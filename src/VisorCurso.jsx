import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  GraduationCap, Plus, Trash2, Upload, UserPlus, Users, FolderPlus,
  CheckSquare, Square, FileSpreadsheet, ArrowUpRight, X, CheckCircle2
} from 'lucide-react';
import { supabase } from './supabaseClient';

function calcularSiguienteNivelYNombre(nivelActualNombre = '', cursoActualNombre = '', listaNiveles = []) {
  const txt = String(nivelActualNombre || '').trim();
  const numMatch = txt.match(/(\d+)/);
  const esBasico = txt.toLowerCase().includes('bás') || txt.toLowerCase().includes('bas');
  const esMedio = txt.toLowerCase().includes('med');

  let siguienteNivelObj = null;
  let esEgresado = false;

  if (esBasico && numMatch) {
    const n = Number(numMatch[1]);
    if (n < 8) {
      siguienteNivelObj = listaNiveles.find((niv) => {
        const t = niv.nombre.toLowerCase();
        return (t.includes('bás') || t.includes('bas')) && t.includes(String(n + 1));
      }) || null;
    } else if (n === 8) {
      siguienteNivelObj = listaNiveles.find((niv) => {
        const t = niv.nombre.toLowerCase();
        return t.includes('med') && (t.includes('1') || t.startsWith('i ') || t.startsWith('i°'));
      }) || null;
    }
  } else if (esMedio) {
    let gradoMed = 0;
    if (txt.includes('4') || txt.toLowerCase().includes('iv')) gradoMed = 4;
    else if (txt.includes('3') || txt.toLowerCase().includes('iii')) gradoMed = 3;
    else if (txt.includes('2') || txt.toLowerCase().includes('ii')) gradoMed = 2;
    else if (txt.includes('1') || txt.toLowerCase().startsWith('i')) gradoMed = 1;

    if (gradoMed >= 4) {
      esEgresado = true;
    } else if (gradoMed > 0) {
      const target = gradoMed + 1;
      siguienteNivelObj = listaNiveles.find((niv) => {
        const t = niv.nombre.toLowerCase();
        if (!t.includes('med')) return false;
        if (target === 2) return t.includes('2') || t.includes('ii');
        if (target === 3) return t.includes('3') || t.includes('iii');
        if (target === 4) return t.includes('4') || t.includes('iv');
        return false;
      }) || null;
    }
  }

  let letraCurso = '';
  const letraMatch = String(cursoActualNombre || '').trim().match(/\s+([A-Za-zÑñ])$/);
  if (letraMatch) {
    letraCurso = ` ${letraMatch[1].toUpperCase()}`;
  }

  const nombreCursoNuevo = siguienteNivelObj
    ? `${siguienteNivelObj.nombre}${letraCurso}`
    : `${cursoActualNombre} (Promovido)`;

  return {
    siguienteNivelObj,
    nombreCursoNuevo,
    esEgresado
  };
}

export default function VisorCurso({
  niveles,
  cursos,
  cursoActivoId,
  setCursoActivoId,
  onRecargarEstructura,
  permisos = {},
  esAdmin = false,
  anioEscolarActivo = 2026,
  onCambiarAnioEscolar
}) {
  const puedeCrearNiveles = esAdmin || Boolean(permisos?.crear_niveles);
  const puedeCrearCursos = esAdmin || Boolean(permisos?.crear_cursos);
  const puedeAgregarEstudiantes = esAdmin || Boolean(permisos?.agregar_estudiantes);
  const puedeEliminarEstudiantes = esAdmin || Boolean(permisos?.eliminar_estudiantes);

  const [estudiantes, setEstudiantes] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [nivelSeleccionado, setNivelSeleccionado] = useState('');
  const [nuevoNivel, setNuevoNivel] = useState('');
  const [nuevoCurso, setNuevoCurso] = useState('');
  const [nuevoRut, setNuevoRut] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');

  // Estados del Asistente de Promoción de Año
  const [modalPromocionAbierto, setModalPromocionAbierto] = useState(false);
  const [anioDestinoPromocion, setAnioDestinoPromocion] = useState(anioEscolarActivo + 1);
  const [planPromocionCursos, setPlanPromocionCursos] = useState([]);
  const [cursoExpandidoPromoId, setCursoExpandidoPromoId] = useState(null);
  const [repitentesIds, setRepitentesIds] = useState(new Set());
  const [cargandoPromo, setCargandoPromo] = useState(false);
  const [ejecutandoPromo, setEjecutandoPromo] = useState(false);

  useEffect(() => {
    setAnioDestinoPromocion(anioEscolarActivo + 1);
  }, [anioEscolarActivo]);

  useEffect(() => {
    if (niveles.length > 0 && (!nivelSeleccionado || !niveles.some((n) => n.id === nivelSeleccionado))) {
      setNivelSeleccionado(niveles[0].id);
    } else if (niveles.length === 0) {
      setNivelSeleccionado('');
    }
  }, [niveles]);

  useEffect(() => {
    setSeleccionados([]);
    if (cursoActivoId) {
      cargarEstudiantesCurso(cursoActivoId);
    } else {
      setEstudiantes([]);
    }
  }, [cursoActivoId]);

  const cargarEstudiantesCurso = async (cursoId) => {
    if (!supabase || !cursoId) return;
    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('curso_id', cursoId)
      .order('nombre');

    if (!error) {
      setEstudiantes(data || []);
    }
  };

  // Abrir asistente de promoción de año
  const abrirAsistentePromocion = async () => {
    if (!supabase) return;
    setModalPromocionAbierto(true);
    setCargandoPromo(true);
    setRepitentesIds(new Set());
    setCursoExpandidoPromoId(null);

    try {
      const idsCursos = cursos.map((c) => c.id);
      let todosEstudiantesAnio = [];
      if (idsCursos.length > 0) {
        const { data } = await supabase
          .from('estudiantes')
          .select('*')
          .in('curso_id', idsCursos)
          .order('nombre');
        todosEstudiantesAnio = data || [];
      }

      const plan = cursos.map((c) => {
        const nivActual = niveles.find((n) => n.id === c.nivel_id);
        const calc = calcularSiguienteNivelYNombre(nivActual?.nombre || '', c.nombre, niveles);
        const alumnosCurso = todosEstudiantesAnio.filter((e) => e.curso_id === c.id);
        return {
          cursoOrigen: c,
          nivelOrigenNombre: nivActual?.nombre || '',
          nivelDestinoId: calc.siguienteNivelObj?.id || c.nivel_id,
          nombreCursoDestino: calc.nombreCursoNuevo,
          esEgresado: calc.esEgresado,
          incluir: true,
          estudiantes: alumnosCurso
        };
      });

      setPlanPromocionCursos(plan);
    } finally {
      setCargandoPromo(false);
    }
  };

  const toggleRepitente = (estId) => {
    setRepitentesIds((prev) => {
      const next = new Set(prev);
      if (next.has(estId)) next.delete(estId);
      else next.add(estId);
      return next;
    });
  };

  const ejecutarPromocionDeAnio = async () => {
    if (!supabase) return;
    const anioNuevo = Number(anioDestinoPromocion);
    if (!anioNuevo || anioNuevo <= anioEscolarActivo) {
      alert('El año escolar destino debe ser mayor al año actual.');
      return;
    }

    if (
      !confirm(
        `¿Confirmas crear la estructura del Año Escolar ${anioNuevo} y promover a los estudiantes seleccionados?\n\nLos datos históricos de ${anioEscolarActivo} permanecerán intactos.`
      )
    ) {
      return;
    }

    setEjecutandoPromo(true);
    try {
      // 1. Registrar el nuevo año escolar
      await supabase
        .from('anios_escolares')
        .upsert([{ anio: anioNuevo, activo: true, cerrado: false }], { onConflict: 'anio' });

      // 2. Consultar cursos ya existentes en el año destino para evitar duplicados
      const { data: cursosExistentesDestino } = await supabase
        .from('cursos')
        .select('*')
        .eq('anio_escolar', anioNuevo);

      const mapaCursosDestino = new Map();
      (cursosExistentesDestino || []).forEach((cd) => {
        mapaCursosDestino.set(`${cd.nivel_id}::${cd.nombre.trim().toLowerCase()}`, cd);
      });

      const obtenerOCrearCursoDestino = async (nivelId, nombreCurso) => {
        const clave = `${nivelId}::${nombreCurso.trim().toLowerCase()}`;
        if (mapaCursosDestino.has(clave)) {
          return mapaCursosDestino.get(clave);
        }
        const { data: creado, error } = await supabase
          .from('cursos')
          .insert([{ nivel_id: nivelId, nombre: nombreCurso.trim(), anio_escolar: anioNuevo }])
          .select()
          .single();

        if (error) throw error;
        mapaCursosDestino.set(clave, creado);
        return creado;
      };

      let totalCursosCreados = 0;
      let totalPromovidos = 0;
      let totalRepitentes = 0;

      // 3. Procesar cada curso del plan
      for (const item of planPromocionCursos) {
        if (!item.incluir) continue;

        const alumnosPromovidos = item.estudiantes.filter((e) => !repitentesIds.has(e.id));
        const alumnosRepitentes = item.estudiantes.filter((e) => repitentesIds.has(e.id));

        // Si no es egresado (IV° Medio), crear curso promovido y trasladar promovidos
        if (!item.esEgresado && item.nivelDestinoId) {
          const cursoDest = await obtenerOCrearCursoDestino(item.nivelDestinoId, item.nombreCursoDestino);
          totalCursosCreados++;

          if (alumnosPromovidos.length > 0) {
            const filas = alumnosPromovidos.map((al) => ({
              curso_id: cursoDest.id,
              rut: al.rut,
              nombre: al.nombre
            }));
            await supabase.from('estudiantes').upsert(filas, { onConflict: 'curso_id,rut' });
            totalPromovidos += alumnosPromovidos.length;
          }
        }

        // Si hay repitentes, asegurar que exista el mismo curso en el nuevo año y matricularlos ahí
        if (alumnosRepitentes.length > 0) {
          const cursoMismoNivel = await obtenerOCrearCursoDestino(
            item.cursoOrigen.nivel_id,
            item.cursoOrigen.nombre
          );
          const filasRep = alumnosRepitentes.map((al) => ({
            curso_id: cursoMismoNivel.id,
            rut: al.rut,
            nombre: al.nombre
          }));
          await supabase.from('estudiantes').upsert(filasRep, { onConflict: 'curso_id,rut' });
          totalRepitentes += alumnosRepitentes.length;
        }
      }

      setModalPromocionAbierto(false);
      alert(
        `✅ Promoción a ${anioNuevo} completada:\n• ${totalCursosCreados} curso(s) habilitado(s)\n• ${totalPromovidos} estudiante(s) promovido(s)\n• ${totalRepitentes} estudiante(s) mantenido(s) en su nivel`
      );

      if (onCambiarAnioEscolar) {
        await onCambiarAnioEscolar(anioNuevo);
      } else {
        onRecargarEstructura();
      }
    } catch (err) {
      alert('Error durante la promoción de año: ' + err.message);
    } finally {
      setEjecutandoPromo(false);
    }
  };

  // Crear Nivel
  const crearNivel = async (e) => {
    e.preventDefault();
    if (!puedeCrearNiveles || !nuevoNivel.trim() || !supabase) return;
    const { data, error } = await supabase
      .from('niveles')
      .insert([{ nombre: nuevoNivel.trim(), orden: niveles.length + 1 }])
      .select()
      .single();

    if (error) {
      alert('Error al crear nivel: ' + error.message);
      return;
    }
    setNuevoNivel('');
    setNivelSeleccionado(data.id);
    onRecargarEstructura();
  };

  // Eliminar Nivel
  const eliminarNivel = async () => {
    if (!puedeCrearNiveles || !nivelSeleccionado || !supabase) return;
    const nivelObj = niveles.find((n) => n.id === nivelSeleccionado);
    const nombreNivel = nivelObj ? nivelObj.nombre : 'este nivel';

    if (!confirm(`¿Eliminar definitivamente el nivel "${nombreNivel}" junto con todos sus cursos y estudiantes asociados?`)) {
      return;
    }

    const cursosDeEsteNivel = cursos.filter((c) => c.nivel_id === nivelSeleccionado).map((c) => c.id);
    const { error } = await supabase.from('niveles').delete().eq('id', nivelSeleccionado);

    if (error) {
      alert('Error al eliminar nivel: ' + error.message);
      return;
    }

    if (cursosDeEsteNivel.includes(cursoActivoId)) {
      setCursoActivoId('');
    }
    setNivelSeleccionado('');
    onRecargarEstructura();
  };

  // Crear Curso en el año escolar activo
  const crearCurso = async (e) => {
    e.preventDefault();
    if (!puedeCrearCursos || !nuevoCurso.trim() || !nivelSeleccionado || !supabase) return;
    const { data, error } = await supabase
      .from('cursos')
      .insert([
        {
          nivel_id: nivelSeleccionado,
          nombre: nuevoCurso.trim(),
          anio_escolar: anioEscolarActivo
        }
      ])
      .select()
      .single();

    if (error) {
      alert('Error al crear curso: ' + error.message);
      return;
    }
    setNuevoCurso('');
    setCursoActivoId(data.id);
    onRecargarEstructura();
  };

  // Eliminar Curso
  const eliminarCurso = async (id) => {
    if (!puedeCrearCursos) return;
    if (!confirm('¿Eliminar este curso completo y todos sus estudiantes?')) return;
    await supabase.from('cursos').delete().eq('id', id);
    if (cursoActivoId === id) setCursoActivoId('');
    onRecargarEstructura();
  };

  // Agregar estudiante individual
  const agregarEstudiante = async (e) => {
    e.preventDefault();
    if (!puedeAgregarEstudiantes || !nuevoRut.trim() || !nuevoNombre.trim() || !cursoActivoId) return;
    const { error } = await supabase
      .from('estudiantes')
      .upsert(
        [{ curso_id: cursoActivoId, rut: nuevoRut.trim(), nombre: nuevoNombre.trim() }],
        { onConflict: 'curso_id,rut' }
      );

    if (error) {
      alert('Error al guardar: ' + error.message);
      return;
    }
    setNuevoRut('');
    setNuevoNombre('');
    cargarEstudiantesCurso(cursoActivoId);
  };

  // Descargar plantilla oficial Excel (.xlsx)
  const descargarPlantillaExcel = () => {
    const datosPlantilla = [
      { RUT: '21.111.111-1', Nombre: 'Ejemplo: Sofía Martínez Rojas' },
      { RUT: '21.222.222-2', Nombre: 'Ejemplo: Mateo González Silva' }
    ];

    const hoja = XLSX.utils.json_to_sheet(datosPlantilla);
    hoja['!cols'] = [{ wch: 18 }, { wch: 40 }];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Nomina_Curso');

    const cursoObj = cursos.find((c) => c.id === cursoActivoId);
    const sufijo = cursoObj ? `_${cursoObj.nombre.replace(/\s+/g, '_')}` : '';
    XLSX.writeFile(libro, `Plantilla_Estudiantes${sufijo}.xlsx`);
  };

  // Subir Excel masivo completado
  const manejarExcel = (e) => {
    const file = e.target.files[0];
    if (!puedeAgregarEstudiantes || !file || !cursoActivoId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          alert('La plantilla está vacía. Completa las filas con RUT y Nombre antes de subirla.');
          return;
        }

        const primeraFila = rows[0];
        const tieneRut = 'RUT' in primeraFila || 'rut' in primeraFila || 'Rut' in primeraFila;
        const tieneNombre = 'Nombre' in primeraFila || 'NOMBRE' in primeraFila || 'nombre' in primeraFila;

        if (!tieneRut || !tieneNombre) {
          alert('Formato inválido. Descarga la plantilla oficial y mantén exactamente los encabezados "RUT" y "Nombre".');
          return;
        }

        const registros = rows
          .map((r) => {
            const rut = String(r.RUT || r.rut || r.Rut || '').trim();
            const nombre = String(r.Nombre || r.NOMBRE || r.nombre || '').trim();
            if (!rut || !nombre || nombre.toLowerCase().startsWith('ejemplo:')) return null;
            return { curso_id: cursoActivoId, rut, nombre };
          })
          .filter(Boolean);

        if (registros.length === 0) {
          alert('No se encontraron estudiantes válidos (revisa que hayas borrado las filas de ejemplo y completado los datos).');
          return;
        }

        const { error } = await supabase
          .from('estudiantes')
          .upsert(registros, { onConflict: 'curso_id,rut' });

        if (error) throw error;
        alert(`✅ ${registros.length} estudiantes cargados correctamente al curso.`);
        cargarEstudiantesCurso(cursoActivoId);
      } catch (err) {
        alert('Error al leer la plantilla Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const toggleSeleccion = (id) => {
    if (!puedeEliminarEstudiantes) return;
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSeleccionarTodos = () => {
    if (!puedeEliminarEstudiantes) return;
    if (seleccionados.length === estudiantes.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(estudiantes.map((e) => e.id));
    }
  };

  const eliminarSeleccionados = async () => {
    if (!puedeEliminarEstudiantes || seleccionados.length === 0) return;
    if (!confirm(`¿Eliminar ${seleccionados.length} estudiante(s) seleccionado(s) de este curso?`)) return;

    const { error } = await supabase
      .from('estudiantes')
      .delete()
      .in('id', seleccionados);

    if (error) {
      alert('Error al eliminar: ' + error.message);
      return;
    }
    setSeleccionados([]);
    cargarEstudiantesCurso(cursoActivoId);
  };

  const cursoObj = cursos.find((c) => c.id === cursoActivoId);
  const nivelObj = cursoObj ? niveles.find((n) => n.id === cursoObj.nivel_id) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {(puedeCrearNiveles || puedeCrearCursos) && (
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GraduationCap size={22} color="#2563eb" />
              Administración de Niveles y Cursos (Año {anioEscolarActivo})
            </h2>

            {puedeCrearCursos && cursos.length > 0 && (
              <button
                type="button"
                onClick={abrirAsistentePromocion}
                style={{
                  background: '#1e3a8a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9px',
                  padding: '9px 14px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ArrowUpRight size={16} />
                Promover Año Escolar ({anioEscolarActivo} → {anioEscolarActivo + 1})
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {puedeCrearNiveles && (
              <form onSubmit={crearNivel} style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>
                  Nuevo Nivel (ej: 1° Medio, 8° Básico)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Nombre del nivel..."
                    value={nuevoNivel}
                    onChange={(e) => setNuevoNivel(e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="submit"
                    style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={16} /> Crear
                  </button>
                </div>
              </form>
            )}

            {puedeCrearCursos && (
              <form onSubmit={crearCurso} style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>
                  Gestionar Nivel / Crear Curso ({anioEscolarActivo})
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <select
                    value={nivelSeleccionado}
                    onChange={(e) => setNivelSeleccionado(e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', minWidth: '130px' }}
                  >
                    <option value="">Seleccionar nivel...</option>
                    {niveles.map((n) => (
                      <option key={n.id} value={n.id}>{n.nombre}</option>
                    ))}
                  </select>

                  {puedeCrearNiveles && nivelSeleccionado && (
                    <button
                      type="button"
                      onClick={eliminarNivel}
                      style={{
                        background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                        borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontWeight: '600',
                        fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                      title="Eliminar este nivel y todos sus cursos"
                    >
                      <Trash2 size={15} /> Eliminar Nivel
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Nuevo curso (ej: 1° Medio A)"
                    value={nuevoCurso}
                    onChange={(e) => setNuevoCurso(e.target.value)}
                    style={{ flex: 1, minWidth: '140px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="submit"
                    style={{ background: '#059669', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <FolderPlus size={16} /> Crear Curso
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Visor de Nómina del Curso Activo */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={22} color="#7c3aed" />
              {cursoObj
                ? `${nivelObj ? nivelObj.nombre + ' — ' : ''}${cursoObj.nombre} (${anioEscolarActivo})`
                : `Selecciona un curso en el menú izquierdo (${anioEscolarActivo})`}
            </h2>
            {cursoObj && (
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                {estudiantes.length} estudiante(s) matriculado(s) en este curso
              </p>
            )}
          </div>

          {cursoObj && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {puedeEliminarEstudiantes && seleccionados.length > 0 && (
                <button
                  onClick={eliminarSeleccionados}
                  style={{
                    background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Trash2 size={16} />
                  Eliminar seleccionados ({seleccionados.length})
                </button>
              )}

              {puedeCrearCursos && (
                <button
                  onClick={() => eliminarCurso(cursoObj.id)}
                  style={{
                    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px',
                    padding: '8px 12px', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
                  }}
                >
                  Eliminar Curso
                </button>
              )}
            </div>
          )}
        </div>

        {!cursoObj ? (
          <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', color: '#64748b', fontSize: '14px' }}>
            Elige un curso desde el menú lateral izquierdo bajo <strong>Mis Cursos ({anioEscolarActivo})</strong> para ver la lista de estudiantes.
          </div>
        ) : (
          <>
            {puedeAgregarEstudiantes && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '13px', color: '#166534' }}>
                  <strong>Carga masiva de curso (3 pasos):</strong>
                  <div style={{ marginTop: '2px' }}>
                    1. Descarga la plantilla oficial &nbsp;→&nbsp; 2. Llena las columnas <strong>RUT</strong> y <strong>Nombre</strong> &nbsp;→&nbsp; 3. Sube el archivo completado.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={descargarPlantillaExcel}
                    style={{
                      background: '#ffffff', color: '#15803d', border: '1px solid #86efac',
                      padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700',
                      fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <FileSpreadsheet size={16} />
                    1. Descargar Plantilla (.xlsx)
                  </button>

                  <label
                    style={{
                      background: '#16a34a', color: 'white', padding: '8px 14px', borderRadius: '8px',
                      cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Upload size={16} />
                    2. Subir Plantilla Llena
                    <input type="file" accept=".xlsx,.xls" onChange={manejarExcel} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            )}

            {puedeAgregarEstudiantes && (
              <form onSubmit={agregarEstudiante} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="RUT (ej: 21.345.678-9)"
                  value={nuevoRut}
                  onChange={(e) => setNuevoRut(e.target.value)}
                  style={{ width: '180px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <input
                  type="text"
                  placeholder="Nombre completo del estudiante"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  style={{ flex: 1, minWidth: '220px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <button
                  type="submit"
                  style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserPlus size={16} /> Agregar Alumno
                </button>
              </form>
            )}

            {estudiantes.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '14px' }}>
                Este curso aún no tiene estudiantes matriculados.
              </div>
            ) : (
              <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                    <tr>
                      {puedeEliminarEstudiantes && (
                        <th style={{ padding: '10px', width: '40px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>
                          <button
                            onClick={toggleSeleccionarTodos}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                            title="Seleccionar todos"
                          >
                            {seleccionados.length === estudiantes.length && estudiantes.length > 0 ? (
                              <CheckSquare size={18} color="#2563eb" />
                            ) : (
                              <Square size={18} color="#64748b" />
                            )}
                          </button>
                        </th>
                      )}
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>N°</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>RUT</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>Nombre Completo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estudiantes.map((est, idx) => {
                      const marcado = seleccionados.includes(est.id);
                      return (
                        <tr
                          key={est.id}
                          onClick={() => toggleSeleccion(est.id)}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: marcado ? '#eff6ff' : '#ffffff',
                            cursor: puedeEliminarEstudiantes ? 'pointer' : 'default'
                          }}
                        >
                          {puedeEliminarEstudiantes && (
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {marcado ? <CheckSquare size={17} color="#2563eb" /> : <Square size={17} color="#94a3b8" />}
                            </td>
                          )}
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{est.rut}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '500' }}>{est.nombre}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL ASISTENTE DE PROMOCIÓN DE AÑO ESCOLAR */}
      {modalPromocionAbierto && (
        <div
          onClick={() => !ejecutandoPromo && setModalPromocionAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '880px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
            }}
          >
            <div style={{ padding: '18px 22px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#1d4ed8', textTransform: 'uppercase' }}>
                  Asistente de Transición Anual
                </div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>
                  Promover Año Escolar ({anioEscolarActivo} → {anioDestinoPromocion})
                </h3>
              </div>

              <button
                type="button"
                disabled={ejecutandoPromo}
                onClick={() => setModalPromocionAbierto(false)}
                style={{ background: '#ffffff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '7px', cursor: 'pointer' }}
              >
                <X size={18} color="#1e3a8a" />
              </button>
            </div>

            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '13px', color: '#334155' }}>
                  Los cursos actuales avanzan automáticamente de nivel (IV° Medio queda como egresado). Si algún estudiante repite, haz clic en <strong>"Marcar repitentes"</strong> en su curso.
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                  <span>Año Destino:</span>
                  <input
                    type="number"
                    min={anioEscolarActivo + 1}
                    max={anioEscolarActivo + 5}
                    value={anioDestinoPromocion}
                    onChange={(e) => setAnioDestinoPromocion(Number(e.target.value))}
                    style={{ width: '80px', padding: '5px 8px', borderRadius: '7px', border: '1px solid #2563eb', fontWeight: '800' }}
                  />
                </label>
              </div>

              {cargandoPromo ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  Cargando cursos y nóminas de {anioEscolarActivo}...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {planPromocionCursos.map((item, idx) => {
                    const repitentesCurso = item.estudiantes.filter((e) => repitentesIds.has(e.id)).length;
                    const promovidosCurso = item.estudiantes.length - repitentesCurso;
                    const expandido = cursoExpandidoPromoId === item.cursoOrigen.id;

                    return (
                      <div key={item.cursoOrigen.id} style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px 14px', background: item.incluir ? '#ffffff' : '#f8fafc', opacity: item.incluir ? 1 : 0.6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '14px', color: '#0f172a', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={item.incluir}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPlanPromocionCursos((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, incluir: checked } : p))
                                );
                              }}
                            />
                            <span>{item.cursoOrigen.nombre} ({anioEscolarActivo})</span>
                          </label>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {item.esEgresado ? (
                              <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '700' }}>
                                Egresan de IV° Medio ({promovidosCurso})
                              </span>
                            ) : (
                              <>
                                <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#16a34a' }}>
                                  → {anioDestinoPromocion}:
                                </span>
                                <input
                                  type="text"
                                  value={item.nombreCursoDestino}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPlanPromocionCursos((prev) =>
                                      prev.map((p, i) => (i === idx ? { ...p, nombreCursoDestino: val } : p))
                                    );
                                  }}
                                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '13px', fontWeight: '700', width: '165px' }}
                                />
                              </>
                            )}

                            {item.estudiantes.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setCursoExpandidoPromoId(expandido ? null : item.cursoOrigen.id)}
                                style={{
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  padding: '4px 9px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  color: '#334155'
                                }}
                              >
                                {expandido ? 'Ocultar alumnos' : `Marcar repitentes (${repitentesCurso}/${item.estudiantes.length})`}
                              </button>
                            )}
                          </div>
                        </div>

                        {expandido && item.estudiantes.length > 0 && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', maxHeight: '190px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px' }}>
                            {item.estudiantes.map((est) => {
                              const esRep = repitentesIds.has(est.id);
                              return (
                                <label
                                  key={est.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                    border: esRep ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                                    background: esRep ? '#fef2f2' : '#f8fafc',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={esRep}
                                    onChange={() => toggleRepitente(est.id)}
                                  />
                                  <span style={{ fontWeight: esRep ? '700' : '500', color: esRep ? '#b91c1c' : '#1e293b' }}>
                                    {est.nombre} {esRep ? '(Repite)' : ''}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 22px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={ejecutandoPromo}
                onClick={() => setModalPromocionAbierto(false)}
                style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '9px 14px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={ejecutandoPromo || cargandoPromo}
                onClick={ejecutarPromocionDeAnio}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9px',
                  padding: '10px 18px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: ejecutandoPromo ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle2 size={16} />
                {ejecutandoPromo ? 'Creando año y promoviendo...' : `Ejecutar Promoción a ${anioDestinoPromocion}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
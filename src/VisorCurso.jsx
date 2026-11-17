import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  GraduationCap, Plus, Trash2, Upload, UserPlus, Users, FolderPlus, CheckSquare, Square, FileSpreadsheet
} from 'lucide-react';
import { supabase } from './supabaseClient';

export default function VisorCurso({
  niveles,
  cursos,
  cursoActivoId,
  setCursoActivoId,
  onRecargarEstructura
}) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [nivelSeleccionado, setNivelSeleccionado] = useState('');
  const [nuevoNivel, setNuevoNivel] = useState('');
  const [nuevoCurso, setNuevoCurso] = useState('');
  const [nuevoRut, setNuevoRut] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');

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

  // Crear Nivel
  const crearNivel = async (e) => {
    e.preventDefault();
    if (!nuevoNivel.trim() || !supabase) return;
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

  // Eliminar Nivel (borra también sus cursos y estudiantes por cascada en BD)
  const eliminarNivel = async () => {
    if (!nivelSeleccionado || !supabase) return;
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

  // Crear Curso
  const crearCurso = async (e) => {
    e.preventDefault();
    if (!nuevoCurso.trim() || !nivelSeleccionado || !supabase) return;
    const { data, error } = await supabase
      .from('cursos')
      .insert([{ nivel_id: nivelSeleccionado, nombre: nuevoCurso.trim() }])
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
    if (!confirm('¿Eliminar este curso completo y todos sus estudiantes?')) return;
    await supabase.from('cursos').delete().eq('id', id);
    if (cursoActivoId === id) setCursoActivoId('');
    onRecargarEstructura();
  };

  // Agregar estudiante individual
  const agregarEstudiante = async (e) => {
    e.preventDefault();
    if (!nuevoRut.trim() || !nuevoNombre.trim() || !cursoActivoId) return;
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
    if (!file || !cursoActivoId) return;

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

  // Selección múltiple de estudiantes
  const toggleSeleccion = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSeleccionarTodos = () => {
    if (seleccionados.length === estudiantes.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(estudiantes.map((e) => e.id));
    }
  };

  // Eliminar varios estudiantes a la vez
  const eliminarSeleccionados = async () => {
    if (seleccionados.length === 0) return;
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
      {/* Panel para Crear/Eliminar Niveles y Cursos */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 14px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GraduationCap size={22} color="#2563eb" />
          Administración de Niveles y Cursos
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Crear Nivel */}
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

          {/* Crear Curso o Eliminar Nivel */}
          <form onSubmit={crearCurso} style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>
              Gestionar Nivel / Crear Curso
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

              {nivelSeleccionado && (
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
        </div>
      </div>

      {/* Visor de Nómina del Curso Activo */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={22} color="#7c3aed" />
              {cursoObj ? `${nivelObj ? nivelObj.nombre + ' — ' : ''}${cursoObj.nombre}` : 'Selecciona un curso en el menú izquierdo'}
            </h2>
            {cursoObj && (
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                {estudiantes.length} estudiante(s) matriculado(s) en este curso
              </p>
            )}
          </div>

          {cursoObj && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {seleccionados.length > 0 && (
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

              <button
                onClick={() => eliminarCurso(cursoObj.id)}
                style={{
                  background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px',
                  padding: '8px 12px', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
                }}
              >
                Eliminar Curso
              </button>
            </div>
          )}
        </div>

        {!cursoObj ? (
          <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', color: '#64748b', fontSize: '14px' }}>
            Elige un curso desde el menú lateral izquierdo bajo <strong>Mis Cursos</strong> para descargar su plantilla, subir la lista y editar estudiantes.
          </div>
        ) : (
          <>
            {/* Flujo guiado de Plantilla Excel */}
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

            {/* Agregar alumno individual */}
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

            {/* Tabla con checkboxes */}
            {estudiantes.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '14px' }}>
                Este curso aún no tiene estudiantes. Usa el botón <strong>1. Descargar Plantilla (.xlsx)</strong> arriba para preparar la nómina.
              </div>
            ) : (
              <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                    <tr>
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
                            cursor: 'pointer'
                          }}
                        >
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {marcado ? <CheckSquare size={17} color="#2563eb" /> : <Square size={17} color="#94a3b8" />}
                          </td>
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
    </div>
  );
}
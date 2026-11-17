import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  GraduationCap, Plus, Trash2, Upload, UserPlus, Users, FolderPlus, CheckCircle2
} from 'lucide-react';
import { supabase } from './supabaseClient';

export default function GestionEscolar({ onActualizarDatos }) {
  const [niveles, setNiveles] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);

  const [nivelSeleccionado, setNivelSeleccionado] = useState('');
  const [cursoSeleccionado, setCursoSeleccionado] = useState('');

  const [nuevoNivel, setNuevoNivel] = useState('');
  const [nuevoCurso, setNuevoCurso] = useState('');
  const [nuevoRut, setNuevoRut] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    if (!supabase) return;
    setCargando(true);
    const [{ data: niv }, { data: cur }, { data: est }] = await Promise.all([
      supabase.from('niveles').select('*').order('orden', { ascending: true }).order('nombre'),
      supabase.from('cursos').select('*').order('nombre'),
      supabase.from('estudiantes').select('*').order('nombre')
    ]);

    const listaNiveles = niv || [];
    const listaCursos = cur || [];
    const listaEstudiantes = est || [];

    setNiveles(listaNiveles);
    setCursos(listaCursos);
    setEstudiantes(listaEstudiantes);

    if (listaNiveles.length > 0 && !nivelSeleccionado) {
      setNivelSeleccionado(listaNiveles[0].id);
    }
    setCargando(false);
    if (onActualizarDatos) onActualizarDatos();
  };

  // --- CREAR / ELIMINAR NIVEL ---
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
    cargarTodo();
  };

  const eliminarNivel = async (id) => {
    if (!confirm('¿Eliminar este nivel y todos sus cursos y estudiantes asociados?')) return;
    await supabase.from('niveles').delete().eq('id', id);
    if (nivelSeleccionado === id) {
      setNivelSeleccionado('');
      setCursoSeleccionado('');
    }
    cargarTodo();
  };

  // --- CREAR / ELIMINAR CURSO ---
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
    setCursoSeleccionado(data.id);
    cargarTodo();
  };

  const eliminarCurso = async (id) => {
    if (!confirm('¿Eliminar este curso y su lista de estudiantes?')) return;
    await supabase.from('cursos').delete().eq('id', id);
    if (cursoSeleccionado === id) setCursoSeleccionado('');
    cargarTodo();
  };

  // --- AGREGAR ESTUDIANTE MANUAL ---
  const agregarEstudianteManual = async (e) => {
    e.preventDefault();
    if (!nuevoRut.trim() || !nuevoNombre.trim() || !cursoSeleccionado) return;
    const { error } = await supabase
      .from('estudiantes')
      .upsert(
        [{ curso_id: cursoSeleccionado, rut: nuevoRut.trim(), nombre: nuevoNombre.trim() }],
        { onConflict: 'curso_id,rut' }
      );

    if (error) {
      alert('Error al guardar estudiante: ' + error.message);
      return;
    }
    setNuevoRut('');
    setNuevoNombre('');
    cargarTodo();
  };

  // --- CARGA MASIVA EXCEL (.xlsx) ---
  const manejarSubidaExcel = (e) => {
    const file = e.target.files[0];
    if (!file || !cursoSeleccionado) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        const registros = rows
          .map((r) => {
            const rut = String(r.RUT || r.rut || r.Rut || '').trim();
            const nombre = String(r.Nombre || r.NOMBRE || r.nombre || r['Nombre Completo'] || '').trim();
            return rut && nombre ? { curso_id: cursoSeleccionado, rut, nombre } : null;
          })
          .filter(Boolean);

        if (registros.length === 0) {
          alert('No se encontraron columnas válidas. Asegúrate de que el Excel tenga encabezados "RUT" y "Nombre".');
          return;
        }

        const { error } = await supabase
          .from('estudiantes')
          .upsert(registros, { onConflict: 'curso_id,rut' });

        if (error) throw error;
        alert(`✅ ${registros.length} estudiantes cargados correctamente al curso.`);
        cargarTodo();
      } catch (err) {
        alert('Error al procesar Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const eliminarEstudiante = async (id) => {
    await supabase.from('estudiantes').delete().eq('id', id);
    cargarTodo();
  };

  const cursosDelNivel = cursos.filter((c) => c.nivel_id === nivelSeleccionado);
  const estudiantesDelCurso = estudiantes.filter((e) => e.curso_id === cursoSeleccionado);
  const cursoActualObj = cursos.find((c) => c.id === cursoSeleccionado);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* BLOQUE SUPERIOR: NIVELES Y CURSOS EN 2 COLUMNAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* COLUMNA 1: NIVELES */}
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <GraduationCap size={20} color="#2563eb" />
            1. Niveles Educativos
          </h3>
          <form onSubmit={crearNivel} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              type="text"
              placeholder="Ej: 1° Medio, 8° Básico..."
              value={nuevoNivel}
              onChange={(e) => setNuevoNivel(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
            <button
              type="submit"
              style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={16} /> Crear
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {niveles.length === 0 && (
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Aún no has creado niveles.</p>
            )}
            {niveles.map((n) => {
              const activo = n.id === nivelSeleccionado;
              const cantCursos = cursos.filter((c) => c.nivel_id === n.id).length;
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    setNivelSeleccionado(n.id);
                    const primerCurso = cursos.find((c) => c.nivel_id === n.id);
                    setCursoSeleccionado(primerCurso ? primerCurso.id : '');
                  }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                    background: activo ? '#dbeafe' : '#ffffff',
                    border: activo ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                    fontWeight: activo ? '700' : '500'
                  }}
                >
                  <span>{n.nombre} <small style={{ color: '#64748b', fontWeight: '400' }}>({cantCursos} cursos)</small></span>
                  <button
                    onClick={(e) => { e.stopPropagation(); eliminarNivel(n.id); }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    title="Eliminar nivel"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMNA 2: CURSOS DEL NIVEL */}
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <FolderPlus size={20} color="#059669" />
            2. Cursos del Nivel
          </h3>
          {!nivelSeleccionado ? (
            <p style={{ color: '#64748b', fontSize: '13px' }}>Selecciona o crea un nivel a la izquierda primero.</p>
          ) : (
            <>
              <form onSubmit={crearCurso} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input
                  type="text"
                  placeholder="Ej: 1° Medio A, 1° Medio B..."
                  value={nuevoCurso}
                  onChange={(e) => setNuevoCurso(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <button
                  type="submit"
                  style={{ background: '#059669', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={16} /> Crear
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {cursosDelNivel.length === 0 && (
                  <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No hay cursos en este nivel.</p>
                )}
                {cursosDelNivel.map((c) => {
                  const activo = c.id === cursoSeleccionado;
                  const cantEst = estudiantes.filter((e) => e.curso_id === c.id).length;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setCursoSeleccionado(c.id)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                        background: activo ? '#d1fae5' : '#ffffff',
                        border: activo ? '1px solid #10b981' : '1px solid #e2e8f0',
                        fontWeight: activo ? '700' : '500'
                      }}
                    >
                      <span>{c.nombre} <small style={{ color: '#64748b', fontWeight: '400' }}>({cantEst} estudiantes)</small></span>
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminarCurso(c.id); }}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        title="Eliminar curso"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* BLOQUE INFERIOR: NÓMINA OFICIAL DE ESTUDIANTES DEL CURSO SELECCIONADO */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <Users size={20} color="#7c3aed" />
            3. Nómina Oficial de Estudiantes {cursoActualObj ? `— ${cursoActualObj.nombre}` : ''}
          </h3>

          {cursoSeleccionado && (
            <label
              style={{
                background: '#2563eb', color: 'white', padding: '8px 14px', borderRadius: '8px',
                cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Upload size={16} />
              Cargar Nómina desde Excel (.xlsx)
              <input type="file" accept=".xlsx,.xls" onChange={manejarSubidaExcel} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {!cursoSeleccionado ? (
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Haz clic sobre un curso arriba para ver, agregar o subir su lista oficial de estudiantes.
          </p>
        ) : (
          <>
            {/* Formulario rápido individual */}
            <form onSubmit={agregarEstudianteManual} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="RUT (ej: 21.456.789-0)"
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

            {/* Tabla de alumnos */}
            {estudiantesDelCurso.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '14px' }}>
                Este curso aún no tiene estudiantes. Sube un archivo Excel con columnas <strong>RUT</strong> y <strong>Nombre</strong> o agrégalos arriba.
              </div>
            ) : (
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>N°</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>RUT</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>Nombre Completo</th>
                      <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estudiantesDelCurso.map((est, idx) => (
                      <tr key={est.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{est.rut}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '500' }}>{est.nombre}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button
                            onClick={() => eliminarEstudiante(est.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            title="Quitar del curso"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
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
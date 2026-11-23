import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Shield, Save, CheckCircle2, XCircle,
  BookOpen, Search, RefreshCw, KeyRound
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { CATEGORIAS_PERMISOS, PERMISOS_RESPALDO } from './permisosConfig';

const ROLES_CONFIG = [
  { id: 'docente', label: 'Docente', color: '#2563eb', bg: '#eff6ff' },
  { id: 'jefe_depto', label: 'Jefe Depto', color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'utp', label: 'UTP', color: '#059669', bg: '#ecfdf5' },
  { id: 'admin', label: 'Admin', color: '#dc2626', bg: '#fef2f2' }
];

export default function GestionUsuarios({ perfilActual, permisosActuales = {}, onPermisosActualizados }) {
  const esAdmin = perfilActual?.rol === 'admin';
  const puedeCrearPerfiles = esAdmin || Boolean(permisosActuales?.crear_perfiles);
  const puedeEditarPerfiles = esAdmin || Boolean(permisosActuales?.editar_perfiles);
  const puedeGestionarPermisos = esAdmin || Boolean(permisosActuales?.gestionar_permisos);

  const [pestana, setPestana] = useState('perfiles'); // 'perfiles' | 'matriz'
  const [perfiles, setPerfiles] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [asignacionesMap, setAsignacionesMap] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  // Formulario nuevo perfil docente
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaAsignatura, setNuevaAsignatura] = useState('Matemática');
  const [nuevoRol, setNuevoRol] = useState('docente');
  const [creandoPerfil, setCreandoPerfil] = useState(false);

  // Modal asignación de cursos a un docente
  const [docenteAsignando, setDocenteAsignando] = useState(null);
  const [cursosSeleccionadosModal, setCursosSeleccionadosModal] = useState(new Set());
  const [guardandoCursos, setGuardandoCursos] = useState(false);

  // Estado de la Matriz de Permisos
  const [matrizPermisos, setMatrizPermisos] = useState({
    docente: { ...PERMISOS_RESPALDO.docente },
    jefe_depto: { ...PERMISOS_RESPALDO.jefe_depto },
    utp: { ...PERMISOS_RESPALDO.utp },
    admin: { ...PERMISOS_RESPALDO.admin }
  });
  const [guardandoMatriz, setGuardandoMatriz] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    if (!supabase) return;
    setCargando(true);
    try {
      const [
        { data: listaPerfiles },
        { data: listaNiveles },
        { data: listaCursos },
        { data: listaAsignaciones },
        { data: listaRolesPerms }
      ] = await Promise.all([
        supabase.from('perfiles').select('*').order('nombre'),
        supabase.from('niveles').select('*').order('orden', { ascending: true }).order('nombre'),
        supabase.from('cursos').select('*').order('nombre'),
        supabase.from('docente_cursos').select('*'),
        supabase.from('roles_permisos').select('*')
      ]);

      setPerfiles(listaPerfiles || []);
      setNiveles(listaNiveles || []);
      setCursos(listaCursos || []);

      const mapaAsig = {};
      (listaAsignaciones || []).forEach((a) => {
        if (!mapaAsig[a.docente_id]) mapaAsig[a.docente_id] = [];
        mapaAsig[a.docente_id].push(a.curso_id);
      });
      setAsignacionesMap(mapaAsig);

      const nuevaMatriz = {
        docente: { ...PERMISOS_RESPALDO.docente },
        jefe_depto: { ...PERMISOS_RESPALDO.jefe_depto },
        utp: { ...PERMISOS_RESPALDO.utp },
        admin: { ...PERMISOS_RESPALDO.admin }
      };

      (listaRolesPerms || []).forEach((row) => {
        if (nuevaMatriz[row.rol] && row.permisos) {
          nuevaMatriz[row.rol] = {
            ...nuevaMatriz[row.rol],
            ...row.permisos
          };
        }
      });

      setMatrizPermisos(nuevaMatriz);
    } finally {
      setCargando(false);
    }
  };

  const crearNuevoPerfil = async (e) => {
    e.preventDefault();
    if (!puedeCrearPerfiles || !nuevoEmail.trim() || !nuevoNombre.trim()) return;

    setCreandoPerfil(true);
    try {
      const emailNorm = nuevoEmail.trim().toLowerCase();
      const { error } = await supabase
        .from('perfiles')
        .upsert(
          [
            {
              email: emailNorm,
              nombre: nuevoNombre.trim(),
              asignatura: nuevaAsignatura.trim() || 'Matemática',
              rol: nuevoRol,
              activo: true
            }
          ],
          { onConflict: 'email' }
        );

      if (error) {
        alert('Error al crear perfil: ' + error.message);
        return;
      }

      setNuevoEmail('');
      setNuevoNombre('');
      await cargarTodo();
      alert(`✅ Perfil docente pre-registrado para ${emailNorm}. Cuando inicie sesión con este correo asumirá automáticamente su rol y cursos asignados.`);
    } finally {
      setCreandoPerfil(false);
    }
  };

  const actualizarCampoPerfil = async (perfilId, campo, valor) => {
    if (!puedeEditarPerfiles || !supabase) return;
    const { error } = await supabase
      .from('perfiles')
      .update({ [campo]: valor })
      .eq('id', perfilId);

    if (error) {
      alert('Error al actualizar perfil: ' + error.message);
      return;
    }

    setPerfiles((prev) =>
      prev.map((p) => (p.id === perfilId ? { ...p, [campo]: valor } : p))
    );
  };

  const abrirModalCursos = (docente) => {
    const actuales = asignacionesMap[docente.id] || [];
    setCursosSeleccionadosModal(new Set(actuales));
    setDocenteAsignando(docente);
  };

  const toggleCursoModal = (cursoId) => {
    setCursosSeleccionadosModal((prev) => {
      const copia = new Set(prev);
      if (copia.has(cursoId)) copia.delete(cursoId);
      else copia.add(cursoId);
      return copia;
    });
  };

  const toggleNivelCompletoModal = (nivelId) => {
    const cursosDelNiv = cursos.filter((c) => c.nivel_id === nivelId).map((c) => c.id);
    if (cursosDelNiv.length === 0) return;

    setCursosSeleccionadosModal((prev) => {
      const copia = new Set(prev);
      const todosSeleccionados = cursosDelNiv.every((id) => copia.has(id));
      if (todosSeleccionados) {
        cursosDelNiv.forEach((id) => copia.delete(id));
      } else {
        cursosDelNiv.forEach((id) => copia.add(id));
      }
      return copia;
    });
  };

  const guardarAsignacionCursos = async () => {
    if (!docenteAsignando || !supabase) return;
    setGuardandoCursos(true);
    try {
      await supabase
        .from('docente_cursos')
        .delete()
        .eq('docente_id', docenteAsignando.id);

      const filas = Array.from(cursosSeleccionadosModal).map((cId) => ({
        docente_id: docenteAsignando.id,
        curso_id: cId
      }));

      if (filas.length > 0) {
        const { error } = await supabase.from('docente_cursos').insert(filas);
        if (error) {
          alert('Error al guardar cursos: ' + error.message);
          return;
        }
      }

      setAsignacionesMap((prev) => ({
        ...prev,
        [docenteAsignando.id]: Array.from(cursosSeleccionadosModal)
      }));
      setDocenteAsignando(null);
      alert('✅ Cursos y niveles asignados correctamente.');
    } finally {
      setGuardandoCursos(false);
    }
  };

  const togglePermisoCelda = (rolId, permisoKey) => {
    if (!puedeGestionarPermisos) return;
    // Evitar bloquear al propio administrador en la gestión de permisos
    if (rolId === 'admin' && permisoKey === 'gestionar_permisos') return;

    setMatrizPermisos((prev) => ({
      ...prev,
      [rolId]: {
        ...prev[rolId],
        [permisoKey]: !prev[rolId]?.[permisoKey]
      }
    }));
  };

  const guardarMatrizPermisos = async () => {
    if (!puedeGestionarPermisos || !supabase) return;
    setGuardandoMatriz(true);
    try {
      const filasUpsert = ROLES_CONFIG.map((r) => ({
        rol: r.id,
        permisos: matrizPermisos[r.id]
      }));

      const { error } = await supabase
        .from('roles_permisos')
        .upsert(filasUpsert, { onConflict: 'rol' });

      if (error) {
        alert('Error al guardar matriz de permisos: ' + error.message);
        return;
      }

      if (onPermisosActualizados) {
        onPermisosActualizados(matrizPermisos);
      }
      alert('✅ Matriz de permisos actualizada en todo el establecimiento.');
    } finally {
      setGuardandoMatriz(false);
    }
  };

  const perfilesFiltrados = perfiles.filter(
    (p) =>
      (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.asignatura || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabecera */}
      <div style={{ background: '#ffffff', padding: '22px 24px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={24} color="#2563eb" />
            Gestión de Docentes y Matriz de Permisos
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#64748b' }}>
            Administra los perfiles del establecimiento, asigna cursos/niveles y configura los permisos por rol.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '5px', borderRadius: '10px' }}>
          <button
            onClick={() => setPestana('perfiles')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: pestana === 'perfiles' ? '#ffffff' : 'transparent',
              color: pestana === 'perfiles' ? '#1e3a8a' : '#475569',
              boxShadow: pestana === 'perfiles' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Users size={16} /> Perfiles y Cursos ({perfiles.length})
          </button>

          {puedeGestionarPermisos && (
            <button
              onClick={() => setPestana('matriz')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: pestana === 'matriz' ? '#ffffff' : 'transparent',
                color: pestana === 'matriz' ? '#1e3a8a' : '#475569',
                boxShadow: pestana === 'matriz' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <KeyRound size={16} /> Matriz de Permisos
            </button>
          )}
        </div>
      </div>

      {/* PESTAÑA 1: PERFILES DOCENTES Y ASIGNACIÓN DE CURSOS */}
      {pestana === 'perfiles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {puedeCrearPerfiles && (
            <form
              onSubmit={crearNuevoPerfil}
              style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} color="#16a34a" /> Crear / Pre-registrar Perfil Docente
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
                <input
                  type="email"
                  required
                  placeholder="Correo institucional (@colegio.cl)"
                  value={nuevoEmail}
                  onChange={(e) => setNuevoEmail(e.target.value)}
                  style={{ padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                />
                <input
                  type="text"
                  required
                  placeholder="Nombre completo docente"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  style={{ padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                />
                <input
                  type="text"
                  placeholder="Asignatura / Depto (Ej: Matemática)"
                  value={nuevaAsignatura}
                  onChange={(e) => setNuevaAsignatura(e.target.value)}
                  style={{ padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                />
                <select
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value)}
                  style={{ padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontWeight: '700' }}
                >
                  <option value="docente">Rol: Docente</option>
                  <option value="jefe_depto">Rol: Jefe de Departamento</option>
                  <option value="utp">Rol: UTP</option>
                  {esAdmin && <option value="admin">Rol: Administrador</option>}
                </select>
                <button
                  type="submit"
                  disabled={creandoPerfil}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 14px',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  {creandoPerfil ? 'Guardando...' : '+ Crear Perfil'}
                </button>
              </div>
            </form>
          )}

          {/* Listado de perfiles */}
          <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                Usuarios Registrados ({perfilesFiltrados.length})
              </h3>
              <div style={{ position: 'relative' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, correo o asignatura..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{ padding: '7px 12px 7px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', minWidth: '250px' }}
                />
              </div>
            </div>

            {cargando ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>Cargando usuarios...</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Docente</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Asignatura / Depto</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Rol</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Cursos / Niveles Asignados</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfilesFiltrados.map((p) => {
                      const idsCursosDoc = asignacionesMap[p.id] || [];
                      const nombresCursos = cursos
                        .filter((c) => idsCursosDoc.includes(c.id))
                        .map((c) => c.nombre);
                      const esCuentaPrincipal = p.email?.toLowerCase().trim() === 'juan.pabloesp97@gmail.com';

                      return (
                        <tr key={p.id || p.email} style={{ borderBottom: '1px solid #f1f5f9', opacity: p.activo === false ? 0.6 : 1 }}>
                          <td style={{ padding: '10px' }}>
                            {puedeEditarPerfiles && !esCuentaPrincipal ? (
                              <input
                                type="text"
                                defaultValue={p.nombre}
                                onBlur={(e) => {
                                  if (e.target.value.trim() && e.target.value !== p.nombre) {
                                    actualizarCampoPerfil(p.id, 'nombre', e.target.value.trim());
                                  }
                                }}
                                style={{ fontWeight: '700', color: '#0f172a', border: '1px solid transparent', borderRadius: '6px', padding: '4px 6px', width: '100%', maxWidth: '210px', background: '#f8fafc' }}
                              />
                            ) : (
                              <div style={{ fontWeight: '700', color: '#0f172a' }}>{p.nombre}</div>
                            )}
                            <div style={{ fontSize: '12px', color: '#64748b', paddingLeft: '6px' }}>{p.email}</div>
                          </td>

                          <td style={{ padding: '10px' }}>
                            {puedeEditarPerfiles ? (
                              <input
                                type="text"
                                defaultValue={p.asignatura || ''}
                                onBlur={(e) => {
                                  if (e.target.value !== (p.asignatura || '')) {
                                    actualizarCampoPerfil(p.id, 'asignatura', e.target.value.trim());
                                  }
                                }}
                                style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '5px 8px', width: '140px', fontSize: '13px' }}
                              />
                            ) : (
                              <span>{p.asignatura || '-'}</span>
                            )}
                          </td>

                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <select
                              disabled={!puedeEditarPerfiles || esCuentaPrincipal}
                              value={p.rol || 'docente'}
                              onChange={(e) => actualizarCampoPerfil(p.id, 'rol', e.target.value)}
                              style={{ padding: '5px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '12.5px' }}
                            >
                              <option value="docente">Docente</option>
                              <option value="jefe_depto">Jefe Depto</option>
                              <option value="utp">UTP</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>

                          <td style={{ padding: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                disabled={!puedeCrearPerfiles && !puedeEditarPerfiles}
                                onClick={() => abrirModalCursos(p)}
                                style={{
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '7px',
                                  padding: '5px 10px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <BookOpen size={14} /> Asignar ({nombresCursos.length})
                              </button>
                              <span style={{ fontSize: '12px', color: '#475569' }}>
                                {nombresCursos.length > 0 ? nombresCursos.join(', ') : 'Sin cursos asignados'}
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {esCuentaPrincipal ? (
                              <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#16a34a' }}>Principal</span>
                            ) : (
                              <button
                                type="button"
                                disabled={!puedeEditarPerfiles}
                                onClick={() => actualizarCampoPerfil(p.id, 'activo', p.activo === false)}
                                style={{
                                  background: p.activo !== false ? '#dcfce7' : '#fee2e2',
                                  color: p.activo !== false ? '#166534' : '#991b1b',
                                  border: 'none',
                                  borderRadius: '999px',
                                  padding: '4px 10px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: puedeEditarPerfiles ? 'pointer' : 'default',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {p.activo !== false ? <><CheckCircle2 size={13} /> Activo</> : <><XCircle size={13} /> Suspendido</>}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: MATRIZ DE PERMISOS POR ROL */}
      {pestana === 'matriz' && puedeGestionarPermisos && (
        <div style={{ background: '#ffffff', padding: '22px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                Matriz de Permisos por Rol Escolar
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Define exactamente qué puede ver, crear, editar, escanear o borrar cada perfil en su aula, departamento o colegio.
              </p>
            </div>

            <button
              type="button"
              onClick={guardarMatrizPermisos}
              disabled={guardandoMatriz}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '11px 18px',
                fontWeight: '800',
                fontSize: '13.5px',
                cursor: guardandoMatriz ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                boxShadow: '0 2px 6px rgba(22,163,74,0.25)'
              }}
            >
              {guardandoMatriz ? <RefreshCw size={16} /> : <Save size={16} />}
              {guardandoMatriz ? 'Guardando...' : 'Guardar Matriz de Permisos'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', minWidth: '320px' }}>Acción / Permiso del Sistema</th>
                  {ROLES_CONFIG.map((r) => (
                    <th key={r.id} style={{ padding: '12px 10px', textAlign: 'center', minWidth: '105px' }}>
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIAS_PERMISOS.map((cat) => (
                  <React.Fragment key={cat.titulo}>
                    <tr style={{ background: '#f1f5f9' }}>
                      <td colSpan={5} style={{ padding: '9px 14px', fontWeight: '800', color: '#1e3a8a', fontSize: '13px', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                        {cat.titulo}
                      </td>
                    </tr>
                    {cat.items.map((item) => (
                      <tr key={item.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', color: '#1e293b', fontWeight: '500' }}>
                          {item.label}
                        </td>
                        {ROLES_CONFIG.map((r) => {
                          const activo = Boolean(matrizPermisos[r.id]?.[item.key]);
                          const bloqueado = r.id === 'admin' && item.key === 'gestionar_permisos';
                          return (
                            <td key={r.id} style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={activo}
                                disabled={bloqueado}
                                onChange={() => togglePermisoCelda(r.id, item.key)}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: bloqueado ? 'not-allowed' : 'pointer',
                                  accentColor: r.color
                                }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL PARA ASIGNAR NIVELES Y CURSOS A UN DOCENTE */}
      {docenteAsignando && (
        <div
          onClick={() => setDocenteAsignando(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden'
            }}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                Asignar Cursos y Niveles
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Docente: <strong>{docenteAsignando.nombre}</strong>
              </p>
            </div>

            <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {niveles.map((niv) => {
                const cursosNiv = cursos.filter((c) => c.nivel_id === niv.id);
                if (cursosNiv.length === 0) return null;
                const todosMarcados = cursosNiv.every((c) => cursosSeleccionadosModal.has(c.id));

                return (
                  <div key={niv.id} style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '14.5px', color: '#0f172a' }}>{niv.nombre}</strong>
                      <button
                        type="button"
                        onClick={() => toggleNivelCompletoModal(niv.id)}
                        style={{
                          background: todosMarcados ? '#dbeafe' : '#ffffff',
                          color: '#1d4ed8',
                          border: '1px solid #93c5fd',
                          borderRadius: '6px',
                          padding: '3px 9px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        {todosMarcados ? 'Desmarcar nivel' : 'Seleccionar nivel completo'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {cursosNiv.map((cur) => {
                        const marcado = cursosSeleccionadosModal.has(cur.id);
                        return (
                          <label
                            key={cur.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: marcado ? '1px solid #2563eb' : '1px solid #cbd5e1',
                              background: marcado ? '#eff6ff' : '#ffffff',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => toggleCursoModal(cur.id)}
                            />
                            {cur.nombre}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '14px 22px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDocenteAsignando(null)}
                style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 14px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarAsignacionCursos}
                disabled={guardandoCursos}
                style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: '700', cursor: 'pointer' }}
              >
                {guardandoCursos ? 'Guardando...' : 'Guardar Asignación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
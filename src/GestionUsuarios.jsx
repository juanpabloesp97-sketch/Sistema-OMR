import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  UserPlus, Users, BookOpen, CheckCircle2, XCircle,
  GraduationCap, RefreshCw, ShieldCheck, Save, RotateCcw,
  KeyRound, Mail, Eye, EyeOff, Copy
} from 'lucide-react';
import { supabase } from './supabaseClient';

const CLAVE_INICIAL_DEFAULT = 'evaluacionesatualcance';

const PERMISOS_DEFAULT = {
  admin: {
    gestionar_usuarios: true,
    configurar_cursos: true,
    ver_todos_cursos: true,
    editar_nominas: true,
    eximir_estudiantes: true,
    crear_evaluaciones: true,
    ver_evals_colegio: true,
    ver_evals_depto: true,
    editar_evals_ajenas: true,
    escanear_hojas: true,
    corregir_manual_propias: true,
    corregir_manual_ajenas: true,
    descargar_reportes: true
  },
  utp: {
    gestionar_usuarios: false,
    configurar_cursos: false,
    ver_todos_cursos: true,
    editar_nominas: false,
    eximir_estudiantes: false,
    crear_evaluaciones: true,
    ver_evals_colegio: true,
    ver_evals_depto: true,
    editar_evals_ajenas: false,
    escanear_hojas: true,
    corregir_manual_propias: true,
    corregir_manual_ajenas: false,
    descargar_reportes: true
  },
  jefe_depto: {
    gestionar_usuarios: false,
    configurar_cursos: false,
    ver_todos_cursos: true,
    editar_nominas: true,
    eximir_estudiantes: true,
    crear_evaluaciones: true,
    ver_evals_colegio: false,
    ver_evals_depto: true,
    editar_evals_ajenas: false,
    escanear_hojas: true,
    corregir_manual_propias: true,
    corregir_manual_ajenas: false,
    descargar_reportes: true
  },
  docente: {
    gestionar_usuarios: false,
    configurar_cursos: false,
    ver_todos_cursos: false,
    editar_nominas: true,
    eximir_estudiantes: true,
    crear_evaluaciones: true,
    ver_evals_colegio: false,
    ver_evals_depto: false,
    editar_evals_ajenas: false,
    escanear_hojas: true,
    corregir_manual_propias: true,
    corregir_manual_ajenas: false,
    descargar_reportes: true
  }
};

const FILAS_PERMISOS = [
  { key: 'gestionar_usuarios', categoria: '1. Cuentas y Permisos', label: 'Crear/suspender cuentas y asignar roles/cursos' },
  { key: 'configurar_cursos', categoria: '2. Estructura y Nóminas', label: 'Crear o eliminar Niveles y Cursos del colegio' },
  { key: 'ver_todos_cursos', categoria: '2. Estructura y Nóminas', label: 'Ver todos los niveles y cursos (no solo los asignados)' },
  { key: 'editar_nominas', categoria: '2. Estructura y Nóminas', label: 'Subir Excel de estudiantes y agregar alumnos a listas' },
  { key: 'eximir_estudiantes', categoria: '2. Estructura y Nóminas', label: 'Eximir / deseximir estudiantes en evaluaciones' },
  { key: 'crear_evaluaciones', categoria: '3. Evaluaciones y Pautas', label: 'Crear evaluaciones propias y compartir/importar pautas' },
  { key: 'ver_evals_colegio', categoria: '3. Evaluaciones y Pautas', label: 'Supervisar evaluaciones de TODO el colegio (todas las asignaturas)' },
  { key: 'ver_evals_depto', categoria: '3. Evaluaciones y Pautas', label: 'Supervisar evaluaciones de su Departamento / Asignatura' },
  { key: 'editar_evals_ajenas', categoria: '3. Evaluaciones y Pautas', label: 'Editar pauta, escala, PDF o eliminar evaluaciones de otros' },
  { key: 'escanear_hojas', categoria: '4. Escaneo y Reportes', label: 'Imprimir hojas y escanear (cámara / PDF) en sus pruebas' },
  { key: 'corregir_manual_propias', categoria: '4. Escaneo y Reportes', label: 'Corregir lectura manual (P1–P30) o borrar escaneos en pruebas propias' },
  { key: 'corregir_manual_ajenas', categoria: '4. Escaneo y Reportes', label: 'Corregir lectura manual (P1–P30) o borrar escaneos en pruebas ajenas' },
  { key: 'descargar_reportes', categoria: '4. Escaneo y Reportes', label: 'Ver gráficos, visor de hoja escaneada y descargar Excel / PDFs' }
];

const ROLES_META = [
  { id: 'admin', label: 'Administrador', color: '#1e3a8a', bg: '#dbeafe' },
  { id: 'utp', label: 'UTP', color: '#6d28d9', bg: '#ede9fe' },
  { id: 'jefe_depto', label: 'Jefe de Depto.', color: '#047857', bg: '#d1fae5' },
  { id: 'docente', label: 'Docente', color: '#334155', bg: '#f1f5f9' }
];

export default function GestionUsuarios({ perfilActual, onPermisosActualizados }) {
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  const [matrizPermisos, setMatrizPermisos] = useState(PERMISOS_DEFAULT);
  const [guardandoPermisos, setGuardandoPermisos] = useState(false);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(CLAVE_INICIAL_DEFAULT);
  const [asignatura, setAsignatura] = useState('Matemática');
  const [rol, setRol] = useState('docente');
  const [creando, setCreando] = useState(false);

  const [clavesVisibles, setClavesVisibles] = useState({});
  const [enviandoResetId, setEnviandoResetId] = useState(null);

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    if (!supabase) return;
    setCargandoLista(true);
    try {
      const { data: users, error: errUsers } = await supabase
        .from('perfiles')
        .select('*');

      if (errUsers) {
        console.error('Error cargando perfiles:', errUsers);
      } else if (users) {
        setListaUsuarios(users);
      }

      const [{ data: niv }, { data: cur }, { data: asig }, { data: permsDB }] = await Promise.all([
        supabase.from('niveles').select('*').order('orden', { ascending: true }),
        supabase.from('cursos').select('*').order('nombre'),
        supabase.from('docente_cursos').select('*'),
        supabase.from('roles_permisos').select('*')
      ]);

      if (niv) setNiveles(niv);
      if (cur) setCursos(cur);
      if (asig) setAsignaciones(asig);

      if (permsDB && permsDB.length > 0) {
        const nuevaMatriz = { ...PERMISOS_DEFAULT };
        permsDB.forEach((row) => {
          if (nuevaMatriz[row.rol]) {
            nuevaMatriz[row.rol] = { ...nuevaMatriz[row.rol], ...(row.permisos || {}) };
          }
        });
        setMatrizPermisos(nuevaMatriz);
      }
    } finally {
      setCargandoLista(false);
    }
  };

  const togglePermiso = (rolId, permisoKey) => {
    if (rolId === 'admin' && permisoKey === 'gestionar_usuarios') return;

    setMatrizPermisos((prev) => ({
      ...prev,
      [rolId]: {
        ...prev[rolId],
        [permisoKey]: !prev[rolId]?.[permisoKey]
      }
    }));
  };

  const guardarMatrizPermisos = async () => {
    if (!supabase) return;
    setGuardandoPermisos(true);
    try {
      const filasUpsert = ROLES_META.map((r) => ({
        rol: r.id,
        nombre_mostrar: r.label,
        permisos: matrizPermisos[r.id] || PERMISOS_DEFAULT[r.id],
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('roles_permisos')
        .upsert(filasUpsert, { onConflict: 'rol' });

      if (error) {
        alert('Error al guardar permisos: ' + error.message);
        return;
      }

      if (onPermisosActualizados) {
        onPermisosActualizados(matrizPermisos);
      }
      alert('✅ Matriz de permisos por rol actualizada en la nube.');
    } finally {
      setGuardandoPermisos(false);
    }
  };

  const restaurarPermisosDefault = () => {
    if (!confirm('¿Restaurar las casillas de los 4 roles a la configuración recomendada inicial?')) return;
    setMatrizPermisos(PERMISOS_DEFAULT);
  };

  const toggleCursoDocente = async (docenteId, cursoId) => {
    const yaAsignado = asignaciones.some(
      (a) => a.docente_id === docenteId && a.curso_id === cursoId
    );

    if (yaAsignado) {
      await supabase
        .from('docente_cursos')
        .delete()
        .eq('docente_id', docenteId)
        .eq('curso_id', cursoId);
    } else {
      await supabase
        .from('docente_cursos')
        .insert([{ docente_id: docenteId, curso_id: cursoId }]);
    }

    const { data: asig } = await supabase.from('docente_cursos').select('*');
    if (asig) setAsignaciones(asig);
  };

  const crearNuevaCuenta = async (e) => {
    e.preventDefault();
    const claveAUsar = password.trim() || CLAVE_INICIAL_DEFAULT;
    if (!nombre.trim() || !email.trim() || claveAUsar.length < 6) {
      alert('Completa todos los campos. La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setCreando(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { data, error } = await tempClient.auth.signUp({
        email: email.trim(),
        password: claveAUsar,
        options: {
          data: {
            nombre: nombre.trim(),
            asignatura: asignatura.trim(),
            rol
          }
        }
      });

      if (error) {
        alert('Error al crear cuenta: ' + error.message);
        return;
      }

      if (data?.user) {
        await supabase.from('perfiles').upsert([
          {
            id: data.user.id,
            email: email.trim(),
            nombre: nombre.trim(),
            asignatura: asignatura.trim(),
            rol,
            activo: true,
            clave_referencia: claveAUsar
          }
        ]);
      }

      alert(`✅ Cuenta creada para ${nombre.trim()}.\nContraseña inicial: ${claveAUsar}`);
      setNombre('');
      setEmail('');
      setPassword(CLAVE_INICIAL_DEFAULT);
      await cargarTodo();
    } catch (err) {
      alert('Error inesperado: ' + err.message);
    } finally {
      setCreando(false);
    }
  };

  const enviarCorreoRestablecer = async (u) => {
    if (!confirm(`¿Enviar correo de restablecimiento de contraseña a ${u.email}?`)) return;
    setEnviandoResetId(u.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(u.email.trim(), {
        redirectTo: window.location.origin
      });

      if (error) {
        alert('No se pudo enviar el correo: ' + error.message);
      } else {
        await supabase
          .from('perfiles')
          .update({ clave_referencia: 'Restablecida por enlace de correo' })
          .eq('id', u.id);
        alert(`✅ Enlace de restablecimiento enviado a ${u.email}. El docente debe revisar su bandeja (o Spam) para definir su nueva contraseña.`);
        cargarTodo();
      }
    } finally {
      setEnviandoResetId(null);
    }
  };

  const copiarTexto = (texto) => {
    navigator.clipboard.writeText(texto);
    alert(`📋 Copiado: ${texto}`);
  };

  const cambiarRolUsuario = async (idUsuario, nuevoRol) => {
    if (idUsuario === perfilActual?.id) return;
    await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', idUsuario);
    cargarTodo();
  };

  const toggleEstadoUsuario = async (u) => {
    if (u.id === perfilActual?.id) return;
    await supabase.from('perfiles').update({ activo: !u.activo }).eq('id', u.id);
    cargarTodo();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. FORMULARIO DE CREACIÓN DE CUENTA */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={22} color="#2563eb" />
          Crear Nueva Cuenta de Usuario
        </h2>
        <p style={{ margin: '0 0 18px 0', fontSize: '13.5px', color: '#64748b' }}>
          Por defecto todas las cuentas nuevas se crean con la contraseña inicial <strong>evaluacionesatualcance</strong>.
        </p>

        <form onSubmit={crearNuevaCuenta} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Nombre Completo</label>
            <input type="text" required placeholder="Ej: María José González" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Correo Institucional</label>
            <input type="email" required placeholder="mgonzalez@colegio.cl" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Contraseña Inicial</label>
            <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: '600', color: '#1e3a8a', background: '#f8fafc' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Asignatura / Departamento</label>
            <input type="text" value={asignatura} onChange={(e) => setAsignatura(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Rol</label>
            <select value={rol} onChange={(e) => setRol(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: '600' }}>
              <option value="docente">Docente</option>
              <option value="jefe_depto">Jefe de Departamento</option>
              <option value="utp">UTP</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" disabled={creando} style={{ width: '100%', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <UserPlus size={17} /> {creando ? 'Creando...' : 'Crear Cuenta'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. LISTA DE USUARIOS, CONTRASEÑAS Y RESTABLECIMIENTO */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={19} color="#0f172a" />
            Usuarios, Contraseñas y Cursos ({listaUsuarios.length})
          </h3>
          <button
            onClick={cargarTodo}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '7px', padding: '6px 10px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <RefreshCw size={14} /> {cargandoLista ? 'Actualizando...' : 'Actualizar lista'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {listaUsuarios.map((u) => {
            const cursosDelDocente = asignaciones
              .filter((a) => a.docente_id === u.id)
              .map((a) => a.curso_id);
            const claveMostrar = u.clave_referencia || CLAVE_INICIAL_DEFAULT;
            const visible = Boolean(clavesVisibles[u.id]);

            return (
              <div key={u.id} style={{ padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: u.activo === false ? '#f8fafc' : '#ffffff', opacity: u.activo === false ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>{u.nombre}</div>
                    <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                      {u.email} • <BookOpen size={12} style={{ verticalAlign: 'middle' }} /> {u.asignatura || 'Matemática'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Visor de contraseña inicial */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 10px', fontSize: '12px' }}>
                      <KeyRound size={13} color="#475569" />
                      <span style={{ color: '#64748b', fontWeight: '600' }}>Clave:</span>
                      <code style={{ fontWeight: '700', color: '#0f172a' }}>
                        {visible ? claveMostrar : '••••••••••••'}
                      </code>
                      <button
                        type="button"
                        onClick={() => setClavesVisibles((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
                        title={visible ? 'Ocultar clave' : 'Ver clave'}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#475569', display: 'flex' }}
                      >
                        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copiarTexto(claveMostrar)}
                        title="Copiar clave"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#2563eb', display: 'flex' }}
                      >
                        <Copy size={13} />
                      </button>
                    </div>

                    {/* Botón enviar correo para restablecer */}
                    <button
                      type="button"
                      onClick={() => enviarCorreoRestablecer(u)}
                      disabled={enviandoResetId === u.id}
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        padding: '5px 10px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: enviandoResetId === u.id ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <Mail size={13} />
                      {enviandoResetId === u.id ? 'Enviando...' : 'Enviar a restablecer'}
                    </button>

                    <select
                      value={u.rol}
                      disabled={u.id === perfilActual?.id}
                      onChange={(e) => cambiarRolUsuario(u.id, e.target.value)}
                      style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '12px' }}
                    >
                      <option value="docente">Docente</option>
                      <option value="jefe_depto">Jefe de Departamento</option>
                      <option value="utp">UTP</option>
                      <option value="admin">Administrador</option>
                    </select>

                    <button
                      onClick={() => toggleEstadoUsuario(u)}
                      disabled={u.id === perfilActual?.id}
                      style={{
                        background: u.activo !== false ? '#dcfce7' : '#fee2e2',
                        color: u.activo !== false ? '#166534' : '#991b1b',
                        border: 'none', borderRadius: '999px', padding: '5px 10px',
                        fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      {u.activo !== false ? <><CheckCircle2 size={13} /> Activo</> : <><XCircle size={13} /> Suspendido</>}
                    </button>
                  </div>
                </div>

                {u.rol === 'admin' ? (
                  <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '600', background: '#eff6ff', padding: '6px 10px', borderRadius: '6px' }}>
                    Acceso completo a todos los niveles y cursos del establecimiento.
                  </div>
                ) : (
                  <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <GraduationCap size={14} /> Cursos de aula asignados directamente:
                    </div>
                    {cursos.length === 0 ? (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Aún no hay cursos creados en Mis Cursos.</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {cursos.map((c) => {
                          const marcado = cursosDelDocente.includes(c.id);
                          const niv = niveles.find((n) => n.id === c.nivel_id);
                          return (
                            <label
                              key={c.id}
                              onClick={() => toggleCursoDocente(u.id, c.id)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '12.5px', fontWeight: '600',
                                border: marcado ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                background: marcado ? '#eff6ff' : '#f8fafc',
                                color: marcado ? '#1d4ed8' : '#475569'
                              }}
                            >
                              <input type="checkbox" checked={marcado} readOnly />
                              {niv ? `${niv.nombre} — ` : ''}{c.nombre}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. MATRIZ EDITABLE DE PERMISOS POR ROL */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a' }}>
              <ShieldCheck size={22} color="#2563eb" />
              Matriz de Atribuciones por Rol (Editable)
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Marca o desmarca las casillas para personalizar qué puede hacer cada perfil en el sistema.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={restaurarPermisosDefault}
              style={{
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <RotateCcw size={14} /> Restaurar Base
            </button>

            <button
              type="button"
              onClick={guardarMatrizPermisos}
              disabled={guardandoPermisos}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: guardandoPermisos ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Save size={15} /> {guardandoPermisos ? 'Guardando...' : 'Guardar Permisos'}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#0f172a' }}>Módulo / Atribución</th>
                {ROLES_META.map((r) => (
                  <th key={r.id} style={{ padding: '10px 8px', textAlign: 'center', minWidth: '115px' }}>
                    <span style={{ background: r.bg, color: r.color, padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '800' }}>
                      {r.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FILAS_PERMISOS.map((fila, idx) => {
                const mostrarCategoria = idx === 0 || FILAS_PERMISOS[idx - 1].categoria !== fila.categoria;
                return (
                  <React.Fragment key={fila.key}>
                    {mostrarCategoria && (
                      <tr style={{ background: '#f1f5f9' }}>
                        <td colSpan={5} style={{ padding: '6px 12px', fontWeight: '800', fontSize: '11.5px', color: '#334155', textTransform: 'uppercase' }}>
                          {fila.categoria}
                        </td>
                      </tr>
                    )}
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 12px', color: '#1e293b', fontWeight: '500' }}>{fila.label}</td>
                      {ROLES_META.map((r) => {
                        const checked = Boolean(matrizPermisos[r.id]?.[fila.key]);
                        const bloqueado = r.id === 'admin' && fila.key === 'gestionar_usuarios';
                        return (
                          <td
                            key={r.id}
                            onClick={() => !bloqueado && togglePermiso(r.id, fila.key)}
                            style={{ padding: '9px 8px', textAlign: 'center', cursor: bloqueado ? 'not-allowed' : 'pointer' }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={bloqueado}
                              onChange={() => {}}
                              style={{ width: '17px', height: '17px', cursor: bloqueado ? 'not-allowed' : 'pointer', accentColor: r.color }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
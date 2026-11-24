import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  UserPlus, Users, BookOpen, CheckCircle2, XCircle,
  GraduationCap, RefreshCw, ShieldCheck, Save, RotateCcw,
  Eye, EyeOff, Copy, KeyRound, Mail
} from 'lucide-react';
import { supabase } from './supabaseClient';
import {
  ROLES_META,
  FILAS_PERMISOS,
  MATRIZ_DEFECTO,
  normalizarMatrizPermisos
} from './permisosConfig';

export default function GestionUsuarios({ perfilActual, onPermisosActualizados }) {
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  const [matrizPermisos, setMatrizPermisos] = useState(() => normalizarMatrizPermisos(MATRIZ_DEFECTO));
  const [guardandoPermisos, setGuardandoPermisos] = useState(false);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [asignatura, setAsignatura] = useState('Matemática');
  const [rol, setRol] = useState('docente');
  const [creando, setCreando] = useState(false);

  const [clavesVisibles, setClavesVisibles] = useState({});
  const [editandoClaveUserId, setEditandoClaveUserId] = useState(null);
  const [nuevaClaveUsuario, setNuevaClaveUsuario] = useState('');
  const [guardandoClaveUserId, setGuardandoClaveUserId] = useState(null);
  const [enviandoResetUserId, setEnviandoResetUserId] = useState(null);

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    if (!supabase) return;
    setCargandoLista(true);
    try {
      const { data: users, error: errUsers } = await supabase
        .from('perfiles')
        .select('*')
        .order('nombre');

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

      if (Array.isArray(permsDB) && permsDB.length > 0) {
        const parcial = {};
        permsDB.forEach((row) => {
          if (row?.rol && row?.permisos) {
            parcial[row.rol] = row.permisos;
          }
        });
        setMatrizPermisos(normalizarMatrizPermisos(parcial));
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
      const normalizada = normalizarMatrizPermisos(matrizPermisos);
      const filasUpsert = ROLES_META.map((r) => ({
        rol: r.id,
        nombre_mostrar: r.label,
        permisos: normalizada[r.id],
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
        onPermisosActualizados(normalizada);
      }
      alert('Matriz de permisos por rol actualizada en la nube.');
    } finally {
      setGuardandoPermisos(false);
    }
  };

  const restaurarPermisosDefault = () => {
    if (!confirm('¿Restaurar las casillas de los 4 roles a la configuración recomendada inicial?')) return;
    setMatrizPermisos(normalizarMatrizPermisos(MATRIZ_DEFECTO));
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
    if (!nombre.trim() || !email.trim() || password.length < 6) {
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
        password,
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
            clave_referencia: password
          }
        ]);
      }

      alert(`Cuenta creada correctamente para ${nombre.trim()}.`);
      setNombre('');
      setEmail('');
      setPassword('');
      await cargarTodo();
    } catch (err) {
      alert('Error inesperado: ' + err.message);
    } finally {
      setCreando(false);
    }
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

  const guardarCambioClaveDirecto = async (u) => {
    const claveLimpia = nuevaClaveUsuario.trim();
    if (claveLimpia.length < 6) {
      alert('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setGuardandoClaveUserId(u.id);
    try {
      const { data, error } = await supabase.functions.invoke('admin-cambiar-clave', {
        body: {
          userId: u.id,
          nuevaPassword: claveLimpia
        }
      });

      if (error || data?.error) {
        alert('No se pudo cambiar la contraseña: ' + (data?.error || error?.message || 'Error desconocido'));
        return;
      }

      alert(`Contraseña actualizada correctamente para ${u.nombre}.`);
      setEditandoClaveUserId(null);
      setNuevaClaveUsuario('');
      setClavesVisibles((prev) => ({ ...prev, [u.id]: true }));
      await cargarTodo();
    } catch (err) {
      alert('Error al conectar con la función de cambio de clave: ' + err.message);
    } finally {
      setGuardandoClaveUserId(null);
    }
  };

  const enviarRestablecerCorreo = async (u) => {
    if (!u?.email) return;
    if (!confirm(`¿Enviar correo de restablecimiento de contraseña a ${u.email}?`)) return;

    setEnviandoResetUserId(u.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(u.email.trim(), {
        redirectTo: window.location.origin
      });

      if (error) {
        alert('Error al enviar correo de restablecimiento: ' + error.message);
      } else {
        alert(`Enlace de restablecimiento enviado a ${u.email}.`);
      }
    } finally {
      setEnviandoResetUserId(null);
    }
  };

  const copiarClave = (texto) => {
    if (!texto) return;
    navigator.clipboard?.writeText(texto);
    alert('Contraseña copiada al portapapeles.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={22} color="#2563eb" />
          Crear Nueva Cuenta de Usuario
        </h2>
        <p style={{ margin: '0 0 18px 0', fontSize: '13.5px', color: '#64748b' }}>
          Crea las cuentas del personal, escribe su contraseña inicial, elige su rol y marca abajo sus cursos de aula.
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
            <input type="text" required minLength={6} placeholder="Escribe una clave (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
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

      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={19} color="#0f172a" />
            Usuarios, Contraseñas y Cursos Asignados ({listaUsuarios.length})
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

            const claveMostrada = u.clave_referencia || '';
            const verClave = Boolean(clavesVisibles[u.id]);
            const estaEditandoClave = editandoClaveUserId === u.id;

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

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    marginBottom: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                        Contraseña registrada:
                      </span>
                      <code
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          color: '#0f172a'
                        }}
                      >
                        {claveMostrada ? (verClave ? claveMostrada : '••••••••••••') : 'No registrada'}
                      </code>

                      {claveMostrada && (
                        <>
                          <button
                            type="button"
                            onClick={() => setClavesVisibles((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
                            title={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              color: '#334155',
                              fontWeight: '600'
                            }}
                          >
                            {verClave ? <EyeOff size={13} /> : <Eye size={13} />}
                            {verClave ? 'Ocultar' : 'Ver'}
                          </button>

                          <button
                            type="button"
                            onClick={() => copiarClave(claveMostrada)}
                            title="Copiar contraseña"
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              color: '#334155',
                              fontWeight: '600'
                            }}
                          >
                            <Copy size={13} /> Copiar
                          </button>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (estaEditandoClave) {
                            setEditandoClaveUserId(null);
                            setNuevaClaveUsuario('');
                          } else {
                            setEditandoClaveUserId(u.id);
                            setNuevaClaveUsuario('');
                          }
                        }}
                        style={{
                          background: '#1e3a8a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '5px 10px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <KeyRound size={13} />
                        {estaEditandoClave ? 'Cancelar' : 'Cambiar contraseña'}
                      </button>

                      <button
                        type="button"
                        disabled={enviandoResetUserId === u.id}
                        onClick={() => enviarRestablecerCorreo(u)}
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #93c5fd',
                          borderRadius: '6px',
                          padding: '5px 10px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: enviandoResetUserId === u.id ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Mail size={13} />
                        {enviandoResetUserId === u.id ? 'Enviando...' : 'Enviar a restablecer'}
                      </button>
                    </div>
                  </div>

                  {estaEditandoClave && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                      <input
                        type="text"
                        minLength={6}
                        value={nuevaClaveUsuario}
                        onChange={(e) => setNuevaClaveUsuario(e.target.value)}
                        placeholder="Escribe nueva contraseña (mín. 6 caracteres)"
                        style={{
                          flex: 1,
                          minWidth: '210px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #93c5fd',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        type="button"
                        disabled={guardandoClaveUserId === u.id}
                        onClick={() => guardarCambioClaveDirecto(u)}
                        style={{
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: guardandoClaveUserId === u.id ? 'wait' : 'pointer'
                        }}
                      >
                        {guardandoClaveUserId === u.id ? 'Guardando...' : 'Guardar nueva clave'}
                      </button>
                    </div>
                  )}
                </div>

                {u.rol === 'admin' ? (
                  <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '600', background: '#eff6ff', padding: '6px 10px', borderRadius: '6px' }}>
                    Acceso completo a todos los niveles y cursos del establecimiento.
                  </div>
                ) : (
                  <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <GraduationCap size={14} /> Cursos de aula asignados directamente (para crear evaluaciones y listas):
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
    </div>
  );
}
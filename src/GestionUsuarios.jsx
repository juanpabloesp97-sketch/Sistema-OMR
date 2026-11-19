import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { UserPlus, Users, BookOpen, CheckCircle2, XCircle, GraduationCap } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function GestionUsuarios({ perfilActual }) {
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]); // [{ docente_id, curso_id }]

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [asignatura, setAsignatura] = useState('Matemática');
  const [rol, setRol] = useState('docente');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    if (!supabase) return;
    const [{ data: users }, { data: niv }, { data: cur }, { data: asig }] = await Promise.all([
      supabase.from('perfiles').select('*').order('created_at', { ascending: true }),
      supabase.from('niveles').select('*').order('orden', { ascending: true }),
      supabase.from('cursos').select('*').order('nombre'),
      supabase.from('docente_cursos').select('*')
    ]);

    if (users) setListaUsuarios(users);
    if (niv) setNiveles(niv);
    if (cur) setCursos(cur);
    if (asig) setAsignaciones(asig);
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
            activo: true
          }
        ]);
      }

      alert(`✅ Cuenta creada correctamente para ${nombre.trim()}.`);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Formulario de creación de cuenta */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={22} color="#2563eb" />
          Crear Nueva Cuenta Docente
        </h2>
        <p style={{ margin: '0 0 18px 0', fontSize: '13.5px', color: '#64748b' }}>
          Crea las cuentas del profesorado y luego marca abajo los cursos que atiende cada uno.
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
            <input type="text" required minLength={6} placeholder="Mín. 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Asignatura</label>
            <input type="text" value={asignatura} onChange={(e) => setAsignatura(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Rol</label>
            <select value={rol} onChange={(e) => setRol(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: '600' }}>
              <option value="docente">Docente</option>
              <option value="admin">Admin / UTP</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" disabled={creando} style={{ width: '100%', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <UserPlus size={17} /> {creando ? 'Creando...' : 'Crear Cuenta'}
            </button>
          </div>
        </form>
      </div>

      {/* Tabla de docentes y asignación de cursos */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={19} color="#0f172a" />
          Docentes y Cursos Asignados ({listaUsuarios.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {listaUsuarios.map((u) => {
            const cursosDelDocente = asignaciones
              .filter((a) => a.docente_id === u.id)
              .map((a) => a.curso_id);

            return (
              <div key={u.id} style={{ padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: u.activo === false ? '#f8fafc' : '#ffffff', opacity: u.activo === false ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>{u.nombre}</div>
                    <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                      {u.email} • <BookOpen size={12} style={{ verticalAlign: 'middle' }} /> {u.asignatura || 'Matemática'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={u.rol}
                      disabled={u.id === perfilActual?.id}
                      onChange={(e) => cambiarRolUsuario(u.id, e.target.value)}
                      style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '12px' }}
                    >
                      <option value="docente">Docente</option>
                      <option value="admin">Admin / UTP (Ve todos los cursos)</option>
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

                {/* Selector de cursos para docentes */}
                {u.rol === 'admin' ? (
                  <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '600', background: '#eff6ff', padding: '6px 10px', borderRadius: '6px' }}>
                    Acceso completo a todos los niveles y cursos del establecimiento.
                  </div>
                ) : (
                  <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <GraduationCap size={14} /> Cursos habilitados para este docente:
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
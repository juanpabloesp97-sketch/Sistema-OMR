import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { UserPlus, Users, Shield, BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function GestionUsuarios({ perfilActual }) {
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [asignatura, setAsignatura] = useState('Matemática');
  const [rol, setRol] = useState('docente');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) setListaUsuarios(data);
  };

  const crearNuevaCuenta = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || password.length < 6) {
      alert('Completa todos los campos. La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setCreando(true);
    try {
      // Cliente temporal sin persistencia para no cerrar la sesión del Administrador actual
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

      alert(`✅ Cuenta creada correctamente para ${nombre.trim()} (${email.trim()}).`);
      setNombre('');
      setEmail('');
      setPassword('');
      await cargarUsuarios();
    } catch (err) {
      alert('Error inesperado: ' + err.message);
    } finally {
      setCreando(false);
    }
  };

  const cambiarRolUsuario = async (idUsuario, nuevoRol) => {
    if (idUsuario === perfilActual?.id) {
      alert('No puedes quitarte el rol de administrador a ti mismo.');
      return;
    }
    const { error } = await supabase
      .from('perfiles')
      .update({ rol: nuevoRol })
      .eq('id', idUsuario);

    if (!error) cargarUsuarios();
  };

  const toggleEstadoUsuario = async (u) => {
    if (u.id === perfilActual?.id) return;
    const { error } = await supabase
      .from('perfiles')
      .update({ activo: !u.activo })
      .eq('id', u.id);
    if (!error) cargarUsuarios();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Formulario de creación de cuenta docente */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={22} color="#2563eb" />
          Crear Nueva Cuenta Docente
        </h2>
        <p style={{ margin: '0 0 18px 0', fontSize: '13.5px', color: '#64748b' }}>
          Solo los administradores pueden habilitar nuevas cuentas. Entrega el correo y contraseña temporal al profesor para su ingreso.
        </p>

        <form onSubmit={crearNuevaCuenta} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Nombre Completo</label>
            <input
              type="text"
              required
              placeholder="Ej: María José González"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Correo Institucional</label>
            <input
              type="email"
              required
              placeholder="mgonzalez@colegio.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Contraseña Inicial (mín. 6)</label>
            <input
              type="text"
              required
              minLength={6}
              placeholder="Ej: Colegio2026"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Asignatura</label>
            <input
              type="text"
              value={asignatura}
              onChange={(e) => setAsignatura(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Rol en Plataforma</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: '600' }}
            >
              <option value="docente">Docente (sus pruebas + compartidas)</option>
              <option value="admin">Administrador / UTP (acceso total)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              disabled={creando}
              style={{
                width: '100%',
                background: creando ? '#94a3b8' : '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 14px',
                fontWeight: '700',
                cursor: creando ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <UserPlus size={17} />
              {creando ? 'Creando...' : 'Crear Cuenta'}
            </button>
          </div>
        </form>
      </div>

      {/* Listado de cuentas registradas */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={19} color="#0f172a" />
          Cuentas Habilitadas en el Establecimiento ({listaUsuarios.length})
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead style={{ background: '#f1f5f9' }}>
              <tr>
                <th style={{ padding: '10px', textAlign: 'left' }}>Docente</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Correo</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Asignatura</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Rol</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {listaUsuarios.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: u.activo === false ? 0.55 : 1 }}>
                  <td style={{ padding: '10px', fontWeight: '700' }}>{u.nombre}</td>
                  <td style={{ padding: '10px', color: '#475569' }}>{u.email}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                      <BookOpen size={14} color="#2563eb" /> {u.asignatura || '-'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <select
                      value={u.rol}
                      disabled={u.id === perfilActual?.id}
                      onChange={(e) => cambiarRolUsuario(u.id, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontWeight: '700',
                        fontSize: '12.5px',
                        background: u.rol === 'admin' ? '#eff6ff' : '#f8fafc',
                        color: u.rol === 'admin' ? '#1d4ed8' : '#334155'
                      }}
                    >
                      <option value="docente">Docente</option>
                      <option value="admin">Admin / UTP</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button
                      onClick={() => toggleEstadoUsuario(u)}
                      disabled={u.id === perfilActual?.id}
                      style={{
                        background: u.activo !== false ? '#dcfce7' : '#fee2e2',
                        color: u.activo !== false ? '#166534' : '#991b1b',
                        border: 'none',
                        borderRadius: '999px',
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: u.id === perfilActual?.id ? 'default' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {u.activo !== false ? <><CheckCircle2 size={13} /> Activo</> : <><XCircle size={13} /> Suspendido</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
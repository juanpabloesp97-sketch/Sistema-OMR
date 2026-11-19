import React, { useState } from 'react';
import { Lock, Mail, LogIn, AlertCircle, CheckSquare } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const iniciarSesion = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setCargando(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        setErrorMsg('Correo o contraseña incorrectos. Si no tienes cuenta, solicítala a Coordinación / UTP.');
      }
    } catch (err) {
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '32px',
          width: '100%',
          maxWidth: '410px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              background: '#eff6ff',
              borderRadius: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}
          >
            <CheckSquare size={28} color="#2563eb" />
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>
            Sistema OMR Escolar
          </h1>
          <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', color: '#64748b' }}>
            Acceso exclusivo para docentes habilitados
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={17} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={iniciarSesion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Correo Institucional
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="email"
                required
                placeholder="docente@colegio.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            style={{
              marginTop: '6px',
              background: cargando ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: cargando ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <LogIn size={18} />
            {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
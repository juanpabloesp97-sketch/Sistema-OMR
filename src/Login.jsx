import React, { useState, useEffect } from 'react';
import { Lock, Mail, LogIn, AlertCircle, CheckSquare, KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [modo, setModo] = useState('login'); // 'login' | 'recuperar' | 'nueva_clave'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [okMsg, setOkMsg] = useState('');

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setModo('nueva_clave');
        setErrorMsg('');
        setOkMsg('');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const iniciarSesion = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setOkMsg('');
    setCargando(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        setErrorMsg('Correo o contraseña incorrectos. Si no tienes cuenta, solicítala a Coordinación / UTP.');
      }
    } catch {
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  const enviarCorreoRecuperacion = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setOkMsg('');
    setCargando(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin
      });

      if (error) {
        setErrorMsg('No se pudo enviar el correo: ' + error.message);
      } else {
        setOkMsg('Te enviamos un enlace a tu correo institucional para restablecer tu contraseña. Revisa también Spam.');
      }
    } catch {
      setErrorMsg('Error al solicitar recuperación.');
    } finally {
      setCargando(false);
    }
  };

  const guardarClaveRecuperada = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (nuevaPassword.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
      if (error) {
        setErrorMsg('Error al actualizar contraseña: ' + error.message);
      } else {
        setOkMsg('¡Contraseña actualizada con éxito! Redirigiendo...');
        setTimeout(() => {
          window.location.href = window.location.origin;
        }, 1200);
      }
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
            {modo === 'login' && 'Acceso exclusivo para docentes habilitados'}
            {modo === 'recuperar' && 'Recuperación de contraseña institucional'}
            {modo === 'nueva_clave' && 'Define tu nueva contraseña personal'}
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

        {okMsg && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              color: '#166534',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
            <span>{okMsg}</span>
          </div>
        )}

        {modo === 'login' && (
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
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setModo('recuperar');
                    setErrorMsg('');
                    setOkMsg('');
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
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
        )}

        {modo === 'recuperar' && (
          <form onSubmit={enviarCorreoRecuperacion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Ingresa tu Correo Institucional
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="email"
                  required
                  placeholder="docente@colegio.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              style={{
                background: cargando ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '14.5px',
                fontWeight: '700',
                cursor: cargando ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <KeyRound size={18} />
              {cargando ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
            </button>

            <button
              type="button"
              onClick={() => {
                setModo('login');
                setErrorMsg('');
                setOkMsg('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={15} /> Volver a iniciar sesión
            </button>
          </form>
        )}

        {modo === 'nueva_clave' && (
          <form onSubmit={guardarClaveRecuperada} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Nueva Contraseña (mínimo 6 caracteres)
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Confirmar Nueva Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {cargando ? 'Guardando...' : 'Guardar Nueva Contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
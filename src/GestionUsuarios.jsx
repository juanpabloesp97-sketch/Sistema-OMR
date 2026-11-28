import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  UserPlus, Users, BookOpen, CheckCircle2, XCircle,
  GraduationCap, RefreshCw, ShieldCheck, Save, RotateCcw,
  Eye, EyeOff, Copy, KeyRound, Mail, Trash2, ChevronDown, X, Building2
} from 'lucide-react';
import { supabase } from './supabaseClient';
import {
  ROLES_META,
  FILAS_PERMISOS,
  MATRIZ_DEFECTO,
  normalizarMatrizPermisos
} from './permisosConfig';
import { TODAS_ASIGNATURAS_ESCRITAS } from './catalogoCurricularMineduc';

function parsearAsignaturas(raw = '') {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function GestionUsuarios({
  perfilActual,
  onPermisosActualizados,
  colegioActual,
  onRecargarColegio
}) {
  const esSuperAdminGlobal =
    perfilActual?.email?.toLowerCase().trim() === 'juan.pabloesp97@gmail.com';

  const [colegiosLista, setColegiosLista] = useState([]);
  const [colegioGestionId, setColegioGestionId] = useState(perfilActual?.colegio_id || 'default');
  const [nuevoColegioId, setNuevoColegioId] = useState('');
  const [nuevoColegioNombre, setNuevoColegioNombre] = useState('');
  const [nuevoColegioMaxUsuarios, setNuevoColegioMaxUsuarios] = useState(30);
  const [creandoColegio, setCreandoColegio] = useState(false);
  const [eliminandoColegio, setEliminandoColegio] = useState(false);

  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  const [matrizPermisos, setMatrizPermisos] = useState(() => normalizarMatrizPermisos(MATRIZ_DEFECTO));
  const [guardandoPermisos, setGuardandoPermisos] = useState(false);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('evaluacionesatualcance');
  const [asignaturasSeleccionadasForm, setAsignaturasSeleccionadasForm] = useState(['Matemática']);
  const [cursosSeleccionadosForm, setCursosSeleccionadosForm] = useState([]);
  const [desplegableAsigFormAbierto, setDesplegableAsigFormAbierto] = useState(false);
  const [desplegableCursosFormAbierto, setDesplegableCursosFormAbierto] = useState(false);
  const [rol, setRol] = useState('docente');
  const [creando, setCreando] = useState(false);

  const [desplegableAsigUserId, setDesplegableAsigUserId] = useState(null);
  const [desplegableCursosUserId, setDesplegableCursosUserId] = useState(null);

  const [clavesVisibles, setClavesVisibles] = useState({});
  const [editandoClaveUserId, setEditandoClaveUserId] = useState(null);
  const [nuevaClaveUsuario, setNuevaClaveUsuario] = useState('');
  const [guardandoClaveUserId, setGuardandoClaveUserId] = useState(null);
  const [enviandoResetUserId, setEnviandoResetUserId] = useState(null);
  const [eliminandoUserId, setEliminandoUserId] = useState(null);

  useEffect(() => {
    setColegioGestionId(perfilActual?.colegio_id || 'default');
  }, [perfilActual?.colegio_id]);

  useEffect(() => {
    cargarTodo(colegioGestionId);
  }, [colegioGestionId]);

  const cargarTodo = async (targetColegioId = colegioGestionId) => {
    if (!supabase) return;
    setCargandoLista(true);
    try {
      if (esSuperAdminGlobal) {
        const { data: cols } = await supabase
          .from('colegios')
          .select('*')
          .order('created_at', { ascending: true });
        if (cols) setColegiosLista(cols);
      }

      const { data: users, error: errUsers } = await supabase
        .from('perfiles')
        .select('*')
        .eq('colegio_id', targetColegioId)
        .order('nombre');

      if (errUsers) {
        console.error('Error cargando perfiles:', errUsers);
      } else if (users) {
        setListaUsuarios(users);
      }

      const [{ data: niv }, { data: cur }, { data: asig }, { data: permsDB }] = await Promise.all([
        supabase.from('niveles').select('*').eq('colegio_id', targetColegioId).order('orden', { ascending: true }),
        supabase.from('cursos').select('*').eq('colegio_id', targetColegioId).order('nombre'),
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

  const colegioObjetivoObj =
    colegiosLista.find((c) => c.id === colegioGestionId) ||
    colegioActual || {
      id: colegioGestionId,
      nombre: 'Establecimiento',
      max_usuarios: 50,
      activo: true
    };

  const maxCupos = Number(colegioObjetivoObj?.max_usuarios || 50);
  const usuariosActivosCount = listaUsuarios.filter((u) => u.activo !== false).length;
  const cupoLleno = !esSuperAdminGlobal && usuariosActivosCount >= maxCupos;

  const crearNuevoColegioCliente = async (e) => {
    e.preventDefault();
    if (!esSuperAdminGlobal || !supabase) return;
    const slug = nuevoColegioId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    if (!slug || !nuevoColegioNombre.trim()) {
      alert('Ingresa un identificador corto (ej: liceo_san_jose) y el nombre del colegio.');
      return;
    }

    setCreandoColegio(true);
    try {
      const { error } = await supabase.from('colegios').insert([
        {
          id: slug,
          nombre: nuevoColegioNombre.trim(),
          plan: 'institucional',
          max_usuarios: Math.max(1, Number(nuevoColegioMaxUsuarios || 30)),
          activo: true
        }
      ]);

      if (error) {
        alert('Error al crear colegio: ' + error.message);
        return;
      }

      await supabase
        .from('anios_escolares')
        .upsert([{ anio: 2026, colegio_id: slug, activo: true, cerrado: false }]);

      alert(`Colegio "${nuevoColegioNombre.trim()}" creado con cupo para ${nuevoColegioMaxUsuarios} usuarios.`);
      setNuevoColegioId('');
      setNuevoColegioNombre('');
      setNuevoColegioMaxUsuarios(30);
      setColegioGestionId(slug);
      await cargarTodo(slug);
    } finally {
      setCreandoColegio(false);
    }
  };

  const actualizarColegioCliente = async (colId, cambios) => {
    if (!esSuperAdminGlobal || !supabase) return;
    const { error } = await supabase.from('colegios').update(cambios).eq('id', colId);
    if (error) {
      alert('Error al actualizar colegio: ' + error.message);
      return;
    }
    await cargarTodo(colegioGestionId);
    if (onRecargarColegio) onRecargarColegio();
  };

  const eliminarColegioCliente = async (colObj) => {
    if (!esSuperAdminGlobal || !colObj || colObj.id === 'default') {
      alert('No se puede eliminar el establecimiento principal (default).');
      return;
    }

    const paso1 = confirm(
      `¿Estás seguro de ELIMINAR definitivamente el establecimiento "${colObj.nombre}" (${colObj.id})?\n\nSe borrarán todos sus cursos, evaluaciones, resultados y cuentas de usuarios.`
    );
    if (!paso1) return;

    const paso2 = confirm(
      `CONFIRMACIÓN FINAL: Esta acción es irreversible y eliminará todos los datos de "${colObj.nombre}". ¿Deseas continuar?`
    );
    if (!paso2) return;

    setEliminandoColegio(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-eliminar-usuario', {
        body: { colegioId: colObj.id }
      });

      if (error || data?.error) {
        alert('No se pudo eliminar el colegio: ' + (data?.error || error?.message || 'Error desconocido'));
        return;
      }

      alert(`Establecimiento "${colObj.nombre}" eliminado correctamente.`);
      const destino = perfilActual?.colegio_id || 'default';
      setColegioGestionId(destino);
      await cargarTodo(destino);
      if (onRecargarColegio) onRecargarColegio();
    } catch (err) {
      alert('Error al conectar con la función de eliminación: ' + err.message);
    } finally {
      setEliminandoColegio(false);
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

  const toggleAsignaturaUsuario = async (usuarioObj, nombreAsig) => {
    const actuales = parsearAsignaturas(usuarioObj.asignatura);
    const existe = actuales.includes(nombreAsig);
    const nuevas = existe
      ? actuales.filter((a) => a !== nombreAsig)
      : [...actuales, nombreAsig];

    const textoFinal = nuevas.length > 0 ? nuevas.join(', ') : 'Matemática';
    await supabase
      .from('perfiles')
      .update({ asignatura: textoFinal })
      .eq('id', usuarioObj.id);

    setListaUsuarios((prev) =>
      prev.map((item) => (item.id === usuarioObj.id ? { ...item, asignatura: textoFinal } : item))
    );
  };

  const toggleAsignaturaForm = (nombreAsig) => {
    setAsignaturasSeleccionadasForm((prev) =>
      prev.includes(nombreAsig) ? prev.filter((a) => a !== nombreAsig) : [...prev, nombreAsig]
    );
  };

  const toggleCursoForm = (cursoId) => {
    setCursosSeleccionadosForm((prev) =>
      prev.includes(cursoId) ? prev.filter((id) => id !== cursoId) : [...prev, cursoId]
    );
  };

  const crearNuevaCuenta = async (e) => {
    e.preventDefault();
    if (cupoLleno) {
      alert(
        `Has alcanzado el límite de ${maxCupos} perfiles activos de tu plan mensual. Suspende una cuenta inactiva o contacta a soporte para ampliar tu plan.`
      );
      return;
    }

    if (!nombre.trim() || !email.trim() || password.length < 6) {
      alert('Completa todos los campos. La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const asignaturaTexto =
      asignaturasSeleccionadasForm.length > 0
        ? asignaturasSeleccionadasForm.join(', ')
        : 'Matemática';

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
            asignatura: asignaturaTexto,
            rol,
            colegio_id: colegioGestionId
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
            asignatura: asignaturaTexto,
            rol,
            colegio_id: colegioGestionId,
            activo: true,
            clave_referencia: password
          }
        ]);

        if (cursosSeleccionadosForm.length > 0) {
          const filasCursos = cursosSeleccionadosForm.map((cId) => ({
            docente_id: data.user.id,
            curso_id: cId
          }));
          await supabase.from('docente_cursos').insert(filasCursos);
        }
      }

      alert(`Cuenta creada correctamente para ${nombre.trim()} en ${colegioObjetivoObj.nombre}.`);
      setNombre('');
      setEmail('');
      setPassword('evaluacionesatualcance');
      setAsignaturasSeleccionadasForm(['Matemática']);
      setCursosSeleccionadosForm([]);
      setDesplegableAsigFormAbierto(false);
      setDesplegableCursosFormAbierto(false);
      await cargarTodo(colegioGestionId);
    } catch (err) {
      alert('Error inesperado: ' + err.message);
    } finally {
      setCreando(false);
    }
  };

  const cambiarRolUsuario = async (idUsuario, nuevoRol) => {
    if (idUsuario === perfilActual?.id) return;
    await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', idUsuario);
    cargarTodo(colegioGestionId);
  };

  const toggleEstadoUsuario = async (u) => {
    if (u.id === perfilActual?.id) return;
    const vaAActivar = u.activo === false;
    if (vaAActivar && !esSuperAdminGlobal && usuariosActivosCount >= maxCupos) {
      alert(
        `No puedes reactivar esta cuenta porque ya tienes ${usuariosActivosCount} de ${maxCupos} cupos activos utilizados en tu plan.`
      );
      return;
    }
    await supabase.from('perfiles').update({ activo: !u.activo }).eq('id', u.id);
    cargarTodo(colegioGestionId);
  };

  const eliminarUsuarioDefinitivo = async (u) => {
    if (u.id === perfilActual?.id) {
      alert('No puedes eliminar tu propia cuenta de Administrador.');
      return;
    }

    const paso1 = confirm(
      `¿Estás seguro de ELIMINAR definitivamente la cuenta de ${u.nombre} (${u.email})?\n\nEsta acción borrará su acceso del sistema y liberará su cupo.`
    );
    if (!paso1) return;

    const paso2 = confirm(
      `CONFIRMACIÓN FINAL: Se eliminará a ${u.nombre} de forma permanente y su correo quedará libre. ¿Continuar?`
    );
    if (!paso2) return;

    setEliminandoUserId(u.id);
    try {
      const { data, error } = await supabase.functions.invoke('admin-eliminar-usuario', {
        body: { userId: u.id }
      });

      if (error || data?.error) {
        alert('No se pudo eliminar el usuario: ' + (data?.error || error?.message || 'Error desconocido'));
        return;
      }

      alert(`Usuario ${u.nombre} eliminado correctamente.`);
      await cargarTodo(colegioGestionId);
    } catch (err) {
      alert('Error al conectar con la función de eliminación: ' + err.message);
    } finally {
      setEliminandoUserId(null);
    }
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
      await cargarTodo(colegioGestionId);
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

  const porcentajeUsoCupos = Math.min(100, Math.round((usuariosActivosCount / Math.max(1, maxCupos)) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* CONSOLA SUPER-ADMIN DE COLEGIOS CLIENTES (SOLO CUENTA MAESTRA) */}
      {esSuperAdminGlobal && (
        <div style={{ background: '#0f172a', color: '#ffffff', padding: '22px 24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#93c5fd', textTransform: 'uppercase' }}>
                Consola Comercial SaaS • Super-Admin
              </div>
              <h2 style={{ margin: '2px 0 0 0', fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={21} color="#60a5fa" />
                Establecimientos Clientes y Cupos Contratados ({colegiosLista.length})
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Administrar colegio:</span>
              <select
                value={colegioGestionId}
                onChange={(e) => setColegioGestionId(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #3b82f6', background: '#1e293b', color: '#ffffff', fontWeight: '700', fontSize: '13px' }}
              >
                {colegiosLista.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.nombre} (Máx. {col.max_usuarios} usuarios)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form onSubmit={crearNuevoColegioCliente} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', background: '#1e293b', padding: '14px', borderRadius: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>ID único (sin espacios)</label>
              <input
                type="text"
                required
                placeholder="ej: colegio_los_andes"
                value={nuevoColegioId}
                onChange={(e) => setNuevoColegioId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '7px', border: '1px solid #475569', background: '#0f172a', color: '#ffffff', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>Nombre del Establecimiento</label>
              <input
                type="text"
                required
                placeholder="Ej: Colegio Los Andes"
                value={nuevoColegioNombre}
                onChange={(e) => setNuevoColegioNombre(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '7px', border: '1px solid #475569', background: '#0f172a', color: '#ffffff', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>Cupo Máx. Perfiles (Plan)</label>
              <input
                type="number"
                min="1"
                max="1000"
                required
                value={nuevoColegioMaxUsuarios}
                onChange={(e) => setNuevoColegioMaxUsuarios(Number(e.target.value))}
                style={{ width: '100%', padding: '8px', borderRadius: '7px', border: '1px solid #475569', background: '#0f172a', color: '#ffffff', boxSizing: 'border-box', fontWeight: '700' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="submit"
                disabled={creandoColegio}
                style={{ width: '100%', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '7px', padding: '9px 12px', fontWeight: '700', cursor: 'pointer' }}
              >
                {creandoColegio ? 'Creando...' : '+ Alta Colegio Cliente'}
              </button>
            </div>
          </form>

          {colegioObjetivoObj && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '13px', background: '#1e293b', padding: '10px 14px', borderRadius: '9px' }}>
              <div>
                Colegio seleccionado: <strong>{colegioObjetivoObj.nombre}</strong> (<code>{colegioObjetivoObj.id}</code>)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Límite perfiles:</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={colegioObjetivoObj.max_usuarios || 30}
                    onChange={(e) =>
                      actualizarColegioCliente(colegioObjetivoObj.id, {
                        max_usuarios: Math.max(1, Number(e.target.value))
                      })
                    }
                    style={{ width: '68px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #60a5fa', background: '#0f172a', color: '#ffffff', fontWeight: '800' }}
                  />
                </label>

                {colegioObjetivoObj.id !== 'default' && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        actualizarColegioCliente(colegioObjetivoObj.id, {
                          activo: colegioObjetivoObj.activo === false
                        })
                      }
                      style={{
                        background: colegioObjetivoObj.activo !== false ? '#16a34a' : '#d97706',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '999px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {colegioObjetivoObj.activo !== false ? 'Suscripción Activa' : 'Suscripción Suspendida'}
                    </button>

                    <button
                      type="button"
                      disabled={eliminandoColegio}
                      onClick={() => eliminarColegioCliente(colegioObjetivoObj)}
                      title="Eliminar colegio cliente y todos sus datos"
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '999px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: eliminandoColegio ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Trash2 size={13} />
                      {eliminandoColegio ? 'Eliminando...' : 'Eliminar Colegio'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INDICADOR DE CUPOS DEL PLAN DEL ESTABLECIMIENTO */}
      <div
        style={{
          background: cupoLleno ? '#fef2f2' : '#ffffff',
          padding: '18px 22px',
          borderRadius: '12px',
          border: cupoLleno ? '1px solid #fca5a5' : '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '14.5px', fontWeight: '800', color: cupoLleno ? '#991b1b' : '#0f172a' }}>
            Plan {colegioObjetivoObj?.nombre}: {usuariosActivosCount} de {maxCupos} perfiles activos utilizados
          </div>
          <span
            style={{
              background: cupoLleno ? '#fee2e2' : '#eff6ff',
              color: cupoLleno ? '#b91c1c' : '#1d4ed8',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '800'
            }}
          >
            {cupoLleno ? 'Límite de plan alcanzado' : `${Math.max(0, maxCupos - usuariosActivosCount)} cupos disponibles`}
          </span>
        </div>

        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${porcentajeUsoCupos}%`,
              height: '100%',
              background: cupoLleno ? '#dc2626' : '#2563eb',
              borderRadius: '999px'
            }}
          />
        </div>

        {cupoLleno && (
          <div style={{ fontSize: '12.5px', color: '#991b1b' }}>
            Has alcanzado el máximo de perfiles contratados en tu suscripción mensual. Suspende o elimina un usuario inactivo para liberar un cupo, o solicita ampliación de plan.
          </div>
        )}
      </div>

      {/* MATRIZ DE ATRIBUCIONES POR ROL */}
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

      {/* CREAR NUEVA CUENTA DE USUARIO */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', opacity: cupoLleno ? 0.65 : 1 }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={22} color="#2563eb" />
          Crear Nueva Cuenta de Usuario ({colegioObjetivoObj?.nombre})
        </h2>
        <p style={{ margin: '0 0 18px 0', fontSize: '13.5px', color: '#64748b' }}>
          Crea las cuentas del personal, define su contraseña inicial, elige su rol y selecciona sus asignaturas y cursos en los desplegables.
        </p>

        <form onSubmit={crearNuevaCuenta} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Nombre Completo</label>
            <input type="text" required disabled={cupoLleno} placeholder="Ej: María José González" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Correo Institucional</label>
            <input type="email" required disabled={cupoLleno} placeholder="mgonzalez@colegio.cl" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Contraseña Inicial</label>
            <input type="text" required disabled={cupoLleno} minLength={6} placeholder="Escribe una clave (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Rol</label>
            <select disabled={cupoLleno} value={rol} onChange={(e) => setRol(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: '600' }}>
              <option value="docente">Docente</option>
              <option value="jefe_depto">Jefe de Departamento</option>
              <option value="utp">UTP</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>
              Asignaturas ({asignaturasSeleccionadasForm.length})
            </label>
            <button
              type="button"
              disabled={cupoLleno}
              onClick={() => {
                setDesplegableAsigFormAbierto((prev) => !prev);
                setDesplegableCursosFormAbierto(false);
              }}
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: '600',
                cursor: cupoLleno ? 'not-allowed' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {asignaturasSeleccionadasForm.length > 0
                  ? asignaturasSeleccionadasForm.join(', ')
                  : 'Seleccionar asignaturas...'}
              </span>
              <ChevronDown size={15} />
            </button>

            {desplegableAsigFormAbierto && !cupoLleno && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid #93c5fd',
                  borderRadius: '10px',
                  padding: '8px',
                  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
                  zIndex: 50,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                {TODAS_ASIGNATURAS_ESCRITAS.map((asig) => {
                  const marcada = asignaturasSeleccionadasForm.includes(asig);
                  return (
                    <label
                      key={asig}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: marcada ? '#eff6ff' : 'transparent',
                        fontSize: '12.5px',
                        fontWeight: marcada ? '700' : '500',
                        color: '#0f172a'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => toggleAsignaturaForm(asig)}
                      />
                      <span>{asig}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>
              Cursos Asignados ({cursosSeleccionadosForm.length})
            </label>
            <button
              type="button"
              disabled={cupoLleno}
              onClick={() => {
                setDesplegableCursosFormAbierto((prev) => !prev);
                setDesplegableAsigFormAbierto(false);
              }}
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: '600',
                cursor: cupoLleno ? 'not-allowed' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cursosSeleccionadosForm.length > 0
                  ? `${cursosSeleccionadosForm.length} curso(s) seleccionado(s)`
                  : 'Seleccionar cursos...'}
              </span>
              <ChevronDown size={15} />
            </button>

            {desplegableCursosFormAbierto && !cupoLleno && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid #93c5fd',
                  borderRadius: '10px',
                  padding: '8px',
                  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
                  zIndex: 50,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                {cursos.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748b', padding: '6px' }}>No hay cursos creados aún en este colegio.</div>
                ) : (
                  cursos.map((c) => {
                    const marcado = cursosSeleccionadosForm.includes(c.id);
                    const niv = niveles.find((n) => n.id === c.nivel_id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: marcado ? '#eff6ff' : 'transparent',
                          fontSize: '12.5px',
                          fontWeight: marcado ? '700' : '500',
                          color: '#0f172a'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => toggleCursoForm(c.id)}
                        />
                        <span>{niv ? `${niv.nombre} — ` : ''}{c.nombre}</span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              disabled={creando || cupoLleno}
              style={{
                width: '100%',
                background: cupoLleno ? '#94a3b8' : '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 14px',
                fontWeight: '700',
                cursor: cupoLleno ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <UserPlus size={17} /> {cupoLleno ? 'Cupo de Plan Completo' : creando ? 'Creando...' : 'Crear Cuenta'}
            </button>
          </div>
        </form>
      </div>

      {/* LISTA DE USUARIOS DEL COLEGIO */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={19} color="#0f172a" />
            Usuarios, Asignaturas y Cursos ({listaUsuarios.length})
          </h3>
          <button
            onClick={() => cargarTodo(colegioGestionId)}
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

            const asignaturasDocente = parsearAsignaturas(u.asignatura);
            const claveMostrada = u.clave_referencia || '';
            const verClave = Boolean(clavesVisibles[u.id]);
            const estaEditandoClave = editandoClaveUserId === u.id;
            const esUsuarioActual = u.id === perfilActual?.id;
            const abiertoDropAsig = desplegableAsigUserId === u.id;
            const abiertoDropCursos = desplegableCursosUserId === u.id;

            return (
              <div key={u.id} style={{ padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: u.activo === false ? '#f8fafc' : '#ffffff', opacity: u.activo === false ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>{u.nombre}</div>
                    <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                      {u.email}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={u.rol}
                      disabled={esUsuarioActual}
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
                      disabled={esUsuarioActual}
                      style={{
                        background: u.activo !== false ? '#dcfce7' : '#fee2e2',
                        color: u.activo !== false ? '#166534' : '#991b1b',
                        border: 'none', borderRadius: '999px', padding: '5px 10px',
                        fontSize: '12px', fontWeight: '700', cursor: esUsuarioActual ? 'not-allowed' : 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      {u.activo !== false ? <><CheckCircle2 size={13} /> Activo</> : <><XCircle size={13} /> Suspendido</>}
                    </button>

                    {!esUsuarioActual && (
                      <button
                        type="button"
                        disabled={eliminandoUserId === u.id}
                        onClick={() => eliminarUsuarioDefinitivo(u)}
                        title="Eliminar cuenta definitivamente"
                        style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '999px',
                          padding: '5px 10px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: eliminandoUserId === u.id ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Trash2 size={13} />
                        {eliminandoUserId === u.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    marginBottom: '12px',
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

                {/* ASIGNACIÓN MULTI-ASIGNATURA Y MULTI-CURSO EN DESPLEGABLES */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <BookOpen size={14} /> Asignaturas asignadas:
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDesplegableAsigUserId(abiertoDropAsig ? null : u.id);
                        setDesplegableCursosUserId(null);
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        color: '#0f172a',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>+ Seleccionar asignaturas ({asignaturasDocente.length})</span>
                      <ChevronDown size={15} />
                    </button>

                    {abiertoDropAsig && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '4px',
                          background: '#ffffff',
                          border: '1px solid #93c5fd',
                          borderRadius: '10px',
                          padding: '8px',
                          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
                          zIndex: 40,
                          maxHeight: '210px',
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        {TODAS_ASIGNATURAS_ESCRITAS.map((asig) => {
                          const marcada = asignaturasDocente.includes(asig);
                          return (
                            <label
                              key={asig}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                background: marcada ? '#eff6ff' : 'transparent',
                                fontSize: '12.5px',
                                fontWeight: marcada ? '700' : '500',
                                color: '#0f172a'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={marcada}
                                onChange={() => toggleAsignaturaUsuario(u, asig)}
                              />
                              <span>{asig}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {asignaturasDocente.map((asig) => (
                        <span
                          key={asig}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#eff6ff',
                            color: '#1e3a8a',
                            border: '1px solid #bfdbfe',
                            borderRadius: '999px',
                            padding: '3px 9px',
                            fontSize: '11.5px',
                            fontWeight: '700'
                          }}
                        >
                          {asig}
                          {asignaturasDocente.length > 1 && (
                            <button
                              type="button"
                              onClick={() => toggleAsignaturaUsuario(u, asig)}
                              style={{ background: 'transparent', border: 'none', color: '#1d4ed8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <GraduationCap size={14} /> Cursos de aula asignados:
                    </div>

                    {u.rol === 'admin' ? (
                      <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '600', background: '#eff6ff', padding: '7px 10px', borderRadius: '8px' }}>
                        Acceso completo a todos los niveles y cursos del establecimiento.
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setDesplegableCursosUserId(abiertoDropCursos ? null : u.id);
                            setDesplegableAsigUserId(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            color: '#0f172a',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span>+ Seleccionar cursos ({cursosDelDocente.length})</span>
                          <ChevronDown size={15} />
                        </button>

                        {abiertoDropCursos && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: '4px',
                              background: '#ffffff',
                              border: '1px solid #93c5fd',
                              borderRadius: '10px',
                              padding: '8px',
                              boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
                              zIndex: 40,
                              maxHeight: '210px',
                              overflowY: 'auto',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}
                          >
                            {cursos.length === 0 ? (
                              <span style={{ fontSize: '12px', color: '#94a3b8', padding: '4px' }}>Aún no hay cursos creados.</span>
                            ) : (
                              cursos.map((c) => {
                                const marcado = cursosDelDocente.includes(c.id);
                                const niv = niveles.find((n) => n.id === c.nivel_id);
                                return (
                                  <label
                                    key={c.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      background: marcado ? '#f0fdf4' : 'transparent',
                                      fontSize: '12.5px',
                                      fontWeight: marcado ? '700' : '500',
                                      color: '#0f172a'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={marcado}
                                      onChange={() => toggleCursoDocente(u.id, c.id)}
                                    />
                                    <span>{niv ? `${niv.nombre} — ` : ''}{c.nombre}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {cursosDelDocente.length === 0 ? (
                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Sin cursos asignados aún.</span>
                          ) : (
                            cursosDelDocente.map((cId) => {
                              const cObj = cursos.find((c) => c.id === cId);
                              if (!cObj) return null;
                              const niv = niveles.find((n) => n.id === cObj.nivel_id);
                              return (
                                <span
                                  key={cId}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    background: '#f0fdf4',
                                    color: '#166534',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '999px',
                                    padding: '3px 9px',
                                    fontSize: '11.5px',
                                    fontWeight: '700'
                                  }}
                                >
                                  {niv ? `${niv.nombre} — ` : ''}{cObj.nombre}
                                  <button
                                    type="button"
                                    onClick={() => toggleCursoDocente(u.id, cId)}
                                    style={{ background: 'transparent', border: 'none', color: '#15803d', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
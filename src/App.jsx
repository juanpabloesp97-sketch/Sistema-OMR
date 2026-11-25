import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  FileDown, User, CheckCircle2, Camera, CheckSquare, Square,
  Cloud, BarChart3, Printer, Clock, AlertCircle, Save, Trash2, UserPlus,
  UserX, UserCheck, Share2, GraduationCap, Users, FolderOpen, ArrowLeft,
  FilePlus2, Filter, Eye, Upload, ShieldAlert, RefreshCw, Search, ArrowRight, X,
  ChevronUp, ChevronDown, Image as ImageIcon
} from 'lucide-react';
import Sidebar from './Sidebar';
import VisorCurso from './VisorCurso';
import PautaEditor from './PautaEditor';
import AnalisisPanel from './AnalisisPanel';
import Login from './Login';
import GestionUsuarios from './GestionUsuarios';
import CamaraOMR from './CamaraOMR';
import { procesarHojaOMR, actualizarAnotacionesImagenOMR } from './omrEngine';
import { convertirPdfAImagenes } from './pdfToImages';
import { procesarLogoBlancoYNegro } from './utils/logoEscuela';
import { supabase } from './supabaseClient';
import {
  MATRIZ_DEFECTO,
  normalizarMatrizPermisos,
  obtenerPermisosRol
} from './permisosConfig';

function obtenerClavesCorrectas(item) {
  if (!item) return [];
  if (typeof item === 'string') return item ? [item] : [];
  if (Array.isArray(item.correcta)) return item.correcta;
  return item.correcta ? [item.correcta] : [];
}

function obtenerPuntajeItem(item) {
  if (typeof item === 'object' && item !== null && item.puntaje !== undefined) {
    return Number(item.puntaje);
  }
  return 1;
}

function BarraProgresoAzul({ visible, titulo = 'Cargando...', porcentaje = 0, detalle = '' }) {
  if (!visible) return null;
  const pct = Math.max(5, Math.min(100, Math.round(porcentaje)));

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #93c5fd',
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: '0 4px 12px rgba(30, 58, 138, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', fontWeight: '700', color: '#1e3a8a' }}>
        <span>{titulo}</span>
        <span>{pct}%</span>
      </div>

      <div style={{ width: '100%', height: '10px', background: '#dbeafe', borderRadius: '999px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: '#1e3a8a',
            borderRadius: '999px',
            transition: 'width 0.25s ease'
          }}
        />
      </div>

      {detalle && (
        <div style={{ fontSize: '12px', color: '#475569' }}>
          {detalle}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [modoRecuperacionClave, setModoRecuperacionClave] = useState(false);
  const [nuevaClave, setNuevaClave] = useState('');
  const [confirmarClave, setConfirmarClave] = useState('');
  const [guardandoClave, setGuardandoClave] = useState(false);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const usuarioCargadoIdRef = useRef(null);
  const ignorarPushHistoryRef = useRef(false);
  const ultimoHashHistoryRef = useRef('');

  const [profesor, setProfesor] = useState({
    id: null,
    nombre: 'Docente',
    asignatura: 'Matemática',
    establecimiento: 'Colegio / Liceo',
    email: '',
    rol: 'docente',
    activo: true
  });
  const [permisosActivos, setPermisosActivos] = useState(() => obtenerPermisosRol(MATRIZ_DEFECTO, 'docente'));

  const [logoEscuela, setLogoEscuela] = useState(() => {
    try {
      return localStorage.getItem('omr_logo_escuela') || null;
    } catch {
      return null;
    }
  });
  const [guardandoLogo, setGuardandoLogo] = useState(false);

  const [vistaActiva, setVistaActiva] = useState('inicio');
  const [nivelActivoId, setNivelActivoId] = useState('');
  const [cursoActivoId, setCursoActivoId] = useState('');
  const [modoResultadosNivel, setModoResultadosNivel] = useState(false);

  const [contextoAperturaEval, setContextoAperturaEval] = useState('curso');
  const [filtroCursoEnNivel, setFiltroCursoEnNivel] = useState('TODOS');

  const [niveles, setNiveles] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [cursosAsignadosAula, setCursosAsignadosAula] = useState(new Set());

  const [evaluacionesVisibles, setEvaluacionesVisibles] = useState([]);
  const [evaluacionesCompartidas, setEvaluacionesCompartidas] = useState([]);

  const [config, setConfig] = useState({
    id: null,
    docenteId: null,
    docenteNombre: '',
    compartida: false,
    cursoId: '',
    nivelId: '',
    tituloPrueba: '',
    asignatura: 'Matemática',
    numPreguntas: 0,
    alternativas: 'ABCD',
    notaMin: 1.0,
    notaMax: 7.0,
    notaAprob: 4.0,
    exigencia: 60,
    pauta: {},
    pdfPruebaUrl: '',
    pdfPruebaNombre: ''
  });

  const [subVistaEval, setSubVistaEval] = useState('avance');
  const [estudiantesCursoEval, setEstudiantesCursoEval] = useState([]);
  const [resultadosCurso, setResultadosCurso] = useState([]);
  const [ordenHojasCorregidas, setOrdenHojasCorregidas] = useState({ col: 'apellido', dir: 'asc' });
  const [escaneosSeleccionados, setEscaneosSeleccionados] = useState([]);
  const [seleccionadosImprimir, setSeleccionadosImprimir] = useState([]);
  const [eximidosRuts, setEximidosRuts] = useState([]);
  const [mostrarPendientesDetalle, setMostrarPendientesDetalle] = useState(true);
  const [cantidadHojasBlancas, setCantidadHojasBlancas] = useState(1);

  const [procesando, setProcesando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [progresoLote, setProgresoLote] = useState('');
  const [camaraAbierta, setCamaraAbierta] = useState(false);

  const [barraVisible, setBarraVisible] = useState(false);
  const [barraTitulo, setBarraTitulo] = useState('');
  const [barraPct, setBarraPct] = useState(0);
  const [barraDetalle, setBarraDetalle] = useState('');

  const [hojasSinQrPendientes, setHojasSinQrPendientes] = useState([]);
  const [indiceHojaSinQr, setIndiceHojaSinQr] = useState(0);
  const [busquedaAlumnoModal, setBusquedaAlumnoModal] = useState('');
  const [rutSeleccionadoModal, setRutSeleccionadoModal] = useState('');
  const [asignandoHoja, setAsignandoHoja] = useState(false);

  const [mostrarFormNuevoAlumnoModal, setMostrarFormNuevoAlumnoModal] = useState(false);
  const [nuevoRutModal, setNuevoRutModal] = useState('');
  const [nuevoNombreModal, setNuevoNombreModal] = useState('');
  const [cursoIdNuevoAlumnoModal, setCursoIdNuevoAlumnoModal] = useState('');
  const [creandoAlumnoYAsignando, setCreandoAlumnoYAsignando] = useState(false);

  const [rutExtra, setRutExtra] = useState('');
  const [nombreExtra, setNombreExtra] = useState('');

  const actualizarBarra = (visible, titulo = '', porcentaje = 0, detalle = '') => {
    setBarraVisible(visible);
    setBarraTitulo(titulo);
    setBarraPct(porcentaje);
    setBarraDetalle(detalle);
  };

  const cargarLogoInstitucionalNube = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('configuracion_institucional')
        .select('logo_url')
        .eq('id', 'default')
        .maybeSingle();

      if (!error && data) {
        const urlNube = data.logo_url || null;
        setLogoEscuela(urlNube);
        if (urlNube) {
          localStorage.setItem('omr_logo_escuela', urlNube);
        } else {
          localStorage.removeItem('omr_logo_escuela');
        }
      }
    } catch (err) {
      console.warn('No se pudo sincronizar logo institucional:', err);
    }
  };

  const manejarSubidaLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGuardandoLogo(true);
    try {
      const dataUrlBN = await procesarLogoBlancoYNegro(file);

      if (supabase) {
        const { error } = await supabase
          .from('configuracion_institucional')
          .upsert([{ id: 'default', logo_url: dataUrlBN, updated_at: new Date().toISOString() }]);

        if (error) {
          alert('Error al guardar el logo en la nube: ' + error.message);
          return;
        }
      }

      setLogoEscuela(dataUrlBN);
      localStorage.setItem('omr_logo_escuela', dataUrlBN);
      alert('Logo institucional actualizado para todos los docentes de la escuela.');
    } catch {
      alert('No se pudo procesar el logo. Intenta con una imagen PNG o JPG.');
    } finally {
      setGuardandoLogo(false);
      e.target.value = '';
    }
  };

  const eliminarLogoEscuela = async () => {
    if (!confirm('¿Quitar el logo institucional para todos los docentes de la escuela?')) return;
    setGuardandoLogo(true);
    try {
      if (supabase) {
        const { error } = await supabase
          .from('configuracion_institucional')
          .upsert([{ id: 'default', logo_url: null, updated_at: new Date().toISOString() }]);

        if (error) {
          alert('Error al quitar el logo en la nube: ' + error.message);
          return;
        }
      }

      setLogoEscuela(null);
      localStorage.removeItem('omr_logo_escuela');
    } finally {
      setGuardandoLogo(false);
    }
  };

  const alternarOrdenHojasCorregidas = (col) => {
    setOrdenHojasCorregidas((prev) => ({
      col,
      dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const calcularNotaConEscala = (puntaje, total, cfg = config) => {
    const nMin = Number(cfg.notaMin ?? 1.0);
    const nMax = Number(cfg.notaMax ?? 7.0);
    const nAprob = Number(cfg.notaAprob ?? 4.0);
    const exig = Number(cfg.exigencia ?? 60);

    if (total <= 0) return nMin;
    const p = Math.max(0, Math.min(Number(puntaje), Number(total)));
    const pAprob = Number(total) * (exig / 100);

    let nota = nMin;
    if (p < pAprob) {
      nota = pAprob > 0 ? nMin + ((nAprob - nMin) * p) / pAprob : nMin;
    } else {
      const tramoSuperior = Number(total) - pAprob;
      nota = tramoSuperior > 0
        ? nAprob + ((nMax - nAprob) * (p - pAprob)) / tramoSuperior
        : nMax;
    }

    const redondeada = Math.round((nota + Number.EPSILON) * 10) / 10;
    return Math.min(nMax, Math.max(nMin, redondeada));
  };

  const evaluarRespuestasConPauta = (respuestasMap, cfg = config) => {
    const totalPreg = Number(cfg.numPreguntas || 0);
    const pautaActual = cfg.pauta || {};
    let puntosObtenidos = 0;
    let puntosTotales = 0;

    for (let i = 1; i <= totalPreg; i++) {
      const item = pautaActual[i];
      const tipo = typeof item === 'object' && item !== null && item.tipo ? item.tipo : 'alternativa';
      const puntajeItem = obtenerPuntajeItem(item);
      if (puntajeItem <= 0) continue;

      if (tipo === 'completacion' || tipo === 'desarrollo') {
        puntosTotales += puntajeItem;
        const evalIa = respuestasMap?._ia?.[i];
        if (evalIa && evalIa.puntajeFinal !== undefined && evalIa.puntajeFinal !== null) {
          puntosObtenidos += Math.max(0, Math.min(puntajeItem, Number(evalIa.puntajeFinal)));
        } else if (evalIa && evalIa.puntajeSugerido !== undefined && evalIa.puntajeSugerido !== null) {
          puntosObtenidos += Math.max(0, Math.min(puntajeItem, Number(evalIa.puntajeSugerido)));
        }
      } else {
        const clavesValidas = obtenerClavesCorrectas(item);
        if (clavesValidas.length > 0) {
          puntosTotales += puntajeItem;
          if (clavesValidas.includes(respuestasMap[i])) {
            puntosObtenidos += puntajeItem;
          }
        }
      }
    }

    if (puntosTotales === 0 && totalPreg > 0) {
      const todasAnuladas = Array.from({ length: totalPreg }, (_, idx) => obtenerPuntajeItem(pautaActual[idx + 1]) === 0).every(Boolean);
      if (!todasAnuladas) puntosTotales = totalPreg;
    }

    const porcentaje = puntosTotales > 0 ? Math.round((puntosObtenidos / puntosTotales) * 100) : 0;
    const nota = calcularNotaConEscala(puntosObtenidos, puntosTotales, cfg);

    return { puntosObtenidos, puntosTotales, porcentaje, nota };
  };

  const esEvaluacionDeSuAula = (
    ev,
    perfilUsuario = profesor,
    idsCursosProfe = cursosAsignadosAula,
    listaCursos = cursos
  ) => {
    if (!ev) return true;
    if (ev.docente_id === perfilUsuario?.id) return true;

    if (ev.curso_id && idsCursosProfe.has(ev.curso_id)) return true;

    if (!ev.curso_id && ev.nivel_id) {
      const tieneCursoEnNivel = listaCursos.some(
        (c) => c.nivel_id === ev.nivel_id && idsCursosProfe.has(c.id)
      );
      if (tieneCursoEnNivel) return true;
    }

    return false;
  };

  useEffect(() => {
    if (!profesor?.id) return;

    const estadoNav = {
      vistaActiva,
      nivelActivoId,
      cursoActivoId,
      evalId: config.id || '',
      subVistaEval,
      contextoAperturaEval,
      filtroCursoEnNivel
    };

    localStorage.setItem(`omr_nav_estado_${profesor.id}`, JSON.stringify(estadoNav));

    const hashActual = JSON.stringify({
      v: vistaActiva,
      n: nivelActivoId,
      c: cursoActivoId,
      e: config.id || '',
      s: subVistaEval
    });

    if (ignorarPushHistoryRef.current) {
      ignorarPushHistoryRef.current = false;
      ultimoHashHistoryRef.current = hashActual;
      return;
    }

    if (ultimoHashHistoryRef.current !== hashActual) {
      if (!ultimoHashHistoryRef.current) {
        window.history.replaceState(estadoNav, '');
      } else {
        window.history.pushState(estadoNav, '');
      }
      ultimoHashHistoryRef.current = hashActual;
    }
  }, [profesor?.id, vistaActiva, nivelActivoId, cursoActivoId, config.id, subVistaEval, contextoAperturaEval, filtroCursoEnNivel]);

  useEffect(() => {
    const manejarPopState = (event) => {
      const nav = event.state;
      if (!nav || !nav.vistaActiva) return;

      ignorarPushHistoryRef.current = true;

      if (nav.nivelActivoId !== undefined) setNivelActivoId(nav.nivelActivoId);
      if (nav.cursoActivoId !== undefined) setCursoActivoId(nav.cursoActivoId);
      if (nav.contextoAperturaEval) setContextoAperturaEval(nav.contextoAperturaEval);
      if (nav.filtroCursoEnNivel) setFiltroCursoEnNivel(nav.filtroCursoEnNivel);

      if (nav.vistaActiva === 'detalle-evaluacion' && nav.evalId) {
        const evEncontrada = evaluacionesVisibles.find((e) => String(e.id) === String(nav.evalId));
        if (evEncontrada) {
          abrirEvaluacion(evEncontrada, nav.cursoActivoId || '', nav.contextoAperturaEval || 'curso');
          if (nav.subVistaEval) setSubVistaEval(nav.subVistaEval);
          return;
        }
      }

      if (nav.subVistaEval) setSubVistaEval(nav.subVistaEval);
      setVistaActiva(nav.vistaActiva);
    };

    window.addEventListener('popstate', manejarPopState);
    return () => window.removeEventListener('popstate', manejarPopState);
  }, [evaluacionesVisibles, profesor, permisosActivos, cursosAsignadosAula, cursos]);

  useEffect(() => {
    if (!supabase) {
      setCargandoSesion(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session);
      if (window.location.hash && window.location.hash.includes('type=recovery')) {
        setModoRecuperacionClave(true);
      }
      if (session?.user) {
        if (usuarioCargadoIdRef.current !== session.user.id) {
          usuarioCargadoIdRef.current = session.user.id;
          cargarPerfilUsuario(session.user);
        }
      } else {
        setCargandoSesion(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSesion(session);

      if (!session?.user) {
        usuarioCargadoIdRef.current = null;
        setCargandoSesion(false);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setModoRecuperacionClave(true);
      }

      if (event === 'TOKEN_REFRESHED') return;
      if (usuarioCargadoIdRef.current === session.user.id) {
        setCargandoSesion(false);
        return;
      }

      usuarioCargadoIdRef.current = session.user.id;
      cargarPerfilUsuario(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const cargarPermisosDeRol = async (rolUsuario) => {
    let matrizActual = normalizarMatrizPermisos(MATRIZ_DEFECTO);
    if (supabase) {
      const { data } = await supabase
        .from('roles_permisos')
        .select('rol, permisos');
      if (Array.isArray(data) && data.length > 0) {
        const parcial = {};
        data.forEach((fila) => {
          if (fila?.rol && fila?.permisos) {
            parcial[fila.rol] = fila.permisos;
          }
        });
        matrizActual = normalizarMatrizPermisos(parcial);
      }
    }
    const finalPerms = obtenerPermisosRol(matrizActual, rolUsuario);
    setPermisosActivos(finalPerms);
    return finalPerms;
  };

  const cargarPerfilUsuario = async (user) => {
    actualizarBarra(true, 'Cargando perfil y datos...', 20, 'Verificando cuenta...');
    try {
      let { data: perfilDB } = await supabase
        .from('perfiles')
        .select('*')
        .or(`id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      const esAdminPrincipal = user.email?.toLowerCase().trim() === 'juan.pabloesp97@gmail.com';

      if (!perfilDB) {
        const nuevoPerfil = {
          id: user.id,
          email: user.email,
          nombre: esAdminPrincipal ? 'Juan Pablo Esparza' : (user.user_metadata?.nombre || user.email.split('@')[0]),
          asignatura: user.user_metadata?.asignatura || 'Matemática',
          rol: esAdminPrincipal ? 'admin' : 'docente',
          activo: true
        };
        await supabase.from('perfiles').upsert([nuevoPerfil]);
        perfilDB = nuevoPerfil;
      }

      const rolFinal = esAdminPrincipal ? 'admin' : (perfilDB?.rol || 'docente');

      const perfilFinal = {
        id: user.id,
        email: user.email,
        nombre: perfilDB?.nombre || (esAdminPrincipal ? 'Juan Pablo Esparza' : user.email.split('@')[0]),
        asignatura: perfilDB?.asignatura || 'Matemática',
        establecimiento: localStorage.getItem('omr_establecimiento') || 'Colegio / Liceo',
        rol: rolFinal,
        activo: perfilDB?.activo !== false
      };

      if (!perfilFinal.activo) {
        alert('Tu cuenta ha sido suspendida por el administrador del establecimiento.');
        usuarioCargadoIdRef.current = null;
        await supabase.auth.signOut();
        setCargandoSesion(false);
        return;
      }

      setProfesor(perfilFinal);
      const permsUsuario = await cargarPermisosDeRol(rolFinal);
      await cargarLogoInstitucionalNube();
      actualizarBarra(true, 'Cargando estructura escolar...', 55, 'Niveles y cursos...');

      setConfig((prev) => ({
        ...prev,
        docenteId: perfilFinal.id,
        docenteNombre: perfilFinal.nombre,
        asignatura: perfilFinal.asignatura || 'Matemática'
      }));
      setCargandoSesion(false);

      const { nivelesVisibles, cursosVisibles, idsAula } = await cargarEstructuraEscolar(perfilFinal, permsUsuario);
      actualizarBarra(true, 'Cargando evaluaciones...', 85, 'Sincronizando panel...');
      const { visibles } = await cargarEvaluacionesNube(perfilFinal, permsUsuario, idsAula, cursosVisibles);

      let restaurado = false;
      try {
        const guardadoRaw = localStorage.getItem(`omr_nav_estado_${user.id}`);
        if (guardadoRaw) {
          const nav = JSON.parse(guardadoRaw);
          if (nav.nivelActivoId && nivelesVisibles.some((n) => n.id === nav.nivelActivoId)) {
            setNivelActivoId(nav.nivelActivoId);
          } else if (nivelesVisibles.length > 0) {
            setNivelActivoId(nivelesVisibles[0].id);
          }

          if (nav.cursoActivoId && cursosVisibles.some((c) => c.id === nav.cursoActivoId)) {
            setCursoActivoId(nav.cursoActivoId);
          }

          if (nav.vistaActiva === 'detalle-evaluacion' && nav.evalId) {
            const evEncontrada = (visibles || []).find((e) => String(e.id) === String(nav.evalId));
            if (evEncontrada) {
              abrirEvaluacion(
                evEncontrada,
                nav.cursoActivoId || '',
                nav.contextoAperturaEval || 'curso',
                perfilFinal,
                permsUsuario,
                idsAula,
                cursosVisibles
              );
              if (nav.subVistaEval) setSubVistaEval(nav.subVistaEval);
              if (nav.filtroCursoEnNivel) setFiltroCursoEnNivel(nav.filtroCursoEnNivel);
              restaurado = true;
            }
          } else if (nav.vistaActiva && nav.vistaActiva !== 'crear-evaluacion') {
            setVistaActiva(nav.vistaActiva);
            restaurado = true;
          }
        }
      } catch (err) {
        console.warn('No se pudo restaurar navegación:', err);
      }

      if (!restaurado) {
        if (nivelesVisibles && nivelesVisibles.length > 0) {
          setNivelActivoId(nivelesVisibles[0].id);
        }
        setVistaActiva('inicio');
      }

      actualizarBarra(true, 'Carga completada', 100, 'Panel listo.');
      setTimeout(() => actualizarBarra(false), 600);
    } catch {
      actualizarBarra(false);
    }
  };

  useEffect(() => {
    if (!sesion?.user || vistaActiva !== 'detalle-evaluacion') return;
    setEscaneosSeleccionados([]);

    const cargarDetalle = async () => {
      actualizarBarra(true, 'Cargando avance y resultados...', 30, 'Consultando registros del curso...');
      try {
        if (config.id) {
          await cargarResultadosNube(config.id);
        } else {
          setResultadosCurso([]);
          setEximidosRuts([]);
        }

        actualizarBarra(true, 'Cargando nómina de estudiantes...', 70, 'Calculando porcentaje de completación...');
        if (contextoAperturaEval === 'curso' && cursoActivoId) {
          await cargarEstudiantesParaEval(cursoActivoId, null);
        } else if (config.cursoId) {
          await cargarEstudiantesParaEval(config.cursoId, null);
        } else if (config.nivelId) {
          await cargarEstudiantesParaEval(null, config.nivelId);
        } else {
          setEstudiantesCursoEval([]);
          setSeleccionadosImprimir([]);
        }
        actualizarBarra(true, 'Carga completada', 100, 'Datos actualizados.');
        setTimeout(() => actualizarBarra(false), 500);
      } catch {
        actualizarBarra(false);
      }
    };

    cargarDetalle();
  }, [config.id, config.cursoId, config.nivelId, vistaActiva, contextoAperturaEval, cursoActivoId, cursos]);

  const cerrarSesion = async () => {
    if (profesor?.id) {
      localStorage.removeItem(`omr_nav_estado_${profesor.id}`);
    }
    usuarioCargadoIdRef.current = null;
    if (supabase) await supabase.auth.signOut();
    setSesion(null);
  };

  const manejarActualizarContrasena = async (e) => {
    e.preventDefault();
    if (!nuevaClave || nuevaClave.length < 6) {
      alert('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (nuevaClave !== confirmarClave) {
      alert('Las contraseñas no coinciden.');
      return;
    }
    setGuardandoClave(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nuevaClave });
      if (error) {
        alert('Error al actualizar la contraseña: ' + error.message);
        return;
      }
      setNuevaClave('');
      setConfirmarClave('');
      setModoRecuperacionClave(false);
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      alert('Contraseña actualizada correctamente.');
    } finally {
      setGuardandoClave(false);
    }
  };

  const obtenerNombreNivelActivo = () => {
    if (config.cursoId) {
      const c = cursos.find((cur) => cur.id === config.cursoId);
      if (c) {
        const n = niveles.find((niv) => niv.id === c.nivel_id);
        if (n) return n.nombre;
      }
    }
    if (config.nivelId) {
      const n = niveles.find((niv) => niv.id === config.nivelId);
      if (n) return n.nombre;
    }
    return '';
  };

  const manejarCambioDestinoEvaluacion = (valorSelect) => {
    if (!valorSelect) {
      setConfig((prev) => ({ ...prev, cursoId: '', nivelId: '' }));
      return;
    }
    if (valorSelect.startsWith('nivel:')) {
      const nId = valorSelect.replace('nivel:', '');
      setConfig((prev) => ({ ...prev, cursoId: '', nivelId: nId }));
    } else {
      const cObj = cursos.find((c) => c.id === valorSelect);
      setConfig((prev) => ({
        ...prev,
        cursoId: valorSelect,
        nivelId: cObj ? cObj.nivel_id : ''
      }));
    }
  };

  const valorSelectDestino = config.cursoId
    ? config.cursoId
    : config.nivelId
    ? `nivel:${config.nivelId}`
    : '';

  const toggleEximirEstudiante = async (rut) => {
    const rutNorm = rut.trim().toLowerCase();
    const existe = eximidosRuts.includes(rutNorm);
    const actualizada = existe
      ? eximidosRuts.filter((r) => r !== rutNorm)
      : [...(Array.isArray(eximidosRuts) ? eximidosRuts : []), rutNorm];
    setEximidosRuts(actualizada);

    if (config.id && supabase) {
      await supabase
        .from('evaluaciones')
        .update({ eximidos: actualizada })
        .eq('id', config.id);
    }
  };

  const cargarEstructuraEscolar = async (perfilUsuario = profesor, permsUsuario = permisosActivos) => {
    if (!supabase) return { nivelesVisibles: [], cursosVisibles: [], idsAula: new Set() };
    const [{ data: niv }, { data: cur }, { data: asig }] = await Promise.all([
      supabase.from('niveles').select('*').order('orden', { ascending: true }).order('nombre'),
      supabase.from('cursos').select('*').order('nombre'),
      perfilUsuario?.id
        ? supabase.from('docente_cursos').select('curso_id').eq('docente_id', perfilUsuario.id)
        : Promise.resolve({ data: [] })
    ]);

    const idsAula = new Set((asig || []).map((a) => a.curso_id));
    setCursosAsignadosAula(idsAula);

    let cursosVisibles = cur || [];
    let nivelesVisibles = niv || [];

    const veTodo = perfilUsuario?.rol === 'admin' || Boolean(permsUsuario?.ver_todos_cursos);

    if (!veTodo && perfilUsuario?.id) {
      cursosVisibles = cursosVisibles.filter((c) => idsAula.has(c.id));
      const nivelesConCurso = new Set(cursosVisibles.map((c) => c.nivel_id));
      nivelesVisibles = nivelesVisibles.filter((n) => nivelesConCurso.has(n.id));
    }

    setNiveles(nivelesVisibles);
    setCursos(cursosVisibles);
    return { nivelesVisibles, cursosVisibles, idsAula };
  };

  const cargarEvaluacionesNube = async (
    perfilUsuario = profesor,
    permsUsuario = permisosActivos,
    idsCursosProfe = cursosAsignadosAula,
    listaCursos = cursos
  ) => {
    if (!supabase || !perfilUsuario?.id) return { visibles: [], compartidas: [] };

    const [{ data: todasEvals }, { data: compartidas }] = await Promise.all([
      supabase
        .from('evaluaciones')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('evaluaciones')
        .select('*')
        .eq('compartida', true)
        .neq('docente_id', perfilUsuario.id)
        .order('created_at', { ascending: false })
    ]);

    const asigUsuario = (perfilUsuario.asignatura || '').trim().toLowerCase();

    const filtradas = (todasEvals || []).filter((ev) => {
      if (esEvaluacionDeSuAula(ev, perfilUsuario, idsCursosProfe, listaCursos)) return true;
      if (perfilUsuario.rol === 'admin' || permsUsuario?.ver_evals_colegio) return true;
      if (permsUsuario?.ver_evals_depto && asigUsuario) {
        const asigEval = (ev.asignatura || '').trim().toLowerCase();
        return asigEval === asigUsuario;
      }
      return false;
    });

    setEvaluacionesVisibles(filtradas);
    setEvaluacionesCompartidas(compartidas || []);
    return { visibles: filtradas, compartidas: compartidas || [] };
  };

  const cargarEstudiantesParaEval = async (cursoId, nivelId) => {
    if (!supabase) return;

    if (cursoId) {
      const cObj = cursos.find((c) => c.id === cursoId);
      const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('curso_id', cursoId)
        .order('nombre');

      if (!error && data) {
        const conCurso = data.map((e) => ({
          ...e,
          curso_nombre: cObj ? cObj.nombre : ''
        }));
        setEstudiantesCursoEval(conCurso);
        setSeleccionadosImprimir((prev) => {
          const nuevosRuts = conCurso.map((e) => e.rut);
          return Array.from(new Set([...prev, ...nuevosRuts]));
        });
      }
    } else if (nivelId) {
      const cursosDelNivel = cursos.filter((c) => c.nivel_id === nivelId);
      const idsCursos = cursosDelNivel.map((c) => c.id);
      if (idsCursos.length === 0) {
        setEstudiantesCursoEval([]);
        setSeleccionadosImprimir([]);
        return;
      }

      const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .in('curso_id', idsCursos)
        .order('nombre');

      if (!error && data) {
        const conCurso = data.map((e) => {
          const cObj = cursosDelNivel.find((c) => c.id === e.curso_id);
          return {
            ...e,
            curso_nombre: cObj ? cObj.nombre : ''
          };
        });
        setEstudiantesCursoEval(conCurso);
        setSeleccionadosImprimir((prev) => {
          const nuevosRuts = conCurso.map((e) => e.rut);
          return Array.from(new Set([...prev, ...nuevosRuts]));
        });
      }
    }
  };

  const cargarResultadosNube = async (evaluacionId) => {
    if (!supabase || !evaluacionId) return [];
    const { data, error } = await supabase
      .from('resultados')
      .select('id, rut_estudiante, nombre_estudiante, curso, puntaje_obtenido, puntaje_total, porcentaje, nota, respuestas_alumno')
      .eq('evaluacion_id', evaluacionId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formateados = data.map((r) => ({
        id: r.id,
        rut: r.rut_estudiante || 'Sin RUT',
        nombre: r.nombre_estudiante || 'Estudiante',
        curso: r.curso || '',
        puntaje: Number(r.puntaje_obtenido ?? 0),
        total: Number(r.puntaje_total ?? 0),
        porcentaje: Number(r.porcentaje ?? 0),
        nota: Number(r.nota ?? 1.0),
        respuestas: r.respuestas_alumno || {},
        imagenProcesada: null
      }));
      setResultadosCurso(formateados);
      return formateados;
    }
    return [];
  };

  const abrirEvaluacion = (
    ev,
    cursoFiltradoId = '',
    contexto = 'curso',
    perfilUsuario = profesor,
    permsUsuario = permisosActivos,
    idsCursosProfe = cursosAsignadosAula,
    listaCursos = cursos
  ) => {
    setConfig({
      id: ev.id,
      docenteId: ev.docente_id || null,
      docenteNombre: ev.docente_nombre || '',
      compartida: Boolean(ev.compartida),
      cursoId: ev.curso_id || '',
      nivelId: ev.nivel_id || '',
      tituloPrueba: ev.titulo,
      asignatura: ev.asignatura || '',
      numPreguntas: ev.num_preguntas || 30,
      alternativas: ev.alternativas || 'ABCD',
      notaMin: ev.nota_min ?? 1.0,
      notaMax: ev.nota_max ?? 7.0,
      notaAprob: ev.nota_aprob ?? 4.0,
      exigencia: ev.exigencia ?? 60,
      pauta: ev.pauta || {},
      pdfPruebaUrl: ev.pdf_prueba_url || '',
      pdfPruebaNombre: ev.pdf_prueba_nombre || ''
    });

    setContextoAperturaEval(contexto);
    setFiltroCursoEnNivel('TODOS');
    setEscaneosSeleccionados([]);
    if (cursoFiltradoId) {
      setCursoActivoId(cursoFiltradoId);
    } else if (contexto === 'nivel') {
      setCursoActivoId('');
    }
    setEximidosRuts(Array.isArray(ev.eximidos) ? ev.eximidos : []);

    const tieneCursoEnVista =
      (cursoFiltradoId && idsCursosProfe.has(cursoFiltradoId)) ||
      (ev.curso_id && idsCursosProfe.has(ev.curso_id)) ||
      (ev.nivel_id && listaCursos.some((c) => c.nivel_id === ev.nivel_id && idsCursosProfe.has(c.id)));

    const deSuAula = esEvaluacionDeSuAula(ev, perfilUsuario, idsCursosProfe, listaCursos) || tieneCursoEnVista;
    const asigUsr = (perfilUsuario?.asignatura || '').trim().toLowerCase();
    const asigEv = (ev?.asignatura || '').trim().toLowerCase();
    const mismaAsig = Boolean(asigUsr && asigEv && asigUsr === asigEv);

    const puedeEditar =
      perfilUsuario?.rol === 'admin' ||
      (deSuAula && Boolean(permsUsuario?.editar_evals_propias)) ||
      (!deSuAula && mismaAsig && Boolean(permsUsuario?.editar_evals_depto)) ||
      (!deSuAula && Boolean(permsUsuario?.editar_evals_colegio));

    const puedeEscanear =
      perfilUsuario?.rol === 'admin' ||
      (deSuAula && Boolean(permsUsuario?.escanear_hojas_propias)) ||
      (!deSuAula && mismaAsig && Boolean(permsUsuario?.escanear_hojas_depto)) ||
      (!deSuAula && Boolean(permsUsuario?.escanear_hojas_colegio));

    setSubVistaEval(puedeEditar || puedeEscanear ? 'avance' : 'analisis');
    setVistaActiva('detalle-evaluacion');
  };

  const iniciarNuevaEvaluacion = (cursoPreseleccionado = '', nivelPreseleccionado = '') => {
    const cObj = cursos.find((c) => c.id === cursoPreseleccionado);
    setConfig({
      id: null,
      docenteId: profesor.id,
      docenteNombre: profesor.nombre,
      compartida: false,
      cursoId: cursoPreseleccionado || '',
      nivelId: cObj ? cObj.nivel_id : (nivelPreseleccionado || ''),
      tituloPrueba: '',
      asignatura: profesor.asignatura || 'Matemática',
      numPreguntas: 0,
      alternativas: 'ABCD',
      notaMin: 1.0,
      notaMax: 7.0,
      notaAprob: 4.0,
      exigencia: 60,
      pauta: {},
      pdfPruebaUrl: '',
      pdfPruebaNombre: ''
    });
    setVistaActiva('crear-evaluacion');
  };

  const guardarEvaluacionNube = async (recalcularNotasExistentes = false) => {
    if (!supabase) return;
    if (!config.tituloPrueba.trim()) {
      alert('Escribe un título para la evaluación.');
      return;
    }
    if (Number(config.numPreguntas) < 1) {
      alert('Agrega al menos 1 pregunta a la evaluación antes de guardar.');
      return;
    }

    const cursoObj = cursos.find((c) => c.id === config.cursoId);
    const nivelFinalId = cursoObj ? cursoObj.nivel_id : (config.nivelId || null);

    const payload = {
      titulo: config.tituloPrueba.trim(),
      asignatura: config.asignatura,
      curso_id: config.cursoId || null,
      nivel_id: nivelFinalId,
      num_preguntas: Number(config.numPreguntas),
      alternativas: config.alternativas,
      nota_min: Number(config.notaMin),
      nota_max: Number(config.notaMax),
      nota_aprob: Number(config.notaAprob),
      exigencia: Number(config.exigencia),
      pauta: config.pauta,
      eximidos: eximidosRuts,
      compartida: Boolean(config.compartida),
      pdf_prueba_url: config.pdfPruebaUrl || null,
      pdf_prueba_nombre: config.pdfPruebaNombre || null
    };

    actualizarBarra(true, 'Guardando evaluación...', 25, 'Sincronizando configuración...');

    if (config.id) {
      if (recalcularNotasExistentes) setRecalculando(true);
      try {
        const { error } = await supabase
          .from('evaluaciones')
          .update(payload)
          .eq('id', config.id);

        if (error) {
          actualizarBarra(false);
          alert('Error al guardar cambios: ' + error.message);
          return;
        }

        if (recalcularNotasExistentes && resultadosCurso.length > 0) {
          for (let i = 0; i < resultadosCurso.length; i++) {
            const res = resultadosCurso[i];
            const evalNueva = evaluarRespuestasConPauta(res.respuestas || {}, config);
            actualizarBarra(
              true,
              'Recalculando notas...',
              35 + Math.round(((i + 1) / resultadosCurso.length) * 60),
              `Actualizando ${res.nombre} (${i + 1}/${resultadosCurso.length})`
            );
            await supabase
              .from('resultados')
              .update({
                puntaje_obtenido: evalNueva.puntosObtenidos,
                puntaje_total: evalNueva.puntosTotales,
                porcentaje: evalNueva.porcentaje,
                nota: evalNueva.nota
              })
              .eq('id', res.id);
          }
          await cargarResultadosNube(config.id);
          await cargarEvaluacionesNube(profesor, permisosActivos);
          actualizarBarra(true, 'Recálculo completado', 100, 'Notas actualizadas.');
          setTimeout(() => actualizarBarra(false), 700);
          alert(`Pauta guardada y ${resultadosCurso.length} nota(s) recalculadas automáticamente.`);
        } else {
          await cargarEvaluacionesNube(profesor, permisosActivos);
          actualizarBarra(true, 'Cambios guardados', 100, 'Evaluación actualizada en la nube.');
          setTimeout(() => actualizarBarra(false), 700);
          alert('Cambios guardados en la nube.');
        }
      } finally {
        setRecalculando(false);
      }
    } else {
      try {
        const { data, error } = await supabase
          .from('evaluaciones')
          .insert([
            {
              ...payload,
              docente_id: profesor.id,
              docente_nombre: profesor.nombre
            }
          ])
          .select()
          .single();

        if (error) {
          actualizarBarra(false);
          alert('Error al crear evaluación: ' + error.message);
        } else if (data) {
          await cargarEvaluacionesNube(profesor, permisosActivos);
          actualizarBarra(true, 'Evaluación creada', 100, 'Lista para usar.');
          setTimeout(() => actualizarBarra(false), 700);
          alert('Evaluación creada correctamente.');
          if (data.curso_id) {
            abrirEvaluacion(data, data.curso_id, 'curso');
          } else {
            abrirEvaluacion(data, '', 'nivel');
          }
        }
      } catch {
        actualizarBarra(false);
      }
    }
  };

  const toggleCompartirEvaluacion = async () => {
    if (!supabase || !config.id) return;
    const nuevoEstado = !config.compartida;
    const { error } = await supabase
      .from('evaluaciones')
      .update({ compartida: nuevoEstado })
      .eq('id', config.id);

    if (!error) {
      setConfig((prev) => ({ ...prev, compartida: nuevoEstado }));
      cargarEvaluacionesNube(profesor, permisosActivos);
    }
  };

  const importarPautaCompartida = (evCompartida) => {
    setConfig({
      id: null,
      docenteId: profesor.id,
      docenteNombre: profesor.nombre,
      compartida: false,
      cursoId: '',
      nivelId: evCompartida.nivel_id || '',
      tituloPrueba: `${evCompartida.titulo} (Copia)`,
      asignatura: evCompartida.asignatura || profesor.asignatura,
      numPreguntas: evCompartida.num_preguntas || 30,
      alternativas: evCompartida.alternativas || 'ABCD',
      notaMin: evCompartida.nota_min ?? 1.0,
      notaMax: evCompartida.nota_max ?? 7.0,
      notaAprob: evCompartida.nota_aprob ?? 4.0,
      exigencia: evCompartida.exigencia ?? 60,
      pauta: evCompartida.pauta || {},
      pdfPruebaUrl: evCompartida.pdf_prueba_url || '',
      pdfPruebaNombre: evCompartida.pdf_prueba_nombre || ''
    });
    alert(`Pauta "${evCompartida.titulo}" cargada. Elige tu curso o nivel y presiona Guardar Evaluación.`);
  };

  const eliminarEvaluacion = async () => {
    if (!supabase || !config.id) return;
    if (!confirm(`¿Eliminar definitivamente "${config.tituloPrueba}" y todos sus resultados escaneados?`)) {
      return;
    }

    const { error } = await supabase
      .from('evaluaciones')
      .delete()
      .eq('id', config.id);

    if (error) {
      alert('Error al eliminar: ' + error.message);
      return;
    }

    await cargarEvaluacionesNube(profesor, permisosActivos);
    if (cursoActivoId) setVistaActiva('panel-curso');
    else if (nivelActivoId) setVistaActiva('panel-nivel');
    else setVistaActiva('inicio');
  };

  const eliminarResultadoEscaneo = async (resultadoObj) => {
    if (!confirm(`¿Eliminar el escaneo de "${resultadoObj.nombre}" (${resultadoObj.rut})?`)) return;
    if (supabase && resultadoObj.id) {
      const { error } = await supabase.from('resultados').delete().eq('id', resultadoObj.id);
      if (!error) {
        setEscaneosSeleccionados((prev) => prev.filter((id) => id !== resultadoObj.id));
        await cargarResultadosNube(config.id);
      }
    }
  };

  const toggleSeleccionEscaneo = (id) => {
    setEscaneosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSeleccionarTodosEscaneos = (listaVisible) => {
    const idsVisibles = listaVisible.map((r) => r.id).filter(Boolean);
    const todosMarcados = idsVisibles.length > 0 && idsVisibles.every((id) => escaneosSeleccionados.includes(id));
    if (todosMarcados) {
      setEscaneosSeleccionados((prev) => prev.filter((id) => !idsVisibles.includes(id)));
    } else {
      setEscaneosSeleccionados((prev) => Array.from(new Set([...prev, ...idsVisibles])));
    }
  };

  const eliminarEscaneosSeleccionados = async () => {
    if (escaneosSeleccionados.length === 0) return;
    if (!confirm(`¿Eliminar los ${escaneosSeleccionados.length} escaneo(s) seleccionados? Esta acción no se puede deshacer.`)) return;

    if (supabase) {
      const { error } = await supabase
        .from('resultados')
        .delete()
        .in('id', escaneosSeleccionados);

      if (error) {
        alert('Error al eliminar escaneos seleccionados: ' + error.message);
        return;
      }
    }

    setEscaneosSeleccionados([]);
    await cargarResultadosNube(config.id);
  };

  const eliminarTodosLosEscaneos = async (listaVisible) => {
    if (!listaVisible || listaVisible.length === 0) return;
    if (!confirm(`¿Eliminar TODOS (${listaVisible.length}) los escaneos cargados en esta vista? Esta acción no se puede deshacer.`)) return;

    const idsABorrar = listaVisible.map((r) => r.id).filter(Boolean);
    if (supabase && idsABorrar.length > 0) {
      const { error } = await supabase
        .from('resultados')
        .delete()
        .in('id', idsABorrar);

      if (error) {
        alert('Error al eliminar todos los escaneos: ' + error.message);
        return;
      }
    }

    setEscaneosSeleccionados([]);
    await cargarResultadosNube(config.id);
  };

  const agregarEstudianteAEvaluacion = async (e) => {
    e.preventDefault();
    if (!rutExtra.trim() || !nombreExtra.trim()) return;
    const nuevo = { id: 'local-' + Date.now(), rut: rutExtra.trim(), nombre: nombreExtra.trim() };
    const cursoDestinoId = (contextoAperturaEval === 'curso' && cursoActivoId)
      ? cursoActivoId
      : (config.cursoId || (config.nivelId ? cursos.find((c) => c.nivel_id === config.nivelId)?.id : null));

    if (cursoDestinoId && supabase) {
      const { error } = await supabase
        .from('estudiantes')
        .upsert([{ curso_id: cursoDestinoId, rut: nuevo.rut, nombre: nuevo.nombre }], { onConflict: 'curso_id,rut' });
      if (error) {
        alert('Error al agregar estudiante: ' + error.message);
        return;
      }
      if (contextoAperturaEval === 'curso' && cursoActivoId) {
        await cargarEstudiantesParaEval(cursoActivoId, null);
      } else {
        await cargarEstudiantesParaEval(config.cursoId, config.nivelId);
      }
    }
    setRutExtra('');
    setNombreExtra('');
  };

  const quitarEstudianteDeEvaluacion = (rut) => {
    setEstudiantesCursoEval((prev) => prev.filter((e) => e.rut !== rut));
    setSeleccionadosImprimir((prev) => prev.filter((r) => r !== rut));
  };

  const obtenerSeccionesPauta = (cfg = config) => {
    const total = Number(cfg.numPreguntas || 0);
    const pautaMap = cfg.pauta || {};
    const alternativas = [];
    const completacion = [];
    const desarrollo = [];

    for (let p = 1; p <= total; p++) {
      const it = pautaMap[p] || { tipo: 'alternativa' };
      const tipo = typeof it === 'object' && it !== null && it.tipo ? it.tipo : 'alternativa';
      if (tipo === 'completacion') completacion.push({ p, item: it });
      else if (tipo === 'desarrollo') desarrollo.push({ p, item: it });
      else alternativas.push({ p, item: it });
    }
    return { alternativas, completacion, desarrollo };
  };

  const construirMapaPagina2 = (secciones) => {
    const { alternativas, completacion, desarrollo } = secciones;
    const tieneSoloAlt = completacion.length === 0 && desarrollo.length === 0;
    if (tieneSoloAlt) {
      return {
        usaPagina2: false,
        seccionesP1: secciones,
        seccionesP2: { alternativas: [], completacion: [], desarrollo: [] }
      };
    }

    let yCursor = 54;
    if (alternativas.length > 0) {
      const filasAlt = Math.ceil(alternativas.length / 2);
      yCursor += 5 + filasAlt * 7.8 + 4;
    }

    const compP1 = [];
    const compP2 = [];
    if (completacion.length > 0) {
      yCursor += 6;
      const filasComp = Math.ceil(completacion.length / 2);
      const altoComp = filasComp * 13;
      if (yCursor + altoComp <= 253) {
        compP1.push(...completacion);
        yCursor += altoComp + 4;
      } else {
        compP2.push(...completacion);
      }
    }

    const desP1 = [];
    const desP2 = [];
    if (desarrollo.length > 0) {
      let ySim = yCursor + 6;
      desarrollo.forEach((d) => {
        const lineas = Math.max(3, Number(d.item?.lineas || 5));
        const altoCaja = 6 + lineas * 7.5;
        if (desP2.length === 0 && ySim + altoCaja <= 253) {
          desP1.push(d);
          ySim += altoCaja + 4;
        } else {
          desP2.push(d);
        }
      });
    }

    const usaPagina2 = compP2.length > 0 || desP2.length > 0;
    return {
      usaPagina2,
      seccionesP1: { alternativas, completacion: compP1, desarrollo: desP1 },
      seccionesP2: { alternativas: [], completacion: compP2, desarrollo: desP2 }
    };
  };

  const dibujarCabeceraHojaOMR = (doc, {
    tituloPrueba,
    asignatura,
    totalPreg,
    alternativas,
    nombreEstudiante,
    rutEstudiante,
    cursoEstudiante,
    qrDataUrl = null,
    esHojaBlanca = false,
    paginaActual = 1,
    totalPaginas = 1
  }) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(12, 12, 8, 8, 'F');
    doc.rect(195, 12, 8, 8, 'F');
    doc.rect(12, 258, 8, 8, 'F');
    doc.rect(195, 258, 8, 8, 'F');

    const topY = 12;
    const boxH = 31;
    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.35);

    doc.rect(23, topY, 27, boxH);
    if (logoEscuela) {
      doc.addImage(logoEscuela, 'PNG', 25, topY + 3.5, 23, 24, undefined, 'FAST');
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(120, 120, 120);
      doc.text('LOGO', 36.5, topY + 14.5, { align: 'center' });
      doc.text('INSTITUCIÓN', 36.5, topY + 18, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }

    doc.rect(52, topY, 54, boxH);
    doc.setFillColor(235, 235, 235);
    doc.rect(52, topY, 54, 5.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text('DATOS DE LA EVALUACIÓN', 54, topY + 3.6);

    doc.setFontSize(8);
    const tituloLineas = doc.splitTextToSize((tituloPrueba || 'EVALUACIÓN').toUpperCase(), 50);
    doc.text(tituloLineas.slice(0, 2), 54, topY + 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const asigLineas = doc.splitTextToSize(`Asignatura: ${asignatura || '-'}`, 50);
    doc.text(asigLineas[0], 54, topY + 20.5);
    doc.text(`Ítems: ${totalPreg}   |   Pág. ${paginaActual} / ${totalPaginas}`, 54, topY + 26.5);

    doc.rect(108, topY, 53, boxH);
    doc.setFillColor(235, 235, 235);
    doc.rect(108, topY, 53, 5.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text('DATOS DEL ESTUDIANTE', 110, topY + 3.6);

    if (esHojaBlanca) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      doc.text('Nombre:', 110, topY + 10);
      doc.line(122, topY + 10.3, 159, topY + 10.3);
      doc.line(110, topY + 15.8, 159, topY + 15.8);

      doc.text('RUT:', 110, topY + 22.3);
      doc.line(118, topY + 22.6, 159, topY + 22.6);

      doc.text('Curso:', 110, topY + 27.8);
      if (cursoEstudiante) {
        doc.setFont('helvetica', 'bold');
        doc.text(cursoEstudiante, 120, topY + 27.8);
        doc.setFont('helvetica', 'normal');
      } else {
        doc.line(120, topY + 28.1, 159, topY + 28.1);
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Nombre:', 110, topY + 9.2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const nombreLineas = doc.splitTextToSize(nombreEstudiante || '', 49);
      doc.text(nombreLineas.slice(0, 2), 110, topY + 13.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`RUT: ${rutEstudiante || '-'}`, 110, topY + 22.8);
      doc.text(`Curso: ${cursoEstudiante || '-'}`, 110, topY + 27.8);
    }

    doc.rect(163, topY, 29, boxH);
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', 166.5, topY + 1, 22, 22);
      doc.setLineWidth(0.25);
      doc.line(163, topY + 23.8, 192, topY + 23.8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.1);
      doc.text(`PÁGINA ${paginaActual} DE ${totalPaginas}`, 177.5, topY + 26.6, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.9);
      doc.text('No rayes este código QR', 177.5, topY + 29.4, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(90, 90, 90);
      doc.text('HOJA EN BLANCO', 177.5, topY + 12, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(`PÁG. ${paginaActual}/${totalPaginas} (SIN QR)`, 177.5, topY + 16.5, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      doc.setLineWidth(0.25);
      doc.line(163, topY + 23.8, 192, topY + 23.8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.1);
      doc.text('PRECAUCIÓN:', 177.5, topY + 26.6, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.9);
      doc.text('No rayes este recuadro', 177.5, topY + 29.4, { align: 'center' });
    }

    doc.setLineWidth(0.25);
    doc.rect(23, 45, 169, 5.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(
      'INSTRUCCIONES: Rellena completamente el círculo y escribe con letra/números claros dentro de cada recuadro sin salirte de los bordes.',
      107.5,
      48.5,
      { align: 'center' }
    );
  };

  const dibujarCuerpoSeccionesHoja = (doc, seccionesPagina, opciones) => {
    const { alternativas, completacion, desarrollo } = seccionesPagina;
    const soloAlternativas = completacion.length === 0 && desarrollo.length === 0;
    let yCursor = 54;

    if (alternativas.length > 0) {
      if (!soloAlternativas) {
        doc.setFillColor(238, 238, 238);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.25);
        doc.rect(23, yCursor, 169, 4.8, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(0, 0, 0);
        doc.text('SECCIÓN I: SELECCIÓN MÚLTIPLE', 25.5, yCursor + 3.4);
        yCursor += 8.2;
      } else {
        yCursor = 56;
      }

      const mitad = soloAlternativas ? 25 : Math.ceil(alternativas.length / 2);
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.3);

      alternativas.forEach(({ p }, idx) => {
        const col = idx < mitad ? 0 : 1;
        const fila = idx < mitad ? idx : idx - mitad;
        const baseX = col === 0 ? 32 : 122;
        const baseY = yCursor + fila * 7.8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`${p}.`, baseX - 8, baseY + 1.5);

        opciones.forEach((letra, idxOpt) => {
          const cx = baseX + idxOpt * 11;
          doc.circle(cx, baseY, 2.7, 'S');
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.text(letra, cx - 1.3, baseY + 1);
        });
      });

      const filasUsadas = Math.min(mitad, alternativas.length);
      yCursor += filasUsadas * 7.8 + 3;
    }

    if (completacion.length > 0) {
      doc.setFillColor(238, 238, 238);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);
      doc.rect(23, yCursor, 169, 4.8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(0, 0, 0);
      doc.text('SECCIÓN II: COMPLETACIÓN NUMÉRICA (ESCRIBE EL RESULTADO EXACTO DENTRO DEL RECUADRO)', 25.5, yCursor + 3.4);
      yCursor += 6.8;

      const mitadComp = Math.ceil(completacion.length / 2);
      completacion.forEach(({ p }, idx) => {
        const col = idx < mitadComp ? 0 : 1;
        const fila = idx < mitadComp ? idx : idx - mitadComp;
        const xNum = col === 0 ? 25 : 113;
        const xBox = col === 0 ? 34 : 122;
        const yRow = yCursor + fila * 13;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        doc.text(`${p}.`, xNum, yRow + 6.5);

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.45);
        doc.rect(xBox, yRow, 66, 10.5);
      });

      yCursor += mitadComp * 13 + 3;
    }

    if (desarrollo.length > 0) {
      doc.setFillColor(238, 238, 238);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);
      doc.rect(23, yCursor, 169, 4.8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(0, 0, 0);
      doc.text('SECCIÓN III: PREGUNTAS DE DESARROLLO (RESPONDE CON LETRA CLARA DENTRO DEL RECUADRO)', 25.5, yCursor + 3.4);
      yCursor += 6.5;

      desarrollo.forEach(({ p, item }) => {
        const numLineas = Math.max(3, Number(item?.lineas || 5));
        const interlineado = 7.5;
        const altoCaja = 5.5 + numLineas * interlineado;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.45);
        doc.rect(23, yCursor, 169, altoCaja);

        doc.setFillColor(245, 245, 245);
        doc.rect(23, yCursor, 169, 5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(`Pregunta ${p}:`, 25.5, yCursor + 3.6);

        doc.setDrawColor(190, 190, 190);
        doc.setLineWidth(0.2);
        for (let l = 1; l <= numLineas; l++) {
          const yLinea = yCursor + 5 + l * interlineado;
          if (yLinea < yCursor + altoCaja - 1) {
            doc.line(26, yLinea, 189, yLinea);
          }
        }

        yCursor += altoCaja + 4;
      });
    }
  };

  const imprimirHojasPDF = async (listaEstudiantesAImprimir, sufijoArchivo = '') => {
    if (!listaEstudiantesAImprimir || listaEstudiantesAImprimir.length === 0) {
      alert('No hay estudiantes seleccionados para imprimir.');
      return;
    }

    const cursoGlobalObj = cursos.find((c) => c.id === (cursoActivoId || config.cursoId));

    const listaOrdenada = [...listaEstudiantesAImprimir].sort((a, b) => {
      const cursoA = (a.curso_nombre || (cursoGlobalObj ? cursoGlobalObj.nombre : '')).trim();
      const cursoB = (b.curso_nombre || (cursoGlobalObj ? cursoGlobalObj.nombre : '')).trim();
      const cmpCurso = cursoA.localeCompare(cursoB, 'es', { numeric: true, sensitivity: 'base' });
      if (cmpCurso !== 0) return cmpCurso;
      return (a.nombre || '').trim().localeCompare((b.nombre || '').trim(), 'es', { sensitivity: 'base' });
    });

    actualizarBarra(true, 'Completando descarga de PDF...', 10, `Preparando ${listaOrdenada.length} hoja(s)...`);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const opciones = config.alternativas.split('');
      const totalPreg = Number(config.numPreguntas);
      const secciones = obtenerSeccionesPauta(config);
      const { usaPagina2, seccionesP1, seccionesP2 } = construirMapaPagina2(secciones);
      const totalPaginasPorAlumno = usaPagina2 ? 2 : 1;

      for (let i = 0; i < listaOrdenada.length; i++) {
        if (i > 0) doc.addPage();
        const est = listaOrdenada[i];
        const nombreCursoEst = est.curso_nombre || (cursoGlobalObj ? cursoGlobalObj.nombre : '');

        actualizarBarra(
          true,
          'Completando descarga de PDF...',
          10 + Math.round(((i + 1) / listaOrdenada.length) * 85),
          `Generando hoja ${i + 1} de ${listaOrdenada.length} (${est.nombre})...`
        );

        const qrPayloadP1 = JSON.stringify({
          r: est.rut,
          n: est.nombre,
          c: nombreCursoEst,
          e: config.id || '',
          p: 1,
          tp: totalPaginasPorAlumno
        });
        const qrDataUrlP1 = await QRCode.toDataURL(qrPayloadP1, { margin: 1, width: 120 });

        dibujarCabeceraHojaOMR(doc, {
          tituloPrueba: config.tituloPrueba,
          asignatura: config.asignatura,
          totalPreg,
          alternativas: config.alternativas,
          nombreEstudiante: est.nombre,
          rutEstudiante: est.rut,
          cursoEstudiante: nombreCursoEst,
          qrDataUrl: qrDataUrlP1,
          esHojaBlanca: false,
          paginaActual: 1,
          totalPaginas: totalPaginasPorAlumno
        });
        dibujarCuerpoSeccionesHoja(doc, seccionesP1, opciones);

        if (usaPagina2) {
          doc.addPage();
          const qrPayloadP2 = JSON.stringify({
            r: est.rut,
            n: est.nombre,
            c: nombreCursoEst,
            e: config.id || '',
            p: 2,
            tp: 2
          });
          const qrDataUrlP2 = await QRCode.toDataURL(qrPayloadP2, { margin: 1, width: 120 });

          dibujarCabeceraHojaOMR(doc, {
            tituloPrueba: config.tituloPrueba,
            asignatura: config.asignatura,
            totalPreg,
            alternativas: config.alternativas,
            nombreEstudiante: est.nombre,
            rutEstudiante: est.rut,
            cursoEstudiante: nombreCursoEst,
            qrDataUrl: qrDataUrlP2,
            esHojaBlanca: false,
            paginaActual: 2,
            totalPaginas: 2
          });
          dibujarCuerpoSeccionesHoja(doc, seccionesP2, opciones);
        }
      }

      doc.save(`Hojas_${config.tituloPrueba.replace(/\s+/g, '_')}${sufijoArchivo}.pdf`);
      actualizarBarra(true, 'Descarga completada', 100, 'Archivo PDF descargado correctamente.');
      setTimeout(() => actualizarBarra(false), 900);
    } catch {
      actualizarBarra(false);
    }
  };

  const imprimirHojasBlancasPDF = async (cantidad = 1) => {
    const cant = Math.max(1, Math.min(6, Number(cantidad || 1)));
    const cursoGlobalObj = cursos.find((c) => c.id === (cursoActivoId || config.cursoId || cursoFiltroObj?.id));
    const nombreCursoRef = cursoGlobalObj ? cursoGlobalObj.nombre : '';

    actualizarBarra(true, 'Completando descarga de PDF...', 15, `Generando ${cant} hoja(s) en blanco...`);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const opciones = config.alternativas.split('');
      const totalPreg = Number(config.numPreguntas || 30);
      const secciones = obtenerSeccionesPauta(config);
      const { usaPagina2, seccionesP1, seccionesP2 } = construirMapaPagina2(secciones);
      const totalPaginasPorAlumno = usaPagina2 ? 2 : 1;

      for (let i = 0; i < cant; i++) {
        if (i > 0) doc.addPage();

        actualizarBarra(
          true,
          'Completando descarga de PDF...',
          15 + Math.round(((i + 1) / cant) * 80),
          `Generando hoja en blanco ${i + 1} de ${cant}...`
        );

        dibujarCabeceraHojaOMR(doc, {
          tituloPrueba: config.tituloPrueba || 'Evaluación',
          asignatura: config.asignatura,
          totalPreg,
          alternativas: config.alternativas,
          nombreEstudiante: '',
          rutEstudiante: '',
          cursoEstudiante: nombreCursoRef,
          qrDataUrl: null,
          esHojaBlanca: true,
          paginaActual: 1,
          totalPaginas: totalPaginasPorAlumno
        });
        dibujarCuerpoSeccionesHoja(doc, seccionesP1, opciones);

        if (usaPagina2) {
          doc.addPage();
          dibujarCabeceraHojaOMR(doc, {
            tituloPrueba: config.tituloPrueba || 'Evaluación',
            asignatura: config.asignatura,
            totalPreg,
            alternativas: config.alternativas,
            nombreEstudiante: '',
            rutEstudiante: '',
            cursoEstudiante: nombreCursoRef,
            qrDataUrl: null,
            esHojaBlanca: true,
            paginaActual: 2,
            totalPaginas: 2
          });
          dibujarCuerpoSeccionesHoja(doc, seccionesP2, opciones);
        }
      }

      doc.save(`Hojas_En_Blanco_${config.tituloPrueba.replace(/\s+/g, '_')}_x${cant}.pdf`);
      actualizarBarra(true, 'Descarga completada', 100, `${cant} hoja(s) en blanco descargada(s).`);
      setTimeout(() => actualizarBarra(false), 900);
    } catch {
      actualizarBarra(false);
    }
  };

  const descargarHojasCorregidasPDF = async (listaResultadosAExportar, sufijoArchivo = '', respetarOrden = false) => {
    if (!listaResultadosAExportar || listaResultadosAExportar.length === 0) {
      alert('No hay resultados corregidos para descargar.');
      return;
    }

    const listaOrdenada = respetarOrden
      ? [...listaResultadosAExportar]
      : [...listaResultadosAExportar].sort((a, b) => {
          const cursoA = (a.curso || '').trim();
          const cursoB = (b.curso || '').trim();
          const cmpCurso = cursoA.localeCompare(cursoB, 'es', { numeric: true, sensitivity: 'base' });
          if (cmpCurso !== 0) return cmpCurso;
          return (a.nombre || '').trim().localeCompare((b.nombre || '').trim(), 'es', { sensitivity: 'base' });
        });

    actualizarBarra(true, 'Completando descarga de PDF...', 10, `Armando ${listaOrdenada.length} hoja(s) corregida(s)...`);

    try {
      const mapaImagenes = new Map();
      listaOrdenada.forEach((r) => {
        if (r.id && r.imagenProcesada) {
          mapaImagenes.set(r.id, r.imagenProcesada);
        }
      });

      const idsFaltantes = listaOrdenada
        .map((r) => r.id)
        .filter((id) => id && !mapaImagenes.has(id));

      if (supabase && idsFaltantes.length > 0) {
        const tamLoteImg = 15;
        for (let k = 0; k < idsFaltantes.length; k += tamLoteImg) {
          const bloqueIds = idsFaltantes.slice(k, k + tamLoteImg);
          actualizarBarra(
            true,
            'Completando descarga de PDF...',
            10 + Math.round(((k + bloqueIds.length) / idsFaltantes.length) * 35),
            `Recuperando hojas corregidas (${Math.min(k + tamLoteImg, idsFaltantes.length)}/${idsFaltantes.length})...`
          );
          const { data: imgsDB } = await supabase
            .from('resultados')
            .select('id, imagen_corregida')
            .in('id', bloqueIds);

          (imgsDB || []).forEach((fila) => {
            if (fila.id && fila.imagen_corregida) {
              mapaImagenes.set(fila.id, fila.imagen_corregida);
            }
          });
        }
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const opciones = config.alternativas.split('');
      const totalPreg = Number(config.numPreguntas);
      const secciones = obtenerSeccionesPauta(config);

      for (let i = 0; i < listaOrdenada.length; i++) {
        if (i > 0) doc.addPage();
        const res = listaOrdenada[i];
        const respuestasAl = res.respuestas || {};
        const iaMapAl = respuestasAl._ia || {};
        const imgHojaRes = (res.id && mapaImagenes.get(res.id)) || res.imagenProcesada || null;

        actualizarBarra(
          true,
          'Completando descarga de PDF...',
          45 + Math.round(((i + 1) / listaOrdenada.length) * 50),
          `Procesando hoja ${i + 1} de ${listaOrdenada.length} (${res.nombre})...`
        );

        doc.setDrawColor(200, 210, 225);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 10, 188, 28, 3, 3, 'FD');

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${config.tituloPrueba} - Revision OMR`, 18, 17);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Estudiante: ${res.nombre}`, 18, 23);
        doc.text(`RUT: ${res.rut}   |   Curso: ${res.curso || '-'}   |   Asignatura: ${config.asignatura}`, 18, 28.5);
        doc.text(`Puntaje: ${res.puntaje} / ${res.total} pts (${res.porcentaje}%)   |   Exigencia: ${config.exigencia}%`, 18, 34);

        const aprobado = Number(res.nota) >= Number(config.notaAprob || 4.0);
        doc.setFillColor(aprobado ? 22 : 220, aprobado ? 163 : 38, aprobado ? 74 : 38);
        doc.roundedRect(167, 12.5, 31, 23, 2.5, 2.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('NOTA FINAL', 182.5, 18.5, { align: 'center' });
        doc.setFontSize(15);
        doc.text(Number(res.nota).toFixed(1), 182.5, 30, { align: 'center' });

        if (imgHojaRes) {
          doc.addImage(imgHojaRes, 'JPEG', 18, 41, 180, 228);
        } else {
          doc.setTextColor(71, 85, 105);
          doc.setFontSize(8);
          doc.text('Leyenda: [Verde] Correcta | [Rojo] Incorrecta | [Azul] Clave | [Gris] Anulada | BLANCO / DOBLE', 18, 44);

          for (let p = 1; p <= totalPreg; p++) {
            const col = p <= 25 ? 0 : 1;
            const fila = p <= 25 ? p - 1 : p - 26;
            const baseX = col === 0 ? 24 : 116;
            const baseY = 52 + fila * 7.8;

            const respMarcada = respuestasAl[p] || '';
            const itemPauta = (config.pauta || {})[p];
            const clavesValidas = obtenerClavesCorrectas(itemPauta);
            const puntajeItem = obtenerPuntajeItem(itemPauta);
            const esAnulada = puntajeItem === 0;
            const esCorrecta = !esAnulada && clavesValidas.length > 0 && clavesValidas.includes(respMarcada);

            doc.setTextColor(15, 23, 42);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`${p}.`, baseX - 7, baseY + 1.2);

            opciones.forEach((letra, idx) => {
              const cx = baseX + idx * 10;

              if (esAnulada) {
                doc.setDrawColor(148, 163, 184);
                doc.setLineWidth(0.3);
                doc.circle(cx, baseY, 2.7, 'S');
                doc.setTextColor(148, 163, 184);
              } else if (respMarcada === letra) {
                doc.setFillColor(esCorrecta ? 22 : 220, esCorrecta ? 163 : 38, esCorrecta ? 74 : 38);
                doc.circle(cx, baseY, 2.7, 'F');
                doc.setTextColor(255, 255, 255);
              } else if (clavesValidas.includes(letra) && !esCorrecta) {
                doc.setDrawColor(37, 99, 235);
                doc.setLineWidth(0.6);
                doc.circle(cx, baseY, 2.7, 'S');
                doc.setTextColor(37, 99, 235);
              } else {
                doc.setDrawColor(160, 170, 185);
                doc.setLineWidth(0.25);
                doc.circle(cx, baseY, 2.7, 'S');
                doc.setTextColor(100, 116, 139);
              }

              doc.setFontSize(7.5);
              doc.setFont('helvetica', 'bold');
              doc.text(letra, cx - 1.2, baseY + 0.9);
            });

            const estadoX = baseX + opciones.length * 10 + 1;
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');

            if (esAnulada) {
              doc.setTextColor(100, 116, 139);
              doc.text('ANULADA', estadoX, baseY + 1);
            } else if (respMarcada === '') {
              doc.setTextColor(100, 116, 139);
              doc.text('X  BLANCO', estadoX, baseY + 1);
            } else if (respMarcada === 'DOBLE') {
              doc.setTextColor(217, 119, 6);
              doc.text('X  DOBLE', estadoX, baseY + 1);
            } else if (esCorrecta) {
              doc.setTextColor(22, 163, 74);
              doc.text('OK', estadoX, baseY + 1);
            } else if (clavesValidas.length > 0) {
              doc.setTextColor(220, 38, 38);
              doc.text(`X (${clavesValidas.join('/')})`, estadoX, baseY + 1);
            }
          }
        }

        if (secciones.desarrollo.length > 0) {
          doc.addPage();
          let yRub = 14;

          doc.setFillColor(245, 243, 255);
          doc.setDrawColor(196, 181, 253);
          doc.roundedRect(14, yRub, 188, 16, 2.5, 2.5, 'FD');
          doc.setTextColor(76, 29, 149);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(`RÚBRICA DE EVALUACIÓN — ${res.nombre}`, 18, yRub + 6.5);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(51, 65, 85);
          doc.text(`${config.tituloPrueba}   |   RUT: ${res.rut}   |   Curso: ${res.curso || '-'}`, 18, yRub + 12.5);
          yRub += 22;

          secciones.desarrollo.forEach(({ p, item }) => {
            const ptsMax = obtenerPuntajeItem(item);
            const infoIa = iaMapAl[p] || {};
            const ptsObtenidos = infoIa.puntajeFinal !== undefined && infoIa.puntajeFinal !== null
              ? Number(infoIa.puntajeFinal)
              : infoIa.puntajeSugerido !== undefined && infoIa.puntajeSugerido !== null
              ? Number(infoIa.puntajeSugerido)
              : 0;

            const rubrica = Array.isArray(item?.rubrica) ? item.rubrica : [];
            let idxAlcanzado = 0;
            if (rubrica.length > 0) {
              let minDiff = Math.abs(Number(rubrica[0].puntaje || 0) - ptsObtenidos);
              rubrica.forEach((niv, idxN) => {
                const diff = Math.abs(Number(niv.puntaje || 0) - ptsObtenidos);
                if (diff < minDiff) {
                  minDiff = diff;
                  idxAlcanzado = idxN;
                }
              });
            }

            const altoBloqueBase = 16 + Math.max(1, rubrica.length) * 11;
            if (yRub + altoBloqueBase > 265) {
              doc.addPage();
              yRub = 14;
            }

            doc.setDrawColor(203, 213, 225);
            doc.setFillColor(248, 250, 252);
            doc.rect(14, yRub, 188, 7.5, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(`Pregunta ${p} ${item?.oa ? `(${item.oa})` : ''}`, 17, yRub + 5);
            doc.setTextColor(109, 40, 217);
            doc.text(`Puntaje: ${ptsObtenidos} / ${ptsMax} pts`, 199, yRub + 5, { align: 'right' });
            yRub += 9;

            if (item?.enunciado) {
              const enunLineas = doc.splitTextToSize(`Enunciado: ${item.enunciado}`, 182);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(51, 65, 85);
              doc.text(enunLineas.slice(0, 2), 17, yRub + 3.5);
              yRub += enunLineas.slice(0, 2).length * 4 + 2;
            }

            rubrica.forEach((niv, idxN) => {
              const esAlcanzado = idxN === idxAlcanzado;
              const descLineas = doc.splitTextToSize(niv.descriptor || '-', 126).slice(0, 2);
              const hFila = Math.max(8.5, descLineas.length * 3.8 + 3);

              if (yRub + hFila > 266) {
                doc.addPage();
                yRub = 14;
              }

              doc.setDrawColor(esAlcanzado ? 22 : 226, esAlcanzado ? 163 : 232, esAlcanzado ? 74 : 240);
              doc.setFillColor(esAlcanzado ? 240 : 255, esAlcanzado ? 253 : 255, esAlcanzado ? 244 : 255);
              doc.rect(14, yRub, 188, hFila, 'FD');

              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8);
              doc.setTextColor(esAlcanzado ? 22 : 71, esAlcanzado ? 163 : 85, esAlcanzado ? 74 : 105);
              doc.text(`${esAlcanzado ? '✓ ' : ''}${niv.nivel} (${niv.puntaje} pts)`, 17, yRub + 4.5);

              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7.6);
              doc.setTextColor(30, 41, 59);
              doc.text(descLineas, 70, yRub + 4.2);

              yRub += hFila + 1.5;
            });

            yRub += 5;
          });
        }
      }

      doc.save(`Corregidas_${config.tituloPrueba.replace(/\s+/g, '_')}${sufijoArchivo}.pdf`);
      actualizarBarra(true, 'Descarga completada', 100, 'PDF de devolución listo.');
      setTimeout(() => actualizarBarra(false), 900);
    } catch {
      actualizarBarra(false);
    }
  };

  const abrirAsistenteHojasSinQr = async (listaResultadosActualizados) => {
    const sinQr = (listaResultadosActualizados || []).filter((r) => {
      const rutNorm = (r.rut || '').trim().toLowerCase();
      return !rutNorm || rutNorm === 'sin qr' || rutNorm === 'sin rut';
    });

    if (sinQr.length > 0) {
      let enriquecidas = sinQr;
      if (supabase) {
        const idsSinImg = sinQr.filter((x) => x.id && !x.imagenProcesada).map((x) => x.id);
        if (idsSinImg.length > 0) {
          const { data: imgs } = await supabase
            .from('resultados')
            .select('id, imagen_corregida')
            .in('id', idsSinImg);
          const mapImg = new Map((imgs || []).map((f) => [f.id, f.imagen_corregida]));
          enriquecidas = sinQr.map((item) => ({
            ...item,
            imagenProcesada: item.imagenProcesada || mapImg.get(item.id) || null
          }));
        }
      }

      const cursoDefault =
        (contextoAperturaEval === 'curso' && cursoActivoId) ||
        cursoFiltroObj?.id ||
        config.cursoId ||
        (cursosDelNivelActivo[0]?.id || '');

      setHojasSinQrPendientes(enriquecidas);
      setIndiceHojaSinQr(0);
      setBusquedaAlumnoModal('');
      setRutSeleccionadoModal('');
      setMostrarFormNuevoAlumnoModal(false);
      setNuevoRutModal('');
      setNuevoNombreModal('');
      setCursoIdNuevoAlumnoModal(cursoDefault);
    }
  };

  const asignarEstudianteAHojaSinQr = async () => {
    const hojaActual = hojasSinQrPendientes[indiceHojaSinQr];
    if (!hojaActual || !rutSeleccionadoModal) {
      alert('Selecciona un estudiante de la lista antes de continuar.');
      return;
    }

    const estElegido = estudiantesCursoEval.find((e) => e.rut === rutSeleccionadoModal);
    if (!estElegido) return;

    setAsignandoHoja(true);
    try {
      const cursoNombreFinal =
        estElegido.curso_nombre ||
        (contextoAperturaEval === 'curso' && cursoActualObj?.nombre) ||
        cursoFiltroObj?.nombre ||
        '';

      const calificacion = evaluarRespuestasConPauta(hojaActual.respuestas || {}, config);

      if (supabase && config.id && hojaActual.id) {
        await supabase
          .from('resultados')
          .delete()
          .eq('evaluacion_id', config.id)
          .eq('rut_estudiante', estElegido.rut)
          .neq('id', hojaActual.id);

        const { error } = await supabase
          .from('resultados')
          .update({
            rut_estudiante: estElegido.rut,
            nombre_estudiante: estElegido.nombre,
            curso: cursoNombreFinal,
            puntaje_obtenido: calificacion.puntosObtenidos,
            puntaje_total: calificacion.puntosTotales,
            porcentaje: calificacion.porcentaje,
            nota: calificacion.nota
          })
          .eq('id', hojaActual.id);

        if (error) {
          alert('Error al asignar estudiante: ' + error.message);
          return;
        }
      }

      const nuevosRes = await cargarResultadosNube(config.id);
      const restantes = nuevosRes.filter((r) => {
        const rutNorm = (r.rut || '').trim().toLowerCase();
        return !rutNorm || rutNorm === 'sin qr' || rutNorm === 'sin rut';
      });

      if (restantes.length === 0) {
        setHojasSinQrPendientes([]);
        setIndiceHojaSinQr(0);
        setRutSeleccionadoModal('');
        setBusquedaAlumnoModal('');
        setMostrarFormNuevoAlumnoModal(false);
        alert('Todas las hojas han sido asignadas a sus estudiantes.');
      } else {
        await abrirAsistenteHojasSinQr(restantes);
      }
    } finally {
      setAsignandoHoja(false);
    }
  };

  const crearEstudianteNuevoYAsignarHoja = async (e) => {
    e.preventDefault();
    const hojaActual = hojasSinQrPendientes[indiceHojaSinQr];
    if (!hojaActual) return;

    const rutLimpio = nuevoRutModal.trim();
    const nombreLimpio = nuevoNombreModal.trim();
    const destinoCursoId = cursoIdNuevoAlumnoModal || cursoFiltroEfectivo || config.cursoId || (cursosDelNivelActivo[0]?.id || '');

    if (!rutLimpio || !nombreLimpio) {
      alert('Ingresa el RUT y el nombre completo del estudiante nuevo.');
      return;
    }

    if (!destinoCursoId) {
      alert('Selecciona el curso al que pertenece el estudiante nuevo.');
      return;
    }

    setCreandoAlumnoYAsignando(true);
    try {
      const cursoElegidoObj = cursos.find((c) => c.id === destinoCursoId);
      const nombreCursoFinal = cursoElegidoObj?.nombre || '';

      if (supabase) {
        const { error: estError } = await supabase
          .from('estudiantes')
          .upsert(
            [{ curso_id: destinoCursoId, rut: rutLimpio, nombre: nombreLimpio }],
            { onConflict: 'curso_id,rut' }
          );

        if (estError) {
          alert('Error al guardar el estudiante en la nómina: ' + estError.message);
          return;
        }
      }

      if (contextoAperturaEval === 'curso' && cursoActivoId) {
        await cargarEstudiantesParaEval(cursoActivoId, null);
      } else if (config.cursoId) {
        await cargarEstudiantesParaEval(config.cursoId, null);
      } else if (config.nivelId) {
        await cargarEstudiantesParaEval(null, config.nivelId);
      }

      const calificacion = evaluarRespuestasConPauta(hojaActual.respuestas || {}, config);

      if (supabase && config.id && hojaActual.id) {
        await supabase
          .from('resultados')
          .delete()
          .eq('evaluacion_id', config.id)
          .eq('rut_estudiante', rutLimpio)
          .neq('id', hojaActual.id);

        const { error: resError } = await supabase
          .from('resultados')
          .update({
            rut_estudiante: rutLimpio,
            nombre_estudiante: nombreLimpio,
            curso: nombreCursoFinal,
            puntaje_obtenido: calificacion.puntosObtenidos,
            puntaje_total: calificacion.puntosTotales,
            porcentaje: calificacion.porcentaje,
            nota: calificacion.nota
          })
          .eq('id', hojaActual.id);

        if (resError) {
          alert('El estudiante se guardó en la nómina, pero hubo un error al asignar la hoja: ' + resError.message);
          return;
        }
      }

      const nuevosRes = await cargarResultadosNube(config.id);
      const restantes = nuevosRes.filter((r) => {
        const rutNorm = (r.rut || '').trim().toLowerCase();
        return !rutNorm || rutNorm === 'sin qr' || rutNorm === 'sin rut';
      });

      setNuevoRutModal('');
      setNuevoNombreModal('');
      setMostrarFormNuevoAlumnoModal(false);

      if (restantes.length === 0) {
        setHojasSinQrPendientes([]);
        setIndiceHojaSinQr(0);
        setRutSeleccionadoModal('');
        setBusquedaAlumnoModal('');
        alert(`Estudiante "${nombreLimpio}" agregado a la nómina y calificado (Nota ${calificacion.nota.toFixed(1)}).`);
      } else {
        await abrirAsistenteHojasSinQr(restantes);
      }
    } finally {
      setCreandoAlumnoYAsignando(false);
    }
  };

  const omitirHojaSinQrActual = () => {
    setMostrarFormNuevoAlumnoModal(false);
    setNuevoRutModal('');
    setNuevoNombreModal('');
    if (indiceHojaSinQr + 1 < hojasSinQrPendientes.length) {
      setIndiceHojaSinQr(indiceHojaSinQr + 1);
      setRutSeleccionadoModal('');
      setBusquedaAlumnoModal('');
    } else {
      setHojasSinQrPendientes([]);
      setIndiceHojaSinQr(0);
      setRutSeleccionadoModal('');
      setBusquedaAlumnoModal('');
    }
  };

  const manejarEscaneo = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !config.id) return;

    setProcesando(true);
    setProgresoLote('Preparando archivos...');
    actualizarBarra(true, 'Completando lectura de archivos...', 5, 'Preparando lote...');

    try {
      let colaImagenes = [];
      for (const file of files) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const paginasImg = await convertirPdfAImagenes(file, (actual, total) => {
            const msg = `Extrayendo página ${actual} de ${total} del PDF...`;
            setProgresoLote(msg);
            actualizarBarra(true, 'Completando extracción de PDF...', Math.round((actual / total) * 30), msg);
          });
          colaImagenes = colaImagenes.concat(paginasImg);
        } else {
          colaImagenes.push(file);
        }
      }

      const cursoPorDefecto =
        (contextoAperturaEval === 'curso' && cursoActualObj?.nombre) ||
        cursoFiltroObj?.nombre ||
        '';

      const mapaEstudiantesLote = new Map();
      const sinQrLista = [];

      for (let idx = 0; idx < colaImagenes.length; idx++) {
        const msgCorr = `Leyendo hoja ${idx + 1} de ${colaImagenes.length}...`;
        setProgresoLote(msgCorr);
        actualizarBarra(
          true,
          'Completando lectura OMR...',
          30 + Math.round(((idx + 1) / colaImagenes.length) * 35),
          msgCorr
        );
        const imgFile = colaImagenes[idx];

        try {
          const resultadoOMR = await procesarHojaOMR(imgFile, {
            numPreguntas: Number(config.numPreguntas),
            alternativas: config.alternativas,
            pauta: config.pauta
          });

          const alumnoInfo = imgFile.qrPreDetectado || resultadoOMR.qrData || {
            r: 'Sin QR',
            n: `Hoja ${idx + 1} (Sin QR)`,
            c: cursoPorDefecto,
            p: 1
          };

          if (!alumnoInfo.c && cursoPorDefecto) alumnoInfo.c = cursoPorDefecto;

          const rutClave = (alumnoInfo.r || '').trim().toLowerCase();
          const esSinQr = !rutClave || rutClave === 'sin qr' || rutClave === 'sin rut';

          if (esSinQr) {
            sinQrLista.push({
              rut: 'Sin QR',
              nombre: alumnoInfo.n || `Hoja ${idx + 1} (Sin QR)`,
              curso: alumnoInfo.c || cursoPorDefecto,
              respuestas: resultadoOMR.respuestas || {},
              recortesIA: resultadoOMR.recortesIA || {},
              imagenProcesada: resultadoOMR.imagenProcesada
            });
          } else {
            const existente = mapaEstudiantesLote.get(rutClave) || {
              rut: alumnoInfo.r,
              nombre: alumnoInfo.n,
              curso: alumnoInfo.c || cursoPorDefecto,
              respuestas: {},
              recortesIA: {},
              imagenProcesada: null
            };

            existente.respuestas = { ...existente.respuestas, ...(resultadoOMR.respuestas || {}) };
            existente.recortesIA = { ...existente.recortesIA, ...(resultadoOMR.recortesIA || {}) };
            if (Number(resultadoOMR.paginaHoja || 1) === 1 || !existente.imagenProcesada) {
              existente.imagenProcesada = resultadoOMR.imagenProcesada;
            }
            mapaEstudiantesLote.set(rutClave, existente);
          }
        } catch (pageErr) {
          console.warn(`Error en hoja ${idx + 1}:`, pageErr);
        }
      }

      const registrosCrudos = [...Array.from(mapaEstudiantesLote.values()), ...sinQrLista];
      const nuevosResultados = [];

      for (let i = 0; i < registrosCrudos.length; i++) {
        const reg = registrosCrudos[i];
        const numsRecortes = Object.keys(reg.recortesIA || {}).map(Number);
        const iaMap = {};

        if (numsRecortes.length > 0 && supabase) {
          actualizarBarra(
            true,
            'Analizando respuestas escritas con IA...',
            65 + Math.round(((i + 1) / registrosCrudos.length) * 15),
            `Evaluando escritura de ${reg.nombre} (${i + 1}/${registrosCrudos.length})...`
          );

          const itemsParaIA = numsRecortes.map((numP) => {
            const itemP = (config.pauta || {})[numP] || {};
            return {
              numero: numP,
              tipo: itemP.tipo || 'desarrollo',
              imagenBase64: reg.recortesIA[numP].imagen,
              respuestaExacta: itemP.respuestaExacta || '',
              puntajeMax: obtenerPuntajeItem(itemP),
              enunciado: itemP.enunciado || '',
              rubrica: itemP.rubrica || []
            };
          });

          try {
            const { data: iaData } = await supabase.functions.invoke('ia-evaluacion', {
              body: {
                accion: 'evaluar_respuestas_abiertas',
                items: itemsParaIA
              }
            });

            const listaResIa = Array.isArray(iaData?.resultados) ? iaData.resultados : [];
            numsRecortes.forEach((numP) => {
              const hallado = listaResIa.find((x) => Number(x.numero) === numP);
              iaMap[numP] = {
                imagenRecorte: reg.recortesIA[numP].imagen,
                transcripcion: hallado?.transcripcion || '',
                puntajeSugerido: hallado?.puntajeSugerido ?? 0,
                justificacion: hallado?.justificacion || 'Pendiente de revisión docente.',
                confirmado: false
              };
            });
          } catch {
            numsRecortes.forEach((numP) => {
              iaMap[numP] = {
                imagenRecorte: reg.recortesIA[numP].imagen,
                transcripcion: '',
                puntajeSugerido: 0,
                justificacion: 'Revisión manual requerida.',
                confirmado: false
              };
            });
          }
        }

        const respuestasFinales = { ...reg.respuestas };
        if (Object.keys(iaMap).length > 0) {
          respuestasFinales._ia = iaMap;
        }

        const calificacion = evaluarRespuestasConPauta(respuestasFinales, config);
        nuevosResultados.push({
          rut: reg.rut,
          nombre: reg.nombre,
          curso: reg.curso,
          puntaje: calificacion.puntosObtenidos,
          total: calificacion.puntosTotales,
          porcentaje: calificacion.porcentaje,
          nota: calificacion.nota,
          respuestas: respuestasFinales,
          imagenProcesada: reg.imagenProcesada
        });
      }

      if (nuevosResultados.length > 0) {
        const rutsExistentesMap = new Map();
        resultadosCurso.forEach((r) => {
          const clave = r.rut.trim().toLowerCase();
          if (clave && clave !== 'sin qr' && clave !== 'sin rut') rutsExistentesMap.set(clave, r);
        });

        const duplicados = nuevosResultados.filter((n) => rutsExistentesMap.has(n.rut.trim().toLowerCase()));
        let sobreescribir = true;
        if (duplicados.length > 0) {
          const nombresDup = duplicados.slice(0, 5).map((d) => `• ${d.nombre} (${d.rut})`).join('\n');
          sobreescribir = confirm(
            `Se detectaron ${duplicados.length} estudiante(s) ya escaneados:\n\n${nombresDup}\n\n¿Deseas SOBREESCRIBIR sus resultados anteriores?`
          );
        }

        const resultadosAGuardar = sobreescribir
          ? nuevosResultados
          : nuevosResultados.filter((n) => !rutsExistentesMap.has(n.rut.trim().toLowerCase()));

        if (resultadosAGuardar.length > 0) {
          if (supabase && config.id) {
            setProgresoLote('Guardando resultados en la nube...');
            actualizarBarra(true, 'Completando guardado en la nube...', 82, 'Preparando registros...');
            if (sobreescribir && duplicados.length > 0) {
              const rutsABorrar = duplicados.map((d) => d.rut);
              await supabase.from('resultados').delete().eq('evaluacion_id', config.id).in('rut_estudiante', rutsABorrar);
            }

            const filasSupabase = resultadosAGuardar.map((reg) => ({
              evaluacion_id: config.id,
              rut_estudiante: reg.rut,
              nombre_estudiante: reg.nombre,
              curso: reg.curso,
              puntaje_obtenido: Number(reg.puntaje),
              puntaje_total: Number(reg.total),
              porcentaje: Number(reg.porcentaje),
              nota: Number(reg.nota),
              respuestas_alumno: reg.respuestas,
              imagen_corregida: reg.imagenProcesada || null
            }));

            let insertError = null;
            const tamanoLote = 10;
            for (let i = 0; i < filasSupabase.length; i += tamanoLote) {
              const bloque = filasSupabase.slice(i, i + tamanoLote);
              const finLote = Math.min(i + tamanoLote, filasSupabase.length);
              const msgSave = `Guardando en la nube (${finLote}/${filasSupabase.length})...`;
              setProgresoLote(msgSave);
              actualizarBarra(
                true,
                'Completando guardado en la nube...',
                82 + Math.round((finLote / filasSupabase.length) * 18),
                msgSave
              );
              const { error } = await supabase.from('resultados').insert(bloque);
              if (error) {
                insertError = error;
                break;
              }
            }

            if (insertError) {
              actualizarBarra(false);
              alert('Error al guardar en la nube: ' + insertError.message);
            } else {
              const listaActualizada = await cargarResultadosNube(config.id);
              actualizarBarra(true, 'Proceso completado', 100, 'Resultados guardados.');
              setTimeout(() => actualizarBarra(false), 800);

              const sinQrCount = listaActualizada.filter((r) => {
                const rn = (r.rut || '').trim().toLowerCase();
                return !rn || rn === 'sin qr' || rn === 'sin rut';
              }).length;

              if (sinQrCount > 0) {
                await abrirAsistenteHojasSinQr(listaActualizada);
              } else {
                alert(`${resultadosAGuardar.length} resultado(s) guardado(s) correctamente.`);
              }
            }
          }
        }
      } else {
        actualizarBarra(false);
      }
    } catch (err) {
      actualizarBarra(false);
      alert('Error al procesar el archivo: ' + err.message);
    } finally {
      setProcesando(false);
      setProgresoLote('');
      e.target.value = '';
    }
  };

  if (cargandoSesion) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: '#475569' }}>
        Verificando credenciales...
      </div>
    );
  }

  if (!sesion) {
    return <Login />;
  }

  if (modoRecuperacionClave) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '16px' }}>
        <form
          onSubmit={manejarActualizarContrasena}
          style={{ background: '#ffffff', padding: '28px', borderRadius: '14px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)' }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>
            Cambia tu contraseña antes de continuar
          </h2>
          <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b' }}>
            Ingresa tu nueva contraseña para asegurar el acceso a tu cuenta ({profesor.email || sesion.user?.email}).
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Nueva contraseña (mínimo 6 caracteres)</label>
            <input
              type="password"
              required
              minLength={6}
              value={nuevaClave}
              onChange={(e) => setNuevaClave(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Confirmar nueva contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmarClave}
              onChange={(e) => setConfirmarClave(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={guardandoClave}
            style={{ marginTop: '6px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: '700', fontSize: '14px', cursor: guardandoClave ? 'wait' : 'pointer' }}
          >
            {guardandoClave ? 'Guardando...' : 'Guardar Nueva Contraseña y Continuar'}
          </button>
        </form>
      </div>
    );
  }

  const tieneCursoAsignadoEnVista =
    (cursoActivoId && cursosAsignadosAula.has(cursoActivoId)) ||
    (config.cursoId && cursosAsignadosAula.has(config.cursoId)) ||
    (config.nivelId &&
      cursos.some((c) => c.nivel_id === config.nivelId && cursosAsignadosAula.has(c.id)));

  const esEvaluacionPropia =
    esEvaluacionDeSuAula(config, profesor, cursosAsignadosAula, cursos) ||
    tieneCursoAsignadoEnVista;

  const esSuperAdmin = profesor.rol === 'admin';
  const asigUsuarioNorm = (profesor?.asignatura || '').trim().toLowerCase();
  const asigEvalNorm = (config?.asignatura || '').trim().toLowerCase();
  const esMismaAsignaturaEval = Boolean(asigUsuarioNorm && asigEvalNorm && asigUsuarioNorm === asigEvalNorm);

  const puedeEditarEvalActual =
    esSuperAdmin ||
    (esEvaluacionPropia && Boolean(permisosActivos?.editar_evals_propias)) ||
    (!esEvaluacionPropia && esMismaAsignaturaEval && Boolean(permisosActivos?.editar_evals_depto)) ||
    (!esEvaluacionPropia && Boolean(permisosActivos?.editar_evals_colegio));

  const puedeBorrarEvalActual =
    esSuperAdmin ||
    (esEvaluacionPropia && Boolean(permisosActivos?.borrar_evals_propias)) ||
    (!esEvaluacionPropia && esMismaAsignaturaEval && Boolean(permisosActivos?.borrar_evals_depto)) ||
    (!esEvaluacionPropia && Boolean(permisosActivos?.borrar_evals_colegio));

  const puedeRecalcularNotasActual =
    esSuperAdmin ||
    (esEvaluacionPropia && Boolean(permisosActivos?.recalcular_notas_propias)) ||
    (!esEvaluacionPropia && esMismaAsignaturaEval && Boolean(permisosActivos?.recalcular_notas_depto)) ||
    (!esEvaluacionPropia && Boolean(permisosActivos?.recalcular_notas_colegio));

  const puedeEscanearEvalActual =
    esSuperAdmin ||
    (esEvaluacionPropia && Boolean(permisosActivos?.escanear_hojas_propias)) ||
    (!esEvaluacionPropia && esMismaAsignaturaEval && Boolean(permisosActivos?.escanear_hojas_depto)) ||
    (!esEvaluacionPropia && Boolean(permisosActivos?.escanear_hojas_colegio));

  const puedeEliminarEscaneosActual =
    esSuperAdmin ||
    (esEvaluacionPropia && Boolean(permisosActivos?.eliminar_escaneos_propias)) ||
    (!esEvaluacionPropia && esMismaAsignaturaEval && Boolean(permisosActivos?.eliminar_escaneos_depto)) ||
    (!esEvaluacionPropia && Boolean(permisosActivos?.eliminar_escaneos_colegio));

  const puedeCorregirManualActual =
    esSuperAdmin ||
    (esEvaluacionPropia && Boolean(permisosActivos?.editar_respuestas_propias)) ||
    (!esEvaluacionPropia && esMismaAsignaturaEval && Boolean(permisosActivos?.editar_respuestas_depto)) ||
    (!esEvaluacionPropia && Boolean(permisosActivos?.editar_respuestas_colegio));

  const puedeEximirActual =
    esSuperAdmin ||
    (esEvaluacionPropia && Boolean(permisosActivos?.eximir_estudiantes_propias)) ||
    (!esEvaluacionPropia && Boolean(permisosActivos?.eximir_estudiantes_otros));

  const puedeAgregarEstudiantesActual = esSuperAdmin || Boolean(permisosActivos?.agregar_estudiantes_asignados);
  const puedeEliminarEstudiantesActual = esSuperAdmin || Boolean(permisosActivos?.eliminar_estudiantes_asignados);
  const puedeCrearPerfilesActual = esSuperAdmin || Boolean(permisosActivos?.crear_perfiles_docentes);
  const puedeEditarPerfilesActual = esSuperAdmin || Boolean(permisosActivos?.editar_perfiles_docentes);
  const puedeConfigurarMatrizActual = esSuperAdmin || Boolean(permisosActivos?.configurar_matriz_permisos);
  const puedeGestionarUsuarios =
    puedeCrearPerfilesActual || puedeEditarPerfilesActual || puedeConfigurarMatrizActual;
  const puedeCrearEvaluaciones = esSuperAdmin || Boolean(permisosActivos?.crear_evaluaciones);
  const puedeAdministrarLogoInstitucional = esSuperAdmin || Boolean(permisosActivos?.configurar_matriz_permisos);

  const nivelActualObj = niveles.find((n) => n.id === nivelActivoId);
  const cursoActualObj = cursos.find((c) => c.id === cursoActivoId);
  const cursosDelNivelActivo = cursos.filter((c) => c.nivel_id === (config.nivelId || nivelActivoId));

  const cursoFiltroEfectivo =
    contextoAperturaEval === 'curso' && cursoActivoId
      ? cursoActivoId
      : filtroCursoEnNivel !== 'TODOS'
      ? filtroCursoEnNivel
      : '';

  const cursoFiltroObj = cursos.find((c) => c.id === cursoFiltroEfectivo);

  const estudiantesVisiblesEval = cursoFiltroEfectivo
    ? estudiantesCursoEval.filter((e) => e.curso_id === cursoFiltroEfectivo || e.curso_nombre === cursoFiltroObj?.nombre)
    : estudiantesCursoEval;

  const rutsPermitidosFiltro = new Set(estudiantesVisiblesEval.map((e) => e.rut.trim().toLowerCase()));

  const resultadosVisiblesEval = cursoFiltroEfectivo
    ? resultadosCurso.filter((r) => {
        const rutNorm = (r.rut || '').trim().toLowerCase();
        const esSinQr = !rutNorm || rutNorm === 'sin qr' || rutNorm === 'sin rut';
        return (
          esSinQr ||
          (cursoFiltroObj && r.curso === cursoFiltroObj.nombre) ||
          rutsPermitidosFiltro.has(rutNorm)
        );
      })
    : resultadosCurso;

  const resultadosHojasOrdenados = [...resultadosVisiblesEval].sort((a, b) => {
    let cmp = 0;
    if (ordenHojasCorregidas.col === 'nota') {
      cmp = Number(a.nota || 0) - Number(b.nota || 0);
      if (cmp === 0) {
        cmp = (a.nombre || '').trim().localeCompare((b.nombre || '').trim(), 'es', { sensitivity: 'base' });
      }
    } else {
      cmp = (a.nombre || '').trim().localeCompare((b.nombre || '').trim(), 'es', { sensitivity: 'base' });
    }
    return ordenHojasCorregidas.dir === 'asc' ? cmp : -cmp;
  });

  const rutsRendidos = new Set(resultadosVisiblesEval.map((r) => r.rut.trim().toLowerCase()));
  const eximidosSet = new Set(eximidosRuts);
  const estudiantesActivos = estudiantesVisiblesEval.filter((e) => !eximidosSet.has(e.rut.trim().toLowerCase()));
  const estudiantesEximidos = estudiantesVisiblesEval.filter((e) => eximidosSet.has(e.rut.trim().toLowerCase()));
  const totalActivos = estudiantesActivos.length;
  const estudiantesRendidos = estudiantesActivos.filter((e) => rutsRendidos.has(e.rut.trim().toLowerCase()));
  const estudiantesPendientes = estudiantesActivos.filter((e) => !rutsRendidos.has(e.rut.trim().toLowerCase()));
  const porcentajeAvance = totalActivos > 0 ? Math.round((estudiantesRendidos.length / totalActivos) * 100) : 0;

  const radio = 46;
  const circunferencia = 2 * Math.PI * radio;
  const trazoCompletado = circunferencia - (porcentajeAvance / 100) * circunferencia;

  const nivelActivoNombre = obtenerNombreNivelActivo();
  const tieneDestinoAsignado = Boolean(config.cursoId || config.nivelId);

  const pestanasEvalDisponibles = [
    { id: 'avance', label: 'Avance y Pendientes', icon: Clock, visible: true },
    { id: 'imprimir', label: 'Imprimir / Nómina Alumnos', icon: Printer, visible: true },
    { id: 'escanear', label: `Escanear Hojas (${resultadosVisiblesEval.length})`, icon: Camera, visible: puedeEscanearEvalActual },
    { id: 'pauta', label: 'Editar Pauta y Escala', icon: CheckSquare, visible: puedeEditarEvalActual },
    { id: 'analisis', label: 'Análisis y Reportes', icon: BarChart3, visible: true }
  ].filter((t) => t.visible);

  const idsVisiblesEscaneos = resultadosHojasOrdenados.map((r) => r.id).filter(Boolean);
  const todosEscaneosMarcados =
    idsVisiblesEscaneos.length > 0 &&
    idsVisiblesEscaneos.every((id) => escaneosSeleccionados.includes(id));

  const hojasSinQrEnVista = resultadosVisiblesEval.filter((r) => {
    const rn = (r.rut || '').trim().toLowerCase();
    return !rn || rn === 'sin qr' || rn === 'sin rut';
  });

  const hojaSinQrActual = hojasSinQrPendientes[indiceHojaSinQr] || null;
  const alumnosFiltradosModal = estudiantesVisiblesEval
    .filter((est) => {
      const q = busquedaAlumnoModal.trim().toLowerCase();
      if (!q) return true;
      return (
        (est.nombre || '').toLowerCase().includes(q) ||
        (est.rut || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aPend = !rutsRendidos.has(a.rut.trim().toLowerCase());
      const bPend = !rutsRendidos.has(b.rut.trim().toLowerCase());
      if (aPend !== bPend) return aPend ? -1 : 1;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });

  const cursosDisponiblesNuevoAlumno =
    cursosDelNivelActivo.length > 0 ? cursosDelNivelActivo : cursos;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
      <Sidebar
        vistaActiva={vistaActiva}
        setVistaActiva={(v) => {
          setModoResultadosNivel(false);
          if (v === 'crear-evaluacion') iniciarNuevaEvaluacion();
          else setVistaActiva(v);
        }}
        niveles={niveles}
        cursos={cursos}
        evaluaciones={evaluacionesVisibles}
        nivelActivoId={nivelActivoId}
        setNivelActivoId={(id) => {
          setNivelActivoId(id);
          setModoResultadosNivel(false);
        }}
        cursoActivoId={cursoActivoId}
        setCursoActivoId={(id) => {
          setCursoActivoId(id);
          setModoResultadosNivel(false);
        }}
        onAbrirEvaluacion={(ev, cId) => abrirEvaluacion(ev, cId, cId ? 'curso' : 'nivel')}
        profesor={profesor}
        permisos={permisosActivos}
        onCerrarSesion={cerrarSesion}
      />

      <main style={{ flex: 1, padding: '24px', maxWidth: '1100px', margin: '0 auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <BarraProgresoAzul
          visible={barraVisible}
          titulo={barraTitulo}
          porcentaje={barraPct}
          detalle={barraDetalle}
        />

        {vistaActiva === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#ffffff',
                padding: '26px 28px',
                borderRadius: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.85 }}>
                  Sistema OMR • {profesor.asignatura || 'Gestión Escolar'}
                </div>
                <h1 style={{ margin: '4px 0 6px 0', fontSize: '26px', fontWeight: '800' }}>
                  Hola, {profesor.nombre}
                </h1>
                <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                  Tienes {niveles.length} nivel(es) y {evaluacionesVisibles.length} evaluación(es) disponibles en tu panel.
                </p>
              </div>

              {puedeCrearEvaluaciones && (
                <button
                  onClick={() => iniciarNuevaEvaluacion()}
                  style={{
                    background: '#ffffff',
                    color: '#1e3a8a',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 18px',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
                  }}
                >
                  <FilePlus2 size={18} /> Crear Nueva Evaluación
                </button>
              )}
            </div>

            <div>
              <h2 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GraduationCap size={20} color="#2563eb" /> Niveles y Cursos Disponibles
              </h2>

              {niveles.length === 0 ? (
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#64748b' }}>
                  Aún no tienes cursos asignados.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px' }}>
                  {niveles.map((niv) => {
                    const cursosNiv = cursos.filter((c) => c.nivel_id === niv.id);
                    return (
                      <div
                        key={niv.id}
                        onClick={() => {
                          setNivelActivoId(niv.id);
                          setCursoActivoId('');
                          setVistaActiva('panel-nivel');
                        }}
                        style={{
                          background: '#ffffff',
                          padding: '18px 20px',
                          borderRadius: '13px',
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '10px',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '800', fontSize: '17px', color: '#0f172a' }}>{niv.nombre}</span>
                          <span style={{ fontSize: '12px', fontWeight: '700', background: '#eff6ff', color: '#1d4ed8', padding: '3px 9px', borderRadius: '999px' }}>
                            {cursosNiv.length} curso{cursosNiv.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                          {cursosNiv.length > 0
                            ? cursosNiv.map((c) => c.nombre).join(' • ')
                            : 'Sin cursos creados'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '17px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderOpen size={20} color="#16a34a" /> Evaluaciones Recientes
                </h2>
              </div>

              {evaluacionesVisibles.length === 0 ? (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '9px', fontSize: '14px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span>Aún no hay evaluaciones registradas en tu vista.</span>
                  {puedeCrearEvaluaciones && (
                    <button
                      onClick={() => iniciarNuevaEvaluacion()}
                      style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                    >
                      + Crear evaluación
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {evaluacionesVisibles.slice(0, 8).map((ev) => {
                    const cObj = cursos.find((c) => c.id === ev.curso_id);
                    const nObj = niveles.find((n) => n.id === ev.nivel_id);
                    const etiquetaDestino = cObj
                      ? cObj.nombre
                      : nObj
                      ? `Nivel Completo: ${nObj.nombre}`
                      : 'Sin asignar';
                    const deSuAula = esEvaluacionDeSuAula(ev);

                    return (
                      <div
                        key={ev.id}
                        onClick={() =>
                          abrirEvaluacion(
                            ev,
                            ev.curso_id || '',
                            ev.curso_id ? 'curso' : 'nivel'
                          )
                        }
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '15px', color: '#0f172a' }}>{ev.titulo}</strong>
                            {!deSuAula && (
                              <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px' }}>
                                Supervisión • Prof. {ev.docente_nombre || 'Docente'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                            {etiquetaDestino} • {ev.asignatura} • {ev.num_preguntas} preguntas
                          </div>
                        </div>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '6px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '12.5px' }}>
                          {deSuAula || puedeEditarEvalActual ? 'Gestionar →' : 'Ver Resultados →'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {vistaActiva === 'panel-nivel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase' }}>Nivel Escolar</div>
                <h1 style={{ margin: '2px 0 0 0', fontSize: '24px', color: '#0f172a' }}>
                  {nivelActualObj ? nivelActualObj.nombre : 'Selecciona un Nivel'}
                </h1>
              </div>

              {puedeCrearEvaluaciones && (
                <button
                  onClick={() => iniciarNuevaEvaluacion('', nivelActivoId)}
                  style={{
                    background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '9px',
                    padding: '10px 16px', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '7px'
                  }}
                >
                  <FilePlus2 size={17} /> Nueva Evaluación de Nivel ({nivelActualObj?.nombre})
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {cursos
                .filter((c) => c.nivel_id === nivelActivoId)
                .map((curso) => {
                  const cantEvalsCurso = evaluacionesVisibles.filter(
                    (ev) => ev.curso_id === curso.id || (!ev.curso_id && ev.nivel_id === nivelActivoId)
                  ).length;

                  return (
                    <div
                      key={curso.id}
                      onClick={() => {
                        setCursoActivoId(curso.id);
                        setModoResultadosNivel(false);
                        setVistaActiva('panel-curso');
                      }}
                      style={{
                        background: '#ffffff',
                        padding: '22px',
                        borderRadius: '14px',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <GraduationCap size={22} color="#2563eb" />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '700', background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '999px' }}>
                          {cantEvalsCurso} eval.
                        </span>
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#0f172a' }}>{curso.nombre}</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                          Lista de curso y evaluaciones
                        </p>
                      </div>
                    </div>
                  );
                })}

              <div
                onClick={() => setModoResultadosNivel(!modoResultadosNivel)}
                style={{
                  background: modoResultadosNivel ? '#1e3a8a' : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  color: modoResultadosNivel ? '#ffffff' : '#0f172a',
                  padding: '22px',
                  borderRadius: '14px',
                  border: '2px solid #3b82f6',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: modoResultadosNivel ? 'rgba(255,255,255,0.15)' : '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BarChart3 size={22} color="#ffffff" />
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: '700', background: modoResultadosNivel ? 'rgba(255,255,255,0.2)' : '#bfdbfe', color: modoResultadosNivel ? '#ffffff' : '#1e40af', padding: '4px 10px', borderRadius: '999px' }}>
                    Nivel Completo
                  </span>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>Evaluaciones del Nivel</h3>
                  <p style={{ margin: 0, fontSize: '13px', opacity: 0.85 }}>
                    Resultados consolidados y filtro por curso
                  </p>
                </div>
              </div>
            </div>

            {modoResultadosNivel && (
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1', marginTop: '6px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#0f172a' }}>
                  Evaluaciones Aplicadas a {nivelActualObj?.nombre}
                </h3>
                {(() => {
                  const idsCursosNivel = new Set(cursos.filter((c) => c.nivel_id === nivelActivoId).map((c) => c.id));
                  const evalsNivel = evaluacionesVisibles.filter(
                    (ev) => ev.nivel_id === nivelActivoId || idsCursosNivel.has(ev.curso_id)
                  );
                  if (evalsNivel.length === 0) {
                    return <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Aún no hay evaluaciones registradas en este nivel.</p>;
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {evalsNivel.map((ev) => {
                        const deSuAula = esEvaluacionDeSuAula(ev);
                        return (
                          <div
                            key={ev.id}
                            onClick={() => abrirEvaluacion(ev, '', 'nivel')}
                            style={{
                              padding: '12px 16px', borderRadius: '9px', border: '1px solid #e2e8f0',
                              background: '#f8fafc', cursor: 'pointer', display: 'flex',
                              justifyContent: 'space-between', alignItems: 'center'
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: '15px', color: '#0f172a' }}>{ev.titulo}</strong>
                              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                                {ev.asignatura} • {ev.num_preguntas} preguntas {!deSuAula && `• Prof. ${ev.docente_nombre || 'Docente'}`}
                              </div>
                            </div>
                            <span style={{ color: '#2563eb', fontWeight: '700', fontSize: '13px' }}>
                              Ver Resultados del Nivel →
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {vistaActiva === 'panel-curso' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setVistaActiva('panel-nivel')}
                style={{
                  background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px',
                  padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  fontWeight: '600', fontSize: '13px', color: '#334155'
                }}
              >
                <ArrowLeft size={16} /> Volver a {nivelActualObj?.nombre || 'Nivel'}
              </button>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase' }}>
                  {nivelActualObj?.nombre}
                </div>
                <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>
                  {cursoActualObj ? cursoActualObj.nombre : 'Curso'}
                </h1>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div
                onClick={() => setVistaActiva('visor-curso')}
                style={{
                  background: '#ffffff', padding: '24px', borderRadius: '14px',
                  border: '1px solid #cbd5e1', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={24} color="#16a34a" />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '19px', color: '#0f172a' }}>Lista de Curso</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Nómina de estudiantes de {cursoActualObj?.nombre}
                    </p>
                  </div>
                </div>

                <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: '9px', color: '#166534', fontWeight: '700', fontSize: '13.5px', textAlign: 'right' }}>
                  Abrir Nómina de {cursoActualObj?.nombre} →
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderOpen size={24} color="#2563eb" />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '19px', color: '#0f172a' }}>Evaluaciones</h2>
                      <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                        Resultados y gestión solo para {cursoActualObj?.nombre}
                      </p>
                    </div>
                  </div>
                  {puedeCrearEvaluaciones && (
                    <button
                      onClick={() => iniciarNuevaEvaluacion(cursoActivoId, nivelActivoId)}
                      style={{
                        background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px',
                        padding: '8px 12px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '5px'
                      }}
                    >
                      <FilePlus2 size={15} /> Crear
                    </button>
                  )}
                </div>

                {(() => {
                  const evalsCurso = evaluacionesVisibles.filter(
                    (ev) => ev.curso_id === cursoActivoId || (!ev.curso_id && ev.nivel_id === nivelActivoId)
                  );
                  if (evalsCurso.length === 0) {
                    return (
                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', fontSize: '13.5px', color: '#64748b' }}>
                        Aún no hay evaluaciones registradas para {cursoActualObj?.nombre}.
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {evalsCurso.map((ev) => {
                        const deSuAula = esEvaluacionDeSuAula(ev);
                        return (
                          <div
                            key={ev.id}
                            onClick={() => abrirEvaluacion(ev, cursoActivoId, 'curso')}
                            style={{
                              padding: '12px 14px', borderRadius: '9px', border: '1px solid #e2e8f0',
                              background: '#f8fafc', cursor: 'pointer', display: 'flex',
                              justifyContent: 'space-between', alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '14.5px', color: '#0f172a' }}>{ev.titulo}</div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                {ev.asignatura} • {ev.num_preguntas} preg. {!deSuAula && `• Prof. ${ev.docente_nombre || 'Docente'}`}
                              </div>
                            </div>
                            <span style={{ color: '#2563eb', fontWeight: '700', fontSize: '13px' }}>Entrar →</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {vistaActiva === 'perfil' && (
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '600px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={24} color="#2563eb" />
              Mi Perfil
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Correo Institucional</label>
                <input type="text" disabled value={profesor.email} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Nombre Completo</label>
                <input type="text" value={profesor.nombre} onChange={(e) => setProfesor({ ...profesor, nombre: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Asignatura / Departamento Principal</label>
                <input type="text" value={profesor.asignatura} onChange={(e) => setProfesor({ ...profesor, asignatura: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>

              <button
                onClick={async () => {
                  if (supabase && profesor.id) {
                    await supabase
                      .from('perfiles')
                      .update({ nombre: profesor.nombre, asignatura: profesor.asignatura })
                      .eq('id', profesor.id);
                    await cargarEvaluacionesNube(profesor, permisosActivos);
                    alert('Perfil actualizado correctamente.');
                  }
                }}
                style={{
                  marginTop: '8px', background: '#2563eb', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '12px', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Save size={18} /> Guardar Cambios de Perfil
              </button>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={18} color="#2563eb" />
                Logo Institucional Compartido (Hojas de Respuesta)
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {puedeAdministrarLogoInstitucional
                  ? 'Como administrador, el logo que subas aquí se sincroniza en la nube y aparece automáticamente en las hojas de respuesta de todos los docentes del colegio.'
                  : 'Este logo institucional está sincronizado para todos los docentes del colegio y se imprime automáticamente en tus hojas de respuesta.'}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '10px',
                    border: '1px dashed #94a3b8',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    padding: '6px'
                  }}
                >
                  {logoEscuela ? (
                    <img src={logoEscuela} alt="Logo institución" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', fontWeight: '600' }}>Sin logo</span>
                  )}
                </div>

                {puedeAdministrarLogoInstitucional && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <label
                      style={{
                        background: guardandoLogo ? '#e2e8f0' : '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #93c5fd',
                        borderRadius: '8px',
                        padding: '9px 14px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: guardandoLogo ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Upload size={15} />
                      {guardandoLogo ? 'Guardando...' : logoEscuela ? 'Cambiar Logo' : 'Subir Logo'}
                      <input type="file" accept="image/*" disabled={guardandoLogo} onChange={manejarSubidaLogo} style={{ display: 'none' }} />
                    </label>

                    {logoEscuela && (
                      <button
                        type="button"
                        disabled={guardandoLogo}
                        onClick={eliminarLogoEscuela}
                        style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          padding: '9px 12px',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: guardandoLogo ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Trash2 size={14} /> Quitar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={manejarActualizarContrasena} style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Cambiar Contraseña</h3>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Nueva contraseña</label>
                <input
                  type="password"
                  minLength={6}
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Confirmar nueva contraseña</label>
                <input
                  type="password"
                  minLength={6}
                  value={confirmarClave}
                  onChange={(e) => setConfirmarClave(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <button
                type="submit"
                disabled={guardandoClave}
                style={{ background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '11px', fontWeight: '700', cursor: guardandoClave ? 'wait' : 'pointer' }}
              >
                {guardandoClave ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </form>
          </div>
        )}

        {vistaActiva === 'usuarios' && puedeGestionarUsuarios && (
          <GestionUsuarios
            perfilActual={profesor}
            permisos={permisosActivos}
            onPermisosActualizados={(nuevaMatriz) => {
              const normalizada = normalizarMatrizPermisos(nuevaMatriz);
              setPermisosActivos(obtenerPermisosRol(normalizada, profesor.rol));
            }}
          />
        )}

        {vistaActiva === 'visor-curso' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {cursoActivoId && (
              <div>
                <button
                  onClick={() => setVistaActiva('panel-curso')}
                  style={{
                    background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px',
                    padding: '8px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                    fontWeight: '600', fontSize: '13px', color: '#334155'
                  }}
                >
                  <ArrowLeft size={16} /> Volver a {cursoActualObj?.nombre || 'Curso'}
                </button>
              </div>
            )}
            <VisorCurso
              niveles={niveles}
              cursos={cursos}
              cursoActivoId={cursoActivoId}
              setCursoActivoId={setCursoActivoId}
              permisos={permisosActivos}
              onRecargarEstructura={() => cargarEstructuraEscolar(profesor, permisosActivos)}
            />
          </div>
        )}

        {vistaActiva === 'crear-evaluacion' && puedeCrearEvaluaciones && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>Crear Nueva Evaluación</h2>

                {permisosActivos?.compartir_importar_pautas && evaluacionesCompartidas.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const ev = evaluacionesCompartidas.find((x) => String(x.id) === e.target.value);
                        if (ev) importarPautaCompartida(ev);
                      }}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #93c5fd', background: '#eff6ff', fontSize: '13px', fontWeight: '600', color: '#1e40af' }}
                    >
                      <option value="">Importar pauta compartida por un colega...</option>
                      {evaluacionesCompartidas.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.titulo} (Prof. {ev.docente_nombre || 'Colega'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Título de la Evaluación</label>
                  <input
                    type="text"
                    placeholder="Ej: Prueba Unidad 2 - Álgebra"
                    value={config.tituloPrueba}
                    onChange={(e) => setConfig({ ...config, tituloPrueba: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Nivel completo o Curso</label>
                  <select
                    value={valorSelectDestino}
                    onChange={(e) => manejarCambioDestinoEvaluacion(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: '600' }}
                  >
                    <option value="">-- Seleccionar nivel o curso --</option>
                    <optgroup label="Aplicar a Nivel Completo (todos sus cursos)">
                      {niveles.map((n) => {
                        const cantCursos = cursos.filter((c) => c.nivel_id === n.id).length;
                        return (
                          <option key={`niv-${n.id}`} value={`nivel:${n.id}`}>
                            Nivel Completo: {n.nombre} ({cantCursos} curso{cantCursos === 1 ? '' : 's'})
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="Aplicar a un Curso Específico">
                      {cursos.map((c) => {
                        const niv = niveles.find((n) => n.id === c.nivel_id);
                        return (
                          <option key={c.id} value={c.id}>
                            {niv ? `${niv.nombre} — ` : ''}{c.nombre}
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Asignatura</label>
                  <input
                    type="text"
                    value={config.asignatura}
                    onChange={(e) => setConfig({ ...config, asignatura: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Alternativas por Ítem</label>
                  <select
                    value={config.alternativas}
                    onChange={(e) => setConfig({ ...config, alternativas: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    <option value="ABCD">4 opciones (A - B - C - D)</option>
                    <option value="ABCDE">5 opciones (A - B - C - D - E)</option>
                    <option value="ABC">3 opciones (A - B - C)</option>
                  </select>
                </div>

                {permisosActivos?.compartir_importar_pautas && (
                  <div style={{ display: 'flex', alignItems: 'center', paddingTop: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '600', color: '#1e3a8a' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(config.compartida)}
                        onChange={(e) => setConfig({ ...config, compartida: e.target.checked })}
                        style={{ width: '17px', height: '17px' }}
                      />
                      Compartir pauta con colegas del colegio
                    </label>
                  </div>
                )}
              </div>
            </div>

            <PautaEditor
              config={config}
              setConfig={setConfig}
              nivelNombre={nivelActivoNombre}
            />

            <button
              onClick={() => guardarEvaluacionNube(false)}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                background: '#16a34a', color: 'white', fontSize: '16px', fontWeight: '700',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <Cloud size={20} />
              Guardar Evaluación en mi Cuenta
            </button>
          </div>
        )}

        {vistaActiva === 'detalle-evaluacion' && config.id && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {!puedeEditarEvalActual && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
                <ShieldAlert size={18} color="#d97706" />
                <span>
                  <strong>Modo Supervisión (Solo Lectura):</strong> Esta evaluación fue creada por <strong>{config.docenteNombre || 'otro docente'}</strong>. Puedes revisar todos los reportes, gráficos, hojas escaneadas y descargar PDF/Excel.
                </span>
              </div>
            )}

            {hojasSinQrEnVista.length > 0 && puedeCorregirManualActual && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  fontSize: '13.5px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={18} color="#dc2626" />
                  <span>
                    Hay <strong>{hojasSinQrEnVista.length} hoja(s) escaneada(s) sin QR</strong> pendientes de asignar a un estudiante.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => abrirAsistenteHojasSinQr(resultadosVisiblesEval)}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Asignar Hojas Ahora ({hojasSinQrEnVista.length})
                </button>
              </div>
            )}

            <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => {
                      if (contextoAperturaEval === 'curso' && cursoActivoId) setVistaActiva('panel-curso');
                      else if (nivelActivoId) setVistaActiva('panel-nivel');
                      else setVistaActiva('inicio');
                    }}
                    style={{
                      background: '#f1f5f9', border: 'none', borderRadius: '8px',
                      padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                      fontWeight: '600', fontSize: '13px', color: '#334155'
                    }}
                  >
                    <ArrowLeft size={15} /> Volver
                  </button>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase' }}>
                      {contextoAperturaEval === 'curso' && cursoActualObj
                        ? `Vista Exclusiva Curso: ${cursoActualObj.nombre}`
                        : `Vista Nivel Completo: ${nivelActivoNombre}`}
                    </div>
                    <h2 style={{ margin: 0, fontSize: '19px', color: '#0f172a' }}>{config.tituloPrueba}</h2>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {contextoAperturaEval === 'nivel' && cursosDelNivelActivo.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '5px 10px' }}>
                      <Filter size={14} color="#1d4ed8" />
                      <select
                        value={filtroCursoEnNivel}
                        onChange={(e) => {
                          setFiltroCursoEnNivel(e.target.value);
                          setEscaneosSeleccionados([]);
                        }}
                        style={{ border: 'none', background: 'transparent', fontSize: '13px', fontWeight: '700', color: '#1e40af', cursor: 'pointer', outline: 'none' }}
                      >
                        <option value="TODOS">Todos los cursos ({nivelActivoNombre})</option>
                        {cursosDelNivelActivo.map((c) => (
                          <option key={c.id} value={c.id}>
                            Solo {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={() => imprimirHojasPDF(estudiantesActivos, cursoFiltroObj ? `_${cursoFiltroObj.nombre.replace(/\s+/g, '_')}` : '')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 12px', borderRadius: '8px', border: '1px solid #2563eb',
                      background: '#eff6ff', color: '#1d4ed8', fontWeight: '700', cursor: 'pointer', fontSize: '13px'
                    }}
                  >
                    <Printer size={15} />
                    Imprimir ({estudiantesActivos.length})
                  </button>

                  {(puedeEditarEvalActual || puedeBorrarEvalActual || permisosActivos?.compartir_importar_pautas) && (
                    <>
                      {permisosActivos?.compartir_importar_pautas && (
                        <button
                          onClick={toggleCompartirEvaluacion}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 12px', borderRadius: '8px',
                            border: `1px solid ${config.compartida ? '#86efac' : '#cbd5e1'}`,
                            background: config.compartida ? '#dcfce7' : '#ffffff',
                            color: config.compartida ? '#166534' : '#475569',
                            fontWeight: '700', cursor: 'pointer', fontSize: '13px'
                          }}
                        >
                          <Share2 size={15} />
                          {config.compartida ? 'Compartida' : 'Compartir'}
                        </button>
                      )}

                      {puedeBorrarEvalActual && (
                        <button
                          onClick={eliminarEvaluacion}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 10px', borderRadius: '8px', border: '1px solid #fecaca',
                            background: '#fef2f2', color: '#dc2626', fontWeight: '700', cursor: 'pointer', fontSize: '13px'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {pestanasEvalDisponibles.map((tab) => {
                const Icono = tab.icon;
                const activo = subVistaEval === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSubVistaEval(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
                      borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                      background: activo ? '#0f172a' : '#e2e8f0',
                      color: activo ? '#ffffff' : '#334155'
                    }}
                  >
                    <Icono size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {subVistaEval === 'avance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {!tieneDestinoAsignado ? (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '16px', borderRadius: '12px', fontSize: '14px' }}>
                    <strong>Esta evaluación aún no tiene un curso o nivel asignado.</strong>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => setMostrarPendientesDetalle(!mostrarPendientesDetalle)}
                      style={{
                        background: '#ffffff', padding: '24px', borderRadius: '14px',
                        border: '2px solid #cbd5e1', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '20px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', width: '112px', height: '112px' }}>
                          <svg width="112" height="112" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="56" cy="56" r={radio} stroke="#e2e8f0" strokeWidth="12" fill="transparent" />
                            <circle
                              cx="56"
                              cy="56"
                              r={radio}
                              stroke={porcentajeAvance === 100 ? '#16a34a' : '#2563eb'}
                              strokeWidth="12"
                              strokeDasharray={circunferencia}
                              strokeDashoffset={trazoCompletado}
                              strokeLinecap="round"
                              fill="transparent"
                            />
                          </svg>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '20px', color: '#0f172a' }}>
                            {porcentajeAvance}%
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase' }}>
                            Cobertura {cursoFiltroObj ? `(${cursoFiltroObj.nombre})` : `(Nivel ${nivelActivoNombre})`}
                          </div>
                          <h3 style={{ margin: '4px 0', fontSize: '20px', color: '#0f172a' }}>
                            {estudiantesRendidos.length} de {totalActivos} estudiantes ya rindieron
                          </h3>
                          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                            {estudiantesPendientes.length === 0
                              ? '¡Completo! Todos los estudiantes activos tienen su hoja escaneada.'
                              : `Faltan ${estudiantesPendientes.length} estudiante(s) por rendir.`}
                            {estudiantesEximidos.length > 0 && ` (${estudiantesEximidos.length} eximido(s)).`}
                          </p>
                        </div>
                      </div>

                      {estudiantesPendientes.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            imprimirHojasPDF(estudiantesPendientes, '_Pendientes');
                          }}
                          style={{
                            background: '#ea580c', color: 'white', border: 'none', borderRadius: '10px',
                            padding: '12px 18px', fontWeight: '700', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'
                          }}
                        >
                          <Printer size={18} />
                          Imprimir Pendientes ({estudiantesPendientes.length})
                        </button>
                      )}
                    </div>

                    {mostrarPendientesDetalle && (
                      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#c2410c' }}>
                            <AlertCircle size={18} />
                            Estudiantes Pendientes / Ausentes ({estudiantesPendientes.length})
                          </h4>

                          {estudiantesPendientes.length === 0 ? (
                            <div style={{ padding: '14px', background: '#f0fdf4', color: '#166534', borderRadius: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CheckCircle2 size={18} /> No hay estudiantes pendientes.
                            </div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                              <thead style={{ background: '#fff7ed' }}>
                                <tr>
                                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #fed7aa' }}>RUT</th>
                                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #fed7aa' }}>Nombre Estudiante</th>
                                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #fed7aa' }}>Curso</th>
                                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #fed7aa' }}>Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {estudiantesPendientes.map((est) => (
                                  <tr key={est.rut} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{est.rut}</td>
                                    <td style={{ padding: '9px 10px', fontWeight: '600' }}>{est.nombre}</td>
                                    <td style={{ padding: '9px 10px', color: '#64748b' }}>{est.curso_nombre || '-'}</td>
                                    <td style={{ padding: '9px 10px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                      {puedeEximirActual && (
                                        <button
                                          onClick={() => toggleEximirEstudiante(est.rut)}
                                          style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          <UserX size={14} /> Eximir
                                        </button>
                                      )}
                                      <button
                                        onClick={() => imprimirHojasPDF([est], `_${est.rut}`)}
                                        style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <FileDown size={14} /> Hoja
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {estudiantesEximidos.length > 0 && (
                          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                              <UserX size={17} /> Estudiantes Eximidos ({estudiantesEximidos.length})
                            </h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                              <tbody>
                                {estudiantesEximidos.map((est) => (
                                  <tr key={est.rut} style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#64748b' }}>{est.rut}</td>
                                    <td style={{ padding: '8px 10px', color: '#64748b', textDecoration: 'line-through' }}>{est.nombre}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                      {puedeEximirActual && (
                                        <button
                                          onClick={() => toggleEximirEstudiante(est.rut)}
                                          style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          <UserCheck size={14} /> Deseximir
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {subVistaEval === 'imprimir' && (
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px' }}>Nómina de Impresión de Hojas de Respuestas</h3>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span>Logo institucional: <strong>{logoEscuela ? 'Activo (Compartido B/N)' : 'Sin logo'}</strong></span>
                      {puedeAdministrarLogoInstitucional && (
                        <>
                          <label style={{ color: '#2563eb', fontWeight: '700', cursor: guardandoLogo ? 'wait' : 'pointer', textDecoration: 'underline' }}>
                            {guardandoLogo ? 'Guardando...' : logoEscuela ? 'Cambiar logo escuela' : '+ Subir logo escuela'}
                            <input type="file" accept="image/*" disabled={guardandoLogo} onChange={manejarSubidaLogo} style={{ display: 'none' }} />
                          </label>
                          {logoEscuela && (
                            <button
                              type="button"
                              disabled={guardandoLogo}
                              onClick={eliminarLogoEscuela}
                              style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                            >
                              (Quitar)
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        const lista = estudiantesVisiblesEval.filter((e) => seleccionadosImprimir.includes(e.rut));
                        imprimirHojasPDF(lista);
                      }}
                      style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <FileDown size={18} /> Descargar PDF ({estudiantesVisiblesEval.filter((e) => seleccionadosImprimir.includes(e.rut)).length})
                    </button>

                    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #93c5fd', borderRadius: '8px', overflow: 'hidden', background: '#eff6ff' }}>
                      <button
                        type="button"
                        onClick={() => imprimirHojasBlancasPDF(cantidadHojasBlancas)}
                        style={{
                          background: 'transparent',
                          color: '#1e3a8a',
                          border: 'none',
                          padding: '10px 14px',
                          fontWeight: '700',
                          fontSize: '13.5px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px'
                        }}
                      >
                        <FileDown size={17} />
                        Descargar hoja en blanco ({cantidadHojasBlancas})
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #93c5fd', background: '#ffffff', padding: '0 6px', gap: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', minWidth: '16px', textAlign: 'center' }}>
                          {cantidadHojasBlancas}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <button
                            type="button"
                            onClick={() => setCantidadHojasBlancas((prev) => Math.min(6, prev + 1))}
                            title="Aumentar cantidad (máx. 6)"
                            style={{ background: 'transparent', border: 'none', padding: '1px 2px', cursor: 'pointer', color: '#1e3a8a', display: 'flex', alignItems: 'center' }}
                          >
                            <ChevronUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCantidadHojasBlancas((prev) => Math.max(1, prev - 1))}
                            title="Disminuir cantidad (mín. 1)"
                            style={{ background: 'transparent', border: 'none', padding: '1px 2px', cursor: 'pointer', color: '#1e3a8a', display: 'flex', alignItems: 'center' }}
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {puedeAgregarEstudiantesActual && (
                  <form onSubmit={agregarEstudianteAEvaluacion} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <input type="text" placeholder="RUT alumno nuevo" value={rutExtra} onChange={(e) => setRutExtra(e.target.value)} style={{ width: '170px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Nombre completo" value={nombreExtra} onChange={(e) => setNombreExtra(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserPlus size={16} /> Agregar al Curso
                    </button>
                  </form>
                )}

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead style={{ background: '#f1f5f9' }}>
                    <tr>
                      <th style={{ padding: '10px', width: '40px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            const rutsVisibles = estudiantesVisiblesEval.map((e) => e.rut);
                            const todosMarcados = rutsVisibles.every((r) => seleccionadosImprimir.includes(r));
                            if (todosMarcados) setSeleccionadosImprimir((prev) => prev.filter((r) => !rutsVisibles.includes(r)));
                            else setSeleccionadosImprimir((prev) => Array.from(new Set([...prev, ...rutsVisibles])));
                          }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          {estudiantesVisiblesEval.length > 0 && estudiantesVisiblesEval.every((e) => seleccionadosImprimir.includes(e.rut))
                            ? <CheckSquare size={18} color="#2563eb" />
                            : <Square size={18} color="#64748b" />}
                        </button>
                      </th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>RUT</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Estudiante</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Curso</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
                      {puedeEximirActual && <th style={{ padding: '10px', textAlign: 'center' }}>Eximir</th>}
                      {puedeEliminarEstudiantesActual && <th style={{ padding: '10px', textAlign: 'center' }}>Quitar</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {estudiantesVisiblesEval.map((est) => {
                      const marcado = seleccionadosImprimir.includes(est.rut);
                      const yaRindio = rutsRendidos.has(est.rut.trim().toLowerCase());
                      const esEximido = eximidosSet.has(est.rut.trim().toLowerCase());
                      return (
                        <tr key={est.rut} style={{ borderBottom: '1px solid #f1f5f9', opacity: esEximido ? 0.65 : 1 }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button onClick={() => setSeleccionadosImprimir((prev) => prev.includes(est.rut) ? prev.filter((r) => r !== est.rut) : [...prev, est.rut])} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                              {marcado ? <CheckSquare size={17} color="#2563eb" /> : <Square size={17} color="#94a3b8" />}
                            </button>
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{est.rut}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '500' }}>{est.nombre}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{est.curso_nombre || '-'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', background: esEximido ? '#e2e8f0' : yaRindio ? '#dcfce7' : '#ffedd5', color: esEximido ? '#475569' : yaRindio ? '#166534' : '#9a3412' }}>
                              {esEximido ? 'Eximido' : yaRindio ? 'Rindió' : 'Pendiente'}
                            </span>
                          </td>
                          {puedeEximirActual && (
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <button onClick={() => toggleEximirEstudiante(est.rut)} style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                                {esEximido ? 'Deseximir' : 'Eximir'}
                              </button>
                            </td>
                          )}
                          {puedeEliminarEstudiantesActual && (
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <button onClick={() => quitarEstudianteDeEvaluacion(est.rut)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                <Trash2 size={15} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {subVistaEval === 'escanear' && puedeEscanearEvalActual && (
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Escanear Hoja de Respuestas o Subir PDF</h3>

                  {resultadosVisiblesEval.length > 0 && (
                    <button
                      onClick={() => descargarHojasCorregidasPDF(resultadosHojasOrdenados, cursoFiltroObj ? `_${cursoFiltroObj.nombre.replace(/\s+/g, '_')}` : '', true)}
                      style={{
                        background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px',
                        padding: '9px 14px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <FileDown size={16} /> Descargar Todas las Corregidas ({resultadosVisiblesEval.length})
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setCamaraAbierta(true)}
                    disabled={procesando}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '9px',
                      background: procesando ? '#94a3b8' : '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      cursor: procesando ? 'wait' : 'pointer',
                      fontWeight: '700',
                      fontSize: '14.5px'
                    }}
                  >
                    <Camera size={19} />
                    Escanear con Cámara (Celular)
                  </button>

                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '9px',
                      background: procesando ? '#94a3b8' : '#2563eb',
                      color: '#ffffff',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      cursor: procesando ? 'wait' : 'pointer',
                      fontWeight: '700',
                      fontSize: '14.5px'
                    }}
                  >
                    <Upload size={19} />
                    {procesando ? (progresoLote || 'Procesando...') : 'Subir Foto o PDF Escaneado'}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={manejarEscaneo}
                      disabled={procesando}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {camaraAbierta && (
                  <CamaraOMR
                    tituloPrueba={config.tituloPrueba}
                    onCerrar={() => setCamaraAbierta(false)}
                    onCapturarImagen={(fileCapturado) => {
                      setCamaraAbierta(false);
                      manejarEscaneo({ target: { files: [fileCapturado], value: '' } });
                    }}
                  />
                )}
              </div>
            )}

            {subVistaEval === 'pauta' && puedeEditarEvalActual && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <PautaEditor config={config} setConfig={setConfig} nivelNombre={nivelActivoNombre} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <button
                    onClick={() => guardarEvaluacionNube(false)}
                    disabled={recalculando}
                    style={{
                      background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px',
                      padding: '12px', fontWeight: '700', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <Save size={18} /> Solo Guardar Pauta
                  </button>

                  {puedeRecalcularNotasActual && (
                    <button
                      onClick={() => guardarEvaluacionNube(true)}
                      disabled={recalculando}
                      style={{
                        background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px',
                        padding: '12px', fontWeight: '700', cursor: recalculando ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        boxShadow: '0 2px 6px rgba(22,163,74,0.25)'
                      }}
                    >
                      <RefreshCw size={18} />
                      {recalculando
                        ? 'Recalculando notas...'
                        : `Guardar y Recalcular Notas (${resultadosCurso.length} alumnos)`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {subVistaEval === 'analisis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <AnalisisPanel
                  resultados={resultadosVisiblesEval}
                  config={config}
                  puedeEditar={puedeCorregirManualActual}
                  esVistaNivelCompleto={!cursoFiltroEfectivo}
                  onActualizarRespuesta={async (resultadoId, nuevasRespuestas) => {
                    const calificacion = evaluarRespuestasConPauta(nuevasRespuestas, config);
                    let imagenBaseActual = resultadosCurso.find((r) => r.id === resultadoId)?.imagenProcesada || null;

                    if (!imagenBaseActual && supabase && resultadoId) {
                      const { data: filaImg } = await supabase
                        .from('resultados')
                        .select('imagen_corregida')
                        .eq('id', resultadoId)
                        .maybeSingle();
                      imagenBaseActual = filaImg?.imagen_corregida || null;
                    }

                    const nuevaImagenProcesada = imagenBaseActual
                      ? await actualizarAnotacionesImagenOMR(
                          imagenBaseActual,
                          nuevasRespuestas,
                          config
                        )
                      : null;

                    if (supabase && resultadoId) {
                      const updatePayload = {
                        respuestas_alumno: nuevasRespuestas,
                        puntaje_obtenido: calificacion.puntosObtenidos,
                        puntaje_total: calificacion.puntosTotales,
                        porcentaje: calificacion.porcentaje,
                        nota: calificacion.nota
                      };
                      if (nuevaImagenProcesada) {
                        updatePayload.imagen_corregida = nuevaImagenProcesada;
                      }

                      const { error } = await supabase
                        .from('resultados')
                        .update(updatePayload)
                        .eq('id', resultadoId);

                      if (error) {
                        alert('Error al guardar cambio: ' + error.message);
                        return null;
                      }
                    }

                    setResultadosCurso((prev) =>
                      prev.map((r) =>
                        r.id === resultadoId
                          ? {
                              ...r,
                              respuestas: nuevasRespuestas,
                              puntaje: calificacion.puntosObtenidos,
                              total: calificacion.puntosTotales,
                              porcentaje: calificacion.porcentaje,
                              nota: calificacion.nota,
                              imagenProcesada: nuevaImagenProcesada || r.imagenProcesada
                            }
                          : r
                      )
                    );

                    return {
                      puntaje: calificacion.puntosObtenidos,
                      total: calificacion.puntosTotales,
                      porcentaje: calificacion.porcentaje,
                      nota: calificacion.nota
                    };
                  }}
                />

                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Eye size={18} color="#2563eb" />
                      Hojas Corregidas para Devolución a Estudiantes ({resultadosVisiblesEval.length})
                    </h3>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => alternarOrdenHojasCorregidas('apellido')}
                        style={{
                          background: ordenHojasCorregidas.col === 'apellido' ? '#eff6ff' : '#ffffff',
                          color: ordenHojasCorregidas.col === 'apellido' ? '#1d4ed8' : '#334155',
                          border: `1px solid ${ordenHojasCorregidas.col === 'apellido' ? '#93c5fd' : '#cbd5e1'}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Ordenar por Apellido {ordenHojasCorregidas.col === 'apellido' ? (ordenHojasCorregidas.dir === 'asc' ? 'A-Z' : 'Z-A') : ''}
                      </button>

                      <button
                        type="button"
                        onClick={() => alternarOrdenHojasCorregidas('nota')}
                        style={{
                          background: ordenHojasCorregidas.col === 'nota' ? '#eff6ff' : '#ffffff',
                          color: ordenHojasCorregidas.col === 'nota' ? '#1d4ed8' : '#334155',
                          border: `1px solid ${ordenHojasCorregidas.col === 'nota' ? '#93c5fd' : '#cbd5e1'}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Ordenar por Nota {ordenHojasCorregidas.col === 'nota' ? (ordenHojasCorregidas.dir === 'asc' ? '↑' : '↓') : ''}
                      </button>

                      {resultadosVisiblesEval.length > 0 && (
                        <button
                          onClick={() => descargarHojasCorregidasPDF(resultadosHojasOrdenados, cursoFiltroObj ? `_${cursoFiltroObj.nombre.replace(/\s+/g, '_')}` : '', true)}
                          style={{
                            background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px',
                            padding: '9px 14px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <FileDown size={16} /> Descargar PDF Todas ({resultadosVisiblesEval.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {resultadosVisiblesEval.length > 0 && puedeEliminarEscaneosActual && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        marginBottom: '12px'
                      }}
                    >
                      <div style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>
                        {escaneosSeleccionados.length > 0
                          ? `${escaneosSeleccionados.length} escaneo(s) seleccionado(s)`
                          : 'Marca casillas para eliminar varios a la vez o limpia toda la lista:'}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {escaneosSeleccionados.length > 0 && (
                          <button
                            type="button"
                            onClick={eliminarEscaneosSeleccionados}
                            style={{
                              background: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '7px 12px',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <Trash2 size={14} />
                            Eliminar seleccionados ({escaneosSeleccionados.length})
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => eliminarTodosLosEscaneos(resultadosVisiblesEval)}
                          style={{
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '7px 12px',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Trash2 size={14} />
                          Eliminar todos ({resultadosVisiblesEval.length})
                        </button>
                      </div>
                    </div>
                  )}

                  {resultadosVisiblesEval.length === 0 ? (
                    <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '14px' }}>No hay hojas escaneadas registradas en esta vista.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead style={{ background: '#f1f5f9' }}>
                          <tr>
                            {puedeEliminarEscaneosActual && (
                              <th style={{ padding: '10px', width: '36px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={todosEscaneosMarcados}
                                  onChange={() => toggleSeleccionarTodosEscaneos(resultadosHojasOrdenados)}
                                  title="Seleccionar todos"
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                              </th>
                            )}
                            <th style={{ padding: '10px', textAlign: 'left' }}>Estudiante</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>RUT</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Curso</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Puntaje</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Logro</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Nota</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadosHojasOrdenados.map((res, idx) => {
                            const seleccionado = res.id && escaneosSeleccionados.includes(res.id);
                            const rutNorm = (res.rut || '').trim().toLowerCase();
                            const esSinQr = !rutNorm || rutNorm === 'sin qr' || rutNorm === 'sin rut';
                            return (
                              <tr
                                key={res.id || idx}
                                style={{
                                  borderBottom: '1px solid #f1f5f9',
                                  background: seleccionado ? '#fef2f2' : esSinQr ? '#fffbeb' : 'transparent'
                                }}
                              >
                                {puedeEliminarEscaneosActual && (
                                  <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={Boolean(seleccionado)}
                                      onChange={() => res.id && toggleSeleccionEscaneo(res.id)}
                                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                  </td>
                                )}
                                <td style={{ padding: '9px 10px', fontWeight: '600' }}>
                                  {res.nombre}
                                  {esSinQr && puedeCorregirManualActual && (
                                    <button
                                      type="button"
                                      onClick={() => abrirAsistenteHojasSinQr([res])}
                                      style={{
                                        marginLeft: '8px',
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        border: '1px solid #fcd34d',
                                        borderRadius: '6px',
                                        padding: '2px 8px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Asignar Alumno
                                    </button>
                                  )}
                                </td>
                                <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{res.rut}</td>
                                <td style={{ padding: '9px 10px', color: '#64748b' }}>{res.curso || '-'}</td>
                                <td style={{ padding: '9px 10px', textAlign: 'center' }}>{res.puntaje} / {res.total}</td>
                                <td style={{ padding: '9px 10px', textAlign: 'center' }}>{res.porcentaje}%</td>
                                <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: '800', color: Number(res.nota) >= Number(config.notaAprob || 4.0) ? '#16a34a' : '#dc2626' }}>{Number(res.nota).toFixed(1)}</td>
                                <td style={{ padding: '9px 10px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                  <button
                                    onClick={() => descargarHojasCorregidasPDF([res], `_${res.rut}`)}
                                    style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <FileDown size={14} /> PDF Alumno
                                  </button>
                                  {puedeEliminarEscaneosActual && (
                                    <button onClick={() => eliminarResultadoEscaneo(res)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <Trash2 size={14} />
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
          </div>
        )}

        {hojaSinQrActual && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1200,
              padding: '16px'
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '980px',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)'
              }}
            >
              <div
                style={{
                  background: '#fef2f2',
                  borderBottom: '1px solid #fecaca',
                  padding: '16px 22px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertCircle size={22} color="#dc2626" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#991b1b' }}>
                      Lo siento, no pude asignar estas hojas automáticamente
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#7f1d1d' }}>
                      Hoja <strong>{indiceHojaSinQr + 1} de {hojasSinQrPendientes.length}</strong> sin lectura de QR • Puntaje leído: <strong>{hojaSinQrActual.puntaje}/{hojaSinQrActual.total} pts</strong> (Nota {Number(hojaSinQrActual.nota).toFixed(1)})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setHojasSinQrPendientes([])}
                  title="Cerrar asistente"
                  style={{ background: '#ffffff', border: '1px solid #fecaca', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#991b1b', fontWeight: '700' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: hojaSinQrActual.imagenProcesada ? '1.1fr 0.9fr' : '1fr',
                  gap: '20px',
                  padding: '20px 22px',
                  overflowY: 'auto',
                  flex: 1
                }}
              >
                {hojaSinQrActual.imagenProcesada && (
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textAlign: 'center' }}>
                      Revisa los datos escritos o impresos en la hoja:
                    </div>
                    <div style={{ width: '100%', maxHeight: '62vh', overflow: 'auto', textAlign: 'center' }}>
                      <img
                        src={hojaSinQrActual.imagenProcesada}
                        alt={hojaSinQrActual.nombre}
                        style={{ width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                        Selecciona un estudiante existente o crea uno nuevo:
                      </div>

                      {puedeAgregarEstudiantesActual && (
                        <button
                          type="button"
                          onClick={() => setMostrarFormNuevoAlumnoModal((prev) => !prev)}
                          style={{
                            background: mostrarFormNuevoAlumnoModal ? '#e2e8f0' : '#eff6ff',
                            color: mostrarFormNuevoAlumnoModal ? '#0f172a' : '#1d4ed8',
                            border: '1px solid #93c5fd',
                            borderRadius: '8px',
                            padding: '6px 11px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <UserPlus size={14} />
                          {mostrarFormNuevoAlumnoModal ? 'Volver a buscar alumno' : 'Crear estudiante nuevo'}
                        </button>
                      )}
                    </div>

                    {mostrarFormNuevoAlumnoModal ? (
                      <form
                        onSubmit={crearEstudianteNuevoYAsignarHoja}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '10px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#1e3a8a' }}>
                          Nuevo Estudiante (se agregará a la nómina y al cálculo de notas)
                        </div>

                        {cursosDisponiblesNuevoAlumno.length > 0 && (
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                              Curso
                            </label>
                            <select
                              value={cursoIdNuevoAlumnoModal}
                              onChange={(e) => setCursoIdNuevoAlumnoModal(e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff' }}
                            >
                              {cursosDisponiblesNuevoAlumno.map((c) => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                            RUT del Estudiante
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ej: 22.456.789-0"
                            value={nuevoRutModal}
                            onChange={(e) => setNuevoRutModal(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                            Nombre Completo (Apellido Paterno Materno Nombres)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ej: Soto Pérez Camila Paz"
                            value={nuevoNombreModal}
                            onChange={(e) => setNuevoNombreModal(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box' }}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={creandoAlumnoYAsignando}
                          style={{
                            width: '100%',
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '9px',
                            padding: '10px 14px',
                            fontSize: '13.5px',
                            fontWeight: '700',
                            cursor: creandoAlumnoYAsignando ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '7px'
                          }}
                        >
                          <UserPlus size={16} />
                          {creandoAlumnoYAsignando ? 'Guardando estudiante...' : 'Guardar Estudiante y Asignar Hoja'}
                        </button>
                      </form>
                    ) : (
                      <>
                        <div style={{ position: 'relative' }}>
                          <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                          <input
                            type="text"
                            placeholder="Buscar por nombre o RUT..."
                            value={busquedaAlumnoModal}
                            onChange={(e) => {
                              setBusquedaAlumnoModal(e.target.value);
                              const q = e.target.value.trim().toLowerCase();
                              if (q) {
                                const coincidencia = estudiantesVisiblesEval.find(
                                  (est) =>
                                    (est.nombre || '').toLowerCase().includes(q) ||
                                    (est.rut || '').toLowerCase().includes(q)
                                );
                                if (coincidencia) setRutSeleccionadoModal(coincidencia.rut);
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '9px 12px 9px 36px',
                              borderRadius: '9px',
                              border: '1px solid #cbd5e1',
                              fontSize: '14px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                            Estudiante del curso ({alumnosFiltradosModal.length} disponibles):
                          </label>
                          <select
                            size={8}
                            value={rutSeleccionadoModal}
                            onChange={(e) => setRutSeleccionadoModal(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px',
                              borderRadius: '9px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13.5px',
                              boxSizing: 'border-box',
                              background: '#ffffff'
                            }}
                          >
                            {alumnosFiltradosModal.map((est) => {
                              const yaTieneNota = rutsRendidos.has(est.rut.trim().toLowerCase());
                              return (
                                <option
                                  key={est.rut}
                                  value={est.rut}
                                  style={{
                                    padding: '6px 8px',
                                    fontWeight: yaTieneNota ? '400' : '700',
                                    color: yaTieneNota ? '#64748b' : '#0f172a'
                                  }}
                                >
                                  {yaTieneNota ? '✓ ' : '• '}
                                  {est.nombre} ({est.rut}) {yaTieneNota ? '[Ya tiene nota]' : '[Pendiente]'}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                    {!mostrarFormNuevoAlumnoModal && (
                      <button
                        type="button"
                        onClick={asignarEstudianteAHojaSinQr}
                        disabled={!rutSeleccionadoModal || asignandoHoja}
                        style={{
                          width: '100%',
                          background: !rutSeleccionadoModal ? '#94a3b8' : '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          fontSize: '14.5px',
                          fontWeight: '700',
                          cursor: !rutSeleccionadoModal || asignandoHoja ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        {asignandoHoja
                          ? 'Asignando...'
                          : indiceHojaSinQr + 1 < hojasSinQrPendientes.length
                          ? <>Asignar y Siguiente <ArrowRight size={18} /></>
                          : <>Asignar y Finalizar <CheckCircle2 size={18} /></>}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={omitirHojaSinQrActual}
                      style={{
                        width: '100%',
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '9px',
                        padding: '9px 14px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Omitir esta hoja por ahora
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
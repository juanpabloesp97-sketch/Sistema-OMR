import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  FileDown, User, CheckCircle2, Camera, CheckSquare, Square,
  Cloud, BarChart3, Printer, Clock, AlertCircle, Save, Trash2, UserPlus,
  UserX, UserCheck, Share2, GraduationCap, Users, FolderOpen, ArrowLeft, FilePlus2, Filter, Eye, Upload, ShieldAlert
} from 'lucide-react';
import Sidebar from './Sidebar';
import VisorCurso from './VisorCurso';
import PautaEditor from './PautaEditor';
import AnalisisPanel from './AnalisisPanel';
import Login from './Login';
import GestionUsuarios from './GestionUsuarios';
import CamaraOMR from './CamaraOMR';
import { procesarHojaOMR } from './omrEngine';
import { convertirPdfAImagenes } from './pdfToImages';
import { supabase } from './supabaseClient';

const PERMISOS_RESPALDO = {
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

export default function App() {
  const [sesion, setSesion] = useState(null);
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
  const [permisosActivos, setPermisosActivos] = useState(PERMISOS_RESPALDO.docente);

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
    numPreguntas: 30,
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
  const [seleccionadosImprimir, setSeleccionadosImprimir] = useState([]);
  const [eximidosRuts, setEximidosRuts] = useState([]);
  const [mostrarPendientesDetalle, setMostrarPendientesDetalle] = useState(true);

  const [ultimoResultado, setUltimoResultado] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [progresoLote, setProgresoLote] = useState('');
  const [camaraAbierta, setCamaraAbierta] = useState(false);

  const [rutExtra, setRutExtra] = useState('');
  const [nombreExtra, setNombreExtra] = useState('');

  // Verifica si una evaluación corresponde al aula del docente
  const esEvaluacionDeSuAula = (
    ev,
    perfilUsuario = profesor,
    idsCursosProfe = cursosAsignadosAula,
    listaCursos = cursos
  ) => {
    if (!ev) return true;
    if (ev.docente_id === perfilUsuario?.id) return true;

    const asigUsuario = (perfilUsuario?.asignatura || '').trim().toLowerCase();
    const asigEval = (ev.asignatura || '').trim().toLowerCase();
    const asigCoincide = !asigUsuario || asigEval === asigUsuario;
    if (!asigCoincide) return false;

    if (ev.curso_id && idsCursosProfe.has(ev.curso_id)) return true;

    if (!ev.curso_id && ev.nivel_id) {
      const nivelesAula = new Set(
        listaCursos.filter((c) => idsCursosProfe.has(c.id)).map((c) => c.nivel_id)
      );
      if (nivelesAula.has(ev.nivel_id)) return true;
    }

    return false;
  };

  // --- SINCRONIZACIÓN CON EL HISTORIAL DEL NAVEGADOR (BOTÓN ATRÁS / ADELANTE) ---
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

  // --- CONTROL DE SESIÓN SIN REINICIAR AL CAMBIAR DE PESTAÑA ---
  useEffect(() => {
    if (!supabase) {
      setCargandoSesion(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session);
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

      // Evitar recargar/resetear la pantalla cuando el usuario vuelve de otra pestaña o se refresca el token
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
    const base = PERMISOS_RESPALDO[rolUsuario] || PERMISOS_RESPALDO.docente;
    if (!supabase) {
      setPermisosActivos(base);
      return base;
    }
    const { data } = await supabase
      .from('roles_permisos')
      .select('permisos')
      .eq('rol', rolUsuario)
      .maybeSingle();

    const finalPerms = data?.permisos ? { ...base, ...data.permisos } : base;
    setPermisosActivos(finalPerms);
    return finalPerms;
  };

  const cargarPerfilUsuario = async (user) => {
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

    setConfig((prev) => ({
      ...prev,
      docenteId: perfilFinal.id,
      docenteNombre: perfilFinal.nombre,
      asignatura: perfilFinal.asignatura || 'Matemática'
    }));
    setCargandoSesion(false);

    const { nivelesVisibles, cursosVisibles, idsAula } = await cargarEstructuraEscolar(perfilFinal, permsUsuario);
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
  };

  useEffect(() => {
    if (!sesion?.user || vistaActiva !== 'detalle-evaluacion') return;
    if (config.id) {
      cargarResultadosNube(config.id);
    } else {
      setResultadosCurso([]);
      setEximidosRuts([]);
    }

    if (contextoAperturaEval === 'curso' && cursoActivoId) {
      cargarEstudiantesParaEval(cursoActivoId, null);
    } else if (config.cursoId) {
      cargarEstudiantesParaEval(config.cursoId, null);
    } else if (config.nivelId) {
      cargarEstudiantesParaEval(null, config.nivelId);
    } else {
      setEstudiantesCursoEval([]);
      setSeleccionadosImprimir([]);
    }
  }, [config.id, config.cursoId, config.nivelId, vistaActiva, contextoAperturaEval, cursoActivoId, cursos]);

  const cerrarSesion = async () => {
    if (profesor?.id) {
      localStorage.removeItem(`omr_nav_estado_${profesor.id}`);
    }
    usuarioCargadoIdRef.current = null;
    if (supabase) await supabase.auth.signOut();
    setSesion(null);
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
        setSeleccionadosImprimir(conCurso.map((e) => e.rut));
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
        setSeleccionadosImprimir(conCurso.map((e) => e.rut));
      }
    }
  };

  const cargarResultadosNube = async (evaluacionId) => {
    if (!supabase || !evaluacionId) return;
    const { data, error } = await supabase
      .from('resultados')
      .select('*')
      .eq('evaluacion_id', evaluacionId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setResultadosCurso(
        data.map((r) => ({
          id: r.id,
          rut: r.rut_estudiante || 'Sin RUT',
          nombre: r.nombre_estudiante || 'Estudiante',
          curso: r.curso || '',
          puntaje: Number(r.puntaje_obtenido ?? 0),
          total: Number(r.puntaje_total ?? 0),
          porcentaje: Number(r.porcentaje ?? 0),
          nota: Number(r.nota ?? 1.0),
          respuestas: r.respuestas_alumno || {},
          imagenProcesada: r.imagen_corregida || null
        }))
      );
    }
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
    if (cursoFiltradoId) {
      setCursoActivoId(cursoFiltradoId);
    } else if (contexto === 'nivel') {
      setCursoActivoId('');
    }
    setEximidosRuts(Array.isArray(ev.eximidos) ? ev.eximidos : []);

    const deSuAula = esEvaluacionDeSuAula(ev, perfilUsuario, idsCursosProfe, listaCursos);
    const puedeEditarAjena = perfilUsuario?.rol === 'admin' || Boolean(permsUsuario?.editar_evals_ajenas);
    setSubVistaEval(deSuAula || puedeEditarAjena ? 'avance' : 'analisis');
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
      numPreguntas: 30,
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

  const guardarEvaluacionNube = async () => {
    if (!supabase) return;
    if (!config.tituloPrueba.trim()) {
      alert('Escribe un título para la evaluación.');
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

    if (config.id) {
      const { error } = await supabase
        .from('evaluaciones')
        .update(payload)
        .eq('id', config.id);

      if (error) {
        alert('Error al guardar cambios: ' + error.message);
      } else {
        alert('✅ Cambios guardados en la nube.');
        await cargarEvaluacionesNube(profesor, permisosActivos);
      }
    } else {
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
        alert('Error al crear evaluación: ' + error.message);
      } else if (data) {
        alert('✅ Evaluación creada correctamente.');
        await cargarEvaluacionesNube(profesor, permisosActivos);
        if (data.curso_id) {
          abrirEvaluacion(data, data.curso_id, 'curso');
        } else {
          abrirEvaluacion(data, '', 'nivel');
        }
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
    alert(`✅ Pauta "${evCompartida.titulo}" cargada. Elige tu curso o nivel y presiona Guardar Evaluación.`);
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

    setUltimoResultado(null);
    await cargarEvaluacionesNube(profesor, permisosActivos);
    if (cursoActivoId) setVistaActiva('panel-curso');
    else if (nivelActivoId) setVistaActiva('panel-nivel');
    else setVistaActiva('inicio');
  };

  const eliminarResultadoEscaneo = async (resultadoObj) => {
    if (!confirm(`¿Eliminar el escaneo de "${resultadoObj.nombre}" (${resultadoObj.rut})?`)) return;
    if (supabase && resultadoObj.id) {
      const { error } = await supabase.from('resultados').delete().eq('id', resultadoObj.id);
      if (!error) await cargarResultadosNube(config.id);
    }
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

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const opciones = config.alternativas.split('');
    const totalPreg = Number(config.numPreguntas);

    for (let i = 0; i < listaOrdenada.length; i++) {
      if (i > 0) doc.addPage();
      const est = listaOrdenada[i];
      const nombreCursoEst = est.curso_nombre || (cursoGlobalObj ? cursoGlobalObj.nombre : '');

      doc.setFillColor(0, 0, 0);
      doc.rect(12, 12, 8, 8, 'F');
      doc.rect(195, 12, 8, 8, 'F');
      doc.rect(12, 258, 8, 8, 'F');
      doc.rect(195, 258, 8, 8, 'F');

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(config.tituloPrueba, 25, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Asignatura: ${config.asignatura}`, 25, 26);
      doc.text(`Estudiante: ${est.nombre}`, 25, 32);
      doc.text(`RUT: ${est.rut}   |   Curso: ${nombreCursoEst || '-'}`, 25, 38);

      const qrPayload = JSON.stringify({
        r: est.rut,
        n: est.nombre,
        c: nombreCursoEst,
        e: config.id || ''
      });
      const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 120 });
      doc.addImage(qrDataUrl, 'PNG', 162, 14, 28, 28);

      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.3);

      for (let p = 1; p <= totalPreg; p++) {
        const col = p <= 25 ? 0 : 1;
        const fila = p <= 25 ? p - 1 : p - 26;
        const baseX = col === 0 ? 32 : 122;
        const baseY = 56 + fila * 7.8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${p}.`, baseX - 8, baseY + 1.5);

        opciones.forEach((letra, idx) => {
          const cx = baseX + idx * 11;
          doc.circle(cx, baseY, 2.7, 'S');
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.text(letra, cx - 1.3, baseY + 1);
        });
      }
    }

    doc.save(`Hojas_${config.tituloPrueba.replace(/\s+/g, '_')}${sufijoArchivo}.pdf`);
  };

  const descargarHojasCorregidasPDF = (listaResultadosAExportar, sufijoArchivo = '') => {
    if (!listaResultadosAExportar || listaResultadosAExportar.length === 0) {
      alert('No hay resultados corregidos para descargar.');
      return;
    }

    const listaOrdenada = [...listaResultadosAExportar].sort((a, b) => {
      const cursoA = (a.curso || '').trim();
      const cursoB = (b.curso || '').trim();
      const cmpCurso = cursoA.localeCompare(cursoB, 'es', { numeric: true, sensitivity: 'base' });
      if (cmpCurso !== 0) return cmpCurso;
      return (a.nombre || '').trim().localeCompare((b.nombre || '').trim(), 'es', { sensitivity: 'base' });
    });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const opciones = config.alternativas.split('');
    const totalPreg = Number(config.numPreguntas);

    for (let i = 0; i < listaOrdenada.length; i++) {
      if (i > 0) doc.addPage();
      const res = listaOrdenada[i];
      const respuestasAl = res.respuestas || {};

      doc.setDrawColor(200, 210, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 10, 188, 28, 3, 3, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${config.tituloPrueba} — Revisión OMR`, 18, 17);

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

      if (res.imagenProcesada) {
        doc.addImage(res.imagenProcesada, 'JPEG', 18, 41, 180, 228);
      } else {
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.text('Leyenda: [Verde] Correcta | [Rojo] Incorrecta | [Azul] Respuesta Correcta | BLANCO / DOBLE', 18, 44);

        for (let p = 1; p <= totalPreg; p++) {
          const col = p <= 25 ? 0 : 1;
          const fila = p <= 25 ? p - 1 : p - 26;
          const baseX = col === 0 ? 24 : 116;
          const baseY = 52 + fila * 7.8;

          const respMarcada = respuestasAl[p] || '';
          const itemPauta = config.pauta[p];
          const correcta = typeof itemPauta === 'object' ? itemPauta?.correcta : itemPauta;
          const esCorrecta = Boolean(correcta) && respMarcada === correcta;

          doc.setTextColor(15, 23, 42);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text(`${p}.`, baseX - 7, baseY + 1.2);

          opciones.forEach((letra, idx) => {
            const cx = baseX + idx * 10;

            if (respMarcada === letra) {
              doc.setFillColor(esCorrecta ? 22 : 220, esCorrecta ? 163 : 38, esCorrecta ? 74 : 38);
              doc.circle(cx, baseY, 2.7, 'F');
              doc.setTextColor(255, 255, 255);
            } else if (correcta === letra && !esCorrecta) {
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

          if (respMarcada === '') {
            doc.setTextColor(100, 116, 139);
            doc.text('X  BLANCO', estadoX, baseY + 1);
          } else if (respMarcada === 'DOBLE') {
            doc.setTextColor(217, 119, 6);
            doc.text('X  DOBLE', estadoX, baseY + 1);
          } else if (esCorrecta) {
            doc.setTextColor(22, 163, 74);
            doc.text('OK', estadoX, baseY + 1);
          } else if (correcta) {
            doc.setTextColor(220, 38, 38);
            doc.text(`X (${correcta})`, estadoX, baseY + 1);
          }
        }
      }
    }

    doc.save(`Corregidas_${config.tituloPrueba.replace(/\s+/g, '_')}${sufijoArchivo}.pdf`);
  };

  const calcularNota = (puntaje, total) => {
    const nMin = Number(config.notaMin ?? 1.0);
    const nMax = Number(config.notaMax ?? 7.0);
    const nAprob = Number(config.notaAprob ?? 4.0);
    const exig = Number(config.exigencia ?? 60);

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

  const manejarEscaneo = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !config.id) return;

    setProcesando(true);
    setProgresoLote('Preparando archivos...');

    try {
      let colaImagenes = [];
      for (const file of files) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const paginasImg = await convertirPdfAImagenes(file, (actual, total) => {
            setProgresoLote(`Extrayendo página ${actual} de ${total} del PDF...`);
          });
          colaImagenes = colaImagenes.concat(paginasImg);
        } else {
          colaImagenes.push(file);
        }
      }

      const nuevosResultados = [];

      for (let idx = 0; idx < colaImagenes.length; idx++) {
        setProgresoLote(`Corrigiendo hoja ${idx + 1} de ${colaImagenes.length}...`);
        const imgFile = colaImagenes[idx];

        try {
          const resultadoOMR = await procesarHojaOMR(imgFile, {
            numPreguntas: Number(config.numPreguntas),
            alternativas: config.alternativas,
            pauta: config.pauta
          });

          const respuestasAlumno = resultadoOMR.respuestas || {};
          const totalPreg = Number(config.numPreguntas);
          let puntosObtenidos = 0;
          let puntosTotales = 0;

          for (let i = 1; i <= totalPreg; i++) {
            const item = config.pauta[i];
            const correcta = typeof item === 'object' ? item?.correcta : item;
            const puntajeItem = typeof item === 'object' ? Number(item?.puntaje || 1) : 1;

            if (correcta) {
              puntosTotales += puntajeItem;
              if (respuestasAlumno[i] === correcta) puntosObtenidos += puntajeItem;
            }
          }

          if (puntosTotales === 0) puntosTotales = totalPreg;

          const porcentaje = Math.round((puntosObtenidos / puntosTotales) * 100);
          const nota = calcularNota(puntosObtenidos, puntosTotales);
          const alumnoInfo = imgFile.qrPreDetectado || resultadoOMR.qrData || {
            r: 'Sin QR',
            n: `Hoja ${idx + 1} (Sin QR)`,
            c: ''
          };

          nuevosResultados.push({
            rut: alumnoInfo.r || 'Sin QR',
            nombre: alumnoInfo.n || `Hoja ${idx + 1}`,
            curso: alumnoInfo.c || '',
            puntaje: puntosObtenidos,
            total: puntosTotales,
            porcentaje,
            nota,
            respuestas: respuestasAlumno,
            imagenProcesada: resultadoOMR.imagenProcesada
          });
        } catch (pageErr) {
          console.warn(`Error en hoja ${idx + 1}:`, pageErr);
        }
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
            `⚠️ Se detectaron ${duplicados.length} estudiante(s) ya escaneados:\n\n${nombresDup}\n\n¿Deseas SOBREESCRIBIR sus resultados anteriores?`
          );
        }

        const resultadosAGuardar = sobreescribir
          ? nuevosResultados
          : nuevosResultados.filter((n) => !rutsExistentesMap.has(n.rut.trim().toLowerCase()));

        if (resultadosAGuardar.length > 0) {
          setUltimoResultado(resultadosAGuardar[resultadosAGuardar.length - 1]);

          if (supabase && config.id) {
            setProgresoLote('Guardando resultados en la nube...');
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

            const { error: insertError } = await supabase.from('resultados').insert(filasSupabase).select();
            if (insertError) {
              alert('❌ Error al guardar en la nube: ' + insertError.message);
            } else {
              await cargarResultadosNube(config.id);
              alert(`✅ ${resultadosAGuardar.length} resultado(s) guardado(s) correctamente.`);
            }
          }
        }
      }
    } catch (err) {
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

  // Permisos efectivos sobre la evaluación actualmente abierta
  const esEvaluacionPropia = esEvaluacionDeSuAula(config, profesor, cursosAsignadosAula, cursos);
  const esSuperAdmin = profesor.rol === 'admin';
  const puedeEditarEvalActual = esSuperAdmin || esEvaluacionPropia || Boolean(permisosActivos?.editar_evals_ajenas);
  const puedeEscanearEvalActual = esSuperAdmin || (esEvaluacionPropia && permisosActivos?.escanear_hojas !== false) || Boolean(permisosActivos?.editar_evals_ajenas);
  const puedeCorregirManualActual =
    esSuperAdmin ||
    (esEvaluacionPropia && permisosActivos?.corregir_manual_propias !== false) ||
    (!esEvaluacionPropia && Boolean(permisosActivos?.corregir_manual_ajenas));
  const puedeEximirActual = esSuperAdmin || (esEvaluacionPropia && permisosActivos?.eximir_estudiantes !== false) || Boolean(permisosActivos?.editar_evals_ajenas);
  const puedeEditarNominasActual = esSuperAdmin || Boolean(permisosActivos?.editar_nominas);
  const puedeGestionarUsuarios = esSuperAdmin || Boolean(permisosActivos?.gestionar_usuarios);
  const puedeCrearEvaluaciones = esSuperAdmin || permisosActivos?.crear_evaluaciones !== false;

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
    ? resultadosCurso.filter(
        (r) =>
          (cursoFiltroObj && r.curso === cursoFiltroObj.nombre) ||
          rutsPermitidosFiltro.has(r.rut.trim().toLowerCase())
      )
    : resultadosCurso;

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

      <main style={{ flex: 1, padding: '24px', maxWidth: '1100px', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* VISTA INICIO: PANEL PRINCIPAL */}
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

            {/* Accesos directos a Niveles y Cursos */}
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

            {/* Evaluaciones Recientes */}
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

        {/* VISTA A: PANEL DE NIVEL */}
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

              {/* Tarjeta Evaluaciones del Nivel */}
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

        {/* VISTA B: PANEL DE CURSO */}
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

        {/* VISTA 1: MI PERFIL DOCENTE */}
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
                    alert('✅ Perfil actualizado correctamente.');
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
          </div>
        )}

        {/* VISTA 1B: GESTIÓN DE USUARIOS Y MATRIZ DE PERMISOS */}
        {vistaActiva === 'usuarios' && puedeGestionarUsuarios && (
          <GestionUsuarios
            perfilActual={profesor}
            onPermisosActualizados={(nuevaMatriz) => {
              if (nuevaMatriz[profesor.rol]) {
                setPermisosActivos(nuevaMatriz[profesor.rol]);
              }
            }}
          />
        )}

        {/* VISTA 2: LISTA DE CURSO / CONFIGURAR NIVELES */}
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
              onRecargarEstructura={() => cargarEstructuraEscolar(profesor, permisosActivos)}
            />
          </div>
        )}

        {/* VISTA 3: CREAR EVALUACIÓN */}
        {vistaActiva === 'crear-evaluacion' && puedeCrearEvaluaciones && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>Crear Nueva Evaluación</h2>

                {evaluacionesCompartidas.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const ev = evaluacionesCompartidas.find((x) => String(x.id) === e.target.value);
                        if (ev) importarPautaCompartida(ev);
                      }}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #93c5fd', background: '#eff6ff', fontSize: '13px', fontWeight: '600', color: '#1e40af' }}
                    >
                      <option value="">📥 Importar pauta compartida por un colega...</option>
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
                            📚 Nivel Completo: {n.nombre} ({cantCursos} curso{cantCursos === 1 ? '' : 's'})
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>N° Preguntas (1 a 50)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.numPreguntas}
                    onChange={(e) => setConfig({ ...config, numPreguntas: Math.min(50, Math.max(1, Number(e.target.value))) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Alternativas</label>
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
              </div>
            </div>

            <PautaEditor
              config={config}
              setConfig={setConfig}
              nivelNombre={nivelActivoNombre}
            />

            <button
              onClick={guardarEvaluacionNube}
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

        {/* VISTA 4: DETALLE DE EVALUACIÓN */}
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
                        onChange={(e) => setFiltroCursoEnNivel(e.target.value)}
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

                  {puedeEditarEvalActual && (
                    <>
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

            {/* SUBVISTA A: AVANCE Y PENDIENTES */}
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

            {/* SUBVISTA B: IMPRIMIR SELECTIVO */}
            {subVistaEval === 'imprimir' && (
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px' }}>Nómina de Impresión de Hojas de Respuestas</h3>
                  <button
                    onClick={() => {
                      const lista = estudiantesVisiblesEval.filter((e) => seleccionadosImprimir.includes(e.rut));
                      imprimirHojasPDF(lista);
                    }}
                    style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <FileDown size={18} /> Descargar PDF ({estudiantesVisiblesEval.filter((e) => seleccionadosImprimir.includes(e.rut)).length})
                  </button>
                </div>

                {puedeEditarNominasActual && (
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
                      {puedeEditarEvalActual && <th style={{ padding: '10px', textAlign: 'center' }}>Quitar</th>}
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
                          {puedeEditarEvalActual && (
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

            {/* SUBVISTA C: ESCANEAR */}
            {subVistaEval === 'escanear' && puedeEscanearEvalActual && (
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Escanear Hoja de Respuestas o Subir PDF</h3>

                  {resultadosVisiblesEval.length > 0 && (
                    <button
                      onClick={() => descargarHojasCorregidasPDF(resultadosVisiblesEval, cursoFiltroObj ? `_${cursoFiltroObj.nombre.replace(/\s+/g, '_')}` : '')}
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

                {ultimoResultado && (
                  <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '16px' }}>{ultimoResultado.nombre}</strong>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>RUT: {ultimoResultado.rut}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <button
                          onClick={() => descargarHojasCorregidasPDF([ultimoResultado], `_${ultimoResultado.rut}`)}
                          style={{
                            background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px',
                            padding: '8px 12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <FileDown size={16} /> Descargar Esta Hoja en PDF
                        </button>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '24px', fontWeight: '800', color: Number(ultimoResultado.nota) >= Number(config.notaAprob || 4.0) ? '#16a34a' : '#dc2626' }}>
                            Nota: {Number(ultimoResultado.nota).toFixed(1)}
                          </span>
                          <div style={{ fontSize: '13px', color: '#475569' }}>{ultimoResultado.puntaje} / {ultimoResultado.total} pts ({ultimoResultado.porcentaje}%)</div>
                        </div>
                      </div>
                    </div>
                    {ultimoResultado.imagenProcesada && (
                      <img src={ultimoResultado.imagenProcesada} alt="Hoja procesada" style={{ maxWidth: '100%', maxHeight: '520px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SUBVISTA D: EDITAR PAUTA */}
            {subVistaEval === 'pauta' && puedeEditarEvalActual && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <PautaEditor config={config} setConfig={setConfig} nivelNombre={nivelActivoNombre} />
                <button
                  onClick={guardarEvaluacionNube}
                  style={{ background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Save size={18} /> Guardar Cambios en Pauta
                </button>
              </div>
            )}

            {/* SUBVISTA E: ANÁLISIS Y REPORTES */}
            {subVistaEval === 'analisis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <AnalisisPanel
                  resultados={resultadosVisiblesEval}
                  config={config}
                  puedeEditar={puedeCorregirManualActual}
                  esVistaNivelCompleto={!cursoFiltroEfectivo}
                  onActualizarRespuesta={async (resultadoId, nuevasRespuestas) => {
                    const totalPreg = Number(config.numPreguntas);
                    let puntosObtenidos = 0;
                    let puntosTotales = 0;

                    for (let i = 1; i <= totalPreg; i++) {
                      const item = config.pauta[i];
                      const correcta = typeof item === 'object' ? item?.correcta : item;
                      const puntajeItem = typeof item === 'object' ? Number(item?.puntaje || 1) : 1;
                      if (correcta) {
                        puntosTotales += puntajeItem;
                        if (nuevasRespuestas[i] === correcta) puntosObtenidos += puntajeItem;
                      }
                    }
                    if (puntosTotales === 0) puntosTotales = totalPreg;

                    const porcentaje = Math.round((puntosObtenidos / puntosTotales) * 100);
                    const nota = calcularNota(puntosObtenidos, puntosTotales);

                    if (supabase && resultadoId) {
                      const { error } = await supabase
                        .from('resultados')
                        .update({
                          respuestas_alumno: nuevasRespuestas,
                          puntaje_obtenido: puntosObtenidos,
                          puntaje_total: puntosTotales,
                          porcentaje,
                          nota
                        })
                        .eq('id', resultadoId);

                      if (error) {
                        alert('Error al guardar cambio: ' + error.message);
                        return null;
                      }
                    }

                    setResultadosCurso((prev) =>
                      prev.map((r) =>
                        r.id === resultadoId
                          ? { ...r, respuestas: nuevasRespuestas, puntaje: puntosObtenidos, total: puntosTotales, porcentaje, nota }
                          : r
                      )
                    );

                    return { puntaje: puntosObtenidos, total: puntosTotales, porcentaje, nota };
                  }}
                />

                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Eye size={18} color="#2563eb" />
                      Hojas Corregidas para Devolución a Estudiantes ({resultadosVisiblesEval.length})
                    </h3>

                    {resultadosVisiblesEval.length > 0 && (
                      <button
                        onClick={() => descargarHojasCorregidasPDF(resultadosVisiblesEval, cursoFiltroObj ? `_${cursoFiltroObj.nombre.replace(/\s+/g, '_')}` : '')}
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

                  {resultadosVisiblesEval.length === 0 ? (
                    <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '14px' }}>No hay hojas escaneadas registradas en esta vista.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead style={{ background: '#f1f5f9' }}>
                          <tr>
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
                          {resultadosVisiblesEval.map((res, idx) => (
                            <tr key={res.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '9px 10px', fontWeight: '600' }}>{res.nombre}</td>
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
                                {puedeCorregirManualActual && (
                                  <button onClick={() => eliminarResultadoEscaneo(res)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Trash2 size={14} />
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
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  FileDown, User, CheckCircle2, Camera, CheckSquare, Square,
  Cloud, BarChart3, Printer, Clock, AlertCircle, Save, Trash2, UserPlus,
  UserX, UserCheck, Info
} from 'lucide-react';
import Sidebar from './Sidebar';
import VisorCurso from './VisorCurso';
import PautaEditor from './PautaEditor';
import AnalisisPanel from './AnalisisPanel';
import { procesarHojaOMR } from './omrEngine';
import { convertirPdfAImagenes } from './pdfToImages';
import { supabase } from './supabaseClient';

export default function App() {
  const [vistaActiva, setVistaActiva] = useState('evaluaciones-creadas');

  // Datos de Perfil Docente
  const [profesor, setProfesor] = useState({
    nombre: 'Profesor(a) Titular',
    asignatura: 'Matemática',
    establecimiento: 'Colegio / Liceo',
    email: ''
  });

  // Estructura escolar (Niveles y Cursos)
  const [niveles, setNiveles] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [cursoActivoId, setCursoActivoId] = useState('');

  // Evaluaciones y Resultados
  const [evaluacionesGuardadas, setEvaluacionesGuardadas] = useState([]);
  const [config, setConfig] = useState({
    id: null,
    cursoId: '',
    nivelId: '',
    tituloPrueba: 'Evaluación Sumativa N° 1',
    asignatura: 'Matemática',
    numPreguntas: 30,
    alternativas: 'ABCD',
    notaMin: 1.0,
    notaMax: 7.0,
    notaAprob: 4.0,
    exigencia: 60,
    pauta: {}
  });

  // Sub-pestaña dentro de una evaluación creada
  const [subVistaEval, setSubVistaEval] = useState('avance');
  const [estudiantesCursoEval, setEstudiantesCursoEval] = useState([]);
  const [resultadosCurso, setResultadosCurso] = useState([]);
  const [seleccionadosImprimir, setSeleccionadosImprimir] = useState([]);
  const [eximidosRuts, setEximidosRuts] = useState([]);
  const [mostrarPendientesDetalle, setMostrarPendientesDetalle] = useState(true);

  const [ultimoResultado, setUltimoResultado] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [progresoLote, setProgresoLote] = useState('');

  // Campos para agregar alumno puntual a una evaluación
  const [rutExtra, setRutExtra] = useState('');
  const [nombreExtra, setNombreExtra] = useState('');

  useEffect(() => {
    const perfilGuardado = localStorage.getItem('omr_perfil_docente');
    if (perfilGuardado) {
      try {
        setProfesor(JSON.parse(perfilGuardado));
      } catch (e) {}
    }
    const ultimaEvalId = localStorage.getItem('omr_ultima_eval_id');
    cargarEstructuraEscolar();
    cargarEvaluacionesNube(ultimaEvalId);
  }, []);

  useEffect(() => {
    if (config.id) {
      localStorage.setItem('omr_ultima_eval_id', String(config.id));
      cargarResultadosNube(config.id);
    } else {
      setResultadosCurso([]);
      setEximidosRuts([]);
    }

    if (config.cursoId) {
      cargarEstudiantesParaEval(config.cursoId, null);
    } else if (config.nivelId) {
      cargarEstudiantesParaEval(null, config.nivelId);
    } else {
      setEstudiantesCursoEval([]);
      setSeleccionadosImprimir([]);
    }
  }, [config.id, config.cursoId, config.nivelId, cursos]);

  // Obtener nombre del nivel activo (ya sea por cursoId o por nivelId directo)
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

  // Manejar selección de "Curso individual" o "Nivel completo" (valor con prefijo "nivel:")
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

  // Valor actual para el <select> unificado de Curso / Nivel
  const valorSelectDestino = config.cursoId
    ? config.cursoId
    : config.nivelId
    ? `nivel:${config.nivelId}`
    : '';

  // Eximir / Deseximir estudiante
  const toggleEximirEstudiante = async (rut) => {
    const rutNorm = rut.trim().toLowerCase();
    const existe = eximidosRuts.includes(rutNorm);
    const actualizada = existe ? eximidosRuts.filter((r) => r !== rutNorm) : [...prevSafe(eximidosRuts), rutNorm];
    setEximidosRuts(actualizada);

    if (config.id) {
      localStorage.setItem(`omr_eximidos_${config.id}`, JSON.stringify(actualizada));
      if (supabase) {
        await supabase
          .from('evaluaciones')
          .update({ eximidos: actualizada })
          .eq('id', config.id);
      }
    }
  };

  const prevSafe = (arr) => (Array.isArray(arr) ? arr : []);

  const cargarEstructuraEscolar = async () => {
    if (!supabase) return;
    const [{ data: niv }, { data: cur }] = await Promise.all([
      supabase.from('niveles').select('*').order('orden', { ascending: true }).order('nombre'),
      supabase.from('cursos').select('*').order('nombre')
    ]);
    setNiveles(niv || []);
    setCursos(cur || []);
  };

  const cargarEvaluacionesNube = async (seleccionarId = null) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('evaluaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando evaluaciones:', error);
      return;
    }

    if (data) {
      setEvaluacionesGuardadas(data);
      if (data.length === 0) {
        setConfig((prev) => ({ ...prev, id: null, cursoId: '', nivelId: '' }));
        return;
      }
      if (seleccionarId) {
        const encontrada = data.find((item) => String(item.id) === String(seleccionarId));
        if (encontrada) {
          abrirEvaluacion(encontrada, false);
          return;
        }
      }
      if (!config.id || !data.some((item) => String(item.id) === String(config.id))) {
        abrirEvaluacion(data[0], false);
      }
    }
  };

  // Carga estudiantes de un curso puntual o de TODOS los cursos de un nivel
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

    if (error) {
      console.error('Error cargando resultados:', error);
      return;
    }

    if (data) {
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
          respuestas: r.respuestas_alumno || {}
        }))
      );
    }
  };

  const abrirEvaluacion = (ev, cambiarDeVista = true) => {
    setConfig({
      id: ev.id,
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
      pauta: ev.pauta || {}
    });

    if (Array.isArray(ev.eximidos)) {
      setEximidosRuts(ev.eximidos);
    } else {
      const localEx = localStorage.getItem(`omr_eximidos_${ev.id}`);
      setEximidosRuts(localEx ? JSON.parse(localEx) : []);
    }

    setSubVistaEval('avance');
    if (cambiarDeVista) setVistaActiva('evaluaciones-creadas');
  };

  const iniciarNuevaEvaluacion = () => {
    const nivelDefecto = niveles.find((n) => n.nombre.includes('6°')) || niveles[0];
    setConfig({
      id: null,
      cursoId: '',
      nivelId: nivelDefecto ? nivelDefecto.id : '',
      tituloPrueba: '',
      asignatura: profesor.asignatura || 'Matemática',
      numPreguntas: 30,
      alternativas: 'ABCD',
      notaMin: 1.0,
      notaMax: 7.0,
      notaAprob: 4.0,
      exigencia: 60,
      pauta: {}
    });
    setVistaActiva('crear-evaluacion');
  };

  const guardarEvaluacionNube = async () => {
    if (!supabase) {
      alert('No hay conexión activa con Supabase.');
      return;
    }
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
      eximidos: eximidosRuts
    };

    if (config.id) {
      const { error } = await supabase
        .from('evaluaciones')
        .update(payload)
        .eq('id', config.id);

      if (error) {
        alert('Error al guardar cambios en la nube: ' + error.message);
      } else {
        alert('✅ Cambios guardados en la nube.');
        await cargarEvaluacionesNube(config.id);
      }
    } else {
      const { data, error } = await supabase
        .from('evaluaciones')
        .insert([payload])
        .select()
        .single();

      if (error) {
        alert('Error al crear evaluación en la nube: ' + error.message);
      } else if (data) {
        alert('✅ Evaluación creada y guardada en la nube.');
        await cargarEvaluacionesNube(data.id);
        setVistaActiva('evaluaciones-creadas');
        setSubVistaEval('avance');
      }
    }
  };

  // Asignar o cambiar curso o nivel completo en una evaluación existente
  const actualizarDestinoEvaluacionNube = async (valorSelect) => {
    manejarCambioDestinoEvaluacion(valorSelect);
    if (!supabase || !config.id) return;

    let nuevoCursoId = null;
    let nuevoNivelId = null;

    if (valorSelect.startsWith('nivel:')) {
      nuevoNivelId = valorSelect.replace('nivel:', '');
    } else if (valorSelect) {
      nuevoCursoId = valorSelect;
      const cObj = cursos.find((c) => c.id === valorSelect);
      nuevoNivelId = cObj ? cObj.nivel_id : null;
    }

    const { error } = await supabase
      .from('evaluaciones')
      .update({
        curso_id: nuevoCursoId,
        nivel_id: nuevoNivelId
      })
      .eq('id', config.id);

    if (error) {
      alert('Error al asignar curso/nivel: ' + error.message);
    } else {
      cargarEvaluacionesNube(config.id);
    }
  };

  // Eliminar evaluación completa de Supabase
  const eliminarEvaluacion = async () => {
    if (!supabase || !config.id) return;
    if (!confirm(`¿Eliminar definitivamente la evaluación "${config.tituloPrueba}" y todos sus resultados escaneados?`)) {
      return;
    }

    const { error } = await supabase
      .from('evaluaciones')
      .delete()
      .eq('id', config.id);

    if (error) {
      alert('Error al eliminar evaluación: ' + error.message);
      return;
    }

    localStorage.removeItem('omr_ultima_eval_id');
    setUltimoResultado(null);
    await cargarEvaluacionesNube();
  };

  // Eliminar un resultado escaneado individual
  const eliminarResultadoEscaneo = async (resultadoObj) => {
    if (!confirm(`¿Eliminar el escaneo de "${resultadoObj.nombre}" (${resultadoObj.rut})?`)) {
      return;
    }

    if (supabase && resultadoObj.id) {
      const { error } = await supabase
        .from('resultados')
        .delete()
        .eq('id', resultadoObj.id);

      if (error) {
        alert('Error al eliminar resultado en la nube: ' + error.message);
        return;
      }
      await cargarResultadosNube(config.id);
    } else {
      setResultadosCurso((prev) => prev.filter((r) => r !== resultadoObj));
    }
  };

  // Agregar estudiante desde la nómina de evaluación
  const agregarEstudianteAEvaluacion = async (e) => {
    e.preventDefault();
    if (!rutExtra.trim() || !nombreExtra.trim()) return;
    const nuevo = { id: 'local-' + Date.now(), rut: rutExtra.trim(), nombre: nombreExtra.trim() };

    const cursoDestinoId = config.cursoId || (config.nivelId ? cursos.find((c) => c.nivel_id === config.nivelId)?.id : null);

    if (cursoDestinoId && supabase) {
      const { error } = await supabase
        .from('estudiantes')
        .upsert([{ curso_id: cursoDestinoId, rut: nuevo.rut, nombre: nuevo.nombre }], { onConflict: 'curso_id,rut' });
      if (error) {
        alert('Error al agregar estudiante al curso: ' + error.message);
        return;
      }
      await cargarEstudiantesParaEval(config.cursoId, config.nivelId);
    } else {
      setEstudiantesCursoEval((prev) => [...prev, nuevo]);
      setSeleccionadosImprimir((prev) => [...prev, nuevo.rut]);
    }
    setRutExtra('');
    setNombreExtra('');
  };

  const quitarEstudianteDeEvaluacion = (rut) => {
    setEstudiantesCursoEval((prev) => prev.filter((e) => e.rut !== rut));
    setSeleccionadosImprimir((prev) => prev.filter((r) => r !== rut));
  };

  // Generar PDF para un subconjunto de estudiantes (respeta el curso individual de cada estudiante si es nivel completo)
  const imprimirHojasPDF = async (listaEstudiantesAImprimir, sufijoArchivo = '') => {
    if (!listaEstudiantesAImprimir || listaEstudiantesAImprimir.length === 0) {
      alert('No hay estudiantes seleccionados para imprimir. Asigna un curso o nivel primero.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const opciones = config.alternativas.split('');
    const totalPreg = Number(config.numPreguntas);
    const cursoGlobalObj = cursos.find((c) => c.id === config.cursoId);

    for (let i = 0; i < listaEstudiantesAImprimir.length; i++) {
      if (i > 0) doc.addPage();
      const est = listaEstudiantesAImprimir[i];
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

  // Escala de notas
  const calcularNota = (puntaje, total) => {
    if (total <= 0) return config.notaMin;
    const pAprob = (Number(config.exigencia) / 100) * total;
    const nMin = Number(config.notaMin);
    const nMax = Number(config.notaMax);
    const nAprob = Number(config.notaAprob);

    let nota = nMin;
    if (puntaje < pAprob) {
      nota = nMin + ((nAprob - nMin) * puntaje) / (pAprob || 1);
    } else {
      nota = nAprob + ((nMax - nAprob) * (puntaje - pAprob)) / (total - pAprob || 1);
    }
    return Number(Math.min(nMax, Math.max(nMin, nota)).toFixed(1));
  };

  // Escaneo de hojas
  const manejarEscaneo = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!config.id) {
      alert('Primero debes seleccionar o guardar una evaluación en la nube.');
      return;
    }

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
              if (respuestasAlumno[i] === correcta) {
                puntosObtenidos += puntajeItem;
              }
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
          if (clave && clave !== 'sin qr' && clave !== 'sin rut') {
            rutsExistentesMap.set(clave, r);
          }
        });

        const duplicados = nuevosResultados.filter((n) =>
          rutsExistentesMap.has(n.rut.trim().toLowerCase())
        );

        let sobreescribir = true;
        if (duplicados.length > 0) {
          const nombresDup = duplicados
            .slice(0, 5)
            .map((d) => `• ${d.nombre} (${d.rut})`)
            .join('\n');
          const extraTxt = duplicados.length > 5 ? `\n...y ${duplicados.length - 5} más.` : '';
          sobreescribir = confirm(
            `⚠️ Se detectaron ${duplicados.length} estudiante(s) que ya tienen un escaneo guardado:\n\n${nombresDup}${extraTxt}\n\n¿Deseas SOBREESCRIBIR sus resultados anteriores con este nuevo escaneo?\n(Aceptar = Sobreescribir | Cancelar = Omitir duplicados)`
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
              await supabase
                .from('resultados')
                .delete()
                .eq('evaluacion_id', config.id)
                .in('rut_estudiante', rutsABorrar);
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
              respuestas_alumno: reg.respuestas
            }));

            const { error: insertError } = await supabase
              .from('resultados')
              .insert(filasSupabase)
              .select();

            if (insertError) {
              alert('❌ Error al guardar en la nube: ' + insertError.message);
            } else {
              await cargarResultadosNube(config.id);
              alert(`✅ ${resultadosAGuardar.length} resultado(s) guardado(s) correctamente en la nube.`);
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

  // Cálculo de porcentaje rendido considerando estudiantes EXIMIDOS
  const rutsRendidos = new Set(resultadosCurso.map((r) => r.rut.trim().toLowerCase()));
  const eximidosSet = new Set(eximidosRuts);

  const estudiantesActivos = estudiantesCursoEval.filter(
    (e) => !eximidosSet.has(e.rut.trim().toLowerCase())
  );
  const estudiantesEximidos = estudiantesCursoEval.filter(
    (e) => eximidosSet.has(e.rut.trim().toLowerCase())
  );

  const totalActivos = estudiantesActivos.length;
  const estudiantesRendidos = estudiantesActivos.filter((e) =>
    rutsRendidos.has(e.rut.trim().toLowerCase())
  );
  const estudiantesPendientes = estudiantesActivos.filter(
    (e) => !rutsRendidos.has(e.rut.trim().toLowerCase())
  );

  const porcentajeAvance =
    totalActivos > 0 ? Math.round((estudiantesRendidos.length / totalActivos) * 100) : 0;

  const radio = 46;
  const circunferencia = 2 * Math.PI * radio;
  const trazoCompletado = circunferencia - (porcentajeAvance / 100) * circunferencia;

  const nivelActivoNombre = obtenerNombreNivelActivo();
  const tieneDestinoAsignado = Boolean(config.cursoId || config.nivelId);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
      {/* MENÚ LATERAL DESPLEGABLE */}
      <Sidebar
        vistaActiva={vistaActiva}
        setVistaActiva={(v) => {
          if (v === 'crear-evaluacion') iniciarNuevaEvaluacion();
          else setVistaActiva(v);
        }}
        niveles={niveles}
        cursos={cursos}
        cursoActivoId={cursoActivoId}
        setCursoActivoId={setCursoActivoId}
        profesor={profesor}
      />

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1100px', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* VISTA 1: MI PERFIL */}
        {vistaActiva === 'perfil' && (
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '600px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={24} color="#2563eb" />
              Mi Perfil Docente
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
              Configura tus datos institucionales. Más adelante podrás vincular tu cuenta con perfiles de otros docentes del establecimiento.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Nombre del Profesor(a)</label>
                <input
                  type="text"
                  value={profesor.nombre}
                  onChange={(e) => setProfesor({ ...profesor, nombre: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Asignatura Principal</label>
                <input
                  type="text"
                  value={profesor.asignatura}
                  onChange={(e) => setProfesor({ ...profesor, asignatura: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Establecimiento Educacional</label>
                <input
                  type="text"
                  value={profesor.establecimiento}
                  onChange={(e) => setProfesor({ ...profesor, establecimiento: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <button
                onClick={() => {
                  localStorage.setItem('omr_perfil_docente', JSON.stringify(profesor));
                  alert('Perfil guardado.');
                }}
                style={{
                  marginTop: '8px', background: '#2563eb', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '12px', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Save size={18} /> Guardar Perfil
              </button>
            </div>
          </div>
        )}

        {/* VISTA 2: VISOR DE CURSOS */}
        {vistaActiva === 'visor-curso' && (
          <VisorCurso
            niveles={niveles}
            cursos={cursos}
            cursoActivoId={cursoActivoId}
            setCursoActivoId={setCursoActivoId}
            onRecargarEstructura={cargarEstructuraEscolar}
          />
        )}

        {/* VISTA 3: CREAR EVALUACIÓN */}
        {vistaActiva === 'crear-evaluacion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Crear Nueva Evaluación</h2>

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
              Guardar Evaluación en la Nube
            </button>
          </div>
        )}

        {/* VISTA 4: EVALUACIONES CREADAS */}
        {vistaActiva === 'evaluaciones-creadas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Barra superior de selección, asignación de nivel/curso, impresión y eliminación */}
            <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                    EVALUACIÓN SELECCIONADA
                  </label>
                  <select
                    value={config.id || ''}
                    onChange={(e) => {
                      const ev = evaluacionesGuardadas.find((x) => String(x.id) === e.target.value);
                      if (ev) abrirEvaluacion(ev, false);
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '14px', fontWeight: '700' }}
                  >
                    {evaluacionesGuardadas.length === 0 && <option value="">Aún no tienes evaluaciones creadas</option>}
                    {evaluacionesGuardadas.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.titulo} ({ev.asignatura})
                      </option>
                    ))}
                  </select>
                </div>

                {config.id && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#2563eb', marginBottom: '4px' }}>
                      NIVEL O CURSO ASIGNADO
                    </label>
                    <select
                      value={valorSelectDestino}
                      onChange={(e) => actualizarDestinoEvaluacionNube(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #3b82f6', background: '#eff6ff', fontSize: '14px', fontWeight: '600' }}
                    >
                      <option value="">-- Sin asignar --</option>
                      <optgroup label="Nivel Completo (todos sus cursos)">
                        {niveles.map((n) => {
                          const cantCursos = cursos.filter((c) => c.nivel_id === n.id).length;
                          return (
                            <option key={`niv-${n.id}`} value={`nivel:${n.id}`}>
                              📚 Nivel Completo: {n.nombre} ({cantCursos} curso{cantCursos === 1 ? '' : 's'})
                            </option>
                          );
                        })}
                      </optgroup>
                      <optgroup label="Curso Individual">
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
                )}

                {config.id && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => imprimirHojasPDF(estudiantesActivos)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '10px 14px', borderRadius: '8px', border: '1px solid #2563eb',
                        background: '#eff6ff', color: '#1d4ed8', fontWeight: '700', cursor: 'pointer', fontSize: '13px'
                      }}
                      title="Imprimir hojas de estudiantes no eximidos"
                    >
                      <Printer size={17} />
                      Imprimir ({estudiantesActivos.length})
                    </button>

                    <button
                      onClick={eliminarEvaluacion}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '10px 14px', borderRadius: '8px', border: '1px solid #fecaca',
                        background: '#fef2f2', color: '#dc2626', fontWeight: '700', cursor: 'pointer', fontSize: '13px'
                      }}
                      title="Eliminar esta evaluación"
                    >
                      <Trash2 size={17} />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {config.id && (
              <>
                {/* Submenú de gestión de la evaluación */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'avance', label: 'Avance y Pendientes', icon: Clock },
                    { id: 'imprimir', label: 'Imprimir / Nómina Alumnos', icon: Printer },
                    { id: 'escanear', label: `Escanear Hojas (${resultadosCurso.length})`, icon: Camera },
                    { id: 'pauta', label: 'Editar Pauta y Escala', icon: CheckSquare },
                    { id: 'analisis', label: 'Análisis y Reportes', icon: BarChart3 }
                  ].map((tab) => {
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

                {/* SUBVISTA A: AVANCE, PENDIENTES Y EXIMIR / DESEXIMIR */}
                {subVistaEval === 'avance' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!tieneDestinoAsignado ? (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '16px', borderRadius: '12px', fontSize: '14px' }}>
                        <strong>Esta evaluación aún no tiene un curso o nivel asignado.</strong> Selecciónalo arriba en <em>"Nivel o Curso Asignado"</em> para ver el gráfico de cobertura y controlar los estudiantes eximidos o pendientes.
                      </div>
                    ) : (
                      <>
                        <div
                          onClick={() => setMostrarPendientesDetalle(!mostrarPendientesDetalle)}
                          style={{
                            background: '#ffffff', padding: '24px', borderRadius: '14px',
                            border: '2px solid #cbd5e1', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            flexWrap: 'wrap', gap: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
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
                              <div
                                style={{
                                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontWeight: '800', fontSize: '20px', color: '#0f172a'
                                }}
                              >
                                {porcentajeAvance}%
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase' }}>
                                Cobertura de Aplicación {config.nivelId && !config.cursoId ? `(Nivel ${nivelActivoNombre})` : ''}
                              </div>
                              <h3 style={{ margin: '4px 0', fontSize: '20px', color: '#0f172a' }}>
                                {estudiantesRendidos.length} de {totalActivos} estudiantes ya rindieron
                              </h3>
                              <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                                {estudiantesPendientes.length === 0
                                  ? '¡Completo! Todos los estudiantes activos tienen su hoja escaneada.'
                                  : `Faltan ${estudiantesPendientes.length} estudiante(s) por rendir.`}
                                {estudiantesEximidos.length > 0 && ` (${estudiantesEximidos.length} eximido(s) excluidos del cálculo).`}
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
                              Imprimir Hojas de Pendientes ({estudiantesPendientes.length})
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
                                  <CheckCircle2 size={18} />
                                  No hay estudiantes pendientes.
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
                                          <button
                                            onClick={() => toggleEximirEstudiante(est.rut)}
                                            style={{
                                              background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
                                              borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                                              fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                            }}
                                          >
                                            <UserX size={14} /> Eximir
                                          </button>
                                          <button
                                            onClick={() => imprimirHojasPDF([est], `_${est.rut}`)}
                                            style={{
                                              background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                                              borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                                              fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                            }}
                                          >
                                            <FileDown size={14} /> Imprimir Hoja
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
                                  <UserX size={17} />
                                  Estudiantes Eximidos ({estudiantesEximidos.length})
                                </h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                  <thead style={{ background: '#f8fafc' }}>
                                    <tr>
                                      <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>RUT</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Nombre Estudiante</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Restaurar</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {estudiantesEximidos.map((est) => (
                                      <tr key={est.rut} style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#64748b' }}>{est.rut}</td>
                                        <td style={{ padding: '8px 10px', color: '#64748b', textDecoration: 'line-through' }}>{est.nombre}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                          <button
                                            onClick={() => toggleEximirEstudiante(est.rut)}
                                            style={{
                                              background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
                                              borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                                              fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                            }}
                                          >
                                            <UserCheck size={14} /> Deseximir
                                          </button>
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

                {/* SUBVISTA B: IMPRIMIR SELECTIVO Y AGREGAR ESTUDIANTES */}
                {subVistaEval === 'imprimir' && (
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '17px' }}>Nómina de Impresión de Hojas de Respuestas</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                          Marca o desmarca estudiantes antes de descargar el PDF.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          const lista = estudiantesCursoEval.filter((e) => seleccionadosImprimir.includes(e.rut));
                          imprimirHojasPDF(lista);
                        }}
                        style={{
                          background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px',
                          padding: '10px 18px', fontWeight: '700', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                      >
                        <FileDown size={18} />
                        Descargar PDF Seleccionados ({seleccionadosImprimir.length})
                      </button>
                    </div>

                    <div
                      style={{
                        background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
                        padding: '12px 14px', borderRadius: '8px', fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px'
                      }}
                    >
                      <Info size={18} style={{ flexShrink: 0 }} />
                      <div>
                        <strong>Nota:</strong> Para mantener la lista unificada, los estudiantes nuevos deberían crearse en <strong>Mis Cursos</strong>. Si agregas un estudiante desde aquí, <strong>se incorporará automáticamente a la nómina oficial del curso</strong>.
                      </div>
                    </div>

                    <form onSubmit={agregarEstudianteAEvaluacion} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      <input
                        type="text"
                        placeholder="RUT alumno nuevo"
                        value={rutExtra}
                        onChange={(e) => setRutExtra(e.target.value)}
                        style={{ width: '170px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                      <input
                        type="text"
                        placeholder="Nombre completo"
                        value={nombreExtra}
                        onChange={(e) => setNombreExtra(e.target.value)}
                        style={{ flex: 1, minWidth: '200px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                      <button
                        type="submit"
                        style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <UserPlus size={16} /> Agregar al Curso
                      </button>
                    </form>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead style={{ background: '#f1f5f9' }}>
                        <tr>
                          <th style={{ padding: '10px', width: '40px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                if (seleccionadosImprimir.length === estudiantesCursoEval.length) setSeleccionadosImprimir([]);
                                else setSeleccionadosImprimir(estudiantesCursoEval.map((e) => e.rut));
                              }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                              {seleccionadosImprimir.length === estudiantesCursoEval.length && estudiantesCursoEval.length > 0 ? (
                                <CheckSquare size={18} color="#2563eb" />
                              ) : (
                                <Square size={18} color="#64748b" />
                              )}
                            </button>
                          </th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>RUT</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Estudiante</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Curso</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Eximir</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Quitar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estudiantesCursoEval.map((est) => {
                          const marcado = seleccionadosImprimir.includes(est.rut);
                          const yaRindio = rutsRendidos.has(est.rut.trim().toLowerCase());
                          const esEximido = eximidosSet.has(est.rut.trim().toLowerCase());
                          return (
                            <tr key={est.rut} style={{ borderBottom: '1px solid #f1f5f9', opacity: esEximido ? 0.65 : 1 }}>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <button
                                  onClick={() =>
                                    setSeleccionadosImprimir((prev) =>
                                      prev.includes(est.rut) ? prev.filter((r) => r !== est.rut) : [...prev, est.rut]
                                    )
                                  }
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                                >
                                  {marcado ? <CheckSquare size={17} color="#2563eb" /> : <Square size={17} color="#94a3b8" />}
                                </button>
                              </td>
                              <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{est.rut}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '500' }}>{est.nombre}</td>
                              <td style={{ padding: '8px 10px', color: '#64748b' }}>{est.curso_nombre || '-'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    padding: '3px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
                                    background: esEximido ? '#e2e8f0' : yaRindio ? '#dcfce7' : '#ffedd5',
                                    color: esEximido ? '#475569' : yaRindio ? '#166534' : '#9a3412'
                                  }}
                                >
                                  {esEximido ? 'Eximido' : yaRindio ? 'Rindió' : 'Pendiente'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <button
                                  onClick={() => toggleEximirEstudiante(est.rut)}
                                  style={{
                                    background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '6px',
                                    padding: '3px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                                    color: esEximido ? '#047857' : '#475569'
                                  }}
                                >
                                  {esEximido ? 'Deseximir' : 'Eximir'}
                                </button>
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <button
                                  onClick={() => quitarEstudianteDeEvaluacion(est.rut)}
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* SUBVISTA C: ESCANEAR */}
                {subVistaEval === 'escanear' && (
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Escanear Hoja de Respuestas o Subir PDF</h3>
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
                      Puedes subir una foto individual, seleccionar varias imágenes o cargar un <strong>PDF multipágina</strong>. Los resultados quedan guardados automáticamente en la nube.
                    </p>
                    <label
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '10px',
                        background: procesando ? '#94a3b8' : '#2563eb',
                        color: 'white', padding: '12px 20px', borderRadius: '10px',
                        cursor: procesando ? 'wait' : 'pointer', fontWeight: '700', fontSize: '15px'
                      }}
                    >
                      <Camera size={20} />
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

                    {ultimoResultado && (
                      <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div>
                            <strong style={{ fontSize: '16px' }}>{ultimoResultado.nombre}</strong>
                            <div style={{ fontSize: '13px', color: '#64748b' }}>RUT: {ultimoResultado.rut}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '24px', fontWeight: '800', color: ultimoResultado.nota >= 4.0 ? '#16a34a' : '#dc2626' }}>
                              Nota: {Number(ultimoResultado.nota).toFixed(1)}
                            </span>
                            <div style={{ fontSize: '13px', color: '#475569' }}>
                              {ultimoResultado.puntaje} / {ultimoResultado.total} pts ({ultimoResultado.porcentaje}%)
                            </div>
                          </div>
                        </div>
                        {ultimoResultado.imagenProcesada && (
                          <img
                            src={ultimoResultado.imagenProcesada}
                            alt="Hoja procesada"
                            style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SUBVISTA D: EDITAR PAUTA CON DESPLEGABLE DE OAs DEL NIVEL */}
                {subVistaEval === 'pauta' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <PautaEditor
                      config={config}
                      setConfig={setConfig}
                      nivelNombre={nivelActivoNombre}
                    />
                    <button
                      onClick={guardarEvaluacionNube}
                      style={{
                        background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px',
                        padding: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                      }}
                    >
                      <Save size={18} /> Guardar Cambios en Pauta
                    </button>
                  </div>
                )}

                {/* SUBVISTA E: ANÁLISIS, REPORTES Y GESTIÓN DE ESCANEOS INDIVIDUALES */}
                {subVistaEval === 'analisis' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <AnalisisPanel resultados={resultadosCurso} config={config} />

                    <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Trash2 size={18} color="#dc2626" />
                        Administrar Hojas Escaneadas ({resultadosCurso.length})
                      </h3>
                      <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#64748b' }}>
                        Si algún escaneo quedó duplicado, sin QR o con error de lectura, elimínalo aquí para que el estudiante vuelva a estado pendiente.
                      </p>

                      {resultadosCurso.length === 0 ? (
                        <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '14px' }}>
                          No hay hojas escaneadas registradas en esta evaluación.
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead style={{ background: '#f1f5f9' }}>
                              <tr>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Estudiante</th>
                                <th style={{ padding: '10px', textAlign: 'left' }}>RUT</th>
                                <th style={{ padding: '10px', textAlign: 'center' }}>Puntaje</th>
                                <th style={{ padding: '10px', textAlign: 'center' }}>Logro</th>
                                <th style={{ padding: '10px', textAlign: 'center' }}>Nota</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Eliminar Escaneo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {resultadosCurso.map((res, idx) => (
                                <tr key={res.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '9px 10px', fontWeight: '600' }}>{res.nombre}</td>
                                  <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{res.rut}</td>
                                  <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                                    {res.puntaje} / {res.total}
                                  </td>
                                  <td style={{ padding: '9px 10px', textAlign: 'center' }}>{res.porcentaje}%</td>
                                  <td
                                    style={{
                                      padding: '9px 10px',
                                      textAlign: 'center',
                                      fontWeight: '800',
                                      color: Number(res.nota) >= 4.0 ? '#16a34a' : '#dc2626'
                                    }}
                                  >
                                    {Number(res.nota).toFixed(1)}
                                  </td>
                                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                                    <button
                                      onClick={() => eliminarResultadoEscaneo(res)}
                                      style={{
                                        background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                        borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                                        fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                      }}
                                    >
                                      <Trash2 size={14} /> Eliminar
                                    </button>
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
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
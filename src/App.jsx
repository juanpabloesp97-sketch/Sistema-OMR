import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  FileDown, User, CheckCircle2, Camera, CheckSquare, Square,
  Cloud, BarChart3, Printer, Clock, AlertCircle, Save, Trash2, UserPlus, Info
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

  const [profesor, setProfesor] = useState({
    nombre: 'Profesor(a) Titular',
    asignatura: 'Matemática',
    establecimiento: 'Colegio / Liceo',
    email: ''
  });

  const [niveles, setNiveles] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [cursoActivoId, setCursoActivoId] = useState('');

  const [evaluacionesGuardadas, setEvaluacionesGuardadas] = useState([]);
  const [config, setConfig] = useState({
    id: null,
    nivelId: '',
    cursoId: '',
    tituloPrueba: 'Evaluación Sumativa N° 1',
    asignatura: 'Matemática',
    numPreguntas: 30,
    alternativas: 'ABCD',
    notaMin: 1.0,
    notaMax: 7.0,
    notaAprob: 4.0,
    exigencia: 60,
    pauta: {},
    eximidos: []
  });

  const [subVistaEval, setSubVistaEval] = useState('avance');
  const [estudiantesCursoEval, setEstudiantesCursoEval] = useState([]);
  const [resultadosCurso, setResultadosCurso] = useState([]);
  const [seleccionadosImprimir, setSeleccionadosImprimir] = useState([]);
  const [mostrarPendientesDetalle, setMostrarPendientesDetalle] = useState(true);

  const [ultimoResultado, setUltimoResultado] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [progresoLote, setProgresoLote] = useState('');

  const [rutExtra, setRutExtra] = useState('');
  const [nombreExtra, setNombreExtra] = useState('');

  useEffect(() => {
    const perfilGuardado = localStorage.getItem('omr_perfil_docente');
    if (perfilGuardado) {
      try {
        setProfesor(JSON.parse(perfilGuardado));
      } catch (e) {}
    }
    cargarEstructuraEscolar();
    cargarEvaluacionesNube();
  }, []);

  useEffect(() => {
    if (config.id) {
      localStorage.setItem('omr_ultima_eval_id', String(config.id));
      cargarResultadosNube(config.id);
    } else {
      setResultadosCurso([]);
    }

    if (config.cursoId) {
      cargarEstudiantesParaEval({ cursoId: config.cursoId });
    } else if (config.nivelId) {
      cargarEstudiantesParaEval({ nivelId: config.nivelId });
    } else {
      setEstudiantesCursoEval([]);
      setSeleccionadosImprimir([]);
    }
  }, [config.id, config.cursoId, config.nivelId, cursos]);

  const cargarEstructuraEscolar = async () => {
    if (!supabase) return;
    const [{ data: niv }, { data: cur }] = await Promise.all([
      supabase.from('niveles').select('*').order('orden', { ascending: true }).order('nombre'),
      supabase.from('cursos').select('*').order('nombre')
    ]);
    setNiveles(niv || []);
    setCursos(cur || []);
  };

  const cargarEvaluacionesNube = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('evaluaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEvaluacionesGuardadas(data);
      const ultimaId = localStorage.getItem('omr_ultima_eval_id');
      const encontrada = data.find((ev) => String(ev.id) === String(ultimaId)) || data[0];
      if (encontrada && !config.id) {
        abrirEvaluacion(encontrada, false);
      }
    }
  };

  const cargarEstudiantesParaEval = async ({ cursoId, nivelId }) => {
    if (!supabase) return;

    if (cursoId) {
      const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('curso_id', cursoId)
        .order('nombre');

      if (!error && data) {
        setEstudiantesCursoEval(data);
        setSeleccionadosImprimir(data.map((e) => e.rut));
      }
    } else if (nivelId) {
      const idsCursosNivel = cursos
        .filter((c) => String(c.nivel_id) === String(nivelId))
        .map((c) => c.id);

      if (idsCursosNivel.length === 0) {
        setEstudiantesCursoEval([]);
        setSeleccionadosImprimir([]);
        return;
      }

      const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .in('curso_id', idsCursosNivel)
        .order('nombre');

      if (!error && data) {
        setEstudiantesCursoEval(data);
        setSeleccionadosImprimir(data.map((e) => e.rut));
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
          rut: r.rut_estudiante,
          nombre: r.nombre_estudiante,
          curso: r.curso || '',
          puntaje: Number(r.puntaje_obtenido ?? 0),
          total: Number(r.puntaje_total ?? config.numPreguntas),
          porcentaje: Number(r.porcentaje ?? 0),
          nota: Number(r.nota ?? 1.0),
          respuestas: r.respuestas_alumno || {},
          imagenUrl: r.imagen_url || null
        }))
      );
    }
  };

  const abrirEvaluacion = (ev, cambiarDeVista = true) => {
    const cursoEncontrado = cursos.find((c) => String(c.id) === String(ev.curso_id));
    setConfig({
      id: ev.id,
      nivelId: ev.nivel_id || (cursoEncontrado ? cursoEncontrado.nivel_id : ''),
      cursoId: ev.curso_id || '',
      tituloPrueba: ev.titulo,
      asignatura: ev.asignatura || '',
      numPreguntas: ev.num_preguntas || 30,
      alternativas: ev.alternativas || 'ABCD',
      notaMin: ev.nota_min ?? 1.0,
      notaMax: ev.nota_max ?? 7.0,
      notaAprob: ev.nota_aprob ?? 4.0,
      exigencia: ev.exigencia ?? 60,
      pauta: ev.pauta || {},
      eximidos: Array.isArray(ev.eximidos) ? ev.eximidos : []
    });
    setUltimoResultado(null);
    setSubVistaEval('avance');
    if (cambiarDeVista) setVistaActiva('evaluaciones-creadas');
  };

  const iniciarNuevaEvaluacion = () => {
    setConfig({
      id: null,
      nivelId: niveles.length > 0 ? niveles[0].id : '',
      cursoId: '',
      tituloPrueba: '',
      asignatura: profesor.asignatura || 'Matemática',
      numPreguntas: 30,
      alternativas: 'ABCD',
      notaMin: 1.0,
      notaMax: 7.0,
      notaAprob: 4.0,
      exigencia: 60,
      pauta: {},
      eximidos: []
    });
    setVistaActiva('crear-evaluacion');
  };

  // Maneja el selector unificado ("nivel:ID" o "curso:ID")
  const manejarCambioDestino = async (valorSelector, guardarEnNube = false) => {
    let nuevoNivelId = '';
    let nuevoCursoId = '';

    if (valorSelector.startsWith('nivel:')) {
      nuevoNivelId = valorSelector.replace('nivel:', '');
      nuevoCursoId = '';
    } else if (valorSelector.startsWith('curso:')) {
      nuevoCursoId = valorSelector.replace('curso:', '');
      const cObj = cursos.find((c) => String(c.id) === String(nuevoCursoId));
      nuevoNivelId = cObj ? cObj.nivel_id : '';
    }

    setConfig((prev) => ({
      ...prev,
      nivelId: nuevoNivelId,
      cursoId: nuevoCursoId
    }));

    if (guardarEnNube && config.id && supabase) {
      const { error } = await supabase
        .from('evaluaciones')
        .update({
          curso_id: nuevoCursoId || null,
          nivel_id: nuevoNivelId || null
        })
        .eq('id', config.id);

      if (error) {
        alert('Error al asignar nivel/curso: ' + error.message);
      } else {
        cargarEvaluacionesNube();
      }
    }
  };

  const guardarEvaluacionNube = async () => {
    if (!supabase) return;
    if (!config.tituloPrueba.trim()) {
      alert('Escribe un título para la evaluación.');
      return;
    }

    const cursoObj = cursos.find((c) => String(c.id) === String(config.cursoId));
    const nivelFinalId = config.nivelId || (cursoObj ? cursoObj.nivel_id : null);

    const payload = {
      titulo: config.tituloPrueba.trim(),
      asignatura: config.asignatura,
      curso_id: config.cursoId || null,
      nivel_id: nivelFinalId || null,
      num_preguntas: Number(config.numPreguntas),
      alternativas: config.alternativas,
      nota_min: Number(config.notaMin),
      nota_max: Number(config.notaMax),
      nota_aprob: Number(config.notaAprob),
      exigencia: Number(config.exigencia),
      pauta: config.pauta,
      eximidos: config.eximidos || []
    };

    if (config.id) {
      const { error } = await supabase
        .from('evaluaciones')
        .update(payload)
        .eq('id', config.id);

      if (error) {
        alert('Error al actualizar en nube: ' + error.message);
      } else {
        alert('✅ Evaluación actualizada en la nube.');
        cargarEvaluacionesNube();
      }
    } else {
      const { data, error } = await supabase
        .from('evaluaciones')
        .insert([payload])
        .select()
        .single();

      if (error) {
        alert('Error al crear evaluación: ' + error.message);
      } else if (data) {
        setConfig((prev) => ({ ...prev, id: data.id }));
        alert('✅ Evaluación creada y guardada en la nube.');
        await cargarEvaluacionesNube();
        setVistaActiva('evaluaciones-creadas');
        setSubVistaEval('avance');
      }
    }
  };

  const eliminarEvaluacionActual = async () => {
    if (!config.id || !supabase) return;
    const confirmar = window.confirm(
      `¿Eliminar la evaluación "${config.tituloPrueba}" y todos sus resultados escaneados? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    await supabase.from('resultados').delete().eq('evaluacion_id', config.id);
    const { error } = await supabase.from('evaluaciones').delete().eq('id', config.id);

    if (error) {
      alert('Error al eliminar evaluación: ' + error.message);
      return;
    }

    localStorage.removeItem('omr_ultima_eval_id');
    const restantes = evaluacionesGuardadas.filter((ev) => ev.id !== config.id);
    setEvaluacionesGuardadas(restantes);
    if (restantes.length > 0) {
      abrirEvaluacion(restantes[0], false);
    } else {
      iniciarNuevaEvaluacion();
    }
  };

  const toggleEximirEstudiante = async (rut) => {
    const rutNorm = rut.trim();
    const actuales = config.eximidos || [];
    const yaEximido = actuales.includes(rutNorm);
    const nuevosEximidos = yaEximido
      ? actuales.filter((r) => r !== rutNorm)
      : [...actuales, rutNorm];

    setConfig((prev) => ({ ...prev, eximidos: nuevosEximidos }));

    if (config.id && supabase) {
      await supabase
        .from('evaluaciones')
        .update({ eximidos: nuevosEximidos })
        .eq('id', config.id);
    }
  };

  const agregarEstudianteAEvaluacion = async (e) => {
    e.preventDefault();
    if (!rutExtra.trim() || !nombreExtra.trim()) return;

    let cursoDestinoId = config.cursoId;
    if (!cursoDestinoId && config.nivelId) {
      const cursosDelNivel = cursos.filter((c) => String(c.nivel_id) === String(config.nivelId));
      if (cursosDelNivel.length > 0) cursoDestinoId = cursosDelNivel[0].id;
    }

    if (!cursoDestinoId) {
      alert('Primero asigna un curso o nivel a esta evaluación.');
      return;
    }

    const nuevo = { curso_id: cursoDestinoId, rut: rutExtra.trim(), nombre: nombreExtra.trim() };
    if (supabase) {
      const { error } = await supabase
        .from('estudiantes')
        .upsert([nuevo], { onConflict: 'curso_id,rut' });

      if (error) {
        alert('Error al agregar estudiante al curso: ' + error.message);
        return;
      }
      await cargarEstudiantesParaEval({ cursoId: config.cursoId, nivelId: config.nivelId });
    }
    setRutExtra('');
    setNombreExtra('');
  };

  const quitarEstudianteDeEvaluacion = (rut) => {
    setEstudiantesCursoEval((prev) => prev.filter((e) => e.rut !== rut));
    setSeleccionadosImprimir((prev) => prev.filter((r) => r !== rut));
  };

  const eliminarResultadoIndividual = async (resultadoId, rut) => {
    const confirmar = window.confirm('¿Eliminar este escaneo de la evaluación?');
    if (!confirmar) return;

    if (supabase && resultadoId) {
      const { error } = await supabase.from('resultados').delete().eq('id', resultadoId);
      if (error) {
        alert('Error al eliminar escaneo: ' + error.message);
        return;
      }
    }

    setResultadosCurso((prev) =>
      prev.filter((r) => (resultadoId ? r.id !== resultadoId : r.rut !== rut))
    );
  };

  // Actualizar respuesta editada manualmente desde el modal del estudiante
  const actualizarRespuestaEstudiante = async (resultadoId, nuevasRespuestas) => {
    const totalPreg = Number(config.numPreguntas);
    let puntosObtenidos = 0;
    let puntosTotales = 0;

    for (let i = 1; i <= totalPreg; i++) {
      const item = config.pauta[i];
      const correcta = typeof item === 'object' ? item?.correcta : item;
      const puntajeItem = typeof item === 'object' ? Number(item?.puntaje || 1) : 1;

      if (correcta) {
        puntosTotales += puntajeItem;
        if (nuevasRespuestas[i] === correcta) {
          puntosObtenidos += puntajeItem;
        }
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
        alert('Error al guardar corrección en la nube: ' + error.message);
        return null;
      }
    }

    setResultadosCurso((prev) =>
      prev.map((item) =>
        item.id === resultadoId
          ? {
              ...item,
              respuestas: nuevasRespuestas,
              puntaje: puntosObtenidos,
              total: puntosTotales,
              porcentaje,
              nota
            }
          : item
      )
    );

    return { puntaje: puntosObtenidos, total: puntosTotales, porcentaje, nota };
  };

  const imprimirHojasPDF = async (listaEstudiantesAImprimir, sufijoArchivo = '') => {
    if (!listaEstudiantesAImprimir || listaEstudiantesAImprimir.length === 0) {
      alert('No hay estudiantes seleccionados para imprimir.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const opciones = config.alternativas.split('');
    const totalPreg = Number(config.numPreguntas);

    for (let i = 0; i < listaEstudiantesAImprimir.length; i++) {
      if (i > 0) doc.addPage();
      const est = listaEstudiantesAImprimir[i];
      const cursoObj = cursos.find((c) => String(c.id) === String(est.curso_id || config.cursoId));
      const nombreCurso = cursoObj ? cursoObj.nombre : '';

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
      doc.text(`RUT: ${est.rut}   |   Curso: ${nombreCurso || '-'}`, 25, 38);

      const qrPayload = JSON.stringify({
        r: est.rut,
        n: est.nombre,
        c: nombreCurso,
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

  const manejarEscaneo = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcesando(true);
    setProgresoLote('Preparando archivos...');

    try {
      let imagenesAProcesar = [];

      for (const file of files) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const paginas = await convertirPdfAImagenes(file, (pag, tot) => {
            setProgresoLote(`Convirtiendo PDF: página ${pag} de ${tot}...`);
          });
          imagenesAProcesar.push(...paginas);
        } else {
          imagenesAProcesar.push(file);
        }
      }

      const procesadosNuevos = [];

      for (let idx = 0; idx < imagenesAProcesar.length; idx++) {
        const imgFile = imagenesAProcesar[idx];
        setProgresoLote(`Leyendo burbujas (${idx + 1} de ${imagenesAProcesar.length})...`);

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

        procesadosNuevos.push({
          rut: (alumnoInfo.r || 'Sin QR').trim(),
          nombre: (alumnoInfo.n || `Hoja ${idx + 1}`).trim(),
          curso: (alumnoInfo.c || '').trim(),
          puntaje: puntosObtenidos,
          total: puntosTotales,
          porcentaje,
          nota,
          respuestas: respuestasAlumno,
          imagenProcesada: resultadoOMR.imagenProcesada
        });
      }

      const rutsExistentes = new Set(resultadosCurso.map((r) => r.rut.toLowerCase()));
      const duplicados = procesadosNuevos.filter(
        (p) => p.rut !== 'sin qr' && rutsExistentes.has(p.rut.toLowerCase())
      );

      let sobrescribirDuplicados = true;
      if (duplicados.length > 0) {
        const nombresDup = duplicados.slice(0, 4).map((d) => `${d.nombre} (${d.rut})`).join('\n');
        const extraTxt = duplicados.length > 4 ? `\n...y ${duplicados.length - 4} más.` : '';
        sobrescribirDuplicados = window.confirm(
          `Se detectaron ${duplicados.length} estudiante(s) ya escaneados:\n\n${nombresDup}${extraTxt}\n\n¿Deseas SOBRESCRIBIR sus resultados anteriores?\n(Aceptar = Sobrescribir | Cancelar = Omitir duplicados)`
        );
      }

      const listaFinalAGuardar = sobrescribirDuplicados
        ? procesadosNuevos
        : procesadosNuevos.filter((p) => !rutsExistentes.has(p.rut.toLowerCase()));

      if (listaFinalAGuardar.length > 0) {
        setUltimoResultado(listaFinalAGuardar[listaFinalAGuardar.length - 1]);

        if (supabase && config.id) {
          setProgresoLote('Guardando resultados e imágenes en la nube...');

          if (sobrescribirDuplicados && duplicados.length > 0) {
            for (const dup of duplicados) {
              await supabase
                .from('resultados')
                .delete()
                .eq('evaluacion_id', config.id)
                .eq('rut_estudiante', dup.rut);
            }
          }

          const filasInsertar = listaFinalAGuardar.map((reg) => ({
            evaluacion_id: config.id,
            curso_id: config.cursoId || null,
            rut_estudiante: reg.rut,
            nombre_estudiante: reg.nombre,
            curso: reg.curso,
            puntaje_obtenido: reg.puntaje,
            puntaje_total: reg.total,
            porcentaje: reg.porcentaje,
            nota: reg.nota,
            respuestas_alumno: reg.respuestas,
            imagen_url: reg.imagenProcesada || null
          }));

          const { error: errorInsert } = await supabase.from('resultados').insert(filasInsertar);

          if (errorInsert) {
            alert(
              '⚠️ Error al guardar en la nube: ' +
                errorInsert.message +
                '\n\nVerifica que ejecutaste el comando SQL para agregar imagen_url.'
            );
          }

          await cargarResultadosNube(config.id);
        } else {
          setResultadosCurso((prev) => {
            const filtrados = prev.filter(
              (r) => !listaFinalAGuardar.some((n) => n.rut.toLowerCase() === r.rut.toLowerCase())
            );
            return [...listaFinalAGuardar.reverse(), ...filtrados];
          });
        }
      }
    } catch (err) {
      alert('Error al procesar archivo: ' + err.message);
    } finally {
      setProcesando(false);
      setProgresoLote('');
      e.target.value = '';
    }
  };

  // Nombre del nivel actual para habilitar el desplegable de OAs en PautaEditor
  const nivelActualObj = niveles.find((n) => String(n.id) === String(config.nivelId));
  const nombreNivelActual = nivelActualObj ? nivelActualObj.nombre : '';

  const valorDestinoActual = config.cursoId
    ? `curso:${config.cursoId}`
    : config.nivelId
    ? `nivel:${config.nivelId}`
    : '';

  // Cálculo de cobertura y pendientes descontando eximidos
  const eximidosSet = new Set((config.eximidos || []).map((r) => r.trim().toLowerCase()));
  const rutsRendidos = new Set(resultadosCurso.map((r) => r.rut.trim().toLowerCase()));

  const estudiantesHabilitados = estudiantesCursoEval.filter(
    (e) => !eximidosSet.has(e.rut.trim().toLowerCase())
  );
  const estudiantesEximidos = estudiantesCursoEval.filter((e) =>
    eximidosSet.has(e.rut.trim().toLowerCase())
  );
  const estudiantesRendidos = estudiantesHabilitados.filter((e) =>
    rutsRendidos.has(e.rut.trim().toLowerCase())
  );
  const estudiantesPendientes = estudiantesHabilitados.filter(
    (e) => !rutsRendidos.has(e.rut.trim().toLowerCase())
  );

  const porcentajeAvance =
    estudiantesHabilitados.length > 0
      ? Math.round((estudiantesRendidos.length / estudiantesHabilitados.length) * 100)
      : 0;

  const radio = 46;
  const circunferencia = 2 * Math.PI * radio;
  const trazoCompletado = circunferencia - (porcentajeAvance / 100) * circunferencia;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
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

      <main style={{ flex: 1, padding: '24px', maxWidth: '1150px', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* VISTA 1: MI PERFIL */}
        {vistaActiva === 'perfil' && (
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '600px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={24} color="#2563eb" />
              Mi Perfil Docente
            </h2>
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
                  alert('✅ Perfil guardado.');
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
                    value={valorDestinoActual}
                    onChange={(e) => manejarCambioDestino(e.target.value, false)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: '600' }}
                  >
                    <option value="">-- Seleccionar nivel o curso --</option>
                    {niveles.length > 0 && (
                      <optgroup label="Aplicar a Nivel Completo (Todos los cursos)">
                        {niveles.map((niv) => {
                          const cantCursos = cursos.filter((c) => String(c.nivel_id) === String(niv.id)).length;
                          return (
                            <option key={`niv-${niv.id}`} value={`nivel:${niv.id}`}>
                              📚 NIVEL COMPLETO: {niv.nombre} ({cantCursos} cursos)
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    <optgroup label="Aplicar a un Curso Específico">
                      {cursos.map((c) => {
                        const niv = niveles.find((n) => String(n.id) === String(c.nivel_id));
                        return (
                          <option key={`cur-${c.id}`} value={`curso:${c.id}`}>
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

            <PautaEditor config={config} setConfig={setConfig} nivelNombre={nombreNivelActual} />

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
            <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ flex: '2 1 280px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                  EVALUACIÓN SELECCIONADA
                </label>
                <select
                  value={config.id || ''}
                  onChange={(e) => {
                    const ev = evaluacionesGuardadas.find((x) => String(x.id) === e.target.value);
                    if (ev) abrirEvaluacion(ev, false);
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '15px', fontWeight: '700' }}
                >
                  {evaluacionesGuardadas.length === 0 && <option value="">Aún no tienes evaluaciones creadas</option>}
                  {evaluacionesGuardadas.map((ev) => {
                    const c = cursos.find((cur) => String(cur.id) === String(ev.curso_id));
                    const n = niveles.find((niv) => String(niv.id) === String(ev.nivel_id));
                    const etiquetaDestino = c ? c.nombre : n ? `Nivel ${n.nombre}` : '';
                    return (
                      <option key={ev.id} value={ev.id}>
                        {ev.titulo} — {ev.asignatura} {etiquetaDestino ? `(${etiquetaDestino})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {config.id && (
                <div style={{ flex: '1 1 220px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                    NIVEL O CURSO ASIGNADO
                  </label>
                  <select
                    value={valorDestinoActual}
                    onChange={(e) => manejarCambioDestino(e.target.value, true)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '14px', fontWeight: '600', background: '#f8fafc' }}
                  >
                    <option value="">-- Sin asignar --</option>
                    {niveles.length > 0 && (
                      <optgroup label="Nivel Completo">
                        {niveles.map((niv) => (
                          <option key={`niv-a-${niv.id}`} value={`nivel:${niv.id}`}>
                            📚 Nivel Completo: {niv.nombre}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Curso Individual">
                      {cursos.map((c) => {
                        const niv = niveles.find((n) => String(n.id) === String(c.nivel_id));
                        return (
                          <option key={`cur-a-${c.id}`} value={`curso:${c.id}`}>
                            {niv ? `${niv.nombre} — ` : ''}{c.nombre}
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>
                </div>
              )}

              {config.id && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={() => imprimirHojasPDF(estudiantesHabilitados)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                      borderRadius: '8px', border: '1px solid #2563eb', background: '#eff6ff',
                      color: '#1d4ed8', fontWeight: '700', cursor: 'pointer', fontSize: '13px'
                    }}
                  >
                    <Printer size={17} />
                    Imprimir ({estudiantesHabilitados.length})
                  </button>

                  <button
                    onClick={eliminarEvaluacionActual}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px',
                      borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2',
                      color: '#dc2626', fontWeight: '700', cursor: 'pointer', fontSize: '13px'
                    }}
                  >
                    <Trash2 size={17} />
                    Eliminar
                  </button>
                </div>
              )}
            </div>

            {config.id && (
              <>
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

                {/* SUBVISTA A: AVANCE, PENDIENTES Y EXIMIDOS */}
                {subVistaEval === 'avance' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                            Cobertura de Aplicación
                          </div>
                          <h3 style={{ margin: '4px 0', fontSize: '20px', color: '#0f172a' }}>
                            {estudiantesRendidos.length} de {estudiantesHabilitados.length} estudiantes ya rindieron
                          </h3>
                          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                            {estudiantesPendientes.length === 0
                              ? '¡Grupo completo! Todos los estudiantes habilitados tienen su hoja escaneada.'
                              : `Faltan ${estudiantesPendientes.length} estudiante(s) por rendir.`}
                            {estudiantesEximidos.length > 0 && ` (${estudiantesEximidos.length} eximido/s)`}
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
                      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#c2410c' }}>
                          <AlertCircle size={18} />
                          Control de Estudiantes Pendientes y Eximidos ({estudiantesPendientes.length + estudiantesEximidos.length})
                        </h4>

                        {estudiantesPendientes.length === 0 && estudiantesEximidos.length === 0 ? (
                          <div style={{ padding: '14px', background: '#f0fdf4', color: '#166534', borderRadius: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={18} />
                            No hay estudiantes pendientes ni eximidos en este grupo.
                          </div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead style={{ background: '#fff7ed' }}>
                              <tr>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #fed7aa' }}>RUT</th>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #fed7aa' }}>Nombre Estudiante</th>
                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #fed7aa' }}>Curso</th>
                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #fed7aa' }}>Estado</th>
                                <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #fed7aa' }}>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...estudiantesPendientes, ...estudiantesEximidos].map((est) => {
                                const esEximido = eximidosSet.has(est.rut.trim().toLowerCase());
                                const curEst = cursos.find((c) => String(c.id) === String(est.curso_id));
                                return (
                                  <tr key={est.rut} style={{ borderBottom: '1px solid #f1f5f9', opacity: esEximido ? 0.7 : 1 }}>
                                    <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{est.rut}</td>
                                    <td style={{ padding: '9px 10px', fontWeight: '600' }}>{est.nombre}</td>
                                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b' }}>{curEst ? curEst.nombre : '-'}</td>
                                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                                      <span
                                        style={{
                                          padding: '3px 9px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
                                          background: esEximido ? '#e2e8f0' : '#ffedd5',
                                          color: esEximido ? '#475569' : '#9a3412'
                                        }}
                                      >
                                        {esEximido ? 'Eximido' : 'Pendiente'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                                        <button
                                          onClick={() => toggleEximirEstudiante(est.rut)}
                                          style={{
                                            background: esEximido ? '#dcfce7' : '#f1f5f9',
                                            color: esEximido ? '#166534' : '#334155',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                                            fontSize: '12px', fontWeight: '600'
                                          }}
                                        >
                                          {esEximido ? 'Deseximir' : 'Eximir'}
                                        </button>

                                        {!esEximido && (
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
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SUBVISTA B: IMPRIMIR / NÓMINA ALUMNOS */}
                {subVistaEval === 'imprimir' && (
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '17px' }}>Nómina de Impresión de Hojas de Respuestas</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                          Selecciona los estudiantes para descargar sus hojas personalizadas con código QR.
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

                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Info size={18} />
                      <span>
                        <strong>Importante:</strong> Lo ideal es gestionar los estudiantes desde la ventana <strong>"Mis Cursos"</strong>. Si agregas un alumno desde aquí, <strong>también quedará guardado automáticamente en la nómina oficial</strong>.
                      </span>
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
                          <th style={{ padding: '10px', textAlign: 'center' }}>Curso</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Quitar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estudiantesCursoEval.map((est) => {
                          const marcado = seleccionadosImprimir.includes(est.rut);
                          const yaRindio = rutsRendidos.has(est.rut.trim().toLowerCase());
                          const esEximido = eximidosSet.has(est.rut.trim().toLowerCase());
                          const curEst = cursos.find((c) => String(c.id) === String(est.curso_id));
                          return (
                            <tr key={est.rut} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{curEst ? curEst.nombre : '-'}</td>
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

                {/* SUBVISTA C: ESCANEAR + GESTIÓN DE ESCANEOS */}
                {subVistaEval === 'escanear' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Escanear Hojas de Respuestas (Fotos o PDF Multipágina)</h3>
                      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
                        Puedes subir una foto individual, varias fotos a la vez o un <strong>archivo PDF escaneado con todo el nivel/curso</strong>.
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
                                Nota: {ultimoResultado.nota.toFixed(1)}
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

                    {resultadosCurso.length > 0 && (
                      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                          Hojas Escaneadas en esta Evaluación ({resultadosCurso.length})
                        </h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                          <thead style={{ background: '#f1f5f9' }}>
                            <tr>
                              <th style={{ padding: '10px', textAlign: 'left' }}>RUT</th>
                              <th style={{ padding: '10px', textAlign: 'left' }}>Estudiante</th>
                              <th style={{ padding: '10px', textAlign: 'center' }}>Curso</th>
                              <th style={{ padding: '10px', textAlign: 'center' }}>Puntaje</th>
                              <th style={{ padding: '10px', textAlign: 'center' }}>Nota</th>
                              <th style={{ padding: '10px', textAlign: 'right' }}>Eliminar Escaneo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resultadosCurso.map((r, idx) => (
                              <tr key={r.id || `${r.rut}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{r.rut}</td>
                                <td style={{ padding: '9px 10px', fontWeight: '600' }}>{r.nombre}</td>
                                <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b' }}>{r.curso || '-'}</td>
                                <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                                  {r.puntaje} / {r.total} ({r.porcentaje}%)
                                </td>
                                <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: '700', color: r.nota >= 4.0 ? '#16a34a' : '#dc2626' }}>
                                  {Number(r.nota).toFixed(1)}
                                </td>
                                <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => eliminarResultadoIndividual(r.id, r.rut)}
                                    style={{
                                      background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                      borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                                      fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                    }}
                                  >
                                    <Trash2 size={13} /> Eliminar
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

                {/* SUBVISTA D: EDITAR PAUTA */}
                {subVistaEval === 'pauta' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <PautaEditor config={config} setConfig={setConfig} nivelNombre={nombreNivelActual} />
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

                {/* SUBVISTA E: ANÁLISIS Y REPORTES */}
                {subVistaEval === 'analisis' && (
                  <AnalisisPanel
                    resultados={resultadosCurso}
                    config={config}
                    estudiantesCurso={estudiantesCursoEval}
                    eximidos={config.eximidos}
                    onActualizarRespuesta={actualizarRespuestaEstudiante}
                  />
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
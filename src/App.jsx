import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import {
  FileDown, Upload, Users, FileText, CheckCircle2,
  Camera, CheckSquare, ScanLine, Cloud, FolderOpen, BarChart3, GraduationCap
} from 'lucide-react';
import PautaEditor from './PautaEditor';
import AnalisisPanel from './AnalisisPanel';
import GestionEscolar from './GestionEscolar';
import { procesarHojaOMR } from './omrEngine';
import { supabase } from './supabaseClient';

export default function App() {
  const [pestana, setPestana] = useState('generar');

  // Estado de configuración de la evaluación
  const [config, setConfig] = useState({
    id: null,
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

  // Estados de listas y resultados
  const [estudiantes, setEstudiantes] = useState([]);
  const [evaluacionesGuardadas, setEvaluacionesGuardadas] = useState([]);
  const [resultadosCurso, setResultadosCurso] = useState([]);
  const [ultimoResultado, setUltimoResultado] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // Estados de Niveles y Cursos desde Supabase
  const [nivelesDB, setNivelesDB] = useState([]);
  const [cursosDB, setCursosDB] = useState([]);
  const [cursoSeleccionadoPDF, setCursoSeleccionadoPDF] = useState('');

  useEffect(() => {
    cargarEvaluacionesNube();
    cargarEstructuraEscolar();
  }, []);

  useEffect(() => {
    if (config.id) {
      cargarResultadosNube(config.id);
    } else {
      setResultadosCurso([]);
    }
  }, [config.id]);

  const cargarEstructuraEscolar = async () => {
    if (!supabase) return;
    const [{ data: niv }, { data: cur }] = await Promise.all([
      supabase.from('niveles').select('*').order('orden', { ascending: true }).order('nombre'),
      supabase.from('cursos').select('*').order('nombre')
    ]);
    setNivelesDB(niv || []);
    setCursosDB(cur || []);
  };

  const cargarEvaluacionesNube = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('evaluaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEvaluacionesGuardadas(data);
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
      const formateados = data.map((r) => ({
        id: r.id,
        rut: r.rut_estudiante,
        nombre: r.nombre_estudiante,
        curso: r.curso || '',
        puntaje: r.puntaje_obtenido,
        total: r.puntaje_total,
        porcentaje: r.porcentaje,
        nota: r.nota,
        respuestas: r.respuestas_alumno || {}
      }));
      setResultadosCurso(formateados);
    }
  };

  const seleccionarEvaluacionNube = (evalId) => {
    if (!evalId) {
      setConfig({
        id: null,
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
      return;
    }
    const ev = evaluacionesGuardadas.find((item) => String(item.id) === String(evalId));
    if (ev) {
      setConfig({
        id: ev.id,
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
    }
  };

  const guardarEvaluacionNube = async () => {
    if (!supabase) {
      alert('No hay conexión configurada con Supabase.');
      return;
    }

    const payload = {
      titulo: config.tituloPrueba,
      asignatura: config.asignatura,
      num_preguntas: Number(config.numPreguntas),
      alternativas: config.alternativas,
      nota_min: Number(config.notaMin),
      nota_max: Number(config.notaMax),
      nota_aprob: Number(config.notaAprob),
      exigencia: Number(config.exigencia),
      pauta: config.pauta
    };

    if (config.id) {
      const { error } = await supabase
        .from('evaluaciones')
        .update(payload)
        .eq('id', config.id);

      if (error) {
        alert('Error al actualizar en nube: ' + error.message);
      } else {
        alert('Evaluación actualizada correctamente en la nube.');
        cargarEvaluacionesNube();
      }
    } else {
      const { data, error } = await supabase
        .from('evaluaciones')
        .insert([payload])
        .select()
        .single();

      if (error) {
        alert('Error al guardar en nube: ' + error.message);
      } else if (data) {
        setConfig((prev) => ({ ...prev, id: data.id }));
        alert('Evaluación guardada en la nube. Ya puedes escanear hojas y se registrarán automáticamente.');
        cargarEvaluacionesNube();
      }
    }
  };

  // Cargar estudiantes desde un curso oficial de Supabase
  const seleccionarCursoParaPDF = async (cursoId) => {
    setCursoSeleccionadoPDF(cursoId);
    if (!cursoId || !supabase) {
      setEstudiantes([]);
      return;
    }
    const cursoObj = cursosDB.find((c) => c.id === cursoId);
    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('curso_id', cursoId)
      .order('nombre');

    if (!error && data) {
      setEstudiantes(
        data.map((e) => ({
          rut: e.rut,
          nombre: e.nombre,
          curso: cursoObj ? cursoObj.nombre : ''
        }))
      );
    }
  };

  // Subir lista de estudiantes desde Excel suelto
  const manejarExcelEstudiantes = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      const lista = rows
        .map((r) => ({
          rut: String(r.RUT || r.rut || r.Rut || '').trim(),
          nombre: String(r.Nombre || r.NOMBRE || r.nombre || '').trim(),
          curso: String(r.Curso || r.CURSO || r.curso || '').trim()
        }))
        .filter((x) => x.rut && x.nombre);
      setEstudiantes(lista);
      setCursoSeleccionadoPDF('');
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const cargarEjemplo = () => {
    setEstudiantes([
      { rut: '21.111.111-1', nombre: 'Sofía Martínez Rojas', curso: '2° Medio A' },
      { rut: '21.222.222-2', nombre: 'Mateo González Silva', curso: '2° Medio A' },
      { rut: '21.333.333-3', nombre: 'Valentina Pérez Soto', curso: '2° Medio A' }
    ]);
    setCursoSeleccionadoPDF('');
  };

  // Generar PDF con marcas fiduciales y QR por alumno
  const generarPDF = async () => {
    if (estudiantes.length === 0) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const opciones = config.alternativas.split('');
    const totalPreg = Number(config.numPreguntas);

    for (let i = 0; i < estudiantes.length; i++) {
      if (i > 0) doc.addPage();
      const est = estudiantes[i];

      // 4 Marcas fiduciales en las esquinas
      doc.setFillColor(0, 0, 0);
      doc.rect(12, 12, 8, 8, 'F');
      doc.rect(195, 12, 8, 8, 'F');
      doc.rect(12, 258, 8, 8, 'F');
      doc.rect(195, 258, 8, 8, 'F');

      // Encabezado
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(config.tituloPrueba, 25, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Asignatura: ${config.asignatura}`, 25, 26);
      doc.text(`Estudiante: ${est.nombre}`, 25, 32);
      doc.text(`RUT: ${est.rut}   |   Curso: ${est.curso || '-'}`, 25, 38);

      // Código QR con datos del estudiante
      const qrPayload = JSON.stringify({
        r: est.rut,
        n: est.nombre,
        c: est.curso || '',
        e: config.id || ''
      });
      const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 120 });
      doc.addImage(qrDataUrl, 'PNG', 162, 14, 28, 28);

      // Grilla de burbujas (2 columnas de 25 preguntas)
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

    doc.save(`Hojas_OMR_${config.tituloPrueba.replace(/\s+/g, '_')}.pdf`);
  };

  // Calcular nota según escala chilena configurable
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

  // Procesar imagen escaneada o foto
  const manejarEscaneo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProcesando(true);

    try {
      const resultadoOMR = await procesarHojaOMR(file, {
        numPreguntas: Number(config.numPreguntas),
        alternativas: config.alternativas
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

      const alumnoInfo = resultadoOMR.qrData || {
        r: 'Sin QR',
        n: 'Estudiante no identificado',
        c: ''
      };

      const nuevoRegistro = {
        rut: alumnoInfo.r || 'Sin QR',
        nombre: alumnoInfo.n || 'Estudiante no identificado',
        curso: alumnoInfo.c || '',
        puntaje: puntosObtenidos,
        total: puntosTotales,
        porcentaje,
        nota,
        respuestas: respuestasAlumno,
        imagenProcesada: resultadoOMR.imagenProcesada
      };

      setUltimoResultado(nuevoRegistro);
      setResultadosCurso((prev) => [nuevoRegistro, ...prev]);

      // Guardar automáticamente en Supabase si la evaluación está en la nube
      if (supabase && config.id) {
        await supabase.from('resultados').insert([
          {
            evaluacion_id: config.id,
            rut_estudiante: nuevoRegistro.rut,
            nombre_estudiante: nuevoRegistro.nombre,
            curso: nuevoRegistro.curso,
            puntaje_obtenido: nuevoRegistro.puntaje,
            puntaje_total: nuevoRegistro.total,
            porcentaje: nuevoRegistro.porcentaje,
            nota: nuevoRegistro.nota,
            respuestas_alumno: nuevoRegistro.respuestas
          }
        ]);
      }
    } catch (err) {
      alert('No se pudo procesar la hoja: ' + err.message);
    } finally {
      setProcesando(false);
      e.target.value = '';
    }
  };

  const pautaDefinidaCount = Object.values(config.pauta).filter((v) =>
    typeof v === 'object' ? Boolean(v?.correcta) : Boolean(v)
  ).length;

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
      {/* ENCABEZADO SUPERIOR */}
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ScanLine size={28} color="#2563eb" />
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>Sistema OMR Escolar</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <FolderOpen size={18} color="#64748b" />
            <select
              value={config.id || ''}
              onChange={(e) => seleccionarEvaluacionNube(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', minWidth: '230px' }}
            >
              <option value="">+ Nueva evaluación local</option>
              {evaluacionesGuardadas.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.titulo} ({ev.asignatura})
                </option>
              ))}
            </select>

            <button
              onClick={guardarEvaluacionNube}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600',
                background: config.id ? '#0284c7' : '#16a34a', color: 'white'
              }}
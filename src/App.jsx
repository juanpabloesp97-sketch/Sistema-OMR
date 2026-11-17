import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import {
  FileDown, Upload, Users, FileText, CheckCircle2,
  Camera, CheckSquare, ScanLine, Cloud, FolderOpen, BarChart3
} from 'lucide-react';
import GestionEscolar from './GestionEscolar';
import PautaEditor from './PautaEditor';
import AnalisisPanel from './AnalisisPanel';
import { procesarHojaOMR } from './omrEngine';
import { supabase } from './supabaseClient';

export default function App() {
  const [pestana, setPestana] = useState('generar');

  const [config, setConfig] = useState({
    id: null,
    tituloPrueba: 'Evaluación Sumativa N° 1',
    asignatura: 'Matemática',
    numPreguntas: 30,
    alternativas: 'ABCD',
    notaMin: 1.0,
    notaAprob: 4.0,
    notaMax: 7.0,
    exigencia: 60,
    pauta: {},
  });

  const [evaluacionesGuardadas, setEvaluacionesGuardadas] = useState([]);
  const [guardandoNube, setGuardandoNube] = useState(false);

  const [alumnos, setAlumnos] = useState([]);
  const [generando, setGenerando] = useState(false);

  const [procesandoOMR, setProcesandoOMR] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(null);
  const [resultadosCurso, setResultadosCurso] = useState([]);

  // Cargar lista de evaluaciones desde Supabase al iniciar
  useEffect(() => {
    cargarEvaluacionesDesdeNube();
  }, []);

  const cargarEvaluacionesDesdeNube = async () => {
    const { data, error } = await supabase
      .from('evaluaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEvaluacionesGuardadas(data);
    }
  };

  // Guardar o actualizar evaluación + pauta en Supabase
  const guardarEvaluacionEnNube = async () => {
    setGuardandoNube(true);
    const registro = {
      titulo: config.tituloPrueba,
      asignatura: config.asignatura,
      num_preguntas: Number(config.numPreguntas),
      alternativas: config.alternativas,
      nota_min: Number(config.notaMin),
      nota_aprob: Number(config.notaAprob),
      nota_max: Number(config.notaMax),
      exigencia: Number(config.exigencia),
      pauta: config.pauta,
    };

    if (config.id) {
      const { error } = await supabase
        .from('evaluaciones')
        .update(registro)
        .eq('id', config.id);

      if (error) alert('Error al actualizar: ' + error.message);
      else alert('¡Evaluación y pauta actualizadas en la nube!');
    } else {
      const { data, error } = await supabase
        .from('evaluaciones')
        .insert([registro])
        .select()
        .single();

      if (error) {
        alert('Error al guardar en Supabase: ' + error.message);
      } else if (data) {
        setConfig((prev) => ({ ...prev, id: data.id }));
        alert('¡Evaluación guardada en la nube! Ya puedes imprimir sus hojas con QR vinculado.');
      }
    }

    await cargarEvaluacionesDesdeNube();
    setGuardandoNube(false);
  };

  // Seleccionar una evaluación guardada y traer sus resultados
  const seleccionarEvaluacion = async (ev) => {
    setConfig({
      id: ev.id,
      tituloPrueba: ev.titulo,
      asignatura: ev.asignatura,
      numPreguntas: ev.num_preguntas,
      alternativas: ev.alternativas,
      notaMin: Number(ev.nota_min),
      notaAprob: Number(ev.nota_aprob),
      notaMax: Number(ev.nota_max),
      exigencia: Number(ev.exigencia),
      pauta: ev.pauta || {},
    });

    const { data } = await supabase
      .from('resultados')
      .select('*')
      .eq('evaluacion_id', ev.id)
      .order('created_at', { ascending: false });

    if (data) {
      setResultadosCurso(
        data.map((r) => ({
          rut: r.rut,
          nombre: r.nombre,
          curso: r.curso,
          buenas: r.buenas,
          totalPreguntas: r.total_preguntas,
          porcentajeLogro: r.porcentaje_logro,
          nota: Number(r.nota),
          detallePreguntas: r.detalle_preguntas,
        }))
      );
    }
    setUltimoResultado(null);
  };

  const nuevaEvaluacion = () => {
    setConfig({
      id: null,
      tituloPrueba: 'Nueva Evaluación',
      asignatura: 'Matemática',
      numPreguntas: 30,
      alternativas: 'ABCD',
      notaMin: 1.0,
      notaAprob: 4.0,
      notaMax: 7.0,
      exigencia: 60,
      pauta: {},
    });
    setResultadosCurso([]);
    setUltimoResultado(null);
  };

  const cargarEjemplo = () => {
    setAlumnos([
      { rut: '21.456.789-0', nombre: 'Sofía Valentina Muñoz Rojas', curso: '4° Medio A' },
      { rut: '21.987.654-3', nombre: 'Mateo Alonso González Pérez', curso: '4° Medio A' },
      { rut: '22.111.222-K', nombre: 'Isidora Paz Silva Contreras', curso: '4° Medio A' },
    ]);
  };

  const manejarSubidaExcel = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = (evento) => {
      const datos = new Uint8Array(evento.target.result);
      const libro = XLSX.read(datos, { type: 'array' });
      const primeraHoja = libro.Sheets[libro.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(primeraHoja);

      const listaFormateada = filas.map((fila) => ({
        rut: String(fila.RUT || fila.rut || fila.Rut || 'Sin RUT').trim(),
        nombre: String(fila.Nombre || fila.NOMBRE || fila.nombre || fila.Alumno || 'Sin Nombre').trim(),
        curso: String(fila.Curso || fila.CURSO || fila.curso || 'Sin Curso').trim(),
      }));

      setAlumnos(listaFormateada);
    };
    lector.readAsArrayBuffer(archivo);
  };

  const generarPDF = async () => {
    if (alumnos.length === 0) {
      alert('Primero sube un Excel con alumnos o carga el curso de ejemplo.');
      return;
    }

    setGenerando(true);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const opciones = config.alternativas.split('');
    const totalPreguntas = Math.min(Math.max(Number(config.numPreguntas), 1), 50);

    for (let i = 0; i < alumnos.length; i++) {
      if (i > 0) doc.addPage();
      const alumno = alumnos[i];

      const payloadQR = JSON.stringify({
        evalId: config.id || 'local',
        rut: alumno.rut,
        nombre: alumno.nombre,
        curso: alumno.curso,
        preguntas: totalPreguntas,
        alt: config.alternativas,
      });
      const qrDataUrl = await QRCode.toDataURL(payloadQR, { margin: 1, width: 150 });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(config.tituloPrueba.toUpperCase(), 15, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Asignatura: ${config.asignatura}`, 15, 25);
      doc.text(`Estudiante: ${alumno.nombre}`, 15, 31);
      doc.text(`RUT: ${alumno.rut}   |   Curso: ${alumno.curso}`, 15, 37);

      doc.addImage(qrDataUrl, 'PNG', 168, 10, 30, 30);

      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text('INSTRUCCIONES: Rellena completamente el círculo con lápiz grafito o pasta negro/azul. No dobles la hoja.', 15, 45);
      doc.setTextColor(0);

      const marcas = [
        [15, 50],
        [192, 50],
        [15, 256],
        [192, 256],
      ];
      doc.setFillColor(0, 0, 0);
      marcas.forEach(([mx, my]) => doc.rect(mx, my, 6, 6, 'F'));

      doc.setDrawColor(210);
      doc.rect(18, 53, 177, 206);
      doc.setDrawColor(0);

      const inicioY = 64;
      const espacioVertical = 7.6;

      for (let p = 1; p <= totalPreguntas; p++) {
        const esSegundaColumna = p > 25;
        const indiceFila = esSegundaColumna ? p - 26 : p - 1;
        const baseX = esSegundaColumna ? 112 : 28;
        const posY = inicioY + indiceFila * espacioVertical;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(`${p}.`, baseX, posY + 1.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        opciones.forEach((letra, idx) => {
          const centroX = baseX + 12 + idx * 11;
          doc.circle(centroX, posY, 2.7, 'S');
          doc.text(letra, centroX - 1.1, posY + 0.9);
        });
      }
    }

    doc.save(`Hojas_OMR_${config.asignatura.replace(/\s+/g, '_')}.pdf`);
    setGenerando(false);
  };

  const manejarEscaneo = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    setProcesandoOMR(true);
    try {
      const resultado = await procesarHojaOMR(archivo, config);
      setUltimoResultado(resultado);

      // Si la evaluación está guardada en Supabase, guardamos también el resultado del alumno
      if (config.id) {
        await supabase.from('resultados').insert([
          {
            evaluacion_id: config.id,
            rut: resultado.rut,
            nombre: resultado.nombre,
            curso: resultado.curso,
            buenas: resultado.buenas,
            total_preguntas: resultado.totalPreguntas,
            porcentaje_logro: resultado.porcentajeLogro,
            nota: resultado.nota,
            detalle_preguntas: resultado.detallePreguntas,
          },
        ]);
      }

      setResultadosCurso((prev) => {
        const sinDuplicado = prev.filter((r) => r.rut !== resultado.rut || resultado.rut === 'No detectado');
        return [resultado, ...sinDuplicado];
      });
    } catch (error) {
      console.error(error);
      alert('Ocurrió un error al procesar la imagen.');
    }
    setProcesandoOMR(false);
  };

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>
      <header style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ScanLine size={28} color="#2563eb" />
            Sistema OMR Escolar
          </h1>

          {/* Selector de Evaluaciones en la Nube */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <FolderOpen size={18} color="#64748b" />
            <select
              value={config.id || ''}
              onChange={(e) => {
                const elegida = evaluacionesGuardadas.find((ev) => ev.id === e.target.value);
                if (elegida) seleccionarEvaluacion(elegida);
                else nuevaEvaluacion();
              }}
              style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
            >
              <option value="">+ Crear nueva evaluación...</option>
              {evaluacionesGuardadas.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.titulo} ({ev.asignatura})
                </option>
              ))}
            </select>

            <button
              onClick={guardarEvaluacionEnNube}
              disabled={guardandoNube}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
                border: 'none', background: config.id ? '#0284c7' : '#16a34a', color: 'white', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
              }}
            >
              <Cloud size={16} />
              {guardandoNube ? 'Guardando...' : config.id ? 'Actualizar en Nube' : 'Guardar en Nube'}
            </button>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setPestana('generar')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600',
              background: pestana === 'generar' ? '#2563eb' : '#f1f5f9',
              color: pestana === 'generar' ? 'white' : '#334155',
            }}
          >
            <FileText size={18} />
            
            <button
  onClick={() => setPestana('gestion')}
  style={{
    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600',
    background: pestana === 'gestion' ? '#2563eb' : '#f1f5f9',
    color: pestana === 'gestion' ? 'white' : '#334155',
  }}
>
  <GraduationCap size={18} />
  Cursos y Alumnos
</button>
            1. Generar Hojas PDF
          </button>

          <button
            onClick={() => setPestana('pauta')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600',
              background: pestana === 'pauta' ? '#2563eb' : '#f1f5f9',
              color: pestana === 'pauta' ? 'white' : '#334155',
            }}
          >
            <CheckSquare size={18} />
            2. Pauta y Escala ({Object.keys(config.pauta).length}/{config.numPreguntas})
          </button>

          <button
            onClick={() => setPestana('escanear')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600',
              background: pestana === 'escanear' ? '#2563eb' : '#f1f5f9',
              color: pestana === 'escanear' ? 'white' : '#334155',
            }}
          >
            <Camera size={18} />
            3. Escanear Hojas ({resultadosCurso.length})
          </button>

          <button
            onClick={() => setPestana('analisis')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600',
              background: pestana === 'analisis' ? '#2563eb' : '#f1f5f9',
              color: pestana === 'analisis' ? 'white' : '#334155',
            }}
          >
            <BarChart3 size={18} />
            4. Análisis y Reportes
          </button>
        
        </nav>
      </header>

      {/* PESTAÑA 1: GENERAR HOJAS */}
      {pestana === 'generar' && (
        <div>
          {!config.id && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <strong>Consejo:</strong> Haz clic en <strong>"Guardar en Nube"</strong> arriba a la derecha antes de descargar el PDF para que los resultados escaneados se guarden automáticamente en tu base de datos.
            </div>
          )}

          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h2 style={{ marginTop: 0, fontSize: '18px' }}>1. Parámetros de la Evaluación</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Título de la Prueba</label>
                <input
                  type="text"
                  value={config.tituloPrueba}
                  onChange={(e) => setConfig({ ...config, tituloPrueba: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Asignatura</label>
                <input
                  type="text"
                  value={config.asignatura}
                  onChange={(e) => setConfig({ ...config, asignatura: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>N° de Preguntas (1 a 50)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={config.numPreguntas}
                  onChange={(e) => setConfig({ ...config, numPreguntas: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Alternativas</label>
                <select
                  value={config.alternativas}
                  onChange={(e) => setConfig({ ...config, alternativas: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: 'white' }}
                >
                  <option value="ABC">3 opciones (A - B - C)</option>
                  <option value="ABCD">4 opciones (A - B - C - D)</option>
                  <option value="ABCDE">5 opciones (A - B - C - D - E)</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h2 style={{ marginTop: 0, fontSize: '18px' }}>2. Lista de Estudiantes (Excel: RUT, Nombre, Curso)</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#2563eb', color: 'white', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                <Upload size={18} />
                Subir archivo Excel (.xlsx)
                <input type="file" accept=".xlsx, .xls, .csv" onChange={manejarSubidaExcel} style={{ display: 'none' }} />
              </label>

              <button
                onClick={cargarEjemplo}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'white', color: '#334155', padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
              >
                <Users size={18} />
                Cargar 3 alumnos de ejemplo
              </button>
            </div>

            {alumnos.length > 0 && (
              <div style={{ marginTop: '16px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: '#ecfdf5', color: '#065f46', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={18} />
                  {alumnos.length} estudiantes listos
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                      <th style={{ padding: '8px 14px' }}>RUT</th>
                      <th style={{ padding: '8px 14px' }}>Nombre</th>
                      <th style={{ padding: '8px 14px' }}>Curso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnos.slice(0, 5).map((al, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 14px' }}>{al.rut}</td>
                        <td style={{ padding: '8px 14px' }}>{al.nombre}</td>
                        <td style={{ padding: '8px 14px' }}>{al.curso}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <button
            onClick={generarPDF}
            disabled={generando}
            style={{
              width: '100%', padding: '16px', background: alumnos.length > 0 ? '#16a34a' : '#94a3b8', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: alumnos.length > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            }}
          >
            <FileDown size={22} />
            {generando ? 'Generando PDF...' : `Descargar PDF con Hojas de Respuestas (${alumnos.length} páginas)`}
          </button>
        </div>
      )}

      {/* PESTAÑA 2: PAUTA Y ESCALA */}
      {pestana === 'pauta' && <PautaEditor config={config} setConfig={setConfig} />}

      {/* PESTAÑA 3: ESCANEAR HOJAS */}
      {pestana === 'escanear' && (
        <div>
          <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '2px dashed #93c5fd', textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ marginTop: 0, fontSize: '18px' }}>Subir Foto o Escaneo de Hoja de Respuestas</h2>
            <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '520px', margin: '0 auto 16px' }}>
              {config.id
                ? 'Conectado a la nube: cada hoja que escanees se guardará automáticamente en Supabase.'
                : 'Modo local: guarda tu evaluación en la nube arriba para sincronizar tus escaneos.'}
            </p>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#2563eb', color: 'white', padding: '14px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
              <Camera size={22} />
              {procesandoOMR ? 'Analizando hoja con IA...' : 'Tomar Foto o Subir Hoja'}
              <input type="file" accept="image/*" capture="environment" onChange={manejarEscaneo} disabled={procesandoOMR} style={{ display: 'none' }} />
            </label>
          </div>

          {ultimoResultado && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ marginTop: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Resultado de Corrección</h3>
                <p><strong>Estudiante:</strong> {ultimoResultado.nombre}</p>
                <p><strong>RUT:</strong> {ultimoResultado.rut} | <strong>Curso:</strong> {ultimoResultado.curso}</p>
                <p style={{ fontSize: '13px', color: ultimoResultado.esquinasOk ? '#16a34a' : '#d97706' }}>
                  {ultimoResultado.esquinasOk ? '✓ 4 marcadores de esquina alineados' : '⚠ Alineación aproximada'}
                  {' | '}
                  {ultimoResultado.qrDetectado ? '✓ QR leído' : '⚠ QR no detectado'}
                </p>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <div style={{ flex: 1, background: '#f1f5f9', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>PUNTAJE</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{ultimoResultado.buenas} / {ultimoResultado.totalPreguntas}</div>
                    <div style={{ fontSize: '13px', color: '#475569' }}>{ultimoResultado.porcentajeLogro}% logro</div>
                  </div>

                  <div style={{ flex: 1, background: ultimoResultado.nota >= 4.0 ? '#ecfdf5' : '#fef2f2', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>NOTA FINAL</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: ultimoResultado.nota >= 4.0 ? '#16a34a' : '#dc2626' }}>
                      {ultimoResultado.nota.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Exig. {config.exigencia}%</div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#475569' }}>
                  Verificación Visual (Verde = Buena | Roja = Mala | Azul = Correcta)
                </div>
                <img
                  src={ultimoResultado.imagenProcesada}
                  alt="Hoja procesada"
                  style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>
          )}
        </div>
      )}
      {pestana === 'analisis' && <AnalisisPanel resultados={resultadosCurso} config={config} 
      />}
      {pestana === 'gestion' && <GestionEscolar />}
    </div>
  );
}
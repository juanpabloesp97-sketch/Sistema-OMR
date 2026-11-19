import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart3, Download, ArrowUpDown, ArrowUp, ArrowDown, X, FileText,
  CheckCircle2, XCircle, MinusCircle, SlidersHorizontal, ExternalLink,
  Search, Eye, Save, ZoomIn
} from 'lucide-react';

export default function AnalisisPanel({
  resultados = [],
  config = {},
  onActualizarRespuesta
}) {
  // --- ESTADOS DE LÍMITES DE DESEMPEÑO (ESTÁNDAR EVALUACIONES A TU ALCANCE) ---
  const [cortes, setCortes] = useState({
    muyBueno: 85,    // 85 - 100%
    bueno: 72,       // 72 - 84%
    aceptable: 60,   // 60 - 71%
    insuficiente: 30 // 30 - 59% (0 - 29% Muy Insuficiente)
  });
  const [mostrarConfigCortes, setMostrarConfigCortes] = useState(false);

  // --- ESTADOS DE MODALES INTERACTIVOS ---
  const [modalGrupo, setModalGrupo] = useState(null);
  const [modalItemNum, setModalItemNum] = useState(null);
  const [opcionSeleccionadaItem, setOpcionSeleccionadaItem] = useState(null);
  const [modalAlumno, setModalAlumno] = useState(null);

  // --- EDICIÓN DE RESPUESTAS Y ZOOM DE HOJA EN MODAL DE ALUMNO ---
  const [editandoRespuestas, setEditandoRespuestas] = useState(false);
  const [respuestasEditadas, setRespuestasEditadas] = useState({});
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [zoomImagen, setZoomImagen] = useState(false);

  // --- VISOR PDF DE LA PRUEBA ORIGINAL (PARA EL MODAL DE ÍTEM) ---
  const [pdfPruebaUrl, setPdfPruebaUrl] = useState(null);
  const [pdfPruebaNombre, setPdfPruebaNombre] = useState('');

  // --- FILTROS Y ORDENAMIENTO ---
  const [busqueda, setBusqueda] = useState('');
  const [ordenTabla, setOrdenTabla] = useState({ col: 'nombre', dir: 'asc' });
  const [ordenItems, setOrdenItems] = useState('numero'); // 'numero' | 'asc' | 'desc'

  const totalAlumnos = resultados.length;
  const numPreguntas = Number(config.numPreguntas || 30);
  const notaAprob = Number(config.notaAprob || 4.0);
  const opciones = (config.alternativas || 'ABCD').split('');
  const pauta = config.pauta || {};

  // --- CLASIFICADOR DE LOS 5 GRUPOS DE DESEMPEÑO ---
  const clasificarDesempeno = (pct) => {
    const val = Number(pct || 0);
    if (val >= cortes.muyBueno) {
      return { id: 'muy_bueno', label: 'Muy Bueno', rango: `${cortes.muyBueno}-100%`, color: '#10b981', bg: '#d1fae5', text: '#065f46' };
    }
    if (val >= cortes.bueno) {
      return { id: 'bueno', label: 'Bueno', rango: `${cortes.bueno}-${cortes.muyBueno - 1}%`, color: '#3b82f6', bg: '#dbeafe', text: '#1e40af' };
    }
    if (val >= cortes.aceptable) {
      return { id: 'aceptable', label: 'Aceptable', rango: `${cortes.aceptable}-${cortes.bueno - 1}%`, color: '#eab308', bg: '#fef9c3', text: '#854d0e' };
    }
    if (val >= cortes.insuficiente) {
      return { id: 'insuficiente', label: 'Insuficiente', rango: `${cortes.insuficiente}-${cortes.aceptable - 1}%`, color: '#f97316', bg: '#ffedd5', text: '#9a3412' };
    }
    return { id: 'muy_insuficiente', label: 'Muy Insuficiente', rango: `0-${cortes.insuficiente - 1}%`, color: '#ef4444', bg: '#fee2e2', text: '#991b1b' };
  };

  // --- INDICADORES CONSOLIDADOS ---
  const promedioNota = totalAlumnos > 0
    ? (resultados.reduce((acc, r) => acc + Number(r.nota || 1.0), 0) / totalAlumnos).toFixed(1)
    : '0.0';

  const promedioLogro = totalAlumnos > 0
    ? Math.round(resultados.reduce((acc, r) => acc + Number(r.porcentaje || 0), 0) / totalAlumnos)
    : 0;

  // --- LOS 5 GRUPOS DE DESEMPEÑO PARA EL GRÁFICO DE BARRAS ---
  const gruposDesempeno = useMemo(() => {
    const definiciones = [
      { id: 'muy_insuficiente', label: 'Muy Insuficiente', rango: `0-${cortes.insuficiente - 1}%`, color: '#ef4444', bg: '#fee2e2', text: '#991b1b' },
      { id: 'insuficiente', label: 'Insuficiente', rango: `${cortes.insuficiente}-${cortes.aceptable - 1}%`, color: '#f97316', bg: '#ffedd5', text: '#9a3412' },
      { id: 'aceptable', label: 'Aceptable', rango: `${cortes.aceptable}-${cortes.bueno - 1}%`, color: '#eab308', bg: '#fef9c3', text: '#854d0e' },
      { id: 'bueno', label: 'Bueno', rango: `${cortes.bueno}-${cortes.muyBueno - 1}%`, color: '#3b82f6', bg: '#dbeafe', text: '#1e40af' },
      { id: 'muy_bueno', label: 'Muy Bueno', rango: `${cortes.muyBueno}-100%`, color: '#10b981', bg: '#d1fae5', text: '#065f46' }
    ];

    return definiciones.map((def) => ({
      ...def,
      estudiantes: resultados
        .filter((r) => clasificarDesempeno(r.porcentaje).id === def.id)
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    }));
  }, [resultados, cortes]);

  const maxAlumnosGrupo = Math.max(1, ...gruposDesempeno.map((g) => g.estudiantes.length));

  // --- PROCESAMIENTO DE OBJETIVOS DE APRENDIZAJE (OAS) Y PREGUNTAS ---
  const { listaOAs, analisisPreguntas } = useMemo(() => {
    const mapaOA = {};
    const preguntasArr = [];

    for (let p = 1; p <= numPreguntas; p++) {
      const itemPauta = pauta[p];
      const correcta = typeof itemPauta === 'object' ? itemPauta?.correcta : itemPauta;
      const oaNombre = (typeof itemPauta === 'object' && itemPauta?.oa) ? itemPauta.oa.trim() : 'General';
      const oaDesc = (typeof itemPauta === 'object' && itemPauta?.habilidad) ? itemPauta.habilidad.trim() : '';

      let aciertos = 0;
      const porOpcion = {};
      opciones.forEach((op) => { porOpcion[op] = []; });
      const omitidasList = [];
      const doblesList = [];

      resultados.forEach((r) => {
        const resp = (r.respuestas && r.respuestas[p]) || '';
        if (!resp) {
          omitidasList.push(r);
        } else if (resp === 'DOBLE') {
          doblesList.push(r);
        } else {
          if (porOpcion[resp]) porOpcion[resp].push(r);
          if (correcta && resp === correcta) aciertos++;
        }
      });

      const pctLogro = totalAlumnos > 0 ? Math.round((aciertos / totalAlumnos) * 100) : 0;
      const colorInfo = clasificarDesempeno(pctLogro);

      preguntasArr.push({
        numero: p,
        correcta: correcta || '-',
        oa: oaNombre,
        descripcion: oaDesc,
        aciertos,
        pctLogro,
        colorInfo,
        porOpcion,
        omitidasList,
        doblesList
      });

      if (!mapaOA[oaNombre]) {
        mapaOA[oaNombre] = {
          oa: oaNombre,
          descripcion: oaDesc,
          preguntas: [],
          sumaLogros: 0
        };
      }
      mapaOA[oaNombre].preguntas.push(p);
      mapaOA[oaNombre].sumaLogros += pctLogro;
      if (oaDesc && !mapaOA[oaNombre].descripcion) {
        mapaOA[oaNombre].descripcion = oaDesc;
      }
    }

    const paletaOA = ['#4f46e5', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];
    const oasCalculados = Object.values(mapaOA).map((g, idx) => ({
      ...g,
      promedioLogro: Math.round(g.sumaLogros / (g.preguntas.length || 1)),
      color: paletaOA[idx % paletaOA.length]
    }));

    return { listaOAs: oasCalculados, analisisPreguntas: preguntasArr };
  }, [resultados, numPreguntas, pauta, opciones, totalAlumnos, cortes]);

  // --- PREGUNTAS ORDENADAS PARA EL GRÁFICO ---
  const preguntasOrdenadas = useMemo(() => {
    const copia = [...analisisPreguntas];
    if (ordenItems === 'asc') return copia.sort((a, b) => a.pctLogro - b.pctLogro);
    if (ordenItems === 'desc') return copia.sort((a, b) => b.pctLogro - a.pctLogro);
    return copia.sort((a, b) => a.numero - b.numero);
  }, [analisisPreguntas, ordenItems]);

  // --- CALCULAR % LOGRO POR CADA OA PARA CADA ESTUDIANTE ---
  const calcularLogroAlumnoEnOA = (alumno, oaObj, respuestasOverride = null) => {
    const mapaResp = respuestasOverride || alumno.respuestas || {};
    let buenas = 0;
    let totalValidas = 0;
    oaObj.preguntas.forEach((numP) => {
      const itemPauta = pauta[numP];
      const correcta = typeof itemPauta === 'object' ? itemPauta?.correcta : itemPauta;
      if (correcta) {
        totalValidas++;
        if (mapaResp[numP] === correcta) {
          buenas++;
        }
      }
    });
    return totalValidas > 0 ? Math.round((buenas / totalValidas) * 100) : 0;
  };

  // --- ORDENAMIENTO DE LA NÓMINA INDIVIDUAL ---
  const toggleOrdenTabla = (col) => {
    setOrdenTabla((prev) => ({
      col,
      dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const alumnosFiltradosYOrdenados = useMemo(() => {
    return resultados
      .filter((r) =>
        r.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        r.rut.toLowerCase().includes(busqueda.toLowerCase()) ||
        (r.curso || '').toLowerCase().includes(busqueda.toLowerCase())
      )
      .sort((a, b) => {
        let cmp = 0;
        if (ordenTabla.col === 'nombre') cmp = a.nombre.localeCompare(b.nombre);
        else if (ordenTabla.col === 'curso') cmp = (a.curso || '').localeCompare(b.curso || '');
        else if (ordenTabla.col === 'puntaje') cmp = Number(a.puntaje) - Number(b.puntaje);
        else if (ordenTabla.col === 'porcentaje') cmp = Number(a.porcentaje) - Number(b.porcentaje);
        else if (ordenTabla.col === 'nota') cmp = Number(a.nota) - Number(b.nota);
        else if (ordenTabla.col.startsWith('oa_')) {
          const oaNombre = ordenTabla.col.replace('oa_', '');
          const oaObj = listaOAs.find((o) => o.oa === oaNombre);
          if (oaObj) {
            cmp = calcularLogroAlumnoEnOA(a, oaObj) - calcularLogroAlumnoEnOA(b, oaObj);
          }
        }
        return ordenTabla.dir === 'asc' ? cmp : -cmp;
      });
  }, [resultados, busqueda, ordenTabla, listaOAs]);

  // --- ABRIR MODAL DE ESTUDIANTE Y PREPARAR EDICIÓN ---
  const abrirModalEstudiante = (al) => {
    setModalAlumno(al);
    setRespuestasEditadas({ ...(al.respuestas || {}) });
    setEditandoRespuestas(false);
    setZoomImagen(false);
  };

  const guardarCambiosEstudiante = async () => {
    if (!modalAlumno || !onActualizarRespuesta) return;
    setGuardandoEdicion(true);
    const actualizado = await onActualizarRespuesta(modalAlumno.id, respuestasEditadas);
    setGuardandoEdicion(false);

    if (actualizado) {
      setModalAlumno((prev) => ({
        ...prev,
        respuestas: { ...respuestasEditadas },
        puntaje: actualizado.puntaje,
        total: actualizado.total,
        porcentaje: actualizado.porcentaje,
        nota: actualizado.nota
      }));
      setEditandoRespuestas(false);
    }
  };

  // --- SUBIR PDF DE LA PRUEBA PARA VERLO DENTRO DEL DETALLE DEL ÍTEM ---
  const manejarSubirPdfPrueba = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (pdfPruebaUrl) URL.revokeObjectURL(pdfPruebaUrl);
    const url = URL.createObjectURL(file);
    setPdfPruebaUrl(url);
    setPdfPruebaNombre(file.name);
  };

  // --- EXPORTAR EXCEL COMPLETO ---
  const exportarExcel = () => {
    if (resultados.length === 0) return;

    const hojaAlumnos = alumnosFiltradosYOrdenados.map((r) => {
      const des = clasificarDesempeno(r.porcentaje);
      const fila = {
        Estudiante: r.nombre,
        RUT: r.rut,
        Curso: r.curso || '-',
        Puntaje: `${r.puntaje}/${r.total}`,
        '% Logro': Number(r.porcentaje),
        Nota: Number(r.nota).toFixed(1),
        Desempeño: des.label
      };
      listaOAs.forEach((oa) => {
        fila[`% ${oa.oa}`] = calcularLogroAlumnoEnOA(r, oa);
      });
      for (let p = 1; p <= numPreguntas; p++) {
        fila[`P${p}`] = (r.respuestas && r.respuestas[p]) || '-';
      }
      return fila;
    });

    const hojaItems = analisisPreguntas.map((it) => {
      const fila = {
        Pregunta: `P${it.numero}`,
        'Clave Correcta': it.correcta,
        OA: it.oa,
        '% Logro': it.pctLogro,
        Aciertos: it.aciertos
      };
      opciones.forEach((op) => {
        fila[`Alt ${op}`] = it.porOpcion[op]?.length || 0;
      });
      fila['Omitidas'] = it.omitidasList.length;
      fila['Dobles'] = it.doblesList.length;
      return fila;
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaAlumnos), 'Nomina_Resultados');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaItems), 'Logro_Por_Pregunta');
    XLSX.writeFile(wb, `Reporte_${(config.tituloPrueba || 'Evaluacion').replace(/\s+/g, '_')}.xlsx`);
  };

  if (totalAlumnos === 0) {
    return (
      <div style={{ background: '#ffffff', padding: '44px 24px', borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
        <BarChart3 size={44} color="#94a3b8" style={{ marginBottom: '12px' }} />
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>Aún no hay resultados escaneados</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          Sube las hojas de respuestas o el PDF escaneado en la pestaña <strong>Escanear Hojas</strong> para visualizar el panel interactivo.
        </p>
      </div>
    );
  }

  const itemActivoModal = modalItemNum ? analisisPreguntas.find((it) => it.numero === modalItemNum) : null;

  const IconoOrden = ({ col }) => {
    if (ordenTabla.col !== col) return <ArrowUpDown size={12} color="#94a3b8" />;
    return ordenTabla.dir === 'asc' ? <ArrowUp size={12} color="#2563eb" /> : <ArrowDown size={12} color="#2563eb" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. CABECERA CONSOLIDADA Y 3 TARJETAS SUPERIORES */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>
              {config.tituloPrueba || 'Evaluación'}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#64748b' }}>
              Consolidado General — <strong>{totalAlumnos} alumnos evaluados</strong> &nbsp;|&nbsp; Exigencia: <strong>{config.exigencia || 60}%</strong> &nbsp;|&nbsp; Escala: <strong>{Number(config.notaMin || 1).toFixed(1)} - {Number(config.notaMax || 7).toFixed(1)}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <label
              style={{
                background: pdfPruebaUrl ? '#eff6ff' : '#f8fafc',
                color: pdfPruebaUrl ? '#1d4ed8' : '#334155',
                border: `1px solid ${pdfPruebaUrl ? '#93c5fd' : '#cbd5e1'}`,
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Adjunta el PDF de la prueba para verlo al hacer clic en cualquier pregunta"
            >
              <FileText size={15} />
              {pdfPruebaNombre ? `PDF: ${pdfPruebaNombre.slice(0, 18)}...` : 'Adjuntar PDF Prueba'}
              <input type="file" accept="application/pdf" onChange={manejarSubirPdfPrueba} style={{ display: 'none' }} />
            </label>

            <button
              onClick={() => setMostrarConfigCortes(!mostrarConfigCortes)}
              style={{
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <SlidersHorizontal size={15} />
              Límites de Logro
            </button>

            <button
              onClick={exportarExcel}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={15} />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Panel editable de límites de los 5 niveles */}
        {mostrarConfigCortes && (
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '18px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', fontSize: '12.5px' }}>
            <strong style={{ color: '#0f172a' }}>Cortes mínimos (%):</strong>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#10b981', fontWeight: '700' }}>Muy Bueno ≥</span>
              <input type="number" value={cortes.muyBueno} onChange={(e) => setCortes({ ...cortes, muyBueno: Number(e.target.value) })} style={{ width: '50px', padding: '4px', borderRadius: '5px', border: '1px solid #cbd5e1' }} />%
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#3b82f6', fontWeight: '700' }}>Bueno ≥</span>
              <input type="number" value={cortes.bueno} onChange={(e) => setCortes({ ...cortes, bueno: Number(e.target.value) })} style={{ width: '50px', padding: '4px', borderRadius: '5px', border: '1px solid #cbd5e1' }} />%
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#eab308', fontWeight: '700' }}>Aceptable ≥</span>
              <input type="number" value={cortes.aceptable} onChange={(e) => setCortes({ ...cortes, aceptable: Number(e.target.value) })} style={{ width: '50px', padding: '4px', borderRadius: '5px', border: '1px solid #cbd5e1' }} />%
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#f97316', fontWeight: '700' }}>Insuficiente ≥</span>
              <input type="number" value={cortes.insuficiente} onChange={(e) => setCortes({ ...cortes, insuficiente: Number(e.target.value) })} style={{ width: '50px', padding: '4px', borderRadius: '5px', border: '1px solid #cbd5e1' }} />%
            </label>
            <span style={{ color: '#ef4444', fontWeight: '700' }}>(Muy Insuficiente: 0 - {cortes.insuficiente - 1}%)</span>
          </div>
        )}

        {/* 3 Tarjetas Principales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              RINDIERON
            </div>
            <div style={{ fontSize: '34px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {totalAlumnos}
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PROMEDIO DE NOTAS
            </div>
            <div style={{ fontSize: '34px', fontWeight: '800', color: Number(promedioNota) >= notaAprob ? '#16a34a' : '#dc2626', marginTop: '4px' }}>
              {promedioNota}
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PORCENTAJE DE LOGRO
            </div>
            <div style={{ fontSize: '34px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
              {promedioLogro}%
            </div>
          </div>
        </div>
      </div>

      {/* 2. PORCENTAJE DE LOGRO POR OBJETIVO DE APRENDIZAJE (OA) + COMPARATIVO DE BARRAS */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' }}>
          Porcentaje de Logro por Objetivo de Aprendizaje (OA)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {listaOAs.map((oaObj) => (
            <div key={oaObj.oa} style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ background: oaObj.color, color: '#ffffff', padding: '3px 10px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '800' }}>
                    {oaObj.oa}
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: '800', color: oaObj.color }}>
                    {oaObj.promedioLogro}%
                  </span>
                </div>
                {oaObj.descripcion && (
                  <p style={{ margin: '6px 0', fontSize: '12.5px', color: '#334155', lineHeight: '1.45' }}>
                    {oaObj.descripcion}
                  </p>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                Preguntas: <strong>{oaObj.preguntas.join(', ')}</strong> ({oaObj.preguntas.length} ítems)
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '12px' }}>
            Comparativo de Logro entre OAs
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '190px', padding: '20px 16px 0 16px', background: '#f8fafc', borderRadius: '10px', borderBottom: '2px solid #cbd5e1' }}>
            {listaOAs.map((oaObj) => (
              <div key={oaObj.oa} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '180px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                  {oaObj.promedioLogro}%
                </span>
                <div
                  style={{
                    width: '70%',
                    height: `${Math.max(8, Math.round((oaObj.promedioLogro / 100) * 145))}px`,
                    background: oaObj.color,
                    borderRadius: '8px 8px 0 0',
                    transition: 'height 0.3s ease'
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 16px 0 16px' }}>
            {listaOAs.map((oaObj) => (
              <div key={oaObj.oa} style={{ flex: 1, maxWidth: '180px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                {oaObj.oa}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. GRUPOS DE DESEMPEÑO (5 BARRAS INTERACTIVAS) */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' }}>
              Grupos de Desempeño
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#2563eb', fontWeight: '600' }}>
              Haz clic en una barra para ver la nómina de estudiantes del grupo
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11.5px' }}>
            {gruposDesempeno.map((g) => (
              <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: '600', color: '#334155' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: g.color }} />
                {g.label} ({g.rango})
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '210px', padding: '24px 12px 0 12px', background: '#f8fafc', borderRadius: '10px', borderBottom: '2px solid #cbd5e1' }}>
          {gruposDesempeno.map((g) => {
            const cant = g.estudiantes.length;
            const pctGrupo = totalAlumnos > 0 ? Math.round((cant / totalAlumnos) * 100) : 0;
            const alturaPx = Math.round((cant / maxAlumnosGrupo) * 155);

            return (
              <div
                key={g.id}
                onClick={() => setModalGrupo(g)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '18%',
                  cursor: 'pointer'
                }}
                title={`Clic para ver los ${cant} estudiantes en ${g.label}`}
              >
                <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', textAlign: 'center' }}>
                  {cant} ({pctGrupo}%)
                </span>
                <div
                  style={{
                    width: '65%',
                    maxWidth: '90px',
                    height: `${Math.max(8, alturaPx)}px`,
                    background: g.color,
                    borderRadius: '8px 8px 0 0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 12px 0 12px' }}>
          {gruposDesempeno.map((g) => (
            <div
              key={g.id}
              onClick={() => setModalGrupo(g)}
              style={{ width: '18%', textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>{g.label}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{g.rango}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. PORCENTAJE DE LOGRO POR PREGUNTA */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' }}>
              Porcentaje de Logro por Pregunta
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Coloreado por nivel de logro. <strong>Haz clic en cualquier barra</strong> para ver el detalle de distractores y alternativas.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', padding: '0 8px' }}>Ordenar preguntas:</span>
            {[
              { id: 'numero', label: 'N° Pregunta' },
              { id: 'asc', label: 'Menor a Mayor' },
              { id: 'desc', label: 'Mayor a Menor' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setOrdenItems(btn.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  background: ordenItems === btn.id ? '#ffffff' : 'transparent',
                  color: ordenItems === btn.id ? '#2563eb' : '#475569',
                  boxShadow: ordenItems === btn.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
          <div style={{ minWidth: `${Math.max(650, numPreguntas * 32)}px` }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '210px', padding: '24px 8px 0 8px', background: '#f8fafc', borderRadius: '10px', borderBottom: '2px solid #cbd5e1', gap: '4px' }}>
              {preguntasOrdenadas.map((it) => (
                <div
                  key={it.numero}
                  onClick={() => {
                    setModalItemNum(it.numero);
                    setOpcionSeleccionadaItem(null);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    minWidth: '24px'
                  }}
                  title={`P${it.numero}: ${it.pctLogro}% logro (Clave: ${it.correcta}) - Clic para detalle`}
                >
                  <span style={{ fontSize: '10px', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                    {it.pctLogro}%
                  </span>
                  <div
                    style={{
                      width: '78%',
                      maxWidth: '28px',
                      height: `${Math.max(6, Math.round((it.pctLogro / 100) * 160))}px`,
                      background: it.colorInfo.color,
                      borderRadius: '5px 5px 0 0',
                      transition: 'height 0.25s ease'
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px 0 8px', gap: '4px' }}>
              {preguntasOrdenadas.map((it) => (
                <div
                  key={it.numero}
                  onClick={() => {
                    setModalItemNum(it.numero);
                    setOpcionSeleccionadaItem(null);
                  }}
                  style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', cursor: 'pointer', minWidth: '24px' }}
                >
                  P{it.numero}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. NÓMINA DE RESULTADOS INDIVIDUALES */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' }}>
              Nómina de Resultados Individuales
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#2563eb', fontWeight: '600' }}>
              Haz clic en el nombre de cualquier alumno para ver su hoja escaneada y editar sus respuestas
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              placeholder="Buscar estudiante o curso..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ padding: '7px 12px 7px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', minWidth: '230px' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th onClick={() => toggleOrdenTabla('nombre')} style={{ padding: '10px', textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>ESTUDIANTE <IconoOrden col="nombre" /></div>
                </th>
                <th onClick={() => toggleOrdenTabla('curso')} style={{ padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>CURSO <IconoOrden col="curso" /></div>
                </th>
                <th onClick={() => toggleOrdenTabla('puntaje')} style={{ padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>PUNTAJE <IconoOrden col="puntaje" /></div>
                </th>
                <th onClick={() => toggleOrdenTabla('porcentaje')} style={{ padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>% LOGRO <IconoOrden col="porcentaje" /></div>
                </th>
                <th onClick={() => toggleOrdenTabla('nota')} style={{ padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>NOTA <IconoOrden col="nota" /></div>
                </th>
                <th style={{ padding: '10px', textAlign: 'center' }}>DESEMPEÑO</th>
                {listaOAs.map((oaObj) => (
                  <th
                    key={oaObj.oa}
                    onClick={() => toggleOrdenTabla(`oa_${oaObj.oa}`)}
                    style={{ padding: '10px', textAlign: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      % {oaObj.oa} <IconoOrden col={`oa_${oaObj.oa}`} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alumnosFiltradosYOrdenados.map((al, idx) => {
                const des = clasificarDesempeno(al.porcentaje);
                const notaNum = Number(al.nota || 1.0);
                return (
                  <tr key={al.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: '700' }}>
                      <button
                        onClick={() => abrirModalEstudiante(al)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: '#1e3a8a',
                          fontWeight: '700',
                          fontSize: '13.5px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          textDecoration: 'underline',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {al.nombre}
                        {al.imagenUrl && <Eye size={14} color="#64748b" title="Tiene hoja escaneada" />}
                      </button>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#475569' }}>{al.curso || '-'}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600' }}>{al.puntaje}/{al.total}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700' }}>{Number(al.porcentaje).toFixed(1)}%</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '800', fontSize: '14.5px', color: notaNum >= notaAprob ? '#16a34a' : '#dc2626' }}>
                      {notaNum.toFixed(1)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span style={{ background: des.bg, color: des.text, padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                        {des.label}
                      </span>
                    </td>
                    {listaOAs.map((oaObj) => {
                      const pctOA = calcularLogroAlumnoEnOA(al, oaObj);
                      return (
                        <td key={oaObj.oa} style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#334155' }}>
                          {pctOA}%
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: GRUPO DE DESEMPEÑO (AL HACER CLIC EN UNA BARRA DE DESEMPEÑO) */}
      {/* ===================================================================== */}
      {modalGrupo && (
        <div
          onClick={() => setModalGrupo(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px',
              maxHeight: '82vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden'
            }}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Grupo: {modalGrupo.label}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  {modalGrupo.estudiantes.length} estudiante(s) en este nivel ({modalGrupo.rango})
                </p>
              </div>
              <button
                onClick={() => setModalGrupo(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} color="#475569" />
              </button>
            </div>

            <div style={{ padding: '12px 22px', overflowY: 'auto', flex: 1 }}>
              {modalGrupo.estudiantes.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '20px 0' }}>
                  No hay estudiantes en este nivel de desempeño.
                </p>
              ) : (
                modalGrupo.estudiantes.map((est, i) => (
                  <div
                    key={est.id || i}
                    onClick={() => {
                      setModalGrupo(null);
                      abrirModalEstudiante(est);
                    }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 4px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{est.nombre}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Curso: {est.curso || '-'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>
                        {Number(est.nota).toFixed(1)}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {Number(est.porcentaje).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: DETALLE DEL ÍTEM P_X + ELECCIÓN POR ALTERNATIVA + VISOR PDF  */}
      {/* ===================================================================== */}
      {itemActivoModal && (
        <div
          onClick={() => setModalItemNum(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '16px', width: '100%',
              maxWidth: pdfPruebaUrl ? '1020px' : '560px',
              maxHeight: '88vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden'
            }}
          >
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ background: '#2563eb', color: '#ffffff', padding: '5px 12px', borderRadius: '8px', fontWeight: '800', fontSize: '15px' }}>
                  P{itemActivoModal.numero}
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                    Detalle del Ítem P{itemActivoModal.numero}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Rendimiento en el curso evaluado
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {pdfPruebaUrl && (
                  <a
                    href={pdfPruebaUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px',
                      borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px',
                      fontWeight: '600', color: '#334155', textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={14} /> Abrir en ventana completa
                  </a>
                )}
                <button
                  onClick={() => setModalItemNum(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
                >
                  <X size={18} color="#475569" />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: pdfPruebaUrl ? '1fr 1fr' : '1fr', overflowY: 'auto', flex: 1 }}>
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>% Logro General</div>
                    <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>
                      Aciertos: <strong>{itemActivoModal.aciertos} de {totalAlumnos}</strong> estudiantes
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a' }}>{itemActivoModal.pctLogro}%</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Clave correcta: <strong style={{ color: '#16a34a' }}>{itemActivoModal.correcta}</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                      Elección por Alternativa
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#2563eb' }}>Haz clic en una opción para ver quién la marcó</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {opciones.map((op) => {
                      const alumnosOp = itemActivoModal.porOpcion[op] || [];
                      const pctOp = totalAlumnos > 0 ? Math.round((alumnosOp.length / totalAlumnos) * 100) : 0;
                      const esCorrecta = op === itemActivoModal.correcta;
                      const activa = opcionSeleccionadaItem === op;

                      return (
                        <div
                          key={op}
                          onClick={() => setOpcionSeleccionadaItem(activa ? null : op)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: activa ? '2px solid #2563eb' : esCorrecta ? '1px solid #86efac' : '1px solid #e2e8f0',
                            background: esCorrecta ? '#f0fdf4' : '#ffffff',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '22px', height: '22px', borderRadius: '6px', background: esCorrecta ? '#16a34a' : '#f1f5f9', color: esCorrecta ? '#fff' : '#334155', fontWeight: '800', fontSize: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                {op}
                              </span>
                              <span style={{ fontWeight: '700', color: '#0f172a' }}>Alternativa {op}</span>
                              {esCorrecta && (
                                <span style={{ background: '#dcfce7', color: '#166534', fontSize: '10.5px', fontWeight: '800', padding: '2px 7px', borderRadius: '4px' }}>
                                  CORRECTA
                                </span>
                              )}
                            </div>
                            <div style={{ fontWeight: '700', color: '#334155' }}>
                              <span style={{ fontSize: '12px', color: '#64748b', marginRight: '8px' }}>{alumnosOp.length} alumnos</span>
                              {pctOp}%
                            </div>
                          </div>
                          <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ width: `${pctOp}%`, height: '100%', background: esCorrecta ? '#16a34a' : '#94a3b8' }} />
                          </div>
                        </div>
                      );
                    })}

                    <div
                      onClick={() => setOpcionSeleccionadaItem(opcionSeleccionadaItem === 'OMITIDA' ? null : 'OMITIDA')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: opcionSeleccionadaItem === 'OMITIDA' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: '#f8fafc',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: '600', color: '#475569' }}>Omitida / Blanco / Doble</span>
                        <span style={{ fontWeight: '700', color: '#475569' }}>
                          {itemActivoModal.omitidasList.length + itemActivoModal.doblesList.length} alumno(s)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {opcionSeleccionadaItem && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#1e40af', marginBottom: '6px' }}>
                      {opcionSeleccionadaItem === 'OMITIDA'
                        ? 'Estudiantes que omitieron o marcaron doble:'
                        : `Estudiantes que marcaron la alternativa ${opcionSeleccionadaItem}:`}
                    </div>
                    <div style={{ maxHeight: '110px', overflowY: 'auto', fontSize: '12.5px', color: '#1e293b' }}>
                      {(opcionSeleccionadaItem === 'OMITIDA'
                        ? [...itemActivoModal.omitidasList, ...itemActivoModal.doblesList]
                        : itemActivoModal.porOpcion[opcionSeleccionadaItem] || []
                      ).map((st, idx) => (
                        <div key={idx} style={{ padding: '3px 0', borderBottom: '1px solid #dbeafe' }}>
                          • {st.nombre} ({st.curso || '-'})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Objetivo de Aprendizaje
                  </div>
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: '800' }}>
                    {itemActivoModal.oa}
                  </span>
                  {itemActivoModal.descripcion && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#334155' }}>
                      {itemActivoModal.descripcion}
                    </p>
                  )}
                </div>
              </div>

              {pdfPruebaUrl && (
                <div style={{ borderLeft: '1px solid #e2e8f0', background: '#f1f5f9', minHeight: '420px' }}>
                  <iframe
                    src={pdfPruebaUrl}
                    title="Vista previa de la evaluación"
                    style={{ width: '100%', height: '100%', minHeight: '480px', border: 'none' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: DESGLOSE INDIVIDUAL + VISOR DE HOJA Y EDICIÓN DE RESPUESTAS  */}
      {/* ===================================================================== */}
      {modalAlumno && (
        <div
          onClick={() => setModalAlumno(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '16px', width: '100%',
              maxWidth: modalAlumno.imagenUrl ? '1180px' : '740px',
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.28)', overflow: 'hidden'
            }}
          >
            {/* Cabecera */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  {modalAlumno.nombre}
                </h3>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                  RUT: {modalAlumno.rut} &nbsp;|&nbsp; Curso: {modalAlumno.curso || '-'} &nbsp;|&nbsp; Puntaje: <strong>{modalAlumno.puntaje}/{modalAlumno.total}</strong> &nbsp;|&nbsp; Nota: <strong style={{ color: Number(modalAlumno.nota) >= notaAprob ? '#16a34a' : '#dc2626' }}>{Number(modalAlumno.nota).toFixed(1)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {editandoRespuestas && (
                  <button
                    onClick={guardarCambiosEstudiante}
                    disabled={guardandoEdicion}
                    style={{
                      background: '#16a34a', color: 'white', border: 'none',
                      padding: '8px 16px', borderRadius: '8px', fontWeight: '700',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
                    }}
                  >
                    <Save size={16} />
                    {guardandoEdicion ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                )}

                <button
                  onClick={() => setModalAlumno(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                >
                  <X size={18} color="#475569" />
                </button>
              </div>
            </div>

            {/* Cuerpo en 2 columnas: Izquierda edición / Derecha foto de la hoja leída */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: modalAlumno.imagenUrl ? '1.15fr 0.85fr' : '1fr',
                gap: '20px',
                padding: '18px 22px',
                overflowY: 'auto',
                flex: 1
              }}
            >
              <div>
                {/* Logro por OA del estudiante */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {listaOAs.map((oaObj) => {
                    const mapaActual = editandoRespuestas ? respuestasEditadas : modalAlumno.respuestas;
                    const pct = calcularLogroAlumnoEnOA(modalAlumno, oaObj, mapaActual);
                    return (
                      <div key={oaObj.oa} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '7px 12px', fontSize: '12.5px' }}>
                        <strong>{oaObj.oa}:</strong> <span style={{ color: oaObj.color, fontWeight: '800' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '10px' }}>
                  Haz clic en una alternativa para corregir la lectura (clic de nuevo para dejar omitida):
                </div>

                {/* Grilla pregunta por pregunta editable */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))', gap: '8px' }}>
                  {Array.from({ length: numPreguntas }, (_, i) => {
                    const p = i + 1;
                    const resp = (editandoRespuestas ? respuestasEditadas[p] : modalAlumno.respuestas?.[p]) || '';
                    const itemPauta = pauta[p];
                    const correcta = typeof itemPauta === 'object' ? itemPauta?.correcta : itemPauta;
                    const esBuena = Boolean(correcta) && resp === correcta;
                    const esOmitida = resp === '' || resp === '-';

                    return (
                      <div
                        key={p}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '10px',
                          border: `1px solid ${esBuena ? '#86efac' : esOmitida ? '#cbd5e1' : '#fecaca'}`,
                          background: esBuena ? '#f0fdf4' : esOmitida ? '#f8fafc' : '#fef2f2',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                          <span style={{ fontWeight: '800', color: '#334155' }}>P{p}</span>
                          <span style={{ fontWeight: '700', color: esBuena ? '#166534' : esOmitida ? '#64748b' : '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            {resp === 'DOBLE' ? 'DUP' : resp || '-'} <span style={{ fontSize: '11px', opacity: 0.8 }}>({correcta || '-'})</span>
                            {esBuena ? (
                              <CheckCircle2 size={13} color="#16a34a" />
                            ) : esOmitida ? (
                              <MinusCircle size={13} color="#94a3b8" />
                            ) : (
                              <XCircle size={13} color="#dc2626" />
                            )}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          {opciones.map((op) => {
                            const seleccionado = resp === op;
                            return (
                              <button
                                key={op}
                                onClick={() => {
                                  const base = editandoRespuestas
                                    ? respuestasEditadas
                                    : { ...(modalAlumno.respuestas || {}) };
                                  const nuevo = { ...base, [p]: seleccionado ? '' : op };
                                  setRespuestasEditadas(nuevo);
                                  setEditandoRespuestas(true);
                                }}
                                style={{
                                  flex: 1,
                                  padding: '3px 0',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                  border: seleccionado ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                                  background: seleccionado ? '#2563eb' : '#ffffff',
                                  color: seleccionado ? '#ffffff' : '#334155'
                                }}
                              >
                                {op}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Columna Derecha: Foto guardada por el visor OMR */}
              {modalAlumno.imagenUrl && (
                <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                      Hoja leída (Verde = Buena | Rojo = Mala | Azul = Clave)
                    </span>
                    <button
                      onClick={() => setZoomImagen(!zoomImagen)}
                      style={{
                        background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
                        padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <ZoomIn size={13} /> {zoomImagen ? 'Ajustar' : 'Ampliar'}
                    </button>
                  </div>

                  <div style={{ width: '100%', maxHeight: '68vh', overflow: 'auto', textAlign: 'center' }}>
                    <img
                      src={modalAlumno.imagenUrl}
                      alt={`Hoja de ${modalAlumno.nombre}`}
                      style={{
                        width: zoomImagen ? '160%' : '100%',
                        maxWidth: zoomImagen ? 'none' : '100%',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
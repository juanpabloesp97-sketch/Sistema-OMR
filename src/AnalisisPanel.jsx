import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart3, Download, ArrowUpDown, ArrowUp, ArrowDown, X,
  CheckCircle2, XCircle, MinusCircle, SlidersHorizontal, Search,
  Eye, Save, ZoomIn, AlertTriangle, ArrowRight, Check
} from 'lucide-react';

export default function AnalisisPanel({
  resultados = [],
  config = {},
  onActualizarRespuesta,
  puedeEditar = true
}) {
  const [cortes, setCortes] = useState({
    muyBueno: 85,
    bueno: 72,
    aceptable: 60,
    insuficiente: 30
  });
  const [mostrarConfigCortes, setMostrarConfigCortes] = useState(false);

  const [modalGrupo, setModalGrupo] = useState(null);
  const [modalItemNum, setModalItemNum] = useState(null);
  const [opcionSeleccionadaItem, setOpcionSeleccionadaItem] = useState(null);
  const [modalAlumno, setModalAlumno] = useState(null);

  const [editandoRespuestas, setEditandoRespuestas] = useState(false);
  const [respuestasEditadas, setRespuestasEditadas] = useState({});
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [zoomImagen, setZoomImagen] = useState(false);

  // Estados para el modal "Revisar preguntas dobles y blancas"
  const [modalDudasAbierto, setModalDudasAbierto] = useState(false);
  const [indiceDudaActual, setIndiceDudaActual] = useState(0);
  const [claveDudaSeleccionada, setClaveDudaSeleccionada] = useState('');
  const [guardandoDuda, setGuardandoDuda] = useState(false);
  const [zoomDudaImagen, setZoomDudaImagen] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [ordenTabla, setOrdenTabla] = useState({ col: 'nombre', dir: 'asc' });
  const [ordenItems, setOrdenItems] = useState('numero');

  const totalAlumnos = resultados.length;
  const numPreguntas = Number(config.numPreguntas || 30);
  const notaAprob = Number(config.notaAprob || 4.0);
  const opciones = (config.alternativas || 'ABCD').split('');
  const pauta = config.pauta || {};

  const obtenerClavesCorrectasItem = (item) => {
    if (!item) return [];
    if (typeof item === 'string') return item ? [item] : [];
    if (Array.isArray(item.correcta)) return item.correcta;
    return item.correcta ? [item.correcta] : [];
  };

  const obtenerPuntajeItem = (item) => {
    if (typeof item === 'object' && item !== null && item.puntaje !== undefined) {
      return Number(item.puntaje);
    }
    return 1;
  };

  const obtenerImagenHoja = (obj) => obj?.imagenProcesada || obj?.imagenUrl || obj?.imagen_corregida || null;

  // Lista de todas las preguntas DOBLE o BLANCO que aún NO han sido confirmadas/revisadas
  const pendientesDoblesYBlancas = useMemo(() => {
    const lista = [];
    resultados.forEach((alumno) => {
      const respMap = alumno.respuestas || {};
      const revisadasArr = Array.isArray(respMap._revisadas) ? respMap._revisadas : [];
      const revisadasSet = new Set(revisadasArr.map(Number));

      for (let p = 1; p <= numPreguntas; p++) {
        if (revisadasSet.has(p)) continue;
        const val = respMap[p];
        const esBlanco = val === '' || val === undefined || val === null || val === '-';
        const esDoble = val === 'DOBLE';

        if (esBlanco || esDoble) {
          lista.push({
            alumno,
            numeroPregunta: p,
            estadoActual: esDoble ? 'DOBLE' : 'BLANCO',
            respuestaActual: val || ''
          });
        }
      }
    });
    return lista;
  }, [resultados, numPreguntas]);

  const dudaActiva = pendientesDoblesYBlancas[indiceDudaActual] || pendientesDoblesYBlancas[0] || null;

  const abrirModalDudas = () => {
    if (pendientesDoblesYBlancas.length === 0) return;
    const primera = pendientesDoblesYBlancas[0];
    setIndiceDudaActual(0);
    setClaveDudaSeleccionada(primera.estadoActual === 'DOBLE' ? '' : primera.respuestaActual);
    setZoomDudaImagen(false);
    setModalDudasAbierto(true);
  };

  const confirmarYAvanzarDuda = async (forzarOmitida = false) => {
    if (!dudaActiva || !onActualizarRespuesta) return;
    const { alumno, numeroPregunta } = dudaActiva;
    const respActuales = { ...(alumno.respuestas || {}) };
    const revisadasPrevias = Array.isArray(respActuales._revisadas)
      ? respActuales._revisadas.map(Number)
      : [];

    const nuevaClave = forzarOmitida ? '' : claveDudaSeleccionada;
    const nuevasRespuestas = {
      ...respActuales,
      [numeroPregunta]: nuevaClave,
      _revisadas: Array.from(new Set([...revisadasPrevias, numeroPregunta]))
    };

    setGuardandoDuda(true);
    try {
      await onActualizarRespuesta(alumno.id, nuevasRespuestas);
      setIndiceDudaActual(0);
      setClaveDudaSeleccionada('');
    } finally {
      setGuardandoDuda(false);
    }
  };

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

  const promedioNota = totalAlumnos > 0
    ? (resultados.reduce((acc, r) => acc + Number(r.nota || 1.0), 0) / totalAlumnos).toFixed(1)
    : '0.0';

  const promedioLogro = totalAlumnos > 0
    ? Math.round(resultados.reduce((acc, r) => acc + Number(r.porcentaje || 0), 0) / totalAlumnos)
    : 0;

  const aprobadosCount = resultados.filter((r) => Number(r.nota || 1.0) >= notaAprob).length;
  const pctAprobacion = totalAlumnos > 0 ? Math.round((aprobadosCount / totalAlumnos) * 100) : 0;

  const gruposDesempeno = useMemo(() => {
    const base = [
      { id: 'muy_insuficiente', label: 'Muy Insuficiente', rango: `0-${cortes.insuficiente - 1}%`, color: '#ef4444', bg: '#fee2e2', text: '#991b1b', estudiantes: [] },
      { id: 'insuficiente', label: 'Insuficiente', rango: `${cortes.insuficiente}-${cortes.aceptable - 1}%`, color: '#f97316', bg: '#ffedd5', text: '#9a3412', estudiantes: [] },
      { id: 'aceptable', label: 'Aceptable', rango: `${cortes.aceptable}-${cortes.bueno - 1}%`, color: '#eab308', bg: '#fef9c3', text: '#854d0e', estudiantes: [] },
      { id: 'bueno', label: 'Bueno', rango: `${cortes.bueno}-${cortes.muyBueno - 1}%`, color: '#3b82f6', bg: '#dbeafe', text: '#1e40af', estudiantes: [] },
      { id: 'muy_bueno', label: 'Muy Bueno', rango: `${cortes.muyBueno}-100%`, color: '#10b981', bg: '#d1fae5', text: '#065f46', estudiantes: [] }
    ];

    resultados.forEach((r) => {
      const cat = clasificarDesempeno(r.porcentaje);
      const encontrado = base.find((g) => g.id === cat.id);
      if (encontrado) encontrado.estudiantes.push(r);
    });

    return base.map((g) => ({
      ...g,
      cantidad: g.estudiantes.length,
      porcentajeCurso: totalAlumnos > 0 ? Math.round((g.estudiantes.length / totalAlumnos) * 100) : 0
    }));
  }, [resultados, cortes, totalAlumnos]);

  const listaOAs = useMemo(() => {
    const map = new Map();
    const coloresOA = ['#2563eb', '#059669', '#7c3aed', '#d97706', '#dc2626', '#0891b2'];
    for (let p = 1; p <= numPreguntas; p++) {
      const item = pauta[p];
      const oaCod = (typeof item === 'object' && item?.oa) ? item.oa.trim() : 'OA General';
      const desc = (typeof item === 'object' && item?.habilidad) ? item.habilidad.trim() : '';
      if (!map.has(oaCod)) {
        map.set(oaCod, {
          oa: oaCod,
          descripcion: desc,
          preguntas: [],
          color: coloresOA[map.size % coloresOA.length]
        });
      }
      map.get(oaCod).preguntas.push(p);
    }
    return Array.from(map.values()).map((entry) => {
      let sumaPct = 0;
      let validos = 0;
      resultados.forEach((r) => {
        let ptsObtenidos = 0;
        let ptsTotales = 0;
        entry.preguntas.forEach((numP) => {
          const it = pauta[numP];
          const pts = obtenerPuntajeItem(it);
          const claves = obtenerClavesCorrectasItem(it);
          if (pts > 0 && claves.length > 0) {
            ptsTotales += pts;
            if (claves.includes(r.respuestas?.[numP])) ptsObtenidos += pts;
          }
        });
        if (ptsTotales > 0) {
          sumaPct += (ptsObtenidos / ptsTotales) * 100;
          validos++;
        }
      });
      return {
        ...entry,
        promedioLogro: validos > 0 ? Math.round(sumaPct / validos) : 0
      };
    });
  }, [pauta, numPreguntas, resultados]);

  const calcularLogroAlumnoEnOA = (alumno, oaObj, mapaRespuestasOverride = null) => {
    const mapa = mapaRespuestasOverride || alumno.respuestas || {};
    let ptsObtenidos = 0;
    let ptsTotales = 0;
    oaObj.preguntas.forEach((numP) => {
      const it = pauta[numP];
      const pts = obtenerPuntajeItem(it);
      const claves = obtenerClavesCorrectasItem(it);
      if (pts > 0 && claves.length > 0) {
        ptsTotales += pts;
        if (claves.includes(mapa[numP])) ptsObtenidos += pts;
      }
    });
    return ptsTotales > 0 ? Math.round((ptsObtenidos / ptsTotales) * 100) : 0;
  };

  const datosItems = useMemo(() => {
    const arr = [];
    for (let p = 1; p <= numPreguntas; p++) {
      const item = pauta[p];
      const clavesCorrectas = obtenerClavesCorrectasItem(item);
      const pts = obtenerPuntajeItem(item);
      const anulada = pts === 0;
      const oaCod = (typeof item === 'object' && item?.oa) ? item.oa.trim() : 'OA General';
      const desc = (typeof item === 'object' && item?.habilidad) ? item.habilidad.trim() : '';

      let aciertos = 0;
      const porOpcion = {};
      opciones.forEach((op) => { porOpcion[op] = []; });
      const omitidas = [];
      const dobles = [];

      resultados.forEach((r) => {
        const resp = r.respuestas?.[p] || '';
        if (!resp) {
          omitidas.push(r);
        } else if (resp === 'DOBLE') {
          dobles.push(r);
        } else {
          if (!porOpcion[resp]) porOpcion[resp] = [];
          porOpcion[resp].push(r);
          if (!anulada && clavesCorrectas.includes(resp)) aciertos++;
        }
      });

      const pctLogro = !anulada && totalAlumnos > 0 ? Math.round((aciertos / totalAlumnos) * 100) : 0;
      arr.push({
        numero: p,
        clavesCorrectas,
        claveTexto: clavesCorrectas.length > 0 ? clavesCorrectas.join(' / ') : '-',
        anulada,
        oa: oaCod,
        descripcion: desc,
        aciertos,
        total: totalAlumnos,
        pctLogro,
        porOpcion,
        omitidas,
        dobles
      });
    }

    if (ordenItems === 'asc') return [...arr].sort((a, b) => a.pctLogro - b.pctLogro);
    if (ordenItems === 'desc') return [...arr].sort((a, b) => b.pctLogro - a.pctLogro);
    return arr;
  }, [numPreguntas, pauta, opciones, resultados, totalAlumnos, ordenItems]);

  const filasOrdenadas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtradas = resultados.filter(
      (r) =>
        !q ||
        (r.nombre || '').toLowerCase().includes(q) ||
        (r.rut || '').toLowerCase().includes(q) ||
        (r.curso || '').toLowerCase().includes(q)
    );

    return [...filtradas].sort((a, b) => {
      let valA;
      let valB;
      if (ordenTabla.col.startsWith('oa_')) {
        const cod = ordenTabla.col.replace('oa_', '');
        const oaObj = listaOAs.find((x) => x.oa === cod);
        valA = oaObj ? calcularLogroAlumnoEnOA(a, oaObj) : 0;
        valB = oaObj ? calcularLogroAlumnoEnOA(b, oaObj) : 0;
      } else if (ordenTabla.col === 'nombre') {
        valA = (a.nombre || '').toLowerCase();
        valB = (b.nombre || '').toLowerCase();
      } else if (ordenTabla.col === 'curso') {
        valA = (a.curso || '').toLowerCase();
        valB = (b.curso || '').toLowerCase();
      } else if (ordenTabla.col === 'puntaje') {
        valA = Number(a.puntaje || 0);
        valB = Number(b.puntaje || 0);
      } else if (ordenTabla.col === 'porcentaje') {
        valA = Number(a.porcentaje || 0);
        valB = Number(b.porcentaje || 0);
      } else {
        valA = Number(a.nota || 1);
        valB = Number(b.nota || 1);
      }

      if (valA < valB) return ordenTabla.dir === 'asc' ? -1 : 1;
      if (valA > valB) return ordenTabla.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [resultados, busqueda, ordenTabla, listaOAs]);

  const alternarOrdenColumna = (col) => {
    setOrdenTabla((prev) => ({
      col,
      dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const renderIconoOrden = (col) => {
    if (ordenTabla.col !== col) return <ArrowUpDown size={13} style={{ opacity: 0.45 }} />;
    return ordenTabla.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
  };

  const exportarExcel = () => {
    const filas = filasOrdenadas.map((r) => {
      const cat = clasificarDesempeno(r.porcentaje);
      const filaObj = {
        RUT: r.rut,
        Estudiante: r.nombre,
        Curso: r.curso || '',
        Puntaje: r.puntaje,
        Total: r.total,
        Logro_Pct: r.porcentaje,
        Nota: Number(r.nota).toFixed(1),
        Grupo_Desempeno: cat.label
      };
      listaOAs.forEach((oaObj) => {
        filaObj[`OA_${oaObj.oa}_Pct`] = calcularLogroAlumnoEnOA(r, oaObj);
      });
      for (let p = 1; p <= numPreguntas; p++) {
        filaObj[`P${p}`] = r.respuestas?.[p] || '-';
      }
      return filaObj;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
    XLSX.writeFile(wb, `Analisis_${(config.tituloPrueba || 'Evaluacion').replace(/\s+/g, '_')}.xlsx`);
  };

  const abrirModalAlumno = (alumno) => {
    setModalAlumno(alumno);
    setRespuestasEditadas({ ...(alumno.respuestas || {}) });
    setEditandoRespuestas(false);
    setZoomImagen(false);
  };

  const guardarCambiosAlumno = async () => {
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

  const itemActivoModal = modalItemNum !== null
    ? datosItems.find((d) => d.numero === modalItemNum) || null
    : null;

  const imagenAlumnoModal = obtenerImagenHoja(modalAlumno);
  const imagenDudaModal = dudaActiva ? obtenerImagenHoja(dudaActiva.alumno) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* BARRA SUPERIOR DE ACCIONES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>
            Análisis de Resultados — {config.tituloPrueba}
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Haz clic en los gráficos de desempeño o en cada pregunta (P1–P{numPreguntas}) para inspeccionar estudiantes y distractores.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {puedeEditar && (
            <button
              type="button"
              onClick={abrirModalDudas}
              disabled={pendientesDoblesYBlancas.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                borderRadius: '8px',
                border: `1px solid ${pendientesDoblesYBlancas.length > 0 ? '#f59e0b' : '#cbd5e1'}`,
                background: pendientesDoblesYBlancas.length > 0 ? '#fef3c7' : '#f8fafc',
                color: pendientesDoblesYBlancas.length > 0 ? '#92400e' : '#94a3b8',
                fontWeight: '700',
                fontSize: '12.5px',
                cursor: pendientesDoblesYBlancas.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              <AlertTriangle size={15} />
              Revisar preguntas dobles y blancas ({pendientesDoblesYBlancas.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => setMostrarConfigCortes(!mostrarConfigCortes)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
              background: mostrarConfigCortes ? '#eff6ff' : '#ffffff', color: '#334155',
              fontWeight: '700', fontSize: '12.5px', cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={15} /> Límites de Logro
          </button>

          <button
            type="button"
            onClick={exportarExcel}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: '#16a34a', color: '#ffffff', fontWeight: '700',
              fontSize: '12.5px', cursor: 'pointer'
            }}
          >
            <Download size={15} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* CONFIGURADOR DE LÍMITES DE DESEMPEÑO */}
      {mostrarConfigCortes && (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <strong style={{ fontSize: '13px', color: '#0f172a' }}>Cortes de Logro (%):</strong>
          <label style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Muy Bueno desde:
            <input type="number" min="1" max="100" value={cortes.muyBueno} onChange={(e) => setCortes({ ...cortes, muyBueno: Number(e.target.value) })} style={{ width: '54px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />%
          </label>
          <label style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Bueno desde:
            <input type="number" min="1" max="100" value={cortes.bueno} onChange={(e) => setCortes({ ...cortes, bueno: Number(e.target.value) })} style={{ width: '54px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />%
          </label>
          <label style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Aceptable desde:
            <input type="number" min="1" max="100" value={cortes.aceptable} onChange={(e) => setCortes({ ...cortes, aceptable: Number(e.target.value) })} style={{ width: '54px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />%
          </label>
          <label style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Insuficiente desde:
            <input type="number" min="0" max="100" value={cortes.insuficiente} onChange={(e) => setCortes({ ...cortes, insuficiente: Number(e.target.value) })} style={{ width: '54px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />%
          </label>
        </div>
      )}

      {/* TARJETAS KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>PROMEDIO NOTA</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: Number(promedioNota) >= notaAprob ? '#16a34a' : '#dc2626', marginTop: '4px' }}>{promedioNota}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>LOGRO PROMEDIO</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>{promedioLogro}%</div>
        </div>
        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>APROBACIÓN</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{pctAprobacion}%</div>
        </div>
        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>HOJAS CORREGIDAS</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{totalAlumnos}</div>
        </div>
      </div>

      {/* GRÁFICO DE GRUPOS DE DESEMPEÑO (CLICABLE) */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={18} color="#2563eb" /> Grupos de Desempeño (Haz clic en un grupo para ver los estudiantes)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          {gruposDesempeno.map((g) => (
            <div
              key={g.id}
              onClick={() => setModalGrupo(g)}
              style={{
                padding: '14px', borderRadius: '10px', border: `1px solid ${g.color}`,
                background: g.bg, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '800', color: g.text }}>{g.label}</div>
              <div style={{ fontSize: '11px', color: g.text, opacity: 0.85 }}>{g.rango}</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: g.text, marginTop: '4px' }}>
                {g.cantidad} <span style={{ fontSize: '13px', fontWeight: '700' }}>({g.porcentajeCurso}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LOGRO POR OA */}
      {listaOAs.length > 0 && (
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: '800' }}>Logro por Objetivo de Aprendizaje (OA)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {listaOAs.map((oaObj) => (
              <div key={oaObj.oa} style={{ padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '14px', marginBottom: '6px' }}>
                  <span>{oaObj.oa}</span>
                  <span style={{ color: oaObj.color }}>{oaObj.promedioLogro}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ width: `${oaObj.promedioLogro}%`, height: '100%', background: oaObj.color }} />
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Ítems: {oaObj.preguntas.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRÁFICO DE LOGRO POR PREGUNTA (CLICABLE + ORDENABLE) */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
            Porcentaje de Logro por Pregunta (Haz clic para ver distractores)
          </h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => setOrdenItems('numero')} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: ordenItems === 'numero' ? '#0f172a' : '#fff', color: ordenItems === 'numero' ? '#fff' : '#334155', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              Orden P1..P{numPreguntas}
            </button>
            <button type="button" onClick={() => setOrdenItems('asc')} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: ordenItems === 'asc' ? '#0f172a' : '#fff', color: ordenItems === 'asc' ? '#fff' : '#334155', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              Menor a Mayor %
            </button>
            <button type="button" onClick={() => setOrdenItems('desc')} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: ordenItems === 'desc' ? '#0f172a' : '#fff', color: ordenItems === 'desc' ? '#fff' : '#334155', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              Mayor a Menor %
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '10px' }}>
          {datosItems.map((it) => {
            const colorBarra = it.anulada ? '#94a3b8' : it.pctLogro >= 70 ? '#16a34a' : it.pctLogro >= 50 ? '#2563eb' : '#dc2626';
            return (
              <div
                key={it.numero}
                onClick={() => {
                  setModalItemNum(it.numero);
                  setOpcionSeleccionadaItem(null);
                }}
                style={{
                  padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0',
                  background: it.anulada ? '#f1f5f9' : '#ffffff', cursor: 'pointer', textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155' }}>P{it.numero}</div>
                <div style={{ fontSize: '17px', fontWeight: '900', color: colorBarra, margin: '3px 0' }}>
                  {it.anulada ? 'ANUL' : `${it.pctLogro}%`}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Clave: <strong>{it.claveTexto}</strong></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NÓMINA INDIVIDUAL ORDENABLE */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
            Resultados por Estudiante ({filasOrdenadas.length})
          </h3>
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              placeholder="Buscar alumno o RUT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th onClick={() => alternarOrdenColumna('nombre')} style={{ padding: '10px', textAlign: 'left', cursor: 'pointer' }}>
                  Estudiante {renderIconoOrden('nombre')}
                </th>
                <th onClick={() => alternarOrdenColumna('curso')} style={{ padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                  Curso {renderIconoOrden('curso')}
                </th>
                <th onClick={() => alternarOrdenColumna('puntaje')} style={{ padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                  Puntaje {renderIconoOrden('puntaje')}
                </th>
                <th onClick={() => alternarOrdenColumna('porcentaje')} style={{ padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                  % Logro {renderIconoOrden('porcentaje')}
                </th>
                <th onClick={() => alternarOrdenColumna('nota')} style={{ padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                  Nota {renderIconoOrden('nota')}
                </th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Grupo</th>
                {listaOAs.map((oaObj) => (
                  <th key={oaObj.oa} onClick={() => alternarOrdenColumna(`oa_${oaObj.oa}`)} style={{ padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                    {oaObj.oa} {renderIconoOrden(`oa_${oaObj.oa}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasOrdenadas.map((r, idx) => {
                const cat = clasificarDesempeno(r.porcentaje);
                const imgHoja = obtenerImagenHoja(r);
                return (
                  <tr key={r.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px' }}>
                      <button
                        type="button"
                        onClick={() => abrirModalAlumno(r)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#1d4ed8', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        {r.nombre}
                        {imgHoja && <Eye size={14} color="#64748b" />}
                      </button>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#475569' }}>{r.curso || '-'}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600' }}>{r.puntaje}/{r.total}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700' }}>{r.porcentaje}%</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '800', color: Number(r.nota) >= notaAprob ? '#16a34a' : '#dc2626' }}>
                      {Number(r.nota).toFixed(1)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11.5px', fontWeight: '700', background: cat.bg, color: cat.text }}>
                        {cat.label}
                      </span>
                    </td>
                    {listaOAs.map((oaObj) => (
                      <td key={oaObj.oa} style={{ padding: '10px', textAlign: 'center', fontWeight: '700' }}>
                        {calcularLogroAlumnoEnOA(r, oaObj)}%
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL NUEVO: REVISAR PREGUNTAS DOBLES Y BLANCAS                        */}
      {/* ===================================================================== */}
      {modalDudasAbierto && dudaActiva && (
        <div
          onClick={() => setModalDudasAbierto(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '16px', width: '100%',
              maxWidth: imagenDudaModal ? '1140px' : '640px',
              maxHeight: '92vh', display: 'flex', flexDirection: 'column',
              overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)'
            }}
          >
            {/* Cabecera del Modal de Dobles y Blancas */}
            <div style={{ padding: '16px 22px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#92400e', textTransform: 'uppercase' }}>
                  Revisión de Dobles y Blancas • {pendientesDoblesYBlancas.length} pendiente(s) por confirmar
                </div>
                <h3 style={{ margin: '3px 0 0 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  {dudaActiva.alumno.nombre} — Pregunta {dudaActiva.numeroPregunta}{' '}
                  <span style={{
                    fontSize: '12px', padding: '2px 8px', borderRadius: '999px', marginLeft: '6px',
                    background: dudaActiva.estadoActual === 'DOBLE' ? '#fef3c7' : '#e2e8f0',
                    color: dudaActiva.estadoActual === 'DOBLE' ? '#b45309' : '#334155'
                  }}>
                    Detectada: {dudaActiva.estadoActual === 'DOBLE' ? 'DOBLE MARCA' : 'BLANCO / OMITIDA'}
                  </span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setModalDudasAbierto(false)}
                style={{ background: '#ffffff', border: '1px solid #fcd34d', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer' }}
              >
                <X size={18} color="#92400e" />
              </button>
            </div>

            {/* Cuerpo en 2 columnas: Izquierda confirmar/modificar clave | Derecha hoja del estudiante */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: imagenDudaModal ? '0.95fr 1.05fr' : '1fr',
                gap: '20px',
                padding: '20px 22px',
                overflowY: 'auto',
                flex: 1
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', fontSize: '13px' }}>
                    <div><strong>RUT:</strong> {dudaActiva.alumno.rut} • <strong>Curso:</strong> {dudaActiva.alumno.curso || '-'}</div>
                    <div style={{ marginTop: '4px' }}>
                      <strong>Clave correcta en pauta (P{dudaActiva.numeroPregunta}):</strong>{' '}
                      <span style={{ color: '#16a34a', fontWeight: '800' }}>
                        {obtenerClavesCorrectasItem(pauta[dudaActiva.numeroPregunta]).join(' / ') || '-'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                      Selecciona o modifica la alternativa para P{dudaActiva.numeroPregunta}:
                    </label>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {opciones.map((op) => {
                        const activa = claveDudaSeleccionada === op;
                        return (
                          <button
                            key={op}
                            type="button"
                            onClick={() => setClaveDudaSeleccionada(activa ? '' : op)}
                            style={{
                              flex: 1,
                              minWidth: '52px',
                              padding: '11px 0',
                              borderRadius: '10px',
                              border: activa ? '2px solid #2563eb' : '1px solid #cbd5e1',
                              background: activa ? '#2563eb' : '#ffffff',
                              color: activa ? '#ffffff' : '#0f172a',
                              fontWeight: '800',
                              fontSize: '15px',
                              cursor: 'pointer'
                            }}
                          >
                            {op}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                  <button
                    type="button"
                    disabled={guardandoDuda}
                    onClick={() => confirmarYAvanzarDuda(false)}
                    style={{
                      width: '100%',
                      background: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: '800',
                      cursor: guardandoDuda ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Check size={17} />
                    {guardandoDuda
                      ? 'Guardando...'
                      : claveDudaSeleccionada
                      ? `Confirmar "${claveDudaSeleccionada}" y Siguiente`
                      : 'Confirmar como BLANCO / Omitida y Siguiente'}
                    <ArrowRight size={17} />
                  </button>

                  {claveDudaSeleccionada && (
                    <button
                      type="button"
                      disabled={guardandoDuda}
                      onClick={() => confirmarYAvanzarDuda(true)}
                      style={{
                        width: '100%',
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '9px',
                        padding: '9px 14px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Dejar en BLANCO (sin respuesta) y marcar revisada
                    </button>
                  )}
                </div>
              </div>

              {imagenDudaModal && (
                <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                      Hoja del estudiante (Pregunta {dudaActiva.numeroPregunta})
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomDudaImagen(!zoomDudaImagen)}
                      style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ZoomIn size={13} /> {zoomDudaImagen ? 'Ajustar' : 'Ampliar'}
                    </button>
                  </div>
                  <div style={{ width: '100%', maxHeight: '62vh', overflow: 'auto', textAlign: 'center' }}>
                    <img
                      src={imagenDudaModal}
                      alt={`Hoja de ${dudaActiva.alumno.nombre}`}
                      style={{ width: zoomDudaImagen ? '160%' : '100%', maxWidth: zoomDudaImagen ? 'none' : '100%', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: GRUPO DE DESEMPEÑO */}
      {modalGrupo && (
        <div onClick={() => setModalGrupo(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', color: modalGrupo.color }}>
                  Grupo: {modalGrupo.label} ({modalGrupo.rango})
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  {modalGrupo.cantidad} estudiante(s) en este nivel
                </p>
              </div>
              <button type="button" onClick={() => setModalGrupo(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
              {modalGrupo.estudiantes.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px' }}>No hay estudiantes en este grupo.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Estudiante</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Logro</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalGrupo.estudiantes.map((est, i) => (
                      <tr key={est.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px' }}>
                          <button type="button" onClick={() => { setModalGrupo(null); abrirModalAlumno(est); }} style={{ background: 'none', border: 'none', padding: 0, color: '#1d4ed8', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer' }}>
                            {est.nombre}
                          </button>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{est.porcentaje}%</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '800' }}>{Number(est.nota).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DETALLE DE ÍTEM Y DISTRACTORES */}
      {itemActivoModal && (
        <div onClick={() => setModalItemNum(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>
                  Pregunta {itemActivoModal.numero} — Clave: <span style={{ color: '#16a34a' }}>{itemActivoModal.claveTexto}</span>
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  {itemActivoModal.anulada ? 'Pregunta anulada (0 pts)' : `Logro: ${itemActivoModal.pctLogro}% (${itemActivoModal.aciertos}/${itemActivoModal.total})`} • {itemActivoModal.oa}
                </p>
              </div>
              <button type="button" onClick={() => setModalItemNum(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {opciones.map((op) => {
                const listaOp = itemActivoModal.porOpcion[op] || [];
                const esCorrecta = itemActivoModal.clavesCorrectas.includes(op);
                const abierta = opcionSeleccionadaItem === op;
                return (
                  <div key={op} style={{ border: `1px solid ${esCorrecta ? '#86efac' : '#e2e8f0'}`, borderRadius: '10px', background: esCorrecta ? '#f0fdf4' : '#f8fafc' }}>
                    <div onClick={() => setOpcionSeleccionadaItem(abierta ? null : op)} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '13.5px' }}>
                      <span>Alternativa {op} {esCorrecta ? '(Correcta)' : ''}</span>
                      <span>{listaOp.length} alumno(s)</span>
                    </div>
                    {abierta && (
                      <div style={{ padding: '8px 14px 12px 14px', borderTop: '1px solid #e2e8f0', fontSize: '12.5px', color: '#334155' }}>
                        {listaOp.length > 0 ? listaOp.map((x) => x.nombre).join(', ') : 'Ningún estudiante marcó esta opción.'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DETALLE INDIVIDUAL + VISOR DE HOJA + EDICIÓN */}
      {modalAlumno && (
        <div onClick={() => setModalAlumno(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: imagenAlumnoModal ? '1180px' : '740px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>{modalAlumno.nombre}</h3>
                <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                  RUT: {modalAlumno.rut} • Puntaje: <strong>{modalAlumno.puntaje}/{modalAlumno.total}</strong> • Nota: <strong>{Number(modalAlumno.nota).toFixed(1)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {editandoRespuestas && puedeEditar && (
                  <button type="button" onClick={guardarCambiosAlumno} disabled={guardandoEdicion} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Save size={16} /> {guardandoEdicion ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                )}
                <button type="button" onClick={() => setModalAlumno(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: imagenAlumnoModal ? '1.15fr 0.85fr' : '1fr', gap: '20px', padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))', gap: '8px' }}>
                  {Array.from({ length: numPreguntas }, (_, i) => {
                    const p = i + 1;
                    const resp = (editandoRespuestas ? respuestasEditadas[p] : modalAlumno.respuestas?.[p]) || '';
                    const itemPauta = pauta[p];
                    const clavesCorrectas = obtenerClavesCorrectasItem(itemPauta);
                    const esBuena = clavesCorrectas.includes(resp);
                    const esOmitida = resp === '' || resp === '-';

                    return (
                      <div key={p} style={{ padding: '8px 10px', borderRadius: '10px', border: `1px solid ${esBuena ? '#86efac' : esOmitida ? '#cbd5e1' : '#fecaca'}`, background: esBuena ? '#f0fdf4' : esOmitida ? '#f8fafc' : '#fef2f2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800' }}>
                          <span>P{p} <small style={{ color: '#64748b', fontWeight: '500' }}>({clavesCorrectas.join('/') || '-'})</small></span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: esBuena ? '#166534' : esOmitida ? '#64748b' : '#991b1b' }}>
                            {resp === 'DOBLE' ? 'DUP' : resp || '-'}
                            {esBuena ? <CheckCircle2 size={13} color="#16a34a" /> : esOmitida ? <MinusCircle size={13} color="#94a3b8" /> : <XCircle size={13} color="#dc2626" />}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {opciones.map((op) => {
                            const seleccionado = resp === op;
                            return (
                              <button
                                key={op}
                                type="button"
                                disabled={!puedeEditar}
                                onClick={() => {
                                  const base = editandoRespuestas ? respuestasEditadas : { ...(modalAlumno.respuestas || {}) };
                                  const nuevo = { ...base, [p]: seleccionado ? '' : op };
                                  setRespuestasEditadas(nuevo);
                                  setEditandoRespuestas(true);
                                }}
                                style={{ flex: 1, padding: '3px 0', fontSize: '11px', fontWeight: '700', borderRadius: '5px', cursor: puedeEditar ? 'pointer' : 'not-allowed', border: seleccionado ? '1px solid #1d4ed8' : '1px solid #cbd5e1', background: seleccionado ? '#2563eb' : '#ffffff', color: seleccionado ? '#ffffff' : '#334155' }}
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

              {imagenAlumnoModal && (
                <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Hoja procesada</span>
                    <button type="button" onClick={() => setZoomImagen(!zoomImagen)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <ZoomIn size={13} /> {zoomImagen ? 'Ajustar' : 'Ampliar'}
                    </button>
                  </div>
                  <div style={{ width: '100%', maxHeight: '68vh', overflow: 'auto', textAlign: 'center' }}>
                    <img src={imagenAlumnoModal} alt={`Hoja de ${modalAlumno.nombre}`} style={{ width: zoomImagen ? '160%' : '100%', maxWidth: zoomImagen ? 'none' : '100%', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
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
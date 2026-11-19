import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileDown, Users, Search, ArrowUpDown, X, CheckCircle2,
  XCircle, MinusCircle, Eye, FileText, Upload, Save, ZoomIn
} from 'lucide-react';

const NIVELES_DESEMPENO = [
  { id: 'muy_insuf', label: 'Muy Insuficiente', rango: '0 - 29%', min: 0, max: 29.99, color: '#dc2626', bg: '#fef2f2' },
  { id: 'insuf', label: 'Insuficiente', rango: '30 - 59%', min: 30, max: 59.99, color: '#f97316', bg: '#fff7ed' },
  { id: 'elem', label: 'Elemental', rango: '60 - 74%', min: 60, max: 74.99, color: '#eab308', bg: '#fefce8' },
  { id: 'adec', label: 'Adecuado', rango: '75 - 84%', min: 75, max: 84.99, color: '#84cc16', bg: '#f7fee7' },
  { id: 'dest', label: 'Destacado', rango: '85 - 100%', min: 85, max: 100, color: '#16a34a', bg: '#f0fdf4' }
];

export default function AnalisisPanel({
  resultados = [],
  config = {},
  estudiantesCurso = [],
  eximidos = [],
  onActualizarRespuesta
}) {
  const [busqueda, setBusqueda] = useState('');
  const [ordenCampo, setOrdenCampo] = useState('nombre');
  const [ordenAsc, setOrdenAsc] = useState(true);

  // Modales interactivos
  const [modalNivel, setModalNivel] = useState(null);
  const [modalPregunta, setModalPregunta] = useState(null);
  const [modalAlumno, setModalAlumno] = useState(null);
  const [editandoRespuestas, setEditandoRespuestas] = useState(false);
  const [respuestasEditadas, setRespuestasEditadas] = useState({});
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [zoomImagen, setZoomImagen] = useState(false);

  // PDF opcional del instrumento de evaluación
  const [pdfInstrumentoUrl, setPdfInstrumentoUrl] = useState(null);

  const numPreguntas = Number(config.numPreguntas || 30);
  const opciones = (config.alternativas || 'ABCD').split('');
  const pauta = config.pauta || {};

  // Detectar OAs definidos en la pauta
  const listaOAs = useMemo(() => {
    const setOAs = new Set();
    for (let i = 1; i <= numPreguntas; i++) {
      const item = pauta[i];
      if (item && typeof item === 'object' && item.oa && item.oa.trim()) {
        setOAs.add(item.oa.trim());
      }
    }
    return Array.from(setOAs);
  }, [pauta, numPreguntas]);

  // Calcular logro por OA para cada estudiante
  const resultadosEnriquecidos = useMemo(() => {
    return resultados.map((r) => {
      const logroPorOA = {};
      listaOAs.forEach((oa) => {
        let ptsObtenidos = 0;
        let ptsTotales = 0;
        for (let p = 1; p <= numPreguntas; p++) {
          const item = pauta[p];
          if (item && typeof item === 'object' && (item.oa || '').trim() === oa && item.correcta) {
            const val = Number(item.puntaje || 1);
            ptsTotales += val;
            if (r.respuestas?.[p] === item.correcta) {
              ptsObtenidos += val;
            }
          }
        }
        logroPorOA[oa] = ptsTotales > 0 ? Math.round((ptsObtenidos / ptsTotales) * 100) : 0;
      });

      const pct = Number(r.porcentaje || 0);
      const nivel =
        NIVELES_DESEMPENO.find((n) => pct >= n.min && pct <= n.max) || NIVELES_DESEMPENO[0];

      return { ...r, logroPorOA, nivelObj: nivel };
    });
  }, [resultados, listaOAs, numPreguntas, pauta]);

  // KPIs generales
  const kpis = useMemo(() => {
    const n = resultadosEnriquecidos.length;
    if (n === 0) {
      return { promedioNota: 0, promedioLogro: 0, aprobacion: 0, rendidos: 0, totalEsperados: 0 };
    }
    const sumaNota = resultadosEnriquecidos.reduce((acc, r) => acc + Number(r.nota || 1), 0);
    const sumaLogro = resultadosEnriquecidos.reduce((acc, r) => acc + Number(r.porcentaje || 0), 0);
    const aprobados = resultadosEnriquecidos.filter(
      (r) => Number(r.nota || 1) >= Number(config.notaAprob || 4.0)
    ).length;

    const eximidosSet = new Set((eximidos || []).map((x) => x.trim().toLowerCase()));
    const habilitados = estudiantesCurso.filter(
      (e) => !eximidosSet.has(e.rut.trim().toLowerCase())
    );

    return {
      promedioNota: (sumaNota / n).toFixed(1),
      promedioLogro: Math.round(sumaLogro / n),
      aprobacion: Math.round((aprobados / n) * 100),
      rendidos: n,
      totalEsperados: habilitados.length || n
    };
  }, [resultadosEnriquecidos, config.notaAprob, estudiantesCurso, eximidos]);

  // Distribución por los 5 niveles de desempeño
  const distribucionNiveles = useMemo(() => {
    const total = resultadosEnriquecidos.length || 1;
    return NIVELES_DESEMPENO.map((niv) => {
      const alumnos = resultadosEnriquecidos.filter((r) => r.nivelObj.id === niv.id);
      return {
        ...niv,
        cantidad: alumnos.length,
        porcentajeCurso: resultadosEnriquecidos.length > 0 ? Math.round((alumnos.length / total) * 100) : 0,
        alumnos
      };
    });
  }, [resultadosEnriquecidos]);

  // Análisis ítem por ítem + distractores
  const analisisPreguntas = useMemo(() => {
    const total = resultadosEnriquecidos.length;
    const lista = [];
    for (let p = 1; p <= numPreguntas; p++) {
      const item = pauta[p];
      const correcta = typeof item === 'object' ? item?.correcta : item;
      const oa = typeof item === 'object' ? item?.oa || '' : '';
      const habilidad = typeof item === 'object' ? item?.habilidad || '' : '';

      const conteoOpciones = {};
      opciones.forEach((op) => (conteoOpciones[op] = []));
      const omitidas = [];
      const dobles = [];
      let aciertos = 0;

      resultadosEnriquecidos.forEach((r) => {
        const resp = r.respuestas?.[p] || '';
        if (!resp) {
          omitidas.push(r);
        } else if (resp === 'DOBLE') {
          dobles.push(r);
        } else {
          if (!conteoOpciones[resp]) conteoOpciones[resp] = [];
          conteoOpciones[resp].push(r);
          if (correcta && resp === correcta) aciertos++;
        }
      });

      const pctLogro = total > 0 ? Math.round((aciertos / total) * 100) : 0;
      lista.push({
        numero: p,
        correcta: correcta || '-',
        oa,
        habilidad,
        pctLogro,
        aciertos,
        total,
        conteoOpciones,
        omitidas,
        dobles
      });
    }
    return lista;
  }, [resultadosEnriquecidos, numPreguntas, pauta, opciones]);

  // Análisis por OA
  const analisisOAs = useMemo(() => {
    return listaOAs.map((oa) => {
      const n = resultadosEnriquecidos.length;
      const suma = resultadosEnriquecidos.reduce((acc, r) => acc + (r.logroPorOA[oa] || 0), 0);
      return {
        oa,
        porcentaje: n > 0 ? Math.round(suma / n) : 0
      };
    });
  }, [listaOAs, resultadosEnriquecidos]);

  // Filtrado y ordenamiento de la tabla individual
  const alumnosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = resultadosEnriquecidos.filter(
      (r) =>
        !q ||
        r.nombre.toLowerCase().includes(q) ||
        r.rut.toLowerCase().includes(q) ||
        (r.curso || '').toLowerCase().includes(q)
    );

    return [...filtrados].sort((a, b) => {
      let valA = a[ordenCampo];
      let valB = b[ordenCampo];
      if (ordenCampo.startsWith('oa_')) {
        const oaKey = ordenCampo.replace('oa_', '');
        valA = a.logroPorOA[oaKey] || 0;
        valB = b.logroPorOA[oaKey] || 0;
      }
      if (typeof valA === 'string') {
        return ordenAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return ordenAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [resultadosEnriquecidos, busqueda, ordenCampo, ordenAsc]);

  const cambiarOrden = (campo) => {
    if (ordenCampo === campo) setOrdenAsc(!ordenAsc);
    else {
      setOrdenCampo(campo);
      setOrdenAsc(campo === 'nombre' || campo === 'curso');
    }
  };

  const abrirModalEstudiante = (alumno) => {
    setModalAlumno(alumno);
    setRespuestasEditadas({ ...(alumno.respuestas || {}) });
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

  const exportarExcel = () => {
    const filas = alumnosFiltrados.map((r) => {
      const base = {
        RUT: r.rut,
        Estudiante: r.nombre,
        Curso: r.curso,
        Puntaje: r.puntaje,
        Total: r.total,
        '% Logro': r.porcentaje,
        Nota: Number(r.nota).toFixed(1),
        Desempeño: r.nivelObj.label
      };
      listaOAs.forEach((oa) => {
        base[`% ${oa}`] = r.logroPorOA[oa] ?? 0;
      });
      for (let p = 1; p <= numPreguntas; p++) {
        base[`P${p}`] = r.respuestas?.[p] || '-';
      }
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
    XLSX.writeFile(wb, `Reporte_${(config.tituloPrueba || 'Evaluacion').replace(/\s+/g, '_')}.xlsx`);
  };

  if (resultados.length === 0) {
    return (
      <div style={{ background: '#ffffff', padding: '40px', borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>
        <Users size={42} color="#94a3b8" style={{ marginBottom: '12px' }} />
        <h3 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Aún no hay hojas escaneadas en esta evaluación</h3>
        <p style={{ margin: 0, fontSize: '14px' }}>
          Escanea al menos una hoja de respuestas para visualizar los indicadores, gráficos por OA y análisis ítem por ítem.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* BARRA SUPERIOR DE EXPORTACIÓN Y PDF DE PRUEBA */}
      <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
            Informe de Resultados — {config.tituloPrueba}
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            {config.asignatura} | Exigencia: {config.exigencia}% | Nota Aprobación: {config.notaAprob}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            <Upload size={16} />
            {pdfInstrumentoUrl ? 'PDF Prueba Cargado ✓' : 'Adjuntar PDF de Prueba'}
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPdfInstrumentoUrl(URL.createObjectURL(f));
              }}
              style={{ display: 'none' }}
            />
          </label>

          <button
            onClick={exportarExcel}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
              borderRadius: '8px', border: 'none', background: '#16a34a', color: 'white',
              fontSize: '13px', fontWeight: '700', cursor: 'pointer'
            }}
          >
            <FileDown size={17} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* TARJETAS KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>PROMEDIO DEL CURSO</div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: Number(kpis.promedioNota) >= Number(config.notaAprob || 4) ? '#16a34a' : '#dc2626', marginTop: '4px' }}>
            {kpis.promedioNota}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Escala {config.notaMin} a {config.notaMax}</div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>% LOGRO PROMEDIO</div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
            {kpis.promedioLogro}%
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Sobre {numPreguntas} preguntas</div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>% APROBACIÓN (≥ {config.notaAprob})</div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {kpis.aprobacion}%
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Estudiantes aprobados</div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>ESTUDIANTES EVALUADOS</div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {kpis.rendidos} <span style={{ fontSize: '16px', color: '#64748b', fontWeight: '600' }}>/ {kpis.totalEsperados}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Hojas procesadas</div>
        </div>
      </div>

      {/* DISTRIBUCIÓN POR NIVELES DE DESEMPEÑO + LOGRO POR OA */}
      <div style={{ display: 'grid', gridTemplateColumns: listaOAs.length > 0 ? '1.3fr 1fr' : '1fr', gap: '16px' }}>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800' }}>Distribución por Nivel de Desempeño</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>
            Haz clic sobre cualquier barra para ver la lista de estudiantes en ese tramo.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {distribucionNiveles.map((niv) => (
              <div
                key={niv.id}
                onClick={() => setModalNivel(niv)}
                style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', transition: 'background 0.15s' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>
                  <span>{niv.label} <small style={{ color: '#64748b', fontWeight: '500' }}>({niv.rango})</small></span>
                  <span>{niv.cantidad} est. ({niv.porcentajeCurso}%)</span>
                </div>
                <div style={{ width: '100%', height: '14px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${niv.porcentajeCurso}%`,
                      height: '100%',
                      background: niv.color,
                      borderRadius: '999px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {listaOAs.length > 0 && (
          <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800' }}>Logro por Objetivo de Aprendizaje (OA)</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>
              Porcentaje promedio de acierto por eje/OA configurado en la pauta.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {analisisOAs.map((item) => (
                <div key={item.oa}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>
                    <span>{item.oa}</span>
                    <span style={{ color: item.porcentaje >= 60 ? '#16a34a' : '#dc2626' }}>{item.porcentaje}%</span>
                  </div>
                  <div style={{ width: '100%', height: '14px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${item.porcentaje}%`,
                        height: '100%',
                        background: item.porcentaje >= 75 ? '#16a34a' : item.porcentaje >= 60 ? '#eab308' : '#dc2626',
                        borderRadius: '999px'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ANÁLISIS POR PREGUNTA (ÍTEM POR ÍTEM) */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800' }}>Logro por Pregunta (Ítem por Ítem)</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>
          Haz clic en cualquier pregunta para ver el análisis de distractores y quién marcó cada alternativa.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: '10px' }}>
          {analisisPreguntas.map((preg) => {
            const bg = preg.pctLogro >= 75 ? '#f0fdf4' : preg.pctLogro >= 50 ? '#fefce8' : '#fef2f2';
            const border = preg.pctLogro >= 75 ? '#86efac' : preg.pctLogro >= 50 ? '#fde047' : '#fecaca';
            const color = preg.pctLogro >= 75 ? '#16a34a' : preg.pctLogro >= 50 ? '#ca8a04' : '#dc2626';

            return (
              <div
                key={preg.numero}
                onClick={() => setModalPregunta(preg)}
                style={{
                  background: bg, border: `1px solid ${border}`, borderRadius: '10px',
                  padding: '10px', textAlign: 'center', cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155' }}>P{preg.numero}</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color, margin: '2px 0' }}>{preg.pctLogro}%</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Clave: <strong>{preg.correcta}</strong></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NÓMINA DE RESULTADOS INDIVIDUALES */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Nómina de Resultados Individuales</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#2563eb' }}>
              Haz clic en el nombre de cualquier alumno para ver su hoja escaneada y editar sus respuestas
            </p>
          </div>

          <div style={{ position: 'relative', minWidth: '250px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Buscar estudiante o curso..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th onClick={() => cambiarOrden('nombre')} style={{ padding: '12px 10px', textAlign: 'left', cursor: 'pointer' }}>
                  ESTUDIANTE <ArrowUpDown size={13} style={{ verticalAlign: 'middle' }} />
                </th>
                <th onClick={() => cambiarOrden('curso')} style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }}>
                  CURSO <ArrowUpDown size={13} style={{ verticalAlign: 'middle' }} />
                </th>
                <th onClick={() => cambiarOrden('puntaje')} style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }}>
                  PUNTAJE <ArrowUpDown size={13} style={{ verticalAlign: 'middle' }} />
                </th>
                <th onClick={() => cambiarOrden('porcentaje')} style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }}>
                  % LOGRO <ArrowUpDown size={13} style={{ verticalAlign: 'middle' }} />
                </th>
                <th onClick={() => cambiarOrden('nota')} style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }}>
                  NOTA <ArrowUpDown size={13} style={{ verticalAlign: 'middle' }} />
                </th>
                <th style={{ padding: '12px 10px', textAlign: 'center' }}>DESEMPEÑO</th>
                {listaOAs.map((oa) => (
                  <th
                    key={oa}
                    onClick={() => cambiarOrden(`oa_${oa}`)}
                    style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }}
                  >
                    % {oa} <ArrowUpDown size={13} style={{ verticalAlign: 'middle' }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alumnosFiltrados.map((r, idx) => (
                <tr key={r.id || `${r.rut}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 10px' }}>
                    <button
                      onClick={() => abrirModalEstudiante(r)}
                      style={{
                        background: 'none', border: 'none', padding: 0, color: '#1d4ed8',
                        fontWeight: '700', textDecoration: 'underline', cursor: 'pointer',
                        textAlign: 'left', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      {r.nombre}
                      {r.imagenUrl && <Eye size={14} color="#64748b" title="Tiene hoja escaneada" />}
                    </button>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'center', color: '#475569' }}>{r.curso || '-'}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '600' }}>{r.puntaje}/{r.total}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700' }}>{Number(r.porcentaje).toFixed(1)}%</td>
                  <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '800', fontSize: '14px', color: Number(r.nota) >= Number(config.notaAprob || 4) ? '#16a34a' : '#dc2626' }}>
                    {Number(r.nota).toFixed(1)}
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '700',
                        background: r.nivelObj.bg, color: r.nivelObj.color
                      }}
                    >
                      {r.nivelObj.label}
                    </span>
                  </td>
                  {listaOAs.map((oa) => (
                    <td key={oa} style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700' }}>
                      {r.logroPorOA[oa] ?? 0}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ESTUDIANTES POR NIVEL DE DESEMPEÑO */}
      {modalNivel && (
        <div
          onClick={() => setModalNivel(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', color: modalNivel.color }}>
                  Nivel {modalNivel.label} ({modalNivel.rango})
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  {modalNivel.cantidad} estudiante(s) en este grupo
                </p>
              </div>
              <button onClick={() => setModalNivel(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
              {modalNivel.alumnos.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px' }}>No hay estudiantes en este rango.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Estudiante</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Puntaje</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>% Logro</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalNivel.alumnos.map((al, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', fontWeight: '600' }}>{al.nombre}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{al.puntaje}/{al.total}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{al.porcentaje}%</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{Number(al.nota).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ANÁLISIS DE DISTRACTORES POR PREGUNTA */}
      {modalPregunta && (
        <div
          onClick={() => setModalPregunta(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '850px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>
                  Pregunta {modalPregunta.numero} — Respuesta Correcta: <span style={{ color: '#16a34a' }}>{modalPregunta.correcta}</span>
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Logro: {modalPregunta.pctLogro}% ({modalPregunta.aciertos}/{modalPregunta.total})
                  {modalPregunta.oa ? ` | OA: ${modalPregunta.oa}` : ''}
                </p>
              </div>
              <button onClick={() => setModalPregunta(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', display: 'grid', gridTemplateColumns: pdfInstrumentoUrl ? '1fr 1fr' : '1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {opciones.map((op) => {
                  const arr = modalPregunta.conteoOpciones[op] || [];
                  const esCorrecta = op === modalPregunta.correcta;
                  return (
                    <div key={op} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${esCorrecta ? '#86efac' : '#e2e8f0'}`, background: esCorrecta ? '#f0fdf4' : '#f8fafc' }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: esCorrecta ? '#16a34a' : '#334155', marginBottom: '4px' }}>
                        Alternativa {op} {esCorrecta ? '(Correcta)' : ''} — {arr.length} alumno(s)
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569' }}>
                        {arr.length > 0 ? arr.map((x) => x.nombre).join(', ') : 'Ningún estudiante marcó esta opción.'}
                      </div>
                    </div>
                  );
                })}

                {(modalPregunta.omitidas.length > 0 || modalPregunta.dobles.length > 0) && (
                  <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid #fed7aa', background: '#fff7ed', fontSize: '12px' }}>
                    {modalPregunta.dobles.length > 0 && (
                      <div style={{ marginBottom: '6px' }}>
                        <strong>Doble marca ({modalPregunta.dobles.length}):</strong> {modalPregunta.dobles.map((x) => x.nombre).join(', ')}
                      </div>
                    )}
                    {modalPregunta.omitidas.length > 0 && (
                      <div>
                        <strong>Omitidas ({modalPregunta.omitidas.length}):</strong> {modalPregunta.omitidas.map((x) => x.nombre).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {pdfInstrumentoUrl && (
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden', minHeight: '420px' }}>
                  <iframe src={pdfInstrumentoUrl} title="Prueba PDF" width="100%" height="100%" style={{ border: 'none', minHeight: '420px' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DESGLOSE INDIVIDUAL CON VISOR DE HOJA Y EDICIÓN DE RESPUESTAS */}
      {modalAlumno && (
        <div
          onClick={() => setModalAlumno(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '16px', width: '100%',
              maxWidth: modalAlumno.imagenUrl ? '1180px' : '820px',
              maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
            }}
          >
            {/* Cabecera */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  {modalAlumno.nombre}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  RUT: {modalAlumno.rut} | Curso: {modalAlumno.curso || '-'} | Puntaje:{' '}
                  <strong>{modalAlumno.puntaje}/{modalAlumno.total}</strong> | Nota:{' '}
                  <strong style={{ color: Number(modalAlumno.nota) >= Number(config.notaAprob || 4) ? '#16a34a' : '#dc2626' }}>
                    {Number(modalAlumno.nota).toFixed(1)}
                  </strong>
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {editandoRespuestas && (
                  <button
                    onClick={guardarCambiosEstudiante}
                    disabled={guardandoEdicion}
                    style={{
                      background: '#16a34a', color: 'white', border: 'none',
                      padding: '9px 16px', borderRadius: '8px', fontWeight: '700',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
                    }}
                  >
                    <Save size={16} />
                    {guardandoEdicion ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                )}

                <button
                  onClick={() => setModalAlumno(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Cuerpo en 2 columnas: Edición de respuestas + Foto del visor */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: modalAlumno.imagenUrl ? '1.15fr 0.85fr' : '1fr',
                gap: '20px',
                padding: '20px 24px',
                overflowY: 'auto'
              }}
            >
              {/* Columna Izquierda: Tarjetas P1..P30 editables */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '12px' }}>
                  Haz clic en una alternativa para corregir lo que leyó el escáner (clic de nuevo para dejar omitida):
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: '8px' }}>
                  {Array.from({ length: numPreguntas }, (_, i) => i + 1).map((numP) => {
                    const actual = (editandoRespuestas ? respuestasEditadas[numP] : modalAlumno.respuestas?.[numP]) || '';
                    const itemPauta = pauta[numP];
                    const correcta = typeof itemPauta === 'object' ? itemPauta?.correcta : itemPauta;
                    const esOk = Boolean(correcta) && actual === correcta;

                    return (
                      <div
                        key={numP}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '10px',
                          border: `1px solid ${esOk ? '#86efac' : actual ? '#fecaca' : '#cbd5e1'}`,
                          background: esOk ? '#f0fdf4' : actual ? '#fef2f2' : '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700' }}>
                          <span>
                            P{numP}{' '}
                            <small style={{ color: '#64748b', fontWeight: '500' }}>
                              ({correcta || '-'})
                            </small>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: esOk ? '#16a34a' : actual ? '#dc2626' : '#64748b' }}>
                            {actual || '-'}
                            {esOk ? <CheckCircle2 size={13} /> : actual ? <XCircle size={13} /> : <MinusCircle size={13} />}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          {opciones.map((op) => {
                            const seleccionado = actual === op;
                            return (
                              <button
                                key={op}
                                onClick={() => {
                                  const base = editandoRespuestas
                                    ? respuestasEditadas
                                    : { ...(modalAlumno.respuestas || {}) };
                                  const nuevo = { ...base, [numP]: seleccionado ? '' : op };
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
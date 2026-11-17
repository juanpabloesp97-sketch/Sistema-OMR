import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { BarChart3, Download, Award, Target, HelpCircle, Users, Filter } from 'lucide-react';

export default function AnalisisPanel({ resultados, config }) {
  const [cursoFiltro, setCursoFiltro] = useState('TODOS');

  // Lista única de cursos presentes en los resultados
  const cursosDisponibles = useMemo(() => {
    const setCursos = new Set(resultados.map((r) => r.curso || 'Sin Curso'));
    return ['TODOS', ...Array.from(setCursos)];
  }, [resultados]);

  // Filtrar resultados según el curso seleccionado
  const datosFiltrados = useMemo(() => {
    if (cursoFiltro === 'TODOS') return resultados;
    return resultados.filter((r) => (r.curso || 'Sin Curso') === cursoFiltro);
  }, [resultados, cursoFiltro]);

  // 1. Indicadores Globales
  const kpis = useMemo(() => {
    if (datosFiltrados.length === 0) return null;
    const notas = datosFiltrados.map((r) => Number(r.nota));
    const logros = datosFiltrados.map((r) => Number(r.porcentajeLogro));
    const aprobados = notas.filter((n) => n >= Number(config.notaAprob || 4.0)).length;

    const promedioNota = notas.reduce((a, b) => a + b, 0) / notas.length;
    const promedioLogro = logros.reduce((a, b) => a + b, 0) / logros.length;

    // Niveles de logro SIMCE/Escolar
    const niveles = {
      adecuado: logros.filter((l) => l >= 75).length,
      elemental: logros.filter((l) => l >= 50 && l < 75).length,
      insuficiente: logros.filter((l) => l < 50).length,
    };

    return {
      totalAlumnos: datosFiltrados.length,
      promedioNota: promedioNota.toFixed(1),
      promedioLogro: Math.round(promedioLogro),
      pctAprobacion: Math.round((aprobados / datosFiltrados.length) * 100),
      notaMax: Math.max(...notas).toFixed(1),
      notaMin: Math.min(...notas).toFixed(1),
      niveles,
    };
  }, [datosFiltrados, config.notaAprob]);

  // 2. Comparativo entre Cursos (siempre usa todos los resultados)
  const comparativoCursos = useMemo(() => {
    const grupos = {};
    resultados.forEach((r) => {
      const c = r.curso || 'Sin Curso';
      if (!grupos[c]) grupos[c] = { curso: c, sumaNotas: 0, sumaLogro: 0, cantidad: 0, aprobados: 0 };
      grupos[c].sumaNotas += Number(r.nota);
      grupos[c].sumaLogro += Number(r.porcentajeLogro);
      grupos[c].cantidad += 1;
      if (Number(r.nota) >= Number(config.notaAprob || 4.0)) grupos[c].aprobados += 1;
    });

    return Object.values(grupos).map((g) => ({
      curso: g.curso,
      cantidad: g.cantidad,
      promedio: (g.sumaNotas / g.cantidad).toFixed(1),
      logro: Math.round(g.sumaLogro / g.cantidad),
      aprobacion: Math.round((g.aprobados / g.cantidad) * 100),
    }));
  }, [resultados, config.notaAprob]);

  // 3. Análisis por Objetivo de Aprendizaje (OA)
  const analisisOA = useMemo(() => {
    const mapaOA = {};
    datosFiltrados.forEach((r) => {
      (r.detallePreguntas || []).forEach((item) => {
        const oaNombre = (config.pauta?.[item.pregunta]?.oa || item.oa || 'Sin OA').trim();
        if (!mapaOA[oaNombre]) mapaOA[oaNombre] = { oa: oaNombre, buenas: 0, total: 0, preguntas: new Set() };
        mapaOA[oaNombre].total += 1;
        if (item.esCorrecta) mapaOA[oaNombre].buenas += 1;
        mapaOA[oaNombre].preguntas.add(item.pregunta);
      });
    });

    return Object.values(mapaOA)
      .map((o) => ({
        oa: o.oa,
        porcentaje: o.total > 0 ? Math.round((o.buenas / o.total) * 100) : 0,
        preguntasLista: Array.from(o.preguntas).sort((a, b) => a - b).join(', '),
      }))
      .sort((a, b) => a.porcentaje - b.porcentaje); // Ordenar de menor a mayor logro para ver debilidades primero
  }, [datosFiltrados, config.pauta]);

  // 4. Análisis por Pregunta (Ítem)
  const analisisPreguntas = useMemo(() => {
    const totalP = Number(config.numPreguntas) || 30;
    const lista = [];

    for (let p = 1; p <= totalP; p++) {
      let buenas = 0;
      let respondidas = 0;
      const conteoAlternativas = {};

      datosFiltrados.forEach((r) => {
        const det = (r.detallePreguntas || []).find((d) => d.pregunta === p);
        if (det) {
          respondidas += 1;
          if (det.esCorrecta) buenas += 1;
          conteoAlternativas[det.marcada] = (conteoAlternativas[det.marcada] || 0) + 1;
        }
      });

      const pct = respondidas > 0 ? Math.round((buenas / respondidas) * 100) : 0;
      const correcta = config.pauta?.[p]?.correcta || '-';
      const oa = config.pauta?.[p]?.oa || 'Sin OA';

      // Encontrar distractor más marcado (distinto de la correcta)
      let distractorTop = '-';
      let maxDist = 0;
      Object.entries(conteoAlternativas).forEach(([alt, cant]) => {
        if (alt !== correcta && alt !== 'OMITIDA' && cant > maxDist) {
          maxDist = cant;
          distractorTop = `${alt} (${cant})`;
        }
      });

      lista.push({ pregunta: p, correcta, oa, pct, distractorTop });
    }
    return lista;
  }, [datosFiltrados, config]);

  // Exportar reporte completo a Excel (3 pestañas)
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Notas por Estudiante
    const hojaAlumnos = datosFiltrados.map((r) => ({
      RUT: r.rut,
      Estudiante: r.nombre,
      Curso: r.curso,
      Buenas: r.buenas,
      Total_Preguntas: r.totalPreguntas,
      Porcentaje_Logro: `${r.porcentajeLogro}%`,
      Nota: Number(r.nota),
      Estado: Number(r.nota) >= Number(config.notaAprob || 4.0) ? 'Aprobado' : 'Reprobado',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaAlumnos), 'Notas Estudiantes');

    // Hoja 2: Logro por OA
    const hojaOA = analisisOA.map((o) => ({
      Objetivo_Aprendizaje: o.oa,
      Preguntas_Asociadas: o.preguntasLista,
      Porcentaje_Logro: `${o.porcentaje}%`,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaOA), 'Analisis por OA');

    // Hoja 3: Análisis por Pregunta
    const hojaPreguntas = analisisPreguntas.map((p) => ({
      Pregunta: p.pregunta,
      Clave_Correcta: p.correcta,
      OA: p.oa,
      Porcentaje_Acierto: `${p.pct}%`,
      Distractor_Principal: p.distractorTop,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaPreguntas), 'Analisis por Pregunta');

    XLSX.writeFile(wb, `Reporte_OMR_${config.tituloPrueba.replace(/\s+/g, '_')}.xlsx`);
  };

  if (resultados.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
        <BarChart3 size={48} color="#94a3b8" style={{ marginBottom: '12px' }} />
        <h3 style={{ margin: '0 0 8px', color: '#334155' }}>Aún no hay hojas escaneadas en esta evaluación</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          Ve a la pestaña <strong>"3. Escanear Hojas"</strong> y procesa al menos una hoja para ver los gráficos y estadísticas.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Barra superior de filtros y descarga */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={18} color="#2563eb" />
          <label style={{ fontWeight: '600', fontSize: '14px' }}>Filtrar por Curso:</label>
          <select
            value={cursoFiltro}
            onChange={(e) => setCursoFiltro(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', fontWeight: '600' }}
          >
            {cursosDisponibles.map((c) => (
              <option key={c} value={c}>
                {c === 'TODOS' ? `Todos los cursos (${resultados.length} hojas)` : c}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={exportarExcel}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#16a34a', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
        >
          <Download size={18} />
          Exportar Informe Excel
        </button>
      </div>

      {/* Tarjetas de Resumen (KPIs) */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>PROMEDIO CURSO</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: Number(kpis.promedioNota) >= 4.0 ? '#16a34a' : '#dc2626' }}>
              {kpis.promedioNota}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Logro medio: {kpis.promedioLogro}%</div>
          </div>

          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>APROBACIÓN (≥ 4.0)</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>{kpis.pctAprobacion}%</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>De {kpis.totalAlumnos} evaluados</div>
          </div>

          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>RANGO DE NOTAS</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>
              {kpis.notaMin} — {kpis.notaMax}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Mínima y Máxima</div>
          </div>

          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '6px' }}>NIVELES DE LOGRO</div>
            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ color: '#16a34a', fontWeight: '600' }}>● Adecuado (≥75%): {kpis.niveles.adecuado}</span>
              <span style={{ color: '#d97706', fontWeight: '600' }}>● Elemental (50-74%): {kpis.niveles.elemental}</span>
              <span style={{ color: '#dc2626', fontWeight: '600' }}>● Insuficiente (menos de 50%): {kpis.niveles.insuficiente}</span>
            </div>
          </div>
        </div>
      )}

      {/* Comparativo entre Cursos */}
      {comparativoCursos.length > 0 && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <h3 style={{ marginTop: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="#2563eb" />
            Comparativo por Curso
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {comparativoCursos.map((c) => (
              <div key={c.curso}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                  <strong>{c.curso} ({c.cantidad} alumnos)</strong>
                  <span>Promedio: <strong>{c.promedio}</strong> | Logro: <strong>{c.logro}%</strong> | Aprobación: <strong>{c.aprobacion}%</strong></span>
                </div>
                <div style={{ width: '100%', height: '14px', background: '#f1f5f9', borderRadius: '7px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${c.logro}%`,
                      height: '100%',
                      background: c.logro >= 60 ? '#2563eb' : '#f59e0b',
                      borderRadius: '7px',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico por Objetivo de Aprendizaje (OA) */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <h3 style={{ marginTop: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={20} color="#16a34a" />
          Logro por Objetivo de Aprendizaje (OA) — Ordenado de menor a mayor
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {analisisOA.map((item) => {
            const colorBarra = item.porcentaje >= 75 ? '#16a34a' : item.porcentaje >= 50 ? '#f59e0b' : '#dc2626';
            return (
              <div key={item.oa}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span><strong>{item.oa}</strong> <span style={{ color: '#64748b' }}>(Preguntas: {item.preguntasLista})</span></span>
                  <strong style={{ color: colorBarra }}>{item.porcentaje}% logro</strong>
                </div>
                <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${item.porcentaje}%`, height: '100%', background: colorBarra, borderRadius: '6px' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gráfico de Acierto por Pregunta */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <h3 style={{ marginTop: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HelpCircle size={20} color="#7c3aed" />
          Rendimiento por Pregunta y Distractores
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
          {analisisPreguntas.map((p) => {
            const color = p.pct >= 70 ? '#16a34a' : p.pct >= 45 ? '#d97706' : '#dc2626';
            return (
              <div key={p.pregunta} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                  <span>P.{p.pregunta} ({p.correcta})</span>
                  <span style={{ color }}>{p.pct}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', margin: '6px 0' }}>
                  <div style={{ width: `${p.pct}%`, height: '100%', background: color, borderRadius: '3px' }} />
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {p.oa} | Distractor: <strong>{p.distractorTop}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabla Detallada de Estudiantes */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={20} color="#2563eb" />
          <h3 style={{ margin: 0, fontSize: '17px' }}>Resultados Individuales</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Estudiante</th>
                <th style={{ padding: '10px 14px' }}>RUT</th>
                <th style={{ padding: '10px 14px' }}>Curso</th>
                <th style={{ padding: '10px 14px' }}>Puntaje</th>
                <th style={{ padding: '10px 14px' }}>Logro</th>
                <th style={{ padding: '10px 14px' }}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {datosFiltrados.map((r, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontWeight: '600' }}>{r.nombre}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.rut}</td>
                  <td style={{ padding: '10px 14px' }}>{r.curso}</td>
                  <td style={{ padding: '10px 14px' }}>{r.buenas} / {r.totalPreguntas}</td>
                  <td style={{ padding: '10px 14px' }}>{r.porcentajeLogro}%</td>
                  <td style={{ padding: '10px 14px', fontWeight: 'bold', color: Number(r.nota) >= 4.0 ? '#16a34a' : '#dc2626' }}>
                    {Number(r.nota).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart3, Download, Users, Award, TrendingUp, AlertTriangle,
  CheckCircle2, Target, Layers, Search
} from 'lucide-react';

export default function AnalisisPanel({ resultados = [], config = {} }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'aprobados' | 'reprobados'

  const totalAlumnos = resultados.length;
  const numPreguntas = Number(config.numPreguntas || 30);
  const notaAprob = Number(config.notaAprob || 4.0);
  const opciones = (config.alternativas || 'ABCD').split('');
  const pauta = config.pauta || {};

  // --- CÁLCULOS GENERALES DEL CURSO ---
  const notas = resultados.map((r) => Number(r.nota || 1.0));
  const logros = resultados.map((r) => Number(r.porcentaje || 0));

  const promedioNota = totalAlumnos > 0
    ? (notas.reduce((a, b) => a + b, 0) / totalAlumnos).toFixed(1)
    : '0.0';

  const promedioLogro = totalAlumnos > 0
    ? Math.round(logros.reduce((a, b) => a + b, 0) / totalAlumnos)
    : 0;

  const notaMaxima = totalAlumnos > 0 ? Math.max(...notas).toFixed(1) : '-';
  const notaMinima = totalAlumnos > 0 ? Math.min(...notas).toFixed(1) : '-';

  const aprobadosCount = notas.filter((n) => n >= notaAprob).length;
  const reprobadosCount = totalAlumnos - aprobadosCount;
  const tasaAprobacion = totalAlumnos > 0 ? Math.round((aprobadosCount / totalAlumnos) * 100) : 0;

  // --- NIVELES DE LOGRO (ESTÁNDAR SIMCE / ESCOLAR) ---
  const nivelesLogro = [
    {
      nombre: 'Adecuado (80% - 100%)',
      color: '#16a34a',
      bg: '#dcfce7',
      cantidad: logros.filter((l) => l >= 80).length
    },
    {
      nombre: 'Elemental (60% - 79%)',
      color: '#2563eb',
      bg: '#dbeafe',
      cantidad: logros.filter((l) => l >= 60 && l < 80).length
    },
    {
      nombre: 'Insuficiente (< 60%)',
      color: '#dc2626',
      bg: '#fee2e2',
      cantidad: logros.filter((l) => l < 60).length
    }
  ];

  // --- DISTRIBUCIÓN POR TRAMOS DE NOTA ---
  const tramosNota = [
    { etiqueta: '1.0 - 3.9', color: '#ef4444', count: notas.filter((n) => n < 4.0).length },
    { etiqueta: '4.0 - 4.9', color: '#f59e0b', count: notas.filter((n) => n >= 4.0 && n < 5.0).length },
    { etiqueta: '5.0 - 5.9', color: '#3b82f6', count: notas.filter((n) => n >= 5.0 && n < 6.0).length },
    { etiqueta: '6.0 - 7.0', color: '#10b981', count: notas.filter((n) => n >= 6.0).length }
  ];
  const maxTramo = Math.max(1, ...tramosNota.map((t) => t.count));

  // --- ANÁLISIS POR ÍTEM Y DISTRACTORES ---
  const analisisItems = [];
  const mapaOA = {};

  for (let p = 1; p <= numPreguntas; p++) {
    const itemPauta = pauta[p];
    const correcta = typeof itemPauta === 'object' ? itemPauta?.correcta : itemPauta;
    const oa = (typeof itemPauta === 'object' && itemPauta?.oa) ? itemPauta.oa.trim() : 'General';
    const habilidad = (typeof itemPauta === 'object' && itemPauta?.habilidad) ? itemPauta.habilidad.trim() : '';

    let aciertos = 0;
    let omitidas = 0;
    let dobles = 0;
    const conteoOpciones = {};
    opciones.forEach((op) => { conteoOpciones[op] = 0; });

    resultados.forEach((r) => {
      const resp = (r.respuestas && r.respuestas[p]) || '';
      if (!resp) {
        omitidas++;
      } else if (resp === 'DOBLE') {
        dobles++;
      } else {
        if (conteoOpciones[resp] !== undefined) conteoOpciones[resp]++;
        if (correcta && resp === correcta) aciertos++;
      }
    });

    const pctLogroItem = totalAlumnos > 0 ? Math.round((aciertos / totalAlumnos) * 100) : 0;

    // Detectar distractor más marcado (opción incorrecta más elegida)
    let distractorPrincipal = '-';
    let maxDistractor = 0;
    opciones.forEach((op) => {
      if (op !== correcta && conteoOpciones[op] > maxDistractor) {
        maxDistractor = conteoOpciones[op];
        distractorPrincipal = `${op} (${Math.round((maxDistractor / (totalAlumnos || 1)) * 100)}%)`;
      }
    });

    analisisItems.push({
      numero: p,
      correcta: correcta || '-',
      oa,
      habilidad,
      aciertos,
      pctLogro: pctLogroItem,
      distractorPrincipal,
      omitidas,
      dobles,
      conteoOpciones
    });

    // Agrupar por OA
    if (!mapaOA[oa]) {
      mapaOA[oa] = { oa, preguntas: [], sumaLogros: 0 };
    }
    mapaOA[oa].preguntas.push(p);
    mapaOA[oa].sumaLogros += pctLogroItem;
  }

  const listaOA = Object.values(mapaOA).map((g) => ({
    oa: g.oa,
    cantidadPreguntas: g.preguntas.length,
    preguntasStr: g.preguntas.join(', '),
    promedioLogro: Math.round(g.sumaLogros / (g.preguntas.length || 1))
  }));

  const itemsCriticos = [...analisisItems]
    .filter((it) => it.correcta !== '-')
    .sort((a, b) => a.pctLogro - b.pctLogro)
    .slice(0, 5);

  // --- EXPORTAR REPORTE COMPLETO A EXCEL ---
  const exportarExcel = () => {
    if (resultados.length === 0) return;

    const hojaAlumnos = resultados.map((r, idx) => {
      const fila = {
        'N°': idx + 1,
        RUT: r.rut,
        Estudiante: r.nombre,
        Curso: r.curso || '',
        Puntaje: r.puntaje,
        'Puntaje Total': r.total,
        'Logro (%)': r.porcentaje,
        Nota: Number(r.nota).toFixed(1),
        Estado: Number(r.nota) >= notaAprob ? 'Aprobado' : 'Reprobado'
      };
      for (let p = 1; p <= numPreguntas; p++) {
        fila[`P${p}`] = (r.respuestas && r.respuestas[p]) || '-';
      }
      return fila;
    });

    const hojaItems = analisisItems.map((it) => ({
      Pregunta: `P.${it.numero}`,
      'Clave Correcta': it.correcta,
      'Eje / OA': it.oa,
      Habilidad: it.habilidad || '-',
      'Aciertos': it.aciertos,
      'Logro (%)': it.pctLogro,
      'Distractor Principal': it.distractorPrincipal,
      Omitidas: it.omitidas,
      Dobles: it.dobles
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaAlumnos), 'Resultados_Estudiantes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaItems), 'Analisis_Por_Item');
    XLSX.writeFile(wb, `Reporte_${(config.tituloPrueba || 'Evaluacion').replace(/\s+/g, '_')}.xlsx`);
  };

  // --- FILTRADO DE TABLA DE ESTUDIANTES ---
  const resultadosFiltrados = resultados.filter((r) => {
    const coincideTexto =
      r.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.rut.toLowerCase().includes(busqueda.toLowerCase());
    if (!coincideTexto) return false;
    if (filtroEstado === 'aprobados') return Number(r.nota) >= notaAprob;
    if (filtroEstado === 'reprobados') return Number(r.nota) < notaAprob;
    return true;
  });

  if (totalAlumnos === 0) {
    return (
      <div style={{ background: '#ffffff', padding: '40px 24px', borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
        <BarChart3 size={42} color="#94a3b8" style={{ marginBottom: '12px' }} />
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>Aún no hay resultados para analizar</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          Escanea hojas de respuestas o sube un PDF en la pestaña <strong>Escanear Hojas</strong> para generar los indicadores, gráficos y análisis por ítem.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ENCABEZADO DEL REPORTE */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          color: '#ffffff',
          padding: '22px 24px',
          borderRadius: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85 }}>
            Informe de Resultados Pedagógicos
          </div>
          <h2 style={{ margin: '4px 0', fontSize: '22px', fontWeight: '800' }}>
            {config.tituloPrueba || 'Evaluación'}
          </h2>
          <div style={{ fontSize: '13px', opacity: 0.9 }}>
            Asignatura: <strong>{config.asignatura || '-'}</strong> &nbsp;|&nbsp; Exigencia: <strong>{config.exigencia || 60}%</strong> &nbsp;|&nbsp; Preguntas: <strong>{numPreguntas}</strong>
          </div>
        </div>

        <button
          onClick={exportarExcel}
          style={{
            background: '#ffffff',
            color: '#1e3a8a',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 16px',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
          }}
        >
          <Download size={17} />
          Exportar Reporte Excel
        </button>
      </div>

      {/* FILA 1: 4 TARJETAS DE INDICADORES CLAVE (KPIs) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', borderTop: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>
            <span>Promedio Curso</span>
            <Award size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: Number(promedioNota) >= notaAprob ? '#16a34a' : '#dc2626', margin: '6px 0 2px 0' }}>
            {promedioNota}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Mín: <strong>{notaMinima}</strong> &nbsp;|&nbsp; Máx: <strong>{notaMaxima}</strong>
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', borderTop: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>
            <span>Logro Promedio</span>
            <TrendingUp size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', margin: '6px 0 2px 0' }}>
            {promedioLogro}%
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Porcentaje de respuestas correctas
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', borderTop: '4px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>
            <span>Tasa Aprobación</span>
            <CheckCircle2 size={18} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', margin: '6px 0 2px 0' }}>
            {tasaAprobacion}%
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            <span style={{ color: '#16a34a', fontWeight: '700' }}>{aprobadosCount} aprob.</span> &nbsp;|&nbsp; <span style={{ color: '#dc2626', fontWeight: '700' }}>{reprobadosCount} reprob.</span>
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', borderTop: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>
            <span>Evaluados</span>
            <Users size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', margin: '6px 0 2px 0' }}>
            {totalAlumnos}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Hojas procesadas en esta prueba
          </div>
        </div>
      </div>

      {/* FILA 2: GRÁFICOS DE DISTRIBUCIÓN DE NOTAS Y NIVELES DE LOGRO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Gráfico de Barras por Tramos de Nota */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="#2563eb" />
            Distribución de Calificaciones
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '165px', paddingTop: '20px', borderBottom: '1px solid #e2e8f0' }}>
            {tramosNota.map((tramo) => {
              const alturaPct = Math.round((tramo.count / maxTramo) * 120);
              const pctCurso = totalAlumnos > 0 ? Math.round((tramo.count / totalAlumnos) * 100) : 0;
              return (
                <div key={tramo.etiqueta} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '22%' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    {tramo.count} ({pctCurso}%)
                  </span>
                  <div
                    style={{
                      width: '44px',
                      height: `${Math.max(6, alturaPct)}px`,
                      background: tramo.color,
                      borderRadius: '6px 6px 0 0',
                      transition: 'height 0.3s ease'
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '8px' }}>
            {tramosNota.map((tramo) => (
              <div key={tramo.etiqueta} style={{ width: '22%', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                {tramo.etiqueta}
              </div>
            ))}
          </div>
        </div>

        {/* Niveles de Logro Pedagógico */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="#059669" />
              Niveles de Logro del Curso
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {nivelesLogro.map((nv) => {
                const pct = totalAlumnos > 0 ? Math.round((nv.cantidad / totalAlumnos) * 100) : 0;
                return (
                  <div key={nv.nombre}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '5px' }}>
                      <span style={{ color: '#1e293b' }}>{nv.nombre}</span>
                      <span style={{ color: nv.color, fontWeight: '800' }}>
                        {nv.cantidad} est. ({pct}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: nv.color,
                          borderRadius: '999px',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {itemsCriticos.length > 0 && (
            <div style={{ marginTop: '16px', padding: '10px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', fontSize: '12.5px', color: '#9a3412', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>
                <strong>Preguntas más descendidas:</strong>{' '}
                {itemsCriticos.map((it) => `P.${it.numero} (${it.pctLogro}%)`).join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* FILA 3: LOGRO POR OBJETIVO DE APRENDIZAJE (OA / EJE) */}
      {listaOA.length > 0 && (
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#7c3aed" />
            Desempeño por Objetivo de Aprendizaje (OA) / Eje
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {listaOA.map((grupo) => {
              const colorBarra = grupo.promedioLogro >= 70 ? '#16a34a' : grupo.promedioLogro >= 50 ? '#2563eb' : '#dc2626';
              return (
                <div key={grupo.oa} style={{ padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>{grupo.oa}</span>
                    <span style={{ fontWeight: '800', fontSize: '15px', color: colorBarra }}>{grupo.promedioLogro}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ width: `${grupo.promedioLogro}%`, height: '100%', background: colorBarra }} />
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Preguntas ({grupo.cantidadPreguntas}): {grupo.preguntasStr}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILA 4: ANÁLISIS DETALLADO ÍTEM POR ÍTEM Y DISTRACTORES */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>
          Análisis Ítem por Ítem y Distractores
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '10px' }}>
          {analisisItems.map((it) => {
            const colorLogro = it.pctLogro >= 70 ? '#16a34a' : it.pctLogro >= 50 ? '#2563eb' : '#dc2626';
            return (
              <div
                key={it.numero}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: it.pctLogro < 50 ? '#fef2f2' : '#ffffff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>
                    P.{it.numero} <span style={{ color: '#2563eb' }}>({it.correcta})</span>
                  </span>
                  <span style={{ fontWeight: '800', fontSize: '13px', color: colorLogro }}>
                    {it.pctLogro}%
                  </span>
                </div>

                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ width: `${it.pctLogro}%`, height: '100%', background: colorLogro }} />
                </div>

                <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.4' }}>
                  <div><strong>{it.oa}</strong> {it.habilidad ? `• ${it.habilidad}` : ''}</div>
                  <div>Distractor: <strong>{it.distractorPrincipal}</strong></div>
                  {(it.omitidas > 0 || it.dobles > 0) && (
                    <div style={{ color: '#b45309' }}>
                      Om: {it.omitidas} | Dob: {it.dobles}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FILA 5: TABLA DETALLADA DE RESULTADOS INDIVIDUALES */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>
            Resultados Individuales ({resultadosFiltrados.length})
          </h3>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Buscar por nombre o RUT..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ padding: '7px 10px 7px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
            >
              <option value="todos">Todos ({totalAlumnos})</option>
              <option value="aprobados">Aprobados ({aprobadosCount})</option>
              <option value="reprobados">Reprobados ({reprobadosCount})</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead style={{ background: '#f1f5f9' }}>
              <tr>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>N°</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>Estudiante</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>RUT</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>Puntaje</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>Logro</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>Nivel</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {resultadosFiltrados.map((r, idx) => {
                const notaNum = Number(r.nota || 1.0);
                const logroNum = Number(r.porcentaje || 0);
                const aprobado = notaNum >= notaAprob;
                const badgeNivel =
                  logroNum >= 80
                    ? { txt: 'Adecuado', bg: '#dcfce7', col: '#166534' }
                    : logroNum >= 60
                    ? { txt: 'Elemental', bg: '#dbeafe', col: '#1e40af' }
                    : { txt: 'Insuficiente', bg: '#fee2e2', col: '#991b1b' };

                return (
                  <tr key={r.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 10px', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '9px 10px', fontWeight: '600' }}>{r.nombre}</td>
                    <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{r.rut}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                      {r.puntaje} / {r.total}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: '600' }}>{logroNum}%</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: '999px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          background: badgeNivel.bg,
                          color: badgeNivel.col
                        }}
                      >
                        {badgeNivel.txt}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '9px 10px',
                        textAlign: 'center',
                        fontWeight: '800',
                        fontSize: '15px',
                        color: aprobado ? '#16a34a' : '#dc2626'
                      }}
                    >
                      {notaNum.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
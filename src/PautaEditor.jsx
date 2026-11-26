import React, { useState } from 'react';
import {
  CheckSquare, Wand2, FileText, Upload, ExternalLink,
  Trash2, PlusCircle, Calculator, X, ListChecks, FileEdit,
  Hash, Sparkles, Settings2
} from 'lucide-react';
import { obtenerOAsPorAsignaturaYNivel } from './catalogoCurricularMineduc';
import { supabase } from './supabaseClient';

const ETIQUETAS_NIVELES = {
  2: ['Logrado', 'Por Lograr'],
  3: ['Logrado', 'Medianamente Logrado', 'Por Lograr'],
  4: ['Destacado', 'Logrado', 'Medianamente Logrado', 'Por Lograr'],
  5: ['Sobresaliente', 'Logrado', 'Medianamente Logrado', 'En Desarrollo', 'Por Lograr']
};

const generarNivelesRubricaBase = (cantidadNiveles = 3, puntajeMax = 3) => {
  const cant = Math.max(2, Math.min(5, Number(cantidadNiveles) || 3));
  const maxPts = Math.max(1, Number(puntajeMax) || 3);
  const etiquetas = ETIQUETAS_NIVELES[cant] || ETIQUETAS_NIVELES[3];

  return etiquetas.map((nombre, idx) => {
    const proporcion = (cant - 1 - idx) / (cant - 1);
    const pts = Math.round(maxPts * proporcion * 10) / 10;
    return {
      nivel: nombre,
      puntaje: pts,
      descriptor: ''
    };
  });
};

export default function PautaEditor({ config, setConfig, nivelNombre = '', asignaturaNombre = '' }) {
  const numPreguntas = Number(config.numPreguntas || 0);
  const opciones = (config.alternativas || 'ABCD').split('');
  const pauta = config.pauta || {};

  const asignaturaEfectiva = asignaturaNombre || config.asignatura || 'Matemática';
  const listaOAsNivel = obtenerOAsPorAsignaturaYNivel(asignaturaEfectiva, nivelNombre);

  const [modalAgregarAbierto, setModalAgregarAbierto] = useState(false);
  const [cantidadAgregar, setCantidadAgregar] = useState(10);
  const [tipoPreguntaAgregar, setTipoPreguntaAgregar] = useState('alternativa');

  const [modalDesarrolloNum, setModalDesarrolloNum] = useState(null);

  const [rangoInicio, setRangoInicio] = useState(1);
  const [rangoFin, setRangoFin] = useState(10);
  const [oaMasivo, setOaMasivo] = useState('');

  const [rangoPtsInicio, setRangoPtsInicio] = useState(1);
  const [rangoPtsFin, setRangoPtsFin] = useState(10);
  const [puntajeMasivo, setPuntajeMasivo] = useState(1);

  const [subiendoPdf, setSubiendoPdf] = useState(false);
  const [generandoIaPregunta, setGenerandoIaPregunta] = useState(null);

  const obtenerTipoItem = (item) => {
    if (typeof item === 'object' && item !== null && item.tipo) {
      return item.tipo;
    }
    return 'alternativa';
  };

  const obtenerClavesItem = (item) => {
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

  const normalizarYAgruparPauta = (listaItems) => {
    const alternativas = listaItems.filter((it) => obtenerTipoItem(it) === 'alternativa');
    const completacion = listaItems.filter((it) => obtenerTipoItem(it) === 'completacion');
    const desarrollo = listaItems.filter((it) => obtenerTipoItem(it) === 'desarrollo');
    const ordenados = [...alternativas, ...completacion, ...desarrollo];

    const nuevaPauta = {};
    ordenados.forEach((it, idx) => {
      nuevaPauta[idx + 1] = it;
    });

    return { nuevaPauta, total: ordenados.length };
  };

  const itemsActuales = Array.from({ length: numPreguntas }, (_, idx) => {
    const raw = pauta[idx + 1];
    if (typeof raw === 'object' && raw !== null) {
      return { tipo: 'alternativa', ...raw };
    }
    return {
      tipo: 'alternativa',
      correcta: obtenerClavesItem(raw),
      oa: '',
      habilidad: '',
      puntaje: 1
    };
  });

  const countAlternativas = itemsActuales.filter((it) => it.tipo === 'alternativa').length;
  const countCompletacion = itemsActuales.filter((it) => it.tipo === 'completacion').length;
  const countDesarrollo = itemsActuales.filter((it) => it.tipo === 'desarrollo').length;

  const puntajeIdealTotal = itemsActuales.reduce((acc, it) => acc + obtenerPuntajeItem(it), 0);
  const preguntasAnuladasCount = itemsActuales.reduce((acc, it) => acc + (obtenerPuntajeItem(it) === 0 ? 1 : 0), 0);

  const abrirModalAgregar = () => {
    if (countAlternativas < 50) {
      setTipoPreguntaAgregar('alternativa');
      setCantidadAgregar(Math.min(10, 50 - countAlternativas));
    } else if (countCompletacion < 10) {
      setTipoPreguntaAgregar('completacion');
      setCantidadAgregar(Math.min(3, 10 - countCompletacion));
    } else {
      setTipoPreguntaAgregar('desarrollo');
      setCantidadAgregar(Math.min(2, 5 - countDesarrollo));
    }
    setModalAgregarAbierto(true);
  };

  const seleccionarTipoEnModal = (tipo) => {
    if (tipo === tipoPreguntaAgregar) return;
    setTipoPreguntaAgregar(tipo);
    if (tipo === 'alternativa') {
      setCantidadAgregar(Math.min(10, Math.max(1, 50 - countAlternativas)));
    } else if (tipo === 'completacion') {
      setCantidadAgregar(Math.min(3, Math.max(1, 10 - countCompletacion)));
    } else if (tipo === 'desarrollo') {
      setCantidadAgregar(Math.min(2, Math.max(1, 5 - countDesarrollo)));
    }
  };

  const confirmarAgregarPreguntas = () => {
    let maximoPermitido = 0;
    if (tipoPreguntaAgregar === 'alternativa') maximoPermitido = 50 - countAlternativas;
    if (tipoPreguntaAgregar === 'completacion') maximoPermitido = 10 - countCompletacion;
    if (tipoPreguntaAgregar === 'desarrollo') maximoPermitido = 5 - countDesarrollo;

    if (maximoPermitido <= 0) {
      alert('Ya alcanzaste el máximo permitido para este tipo de pregunta.');
      return;
    }

    const cant = Math.max(1, Math.min(maximoPermitido, Number(cantidadAgregar || 1)));
    const nuevos = [];

    for (let i = 0; i < cant; i++) {
      if (tipoPreguntaAgregar === 'alternativa') {
        nuevos.push({
          tipo: 'alternativa',
          correcta: [],
          oa: '',
          habilidad: '',
          puntaje: 1
        });
      } else if (tipoPreguntaAgregar === 'completacion') {
        nuevos.push({
          tipo: 'completacion',
          respuestaExacta: '',
          oa: '',
          habilidad: '',
          puntaje: 1
        });
      } else if (tipoPreguntaAgregar === 'desarrollo') {
        nuevos.push({
          tipo: 'desarrollo',
          enunciado: '',
          lineas: 5,
          puntaje: 3,
          oa: '',
          habilidad: '',
          cantidadNiveles: 3,
          rubrica: generarNivelesRubricaBase(3, 3)
        });
      }
    }

    const { nuevaPauta, total } = normalizarYAgruparPauta([...itemsActuales, ...nuevos]);
    setConfig((prev) => ({
      ...prev,
      numPreguntas: total,
      pauta: nuevaPauta
    }));
    setModalAgregarAbierto(false);
  };

  const eliminarPreguntaIndividual = (numAEliminar) => {
    const filtrados = itemsActuales.filter((_, idx) => idx + 1 !== numAEliminar);
    const { nuevaPauta, total } = normalizarYAgruparPauta(filtrados);

    if (modalDesarrolloNum === numAEliminar) {
      setModalDesarrolloNum(null);
    }

    setConfig((prev) => ({
      ...prev,
      numPreguntas: total,
      pauta: nuevaPauta
    }));
  };

  const toggleAlternativaCorrecta = (numP, letra) => {
    const actual = pauta[numP];
    const clavesActuales = obtenerClavesItem(actual);
    const yaEsta = clavesActuales.includes(letra);
    const nuevasClaves = yaEsta
      ? clavesActuales.filter((l) => l !== letra)
      : [...clavesActuales, letra].sort();

    const objBase = typeof actual === 'object' && actual !== null
      ? { ...actual }
      : { tipo: 'alternativa', correcta: [], oa: '', habilidad: '', puntaje: 1 };

    objBase.correcta = nuevasClaves;

    setConfig((prev) => ({
      ...prev,
      pauta: {
        ...prev.pauta,
        [numP]: objBase
      }
    }));
  };

  const actualizarItem = (numP, campo, valor) => {
    const actual = pauta[numP];
    const objBase = typeof actual === 'object' && actual !== null
      ? { ...actual }
      : { tipo: 'alternativa', correcta: obtenerClavesItem(actual), oa: '', habilidad: '', puntaje: 1 };

    if (campo === 'oa') {
      objBase.oa = valor;
      const oaEncontrado = listaOAsNivel.find((item) => item.codigo === valor);
      if (oaEncontrado) {
        objBase.habilidad = oaEncontrado.descripcion;
      }
    } else if (campo === 'puntaje') {
      const nuevoPuntaje = Number(valor);
      objBase.puntaje = nuevoPuntaje;
      if (objBase.tipo === 'desarrollo' && Array.isArray(objBase.rubrica)) {
        const cantNiv = objBase.rubrica.length || 3;
        objBase.rubrica = objBase.rubrica.map((niv, idx) => {
          const prop = cantNiv > 1 ? (cantNiv - 1 - idx) / (cantNiv - 1) : 1;
          return { ...niv, puntaje: Math.round(nuevoPuntaje * prop * 10) / 10 };
        });
      }
    } else if (campo === 'cantidadNiveles') {
      const cantNiv = Number(valor);
      objBase.cantidadNiveles = cantNiv;
      objBase.rubrica = generarNivelesRubricaBase(cantNiv, objBase.puntaje || 3);
    } else {
      objBase[campo] = valor;
    }

    setConfig((prev) => ({
      ...prev,
      pauta: {
        ...prev.pauta,
        [numP]: objBase
      }
    }));
  };

  const actualizarNivelRubrica = (numP, idxNivel, campo, valor) => {
    const actual = pauta[numP];
    if (!actual || !Array.isArray(actual.rubrica)) return;
    const nuevaRubrica = actual.rubrica.map((niv, idx) =>
      idx === idxNivel ? { ...niv, [campo]: campo === 'puntaje' ? Number(valor) : valor } : niv
    );
    actualizarItem(numP, 'rubrica', nuevaRubrica);
  };

  const generarRubricaConIA = async (numP) => {
    const item = pauta[numP];
    if (!item) return;

    const enunciado = (item.enunciado || '').trim();
    if (!enunciado && !config.pdfPruebaUrl) {
      alert('Escribe el enunciado de la pregunta (o sube el PDF de la prueba arriba) para que la IA pueda generar la rúbrica.');
      return;
    }

    const cantNiveles = Number(item.cantidadNiveles || item.rubrica?.length || 3);
    const puntajeMax = Math.max(1, Number(item.puntaje || 3));
    const etiquetas = ETIQUETAS_NIVELES[cantNiveles] || ETIQUETAS_NIVELES[3];

    setGenerandoIaPregunta(numP);
    try {
      if (!supabase) throw new Error('Supabase no configurado');

      const { data, error } = await supabase.functions.invoke('ia-evaluacion', {
        body: {
          accion: 'generar_rubrica',
          numeroPregunta: numP,
          enunciado,
          pdfUrl: config.pdfPruebaUrl || null,
          asignatura: config.asignatura || '',
          nivelNombre,
          oa: item.oa || '',
          habilidad: item.habilidad || '',
          puntajeMax,
          etiquetasNiveles: etiquetas
        }
      });

      if (error) throw error;

      if (data?.rubrica && Array.isArray(data.rubrica)) {
        actualizarItem(numP, 'rubrica', data.rubrica);
        if (data.enunciadoDetectado && !enunciado) {
          actualizarItem(numP, 'enunciado', data.enunciadoDetectado);
        }
      } else {
        throw new Error(data?.error || 'Respuesta sin formato de rúbrica');
      }
    } catch (err) {
      console.error('Error IA rúbrica:', err);
      alert(`La IA no respondió (${err?.message || 'revisa Deploy en Supabase'}). Se cargó una plantilla base sin repetir niveles.`);
      const base = generarNivelesRubricaBase(cantNiveles, puntajeMax).map((niv, idx) => {
        let desc = 'Responde de forma completa y correcta todo lo pedido en la pregunta, con respaldo o desarrollo claro.';
        if (idx === cantNiveles - 1) {
          desc = 'Deja el espacio en blanco, copia solo datos de la pregunta o escribe algo sin relación con lo pedido.';
        } else if (idx > 0) {
          desc = 'Responde una parte correcta de lo pedido, pero le falta completar el paso final o el respaldo.';
        }
        return { ...niv, descriptor: desc };
      });
      actualizarItem(numP, 'rubrica', base);
    } finally {
      setGenerandoIaPregunta(null);
    }
  };

  const aplicarOAMasivo = () => {
    if (!oaMasivo.trim() || numPreguntas === 0) return;
    const inicio = Math.max(1, Math.min(numPreguntas, Number(rangoInicio)));
    const fin = Math.max(inicio, Math.min(numPreguntas, Number(rangoFin)));
    const oaEncontrado = listaOAsNivel.find((item) => item.codigo === oaMasivo.trim());

    const nuevaPauta = { ...pauta };
    for (let p = inicio; p <= fin; p++) {
      const actual = nuevaPauta[p];
      const objBase = typeof actual === 'object' && actual !== null
        ? { ...actual }
        : { tipo: 'alternativa', correcta: obtenerClavesItem(actual), oa: '', habilidad: '', puntaje: 1 };

      objBase.oa = oaMasivo.trim();
      if (oaEncontrado) {
        objBase.habilidad = oaEncontrado.descripcion;
      }
      nuevaPauta[p] = objBase;
    }

    setConfig((prev) => ({ ...prev, pauta: nuevaPauta }));
  };

  const aplicarPuntajeMasivo = () => {
    if (numPreguntas === 0) return;
    const inicio = Math.max(1, Math.min(numPreguntas, Number(rangoPtsInicio)));
    const fin = Math.max(inicio, Math.min(numPreguntas, Number(rangoPtsFin)));

    const nuevaPauta = { ...pauta };
    for (let p = inicio; p <= fin; p++) {
      const actual = nuevaPauta[p];
      const objBase = typeof actual === 'object' && actual !== null
        ? { ...actual }
        : { tipo: 'alternativa', correcta: obtenerClavesItem(actual), oa: '', habilidad: '', puntaje: 1 };

      objBase.puntaje = Number(puntajeMasivo);
      nuevaPauta[p] = objBase;
    }

    setConfig((prev) => ({ ...prev, pauta: nuevaPauta }));
  };

  const manejarSubidaPdfNube = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setSubiendoPdf(true);
    try {
      const nombreLimpio = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const rutaArchivo = `${config.docenteId || 'docente'}/${Date.now()}_${nombreLimpio}`;

      const { error: uploadError } = await supabase.storage
        .from('pruebas_pdf')
        .upload(rutaArchivo, file, { upsert: true });

      if (uploadError) {
        alert('Error al subir PDF: ' + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('pruebas_pdf')
        .getPublicUrl(rutaArchivo);

      const urlPublica = publicUrlData.publicUrl;

      setConfig((prev) => ({
        ...prev,
        pdfPruebaUrl: urlPublica,
        pdfPruebaNombre: file.name
      }));

      if (config.id) {
        await supabase
          .from('evaluaciones')
          .update({
            pdf_prueba_url: urlPublica,
            pdf_prueba_nombre: file.name
          })
          .eq('id', config.id);
      }

      alert('✅ PDF de la prueba guardado permanentemente.');
    } catch (err) {
      alert('No se pudo subir el PDF: ' + err.message);
    } finally {
      setSubiendoPdf(false);
      e.target.value = '';
    }
  };

  const quitarPdfPrueba = async () => {
    setConfig((prev) => ({
      ...prev,
      pdfPruebaUrl: '',
      pdfPruebaNombre: ''
    }));
    if (config.id && supabase) {
      await supabase
        .from('evaluaciones')
        .update({ pdf_prueba_url: null, pdf_prueba_nombre: null })
        .eq('id', config.id);
    }
  };

  const listaAlternativas = [];
  const listaCompletacion = [];
  const listaDesarrollo = [];

  for (let p = 1; p <= numPreguntas; p++) {
    const item = pauta[p] || { tipo: 'alternativa', correcta: [], oa: '', habilidad: '', puntaje: 1 };
    const tipo = obtenerTipoItem(item);
    if (tipo === 'completacion') listaCompletacion.push({ p, item });
    else if (tipo === 'desarrollo') listaDesarrollo.push({ p, item });
    else listaAlternativas.push({ p, item });
  }

  const maxPorTipoModal =
    tipoPreguntaAgregar === 'alternativa'
      ? Math.max(1, 50 - countAlternativas)
      : tipoPreguntaAgregar === 'completacion'
      ? Math.max(1, 10 - countCompletacion)
      : Math.max(1, 5 - countDesarrollo);

  const itemModalDesarrollo = modalDesarrolloNum ? pauta[modalDesarrolloNum] : null;

  return (
    <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={20} color="#16a34a" />
            Pauta, Rúbricas y Objetivos (OA)
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Currículo MINEDUC activo: <strong>{asignaturaEfectiva}</strong> {nivelNombre ? `• ${nivelNombre}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12.5px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#dbeafe', color: '#1e3a8a', padding: '4px 10px', borderRadius: '6px', fontWeight: '800' }}>
              <Calculator size={14} /> Puntaje Ideal: {puntajeIdealTotal} pts
              {preguntasAnuladasCount > 0 && ` (${preguntasAnuladasCount} anulada${preguntasAnuladasCount === 1 ? '' : 's'})`}
            </span>

            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <strong>Exigencia:</strong>
              <input
                type="number"
                min="1"
                max="100"
                value={config.exigencia ?? 60}
                onChange={(e) => setConfig({ ...config, exigencia: Number(e.target.value) })}
                style={{ width: '48px', padding: '3px 5px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
              />%
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <strong>Mín:</strong>
              <input
                type="number"
                step="0.1"
                value={config.notaMin ?? 1.0}
                onChange={(e) => setConfig({ ...config, notaMin: Number(e.target.value) })}
                style={{ width: '48px', padding: '3px 5px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <strong>Aprob:</strong>
              <input
                type="number"
                step="0.1"
                value={config.notaAprob ?? 4.0}
                onChange={(e) => setConfig({ ...config, notaAprob: Number(e.target.value) })}
                style={{ width: '48px', padding: '3px 5px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <strong>Máx:</strong>
              <input
                type="number"
                step="0.1"
                value={config.notaMax ?? 7.0}
                onChange={(e) => setConfig({ ...config, notaMax: Number(e.target.value) })}
                style={{ width: '48px', padding: '3px 5px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {config.pdfPruebaUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '7px 12px', fontSize: '12.5px' }}>
                <FileText size={16} color="#1d4ed8" />
                <span style={{ fontWeight: '700', color: '#1e3a8a', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {config.pdfPruebaNombre || 'Prueba_Adjunta.pdf'}
                </span>
                <a href={config.pdfPruebaUrl} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', display: 'inline-flex', alignItems: 'center' }}>
                  <ExternalLink size={14} />
                </a>
                <label style={{ cursor: 'pointer', color: '#2563eb', fontWeight: '700', marginLeft: '4px' }}>
                  Cambiar
                  <input type="file" accept="application/pdf" onChange={manejarSubidaPdfNube} disabled={subiendoPdf} style={{ display: 'none' }} />
                </label>
                <button type="button" onClick={quitarPdfPrueba} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  background: subiendoPdf ? '#e2e8f0' : '#eff6ff',
                  color: '#1e40af', border: '1px solid #93c5fd',
                  padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px',
                  fontWeight: '700', cursor: subiendoPdf ? 'wait' : 'pointer'
                }}
              >
                <Upload size={15} color="#1e40af" />
                <span>{subiendoPdf ? 'Subiendo PDF...' : 'Subir Prueba en PDF'}</span>
                <input type="file" accept="application/pdf" onChange={manejarSubidaPdfNube} disabled={subiendoPdf} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={abrirModalAgregar}
          style={{
            background: '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '9px 16px',
            fontSize: '13.5px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(22,163,74,0.2)'
          }}
        >
          <PlusCircle size={17} /> Agregar Preguntas
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12.5px' }}>
          <span style={{ fontWeight: '800', color: '#334155' }}>
            Total: {numPreguntas}
          </span>
          {countAlternativas > 0 && (
            <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 9px', borderRadius: '999px', fontWeight: '700' }}>
              {countAlternativas} Alternativa{countAlternativas === 1 ? '' : 's'}
            </span>
          )}
          {countCompletacion > 0 && (
            <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 9px', borderRadius: '999px', fontWeight: '700' }}>
              {countCompletacion} Completación Numérica
            </span>
          )}
          {countDesarrollo > 0 && (
            <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '3px 9px', borderRadius: '999px', fontWeight: '700' }}>
              {countDesarrollo} Desarrollo
            </span>
          )}
        </div>
      </div>

      {numPreguntas > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '9px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#1e40af' }}>
              <Wand2 size={15} /> Asignar OA ({asignaturaEfectiva}):
            </span>
            <span>Desde P.</span>
            <input type="number" min="1" max={numPreguntas} value={rangoInicio} onChange={(e) => setRangoInicio(e.target.value)} style={{ width: '50px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #93c5fd' }} />
            <span>hasta P.</span>
            <input type="number" min="1" max={numPreguntas} value={rangoFin} onChange={(e) => setRangoFin(e.target.value)} style={{ width: '50px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #93c5fd' }} />

            {listaOAsNivel.length > 0 ? (
              <select value={oaMasivo} onChange={(e) => setOaMasivo(e.target.value)} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #93c5fd', maxWidth: '340px', fontWeight: '600' }}>
                <option value="">-- Elegir OA de {asignaturaEfectiva} ({nivelNombre || 'Nivel'}) --</option>
                {listaOAsNivel.map((oa) => (
                  <option key={oa.codigo} value={oa.codigo}>
                    {oa.codigo} — {oa.descripcion.slice(0, 65)}...
                  </option>
                ))}
              </select>
            ) : (
              <input type="text" placeholder="Ej: OA 1" value={oaMasivo} onChange={(e) => setOaMasivo(e.target.value)} style={{ width: '110px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #93c5fd' }} />
            )}

            <button type="button" onClick={aplicarOAMasivo} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: '700', cursor: 'pointer' }}>
              Aplicar OA
            </button>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '9px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#334155' }}>
              <Calculator size={15} /> Asignar Puntaje:
            </span>
            <span>Desde P.</span>
            <input type="number" min="1" max={numPreguntas} value={rangoPtsInicio} onChange={(e) => setRangoPtsInicio(e.target.value)} style={{ width: '50px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <span>hasta P.</span>
            <input type="number" min="1" max={numPreguntas} value={rangoPtsFin} onChange={(e) => setRangoPtsFin(e.target.value)} style={{ width: '50px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <select value={puntajeMasivo} onChange={(e) => setPuntajeMasivo(Number(e.target.value))} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700' }}>
              <option value={0}>0 pts (Anular preguntas)</option>
              <option value={1}>1 punto (Predeterminado)</option>
              <option value={2}>2 puntos</option>
              <option value={3}>3 puntos</option>
              <option value={4}>4 puntos</option>
              <option value={5}>5 puntos</option>
            </select>
            <button type="button" onClick={aplicarPuntajeMasivo} style={{ background: '#334155', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: '700', cursor: 'pointer' }}>
              Aplicar Puntaje
            </button>
          </div>
        </div>
      )}

      {numPreguntas === 0 ? (
        <div style={{ padding: '28px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '14px' }}>
          Aún no has agregado preguntas. Haz clic en <strong>+ Agregar Preguntas</strong> arriba para comenzar.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {listaAlternativas.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '800', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ListChecks size={17} /> Sección I: Preguntas de Alternativa ({listaAlternativas.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(365px, 1fr))', gap: '10px' }}>
                {listaAlternativas.map(({ p, item }) => {
                  const clavesCorrectas = obtenerClavesItem(item);
                  const oaActual = typeof item === 'object' ? (item?.oa || '') : '';
                  const descActual = typeof item === 'object' ? (item?.habilidad || '') : '';
                  const puntajeActual = obtenerPuntajeItem(item);
                  const anulada = puntajeActual === 0;

                  return (
                    <div
                      key={p}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        border: anulada ? '1px solid #fca5a5' : clavesCorrectas.length > 0 ? '1px solid #86efac' : '1px solid #e2e8f0',
                        background: anulada ? '#fef2f2' : clavesCorrectas.length > 0 ? '#f0fdf4' : '#ffffff',
                        opacity: anulada ? 0.78 : 1,
                        gap: '6px'
                      }}
                    >
                      <span style={{ fontWeight: '800', fontSize: '13.5px', minWidth: '26px', color: anulada ? '#dc2626' : '#0f172a' }}>
                        {p}.
                      </span>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        {opciones.map((letra) => {
                          const activa = clavesCorrectas.includes(letra);
                          return (
                            <button
                              key={letra}
                              type="button"
                              onClick={() => toggleAlternativaCorrecta(p, letra)}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '999px',
                                border: activa ? '2px solid #16a34a' : '1px solid #cbd5e1',
                                background: activa ? '#16a34a' : '#ffffff',
                                color: activa ? '#ffffff' : '#334155',
                                fontWeight: '800',
                                fontSize: '11.5px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {letra}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {listaOAsNivel.length > 0 ? (
                          <select
                            value={oaActual}
                            onChange={(e) => actualizarItem(p, 'oa', e.target.value)}
                            title={descActual || `Selecciona un OA de ${asignaturaEfectiva}`}
                            style={{
                              width: '72px',
                              padding: '5px 3px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              color: oaActual ? '#1e3a8a' : '#64748b',
                              background: '#ffffff'
                            }}
                          >
                            <option value="">OA...</option>
                            {listaOAsNivel.map((oa) => (
                              <option key={oa.codigo} value={oa.codigo}>
                                {oa.codigo} — {oa.descripcion}
                              </option>
                            ))}
                            {oaActual && !listaOAsNivel.some((o) => o.codigo === oaActual) && (
                              <option value={oaActual}>{oaActual}</option>
                            )}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="OA"
                            value={oaActual}
                            onChange={(e) => actualizarItem(p, 'oa', e.target.value)}
                            style={{ width: '62px', padding: '5px 5px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px' }}
                          />
                        )}

                        <select
                          value={puntajeActual}
                          onChange={(e) => actualizarItem(p, 'puntaje', Number(e.target.value))}
                          title="Puntaje de la pregunta (0 pts = Anulada)"
                          style={{
                            width: '64px',
                            padding: '5px 3px',
                            borderRadius: '6px',
                            border: anulada ? '1px solid #ef4444' : '1px solid #cbd5e1',
                            fontSize: '11.5px',
                            fontWeight: '800',
                            color: anulada ? '#dc2626' : '#0f172a',
                            background: anulada ? '#fee2e2' : '#ffffff'
                          }}
                        >
                          <option value={0}>0 pts (Anul.)</option>
                          <option value={1}>1 pt</option>
                          <option value={2}>2 pts</option>
                          <option value={3}>3 pts</option>
                          <option value={4}>4 pts</option>
                          <option value={5}>5 pts</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => eliminarPreguntaIndividual(p)}
                          title={`Eliminar pregunta ${p}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '6px'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fee2e2'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {listaCompletacion.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '800', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Hash size={17} /> Sección II: Completación Numérica Exacta ({listaCompletacion.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(410px, 1fr))', gap: '10px' }}>
                {listaCompletacion.map(({ p, item }) => {
                  const respExacta = item?.respuestaExacta ?? '';
                  const oaActual = item?.oa || '';
                  const descActual = item?.habilidad || '';
                  const puntajeActual = obtenerPuntajeItem(item);
                  const anulada = puntajeActual === 0;

                  return (
                    <div
                      key={p}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: anulada ? '1px solid #fca5a5' : String(respExacta).trim() !== '' ? '1px solid #fcd34d' : '1px solid #e2e8f0',
                        background: anulada ? '#fef2f2' : '#fffbeb',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontWeight: '800', fontSize: '13.5px', minWidth: '26px', color: '#78350f' }}>
                        {p}.
                      </span>

                      <input
                        type="text"
                        placeholder="Valor exacto (ej: 42 o -3,5)"
                        value={respExacta}
                        onChange={(e) => actualizarItem(p, 'respuestaExacta', e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: '125px',
                          padding: '6px 9px',
                          borderRadius: '7px',
                          border: '1px solid #f59e0b',
                          fontSize: '13px',
                          fontWeight: '800',
                          color: '#0f172a',
                          background: '#ffffff'
                        }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {listaOAsNivel.length > 0 ? (
                          <select
                            value={oaActual}
                            onChange={(e) => actualizarItem(p, 'oa', e.target.value)}
                            title={descActual || `Selecciona un OA de ${asignaturaEfectiva}`}
                            style={{
                              width: '72px',
                              padding: '5px 3px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              color: oaActual ? '#1e3a8a' : '#64748b',
                              background: '#ffffff'
                            }}
                          >
                            <option value="">OA...</option>
                            {listaOAsNivel.map((oa) => (
                              <option key={oa.codigo} value={oa.codigo}>
                                {oa.codigo} — {oa.descripcion}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="OA"
                            value={oaActual}
                            onChange={(e) => actualizarItem(p, 'oa', e.target.value)}
                            style={{ width: '62px', padding: '5px 5px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px' }}
                          />
                        )}

                        <select
                          value={puntajeActual}
                          onChange={(e) => actualizarItem(p, 'puntaje', Number(e.target.value))}
                          style={{
                            width: '64px',
                            padding: '5px 3px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '11.5px',
                            fontWeight: '800',
                            background: '#ffffff'
                          }}
                        >
                          <option value={0}>0 pts (Anul.)</option>
                          <option value={1}>1 pt</option>
                          <option value={2}>2 pts</option>
                          <option value={3}>3 pts</option>
                          <option value={4}>4 pts</option>
                          <option value={5}>5 pts</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => eliminarPreguntaIndividual(p)}
                          title={`Eliminar pregunta ${p}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '6px'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fee2e2'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {listaDesarrollo.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '800', color: '#5b21b6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileEdit size={17} /> Sección III: Preguntas de Desarrollo y Rúbrica IA ({listaDesarrollo.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {listaDesarrollo.map(({ p, item }) => {
                  const oaActual = item?.oa || '';
                  const puntajeActual = obtenerPuntajeItem(item);
                  const lineasActual = Number(item?.lineas || 5);
                  const cantNiveles = Number(item?.cantidadNiveles || item?.rubrica?.length || 3);
                  const tieneDescriptores = Array.isArray(item?.rubrica) && item.rubrica.some((n) => (n.descriptor || '').trim() !== '');

                  return (
                    <div
                      key={p}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '11px',
                        border: '1px solid #c4b5fd',
                        background: '#faf5ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                        <span style={{ background: '#7c3aed', color: '#ffffff', fontWeight: '800', fontSize: '13px', padding: '4px 10px', borderRadius: '7px', whiteSpace: 'nowrap' }}>
                          P{p} • Desarrollo
                        </span>

                        <div style={{ fontSize: '12.5px', color: '#334155' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>
                            {item?.enunciado ? `"${item.enunciado.slice(0, 75)}${item.enunciado.length > 75 ? '...' : ''}"` : 'Sin enunciado escrito aún'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                            {lineasActual} renglones • {cantNiveles} niveles • {puntajeActual} pts {oaActual ? `• ${oaActual}` : ''} •{' '}
                            <strong style={{ color: tieneDescriptores ? '#16a34a' : '#d97706' }}>
                              {tieneDescriptores ? 'Rúbrica configurada ✓' : 'Rúbrica pendiente'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setModalDesarrolloNum(p)}
                          style={{
                            background: '#7c3aed',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 13px',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Settings2 size={15} /> Configurar Pregunta y Rúbrica IA
                        </button>

                        <button
                          type="button"
                          onClick={() => eliminarPreguntaIndividual(p)}
                          title={`Eliminar pregunta ${p}`}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            cursor: 'pointer',
                            padding: '7px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '8px'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {modalDesarrolloNum && itemModalDesarrollo && (
        <div
          onClick={() => setModalDesarrolloNum(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1150,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '920px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
            }}
          >
            <div style={{ padding: '16px 22px', background: '#f5f3ff', borderBottom: '1px solid #ddd6fe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#6d28d9', textTransform: 'uppercase' }}>
                  Configuración de Pregunta Abierta y Rúbrica IA ({asignaturaEfectiva})
                </div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>
                  Pregunta {modalDesarrolloNum} (Desarrollo)
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setModalDesarrolloNum(null)}
                style={{ background: '#ffffff', border: '1px solid #c4b5fd', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer' }}
              >
                <X size={18} color="#5b21b6" />
              </button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    Renglones en la hoja
                  </label>
                  <select
                    value={Number(itemModalDesarrollo?.lineas || 5)}
                    onChange={(e) => actualizarItem(modalDesarrolloNum, 'lineas', Number(e.target.value))}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', fontWeight: '700', background: '#ffffff' }}
                  >
                    <option value={3}>3 líneas (Corto)</option>
                    <option value={5}>5 líneas (Estándar)</option>
                    <option value={8}>8 líneas (Mediano)</option>
                    <option value={12}>12 líneas (Extenso)</option>
                    <option value={16}>16 líneas (Media página)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    Niveles de graduación
                  </label>
                  <select
                    value={Number(itemModalDesarrollo?.cantidadNiveles || itemModalDesarrollo?.rubrica?.length || 3)}
                    onChange={(e) => actualizarItem(modalDesarrolloNum, 'cantidadNiveles', Number(e.target.value))}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', fontWeight: '700', background: '#ffffff' }}
                  >
                    <option value={2}>2 niveles</option>
                    <option value={3}>3 niveles</option>
                    <option value={4}>4 niveles</option>
                    <option value={5}>5 niveles</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    Puntaje máximo
                  </label>
                  <select
                    value={obtenerPuntajeItem(itemModalDesarrollo)}
                    onChange={(e) => actualizarItem(modalDesarrolloNum, 'puntaje', Number(e.target.value))}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', fontWeight: '800', background: '#ffffff' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((pts) => (
                      <option key={pts} value={pts}>{pts} punto{pts === 1 ? '' : 's'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    Objetivo de Aprendizaje (OA)
                  </label>
                  {listaOAsNivel.length > 0 ? (
                    <select
                      value={itemModalDesarrollo?.oa || ''}
                      onChange={(e) => actualizarItem(modalDesarrolloNum, 'oa', e.target.value)}
                      style={{ width: '100%', padding: '7px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', fontWeight: '700', background: '#ffffff' }}
                    >
                      <option value="">-- Elegir OA --</option>
                      {listaOAsNivel.map((oa) => (
                        <option key={oa.codigo} value={oa.codigo}>
                          {oa.codigo} — {oa.descripcion.slice(0, 45)}...
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ej: OA 4"
                      value={itemModalDesarrollo?.oa || ''}
                      onChange={(e) => actualizarItem(modalDesarrolloNum, 'oa', e.target.value)}
                      style={{ width: '100%', padding: '7px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                    />
                  )}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                    Enunciado o problema de la Pregunta {modalDesarrolloNum}:
                  </label>

                  <button
                    type="button"
                    onClick={() => generarRubricaConIA(modalDesarrolloNum)}
                    disabled={generandoIaPregunta === modalDesarrolloNum}
                    style={{
                      background: generandoIaPregunta === modalDesarrolloNum ? '#a78bfa' : '#7c3aed',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: generandoIaPregunta === modalDesarrolloNum ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Sparkles size={15} />
                    {generandoIaPregunta === modalDesarrolloNum ? 'Generando rúbrica con IA...' : 'Generar rúbrica con IA'}
                  </button>
                </div>

                <textarea
                  rows={3}
                  placeholder={config.pdfPruebaUrl
                    ? `Escribe aquí el enunciado de la pregunta ${modalDesarrolloNum} o déjalo vacío y presiona "Generar rúbrica con IA" para extraerla del PDF adjunto...`
                    : `Escribe aquí el enunciado completo de la pregunta ${modalDesarrolloNum}...`}
                  value={itemModalDesarrollo?.enunciado || ''}
                  onChange={(e) => actualizarItem(modalDesarrolloNum, 'enunciado', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '9px',
                    border: '1px solid #c4b5fd',
                    fontSize: '13.5px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#4c1d95', marginBottom: '8px' }}>
                  Niveles y criterios de evaluación (puedes editar textos y puntajes):
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(Array.isArray(itemModalDesarrollo?.rubrica) && itemModalDesarrollo.rubrica.length > 0
                    ? itemModalDesarrollo.rubrica
                    : generarNivelesRubricaBase(3, obtenerPuntajeItem(itemModalDesarrollo) || 3)
                  ).map((niv, idxNiv) => (
                    <div
                      key={idxNiv}
                      style={{
                        background: '#faf5ff',
                        border: '1px solid #ddd6fe',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="text"
                          value={niv.nivel}
                          onChange={(e) => actualizarNivelRubrica(modalDesarrolloNum, idxNiv, 'nivel', e.target.value)}
                          style={{
                            fontWeight: '800',
                            fontSize: '14px',
                            color: '#5b21b6',
                            background: '#ffffff',
                            border: '1px solid #c4b5fd',
                            borderRadius: '6px',
                            padding: '5px 9px',
                            flex: 1
                          }}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                          <span>Puntaje:</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={obtenerPuntajeItem(itemModalDesarrollo)}
                            value={niv.puntaje}
                            onChange={(e) => actualizarNivelRubrica(modalDesarrolloNum, idxNiv, 'puntaje', e.target.value)}
                            style={{
                              width: '60px',
                              padding: '5px 6px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              textAlign: 'center',
                              fontWeight: '800',
                              fontSize: '14px'
                            }}
                          />
                          <span>pts</span>
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        placeholder={`Describe qué debe lograr el estudiante para obtener el nivel "${niv.nivel}"...`}
                        value={niv.descriptor || ''}
                        onChange={(e) => actualizarNivelRubrica(modalDesarrolloNum, idxNiv, 'descriptor', e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: '13px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '7px',
                          padding: '8px 10px',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          color: '#1e293b',
                          boxSizing: 'border-box',
                          background: '#ffffff'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 22px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setModalDesarrolloNum(null)}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Listo, Guardar Rúbrica
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAgregarAbierto && (
        <div
          onClick={() => setModalAgregarAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '470px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Agregar Preguntas
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Se agrupan automáticamente en la hoja de respuestas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAgregarAbierto(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} color="#475569" />
              </button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <div
                onClick={() => seleccionarTipoEnModal('alternativa')}
                style={{
                  padding: '13px 15px',
                  borderRadius: '12px',
                  border: tipoPreguntaAgregar === 'alternativa' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                  background: tipoPreguntaAgregar === 'alternativa' ? '#f0fdf4' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ListChecks size={20} color="#16a34a" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '14.5px', color: '#0f172a' }}>
                        Preguntas de Alternativa
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Burbujas OMR ({countAlternativas}/50 usadas)
                      </div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    checked={tipoPreguntaAgregar === 'alternativa'}
                    onChange={() => seleccionarTipoEnModal('alternativa')}
                    style={{ width: '17px', height: '17px', accentColor: '#16a34a' }}
                  />
                </div>

                {tipoPreguntaAgregar === 'alternativa' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed #86efac' }}
                  >
                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>
                      Cantidad (máx. {Math.max(0, 50 - countAlternativas)}):
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={maxPorTipoModal}
                      value={cantidadAgregar}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setCantidadAgregar(e.target.value)}
                      style={{
                        width: '82px',
                        padding: '5px 8px',
                        borderRadius: '8px',
                        border: '1px solid #16a34a',
                        fontSize: '15px',
                        fontWeight: '800',
                        textAlign: 'center'
                      }}
                    />
                  </div>
                )}
              </div>

              <div
                onClick={() => seleccionarTipoEnModal('completacion')}
                style={{
                  padding: '13px 15px',
                  borderRadius: '12px',
                  border: tipoPreguntaAgregar === 'completacion' ? '2px solid #d97706' : '1px solid #cbd5e1',
                  background: tipoPreguntaAgregar === 'completacion' ? '#fffbeb' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Hash size={20} color="#d97706" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '14.5px', color: '#0f172a' }}>
                        Completación Numérica
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Recuadro libre para cifra exacta ({countCompletacion}/10 usadas)
                      </div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    checked={tipoPreguntaAgregar === 'completacion'}
                    onChange={() => seleccionarTipoEnModal('completacion')}
                    style={{ width: '17px', height: '17px', accentColor: '#d97706' }}
                  />
                </div>

                {tipoPreguntaAgregar === 'completacion' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed #fcd34d' }}
                  >
                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>
                      Cantidad (máx. {Math.max(0, 10 - countCompletacion)}):
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={maxPorTipoModal}
                      value={cantidadAgregar}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setCantidadAgregar(e.target.value)}
                      style={{
                        width: '82px',
                        padding: '5px 8px',
                        borderRadius: '8px',
                        border: '1px solid #d97706',
                        fontSize: '15px',
                        fontWeight: '800',
                        textAlign: 'center'
                      }}
                    />
                  </div>
                )}
              </div>

              <div
                onClick={() => seleccionarTipoEnModal('desarrollo')}
                style={{
                  padding: '13px 15px',
                  borderRadius: '12px',
                  border: tipoPreguntaAgregar === 'desarrollo' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  background: tipoPreguntaAgregar === 'desarrollo' ? '#faf5ff' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileEdit size={20} color="#7c3aed" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '14.5px', color: '#0f172a' }}>
                        Preguntas de Desarrollo
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Recuadro con renglones y rúbrica IA ({countDesarrollo}/5 usadas)
                      </div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    checked={tipoPreguntaAgregar === 'desarrollo'}
                    onChange={() => seleccionarTipoEnModal('desarrollo')}
                    style={{ width: '17px', height: '17px', accentColor: '#7c3aed' }}
                  />
                </div>

                {tipoPreguntaAgregar === 'desarrollo' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed #c4b5fd' }}
                  >
                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#5b21b6' }}>
                      Cantidad (máx. {Math.max(0, 5 - countDesarrollo)}):
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={maxPorTipoModal}
                      value={cantidadAgregar}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setCantidadAgregar(e.target.value)}
                      style={{
                        width: '82px',
                        padding: '5px 8px',
                        borderRadius: '8px',
                        border: '1px solid #7c3aed',
                        fontSize: '15px',
                        fontWeight: '800',
                        textAlign: 'center'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '14px 22px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setModalAgregarAbierto(false)}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarAgregarPreguntas}
                style={{
                  background: tipoPreguntaAgregar === 'desarrollo' ? '#7c3aed' : tipoPreguntaAgregar === 'completacion' ? '#d97706' : '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <PlusCircle size={16} /> Agregar {cantidadAgregar} Pregunta{Number(cantidadAgregar) === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
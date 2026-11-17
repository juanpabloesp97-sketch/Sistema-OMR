import React from 'react';
import { CheckSquare, Shuffle, Sliders } from 'lucide-react';

export default function PautaEditor({ config, setConfig }) {
  const opciones = config.alternativas.split('');
  const total = Math.min(Math.max(Number(config.numPreguntas), 1), 50);

  const actualizarPregunta = (num, campo, valor) => {
    setConfig((prev) => ({
      ...prev,
      pauta: {
        ...prev.pauta,
        [num]: {
          ...(prev.pauta[num] || { correcta: '', oa: 'OA 1' }),
          [campo]: valor,
        },
      },
    }));
  };

  // Botón útil para rellenar pauta rápida al hacer pruebas
  const llenarEjemplo = () => {
    const nuevaPauta = {};
    for (let i = 1; i <= total; i++) {
      nuevaPauta[i] = {
        correcta: opciones[(i - 1) % opciones.length],
        oa: `OA ${Math.ceil(i / 10)}`,
      };
    }
    setConfig((prev) => ({ ...prev, pauta: nuevaPauta }));
  };

  return (
    <div>
      {/* Escala de Notas Chilena */}
      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <h2 style={{ marginTop: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={20} color="#2563eb" />
          1. Configuración de Escala de Notas
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Nota Mínima</label>
            <select
              value={config.notaMin}
              onChange={(e) => setConfig({ ...config, notaMin: Number(e.target.value) })}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
            >
              <option value={1.0}>1.0 (Estándar)</option>
              <option value={2.0}>2.0 (Piso 2.0)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Porcentaje de Exigencia</label>
            <select
              value={config.exigencia}
              onChange={(e) => setConfig({ ...config, exigencia: Number(e.target.value) })}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
            >
              <option value={50}>50% de exigencia</option>
              <option value={55}>55% de exigencia</option>
              <option value={60}>60% de exigencia (Estándar)</option>
              <option value={70}>70% de exigencia</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Nota Aprobación / Máxima</label>
            <div style={{ padding: '8px 12px', background: '#e2e8f0', borderRadius: '6px', fontSize: '14px', fontWeight: '600' }}>
              4.0 a 7.0 ({total} pts máx.)
            </div>
          </div>
        </div>
      </div>

      {/* Pauta de Respuestas y OA */}
      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={20} color="#16a34a" />
            2. Pauta de Respuestas Correctas y Objetivos (OA)
          </h2>
          <button
            onClick={llenarEjemplo}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
          >
            <Shuffle size={16} />
            Rellenar pauta de ejemplo
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
          {Array.from({ length: total }, (_, i) => i + 1).map((num) => {
            const item = config.pauta[num] || { correcta: '', oa: 'OA 1' };
            return (
              <div
                key={num}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'white',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: item.correcta ? '1px solid #86efac' : '1px solid #e2e8f0',
                  gap: '8px',
                }}
              >
                <strong style={{ width: '28px', fontSize: '14px' }}>{num}.</strong>

                <div style={{ display: 'flex', gap: '4px' }}>
                  {opciones.map((letra) => (
                    <button
                      key={letra}
                      onClick={() => actualizarPregunta(num, 'correcta', letra)}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        border: '1px solid #cbd5e1',
                        background: item.correcta === letra ? '#16a34a' : '#f8fafc',
                        color: item.correcta === letra ? 'white' : '#334155',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {letra}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="OA"
                  value={item.oa}
                  onChange={(e) => actualizarPregunta(num, 'oa', e.target.value)}
                  style={{ width: '62px', padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import {
  User, GraduationCap, FileText, ChevronDown, ChevronRight,
  PlusCircle, FolderOpen, ScanLine, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

export default function Sidebar({
  vistaActiva,
  setVistaActiva,
  niveles,
  cursos,
  cursoActivoId,
  setCursoActivoId,
  profesor
}) {
  const [colapsado, setColapsado] = useState(false);
  const [esMovil, setEsMovil] = useState(window.innerWidth < 768);
  const [cursosExpandido, setCursosExpandido] = useState(true);
  const [evalExpandido, setEvalExpandido] = useState(true);
  const [nivelesAbiertos, setNivelesAbiertos] = useState({});

  useEffect(() => {
    const manejarResize = () => {
      const movil = window.innerWidth < 768;
      setEsMovil(movil);
      if (movil) setColapsado(true);
    };
    manejarResize();
    window.addEventListener('resize', manejarResize);
    return () => window.removeEventListener('resize', manejarResize);
  }, []);

  const toggleNivel = (nivelId) => {
    setNivelesAbiertos((prev) => ({
      ...prev,
      [nivelId]: prev[nivelId] === undefined ? false : !prev[nivelId]
    }));
  };

  const irACurso = (cursoId) => {
    setCursoActivoId(cursoId);
    setVistaActiva('visor-curso');
    if (esMovil) setColapsado(true);
  };

  const cambiarVista = (vista) => {
    setVistaActiva(vista);
    if (esMovil) setColapsado(true);
  };

  const estiloItem = (activo) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: colapsado ? 'center' : 'space-between',
    width: '100%',
    padding: colapsado ? '10px 0' : '10px 12px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: activo ? '700' : '600',
    background: activo ? '#2563eb' : 'transparent',
    color: activo ? '#ffffff' : '#334155',
    textAlign: 'left',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap'
  });

  return (
    <aside
      style={{
        width: colapsado ? '68px' : '260px',
        minWidth: colapsado ? '68px' : '260px',
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: colapsado ? '16px 10px' : '18px 14px',
        boxSizing: 'border-box',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 20
      }}
    >
      {/* CABECERA CON LOGO Y BOTÓN COLAPSAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: colapsado ? 'center' : 'space-between',
          paddingBottom: '16px',
          marginBottom: '16px',
          borderBottom: '1px solid #e2e8f0',
          gap: '8px'
        }}
      >
        {!colapsado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div style={{ background: '#eff6ff', padding: '7px', borderRadius: '8px', display: 'flex' }}>
              <ScanLine size={22} color="#2563eb" />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '16px', color: '#0f172a', lineHeight: '1.1', whiteSpace: 'nowrap' }}>
                Sistema OMR
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                Gestión Escolar
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setColapsado(!colapsado)}
          title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '7px',
            cursor: 'pointer',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {colapsado ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* NAVEGACIÓN PRINCIPAL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* 1. MI PERFIL */}
        <button
          onClick={() => cambiarVista('perfil')}
          style={estiloItem(vistaActiva === 'perfil')}
          title="Mi Perfil"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={18} />
            {!colapsado && 'Mi Perfil'}
          </span>
        </button>

        {/* 2. MIS CURSOS */}
        <div>
          <button
            onClick={() => {
              if (colapsado) {
                setColapsado(false);
                setCursosExpandido(true);
              } else {
                setCursosExpandido(!cursosExpandido);
              }
            }}
            style={{
              ...estiloItem(colapsado && vistaActiva === 'visor-curso'),
              color: colapsado && vistaActiva === 'visor-curso' ? '#ffffff' : '#0f172a',
              background: colapsado && vistaActiva === 'visor-curso' ? '#2563eb' : '#f8fafc'
            }}
            title="Mis Cursos"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GraduationCap size={18} color={colapsado && vistaActiva === 'visor-curso' ? '#ffffff' : '#2563eb'} />
              {!colapsado && 'Mis Cursos'}
            </span>
            {!colapsado && (cursosExpandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}
          </button>

          {!colapsado && cursosExpandido && (
            <div style={{ paddingLeft: '10px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid #e2e8f0', marginLeft: '14px' }}>
              <button
                onClick={() => {
                  setCursoActivoId('');
                  cambiarVista('visor-curso');
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px',
                  borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12.5px',
                  fontWeight: '600', color: '#2563eb', whiteSpace: 'nowrap',
                  background: vistaActiva === 'visor-curso' && !cursoActivoId ? '#eff6ff' : 'transparent'
                }}
              >
                <PlusCircle size={14} />
                Niveles y Cursos
              </button>

              {niveles.map((niv) => {
                const cursosNiv = cursos.filter((c) => c.nivel_id === niv.id);
                const abierto = nivelesAbiertos[niv.id] !== false;
                return (
                  <div key={niv.id} style={{ marginTop: '2px' }}>
                    <button
                      onClick={() => toggleNivel(niv.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '5px 8px', border: 'none', background: 'transparent',
                        cursor: 'pointer', fontSize: '11.5px', fontWeight: '700', color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.03em'
                      }}
                    >
                      <span>{niv.nombre}</span>
                      {abierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    {abierto && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '6px' }}>
                        {cursosNiv.length === 0 && (
                          <span style={{ fontSize: '12px', color: '#94a3b8', padding: '4px 8px' }}>Sin cursos</span>
                        )}
                        {cursosNiv.map((cur) => {
                          const esActivo = vistaActiva === 'visor-curso' && cursoActivoId === cur.id;
                          return (
                            <button
                              key={cur.id}
                              onClick={() => irACurso(cur.id)}
                              style={{
                                padding: '7px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap',
                                fontWeight: esActivo ? '700' : '500',
                                background: esActivo ? '#dbeafe' : 'transparent',
                                color: esActivo ? '#1d4ed8' : '#334155'
                              }}
                            >
                              {cur.nombre}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. EVALUACIONES */}
        <div>
          <button
            onClick={() => {
              if (colapsado) {
                setColapsado(false);
                setEvalExpandido(true);
              } else {
                setEvalExpandido(!evalExpandido);
              }
            }}
            style={{
              ...estiloItem(colapsado && (vistaActiva === 'evaluaciones-creadas' || vistaActiva === 'crear-evaluacion')),
              color: colapsado && (vistaActiva === 'evaluaciones-creadas' || vistaActiva === 'crear-evaluacion') ? '#ffffff' : '#0f172a',
              background: colapsado && (vistaActiva === 'evaluaciones-creadas' || vistaActiva === 'crear-evaluacion') ? '#2563eb' : '#f8fafc'
            }}
            title="Evaluaciones"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText
                size={18}
                color={colapsado && (vistaActiva === 'evaluaciones-creadas' || vistaActiva === 'crear-evaluacion') ? '#ffffff' : '#059669'}
              />
              {!colapsado && 'Evaluaciones'}
            </span>
            {!colapsado && (evalExpandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}
          </button>

          {!colapsado && evalExpandido && (
            <div style={{ paddingLeft: '10px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid #e2e8f0', marginLeft: '14px' }}>
              <button
                onClick={() => cambiarVista('evaluaciones-creadas')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                  borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px',
                  whiteSpace: 'nowrap',
                  fontWeight: vistaActiva === 'evaluaciones-creadas' ? '700' : '500',
                  background: vistaActiva === 'evaluaciones-creadas' ? '#dbeafe' : 'transparent',
                  color: vistaActiva === 'evaluaciones-creadas' ? '#1d4ed8' : '#334155'
                }}
              >
                <FolderOpen size={15} />
                Evaluaciones Creadas
              </button>

              <button
                onClick={() => cambiarVista('crear-evaluacion')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                  borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px',
                  whiteSpace: 'nowrap',
                  fontWeight: vistaActiva === 'crear-evaluacion' ? '700' : '500',
                  background: vistaActiva === 'crear-evaluacion' ? '#dbeafe' : 'transparent',
                  color: vistaActiva === 'crear-evaluacion' ? '#1d4ed8' : '#334155'
                }}
              >
                <PlusCircle size={15} />
                Crear Evaluación
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PIE DEL MENÚ CON PERFIL DEL DOCENTE */}
      <div
        style={{
          borderTop: '1px solid #e2e8f0',
          paddingTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: colapsado ? 'center' : 'flex-start',
          gap: '10px'
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            minWidth: '32px',
            borderRadius: '999px',
            background: '#dbeafe',
            color: '#1d4ed8',
            fontWeight: '800',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {(profesor.nombre || 'P').charAt(0).toUpperCase()}
        </div>

        {!colapsado && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {profesor.nombre}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {profesor.asignatura}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
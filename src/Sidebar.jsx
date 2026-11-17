import React, { useState } from 'react';
import {
  User, GraduationCap, FileText, ChevronDown, ChevronRight,
  PlusCircle, FolderOpen, ScanLine, Menu, X
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
  const [abiertoMobile, setAbiertoMobile] = useState(false);
  const [cursosExpandido, setCursosExpandido] = useState(true);
  const [evalExpandido, setEvalExpandido] = useState(true);
  const [nivelesAbiertos, setNivelesAbiertos] = useState({});

  const toggleNivel = (nivelId) => {
    setNivelesAbiertos((prev) => ({
      ...prev,
      [nivelId]: prev[nivelId] === undefined ? false : !prev[nivelId]
    }));
  };

  const irACurso = (cursoId) => {
    setCursoActivoId(cursoId);
    setVistaActiva('visor-curso');
    setAbiertoMobile(false);
  };

  const cambiarVista = (vista) => {
    setVistaActiva(vista);
    setAbiertoMobile(false);
  };

  const estiloItem = (activo) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: activo ? '700' : '600',
    background: activo ? '#2563eb' : 'transparent',
    color: activo ? '#ffffff' : '#334155',
    textAlign: 'left',
    transition: 'background 0.15s'
  });

  const contenidoMenu = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', boxSizing: 'border-box' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ScanLine size={26} color="#2563eb" />
          <div>
            <div style={{ fontWeight: '800', fontSize: '16px', color: '#0f172a', lineHeight: '1.1' }}>Sistema OMR</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Gestión Escolar</div>
          </div>
        </div>
        <button
          onClick={() => setAbiertoMobile(false)}
          style={{ display: 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Navegación */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
        {/* 1. MI PERFIL */}
        <button
          onClick={() => cambiarVista('perfil')}
          style={estiloItem(vistaActiva === 'perfil')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={18} />
            Mi Perfil
          </span>
        </button>

        {/* 2. MIS CURSOS (DESPLEGABLE) */}
        <div>
          <button
            onClick={() => setCursosExpandido(!cursosExpandido)}
            style={{
              ...estiloItem(false),
              color: '#0f172a',
              background: '#f8fafc'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GraduationCap size={18} color="#2563eb" />
              Mis Cursos
            </span>
            {cursosExpandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {cursosExpandido && (
            <div style={{ paddingLeft: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid #e2e8f0', marginLeft: '14px' }}>
              <button
                onClick={() => {
                  setCursoActivoId('');
                  cambiarVista('visor-curso');
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px',
                  borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px',
                  fontWeight: '600', color: '#2563eb', background: vistaActiva === 'visor-curso' && !cursoActivoId ? '#eff6ff' : 'transparent'
                }}
              >
                <PlusCircle size={15} />
                Gestionar Niveles / Cursos
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
                        width: '100%', padding: '6px 8px', border: 'none', background: 'transparent',
                        cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase'
                      }}
                    >
                      <span>{niv.nombre}</span>
                      {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {abierto && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px' }}>
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
                                fontSize: '13px', textAlign: 'left',
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

        {/* 3. EVALUACIONES (2 SUBSECCIONES) */}
        <div>
          <button
            onClick={() => setEvalExpandido(!evalExpandido)}
            style={{
              ...estiloItem(false),
              color: '#0f172a',
              background: '#f8fafc'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={18} color="#059669" />
              Evaluaciones
            </span>
            {evalExpandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {evalExpandido && (
            <div style={{ paddingLeft: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid #e2e8f0', marginLeft: '14px' }}>
              <button
                onClick={() => cambiarVista('evaluaciones-creadas')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                  borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px',
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

      {/* Pie del menú con info rápida del docente */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', fontSize: '12px', color: '#64748b' }}>
        <div style={{ fontWeight: '700', color: '#1e293b' }}>{profesor.nombre}</div>
        <div>{profesor.asignatura}</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Botón flotante para pantallas pequeñas / celulares */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }} className="mobile-topbar">
        <button
          onClick={() => setAbiertoMobile(!abiertoMobile)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
        >
          <Menu size={18} />
          Menú
        </button>
        <span style={{ fontWeight: '800', color: '#0f172a' }}>Sistema OMR Escolar</span>
      </div>

      {/* Sidebar fijo en escritorio */}
      <aside
        style={{
          width: '260px',
          minWidth: '260px',
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          minHeight: '100vh',
          display: abiertoMobile ? 'block' : undefined
        }}
        className={`sidebar-container ${abiertoMobile ? 'abierto' : ''}`}
      >
        {contenidoMenu}
      </aside>
    </>
  );
}
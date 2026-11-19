import React, { useState } from 'react';
import {
  User, GraduationCap, FilePlus2, FolderOpen,
  ChevronDown, ChevronRight, Menu, X, CheckSquare, Users, LogOut
} from 'lucide-react';

export default function Sidebar({
  vistaActiva,
  setVistaActiva,
  niveles,
  cursos,
  cursoActivoId,
  setCursoActivoId,
  profesor,
  onCerrarSesion
}) {
  const [colapsado, setColapsado] = useState(false);
  const [menuCursosAbierto, setMenuCursosAbierto] = useState(true);
  const [menuEvalAbierto, setMenuEvalAbierto] = useState(true);
  const [nivelesAbiertos, setNivelesAbiertos] = useState({});

  const toggleNivel = (nivelId) => {
    setNivelesAbiertos((prev) => ({
      ...prev,
      [nivelId]: prev[nivelId] === undefined ? false : !prev[nivelId]
    }));
  };

  const estiloBotonMenu = (activo) => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: colapsado ? 'center' : 'space-between',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: 'none',
    background: activo ? '#eff6ff' : 'transparent',
    color: activo ? '#1d4ed8' : '#334155',
    fontWeight: activo ? '700' : '500',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s'
  });

  const esAdmin = profesor?.rol === 'admin';

  return (
    <aside
      style={{
        width: colapsado ? '68px' : '265px',
        minHeight: '100vh',
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          padding: '16px 14px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: colapsado ? 'center' : 'space-between'
        }}
      >
        {!colapsado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={22} color="#2563eb" />
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a', lineHeight: 1.1 }}>
                Sistema OMR
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Gestión Escolar</div>
            </div>
          </div>
        )}
        <button
          onClick={() => setColapsado(!colapsado)}
          title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          style={{
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '6px',
            padding: '6px',
            cursor: 'pointer',
            color: '#475569',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {colapsado ? <Menu size={18} /> : <X size={18} />}
        </button>
      </div>

      {/* Navegación */}
      <nav style={{ padding: '12px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        {/* 1. Mi Perfil */}
        <button
          onClick={() => setVistaActiva('perfil')}
          style={estiloBotonMenu(vistaActiva === 'perfil')}
          title="Mi Perfil Docente"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={18} />
            {!colapsado && <span>Mi Perfil</span>}
          </span>
        </button>

        {/* 1B. Gestión de Cuentas (Solo visible para Admin / UTP) */}
        {esAdmin && (
          <button
            onClick={() => setVistaActiva('usuarios')}
            style={estiloBotonMenu(vistaActiva === 'usuarios')}
            title="Administrar Cuentas Docentes"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={18} />
              {!colapsado && <span>Cuentas Docentes</span>}
            </span>
          </button>
        )}

        {/* 2. Mis Cursos */}
        <div style={{ marginTop: '4px' }}>
          <button
            onClick={() => {
              if (colapsado) {
                setColapsado(false);
                setMenuCursosAbierto(true);
              } else {
                setMenuCursosAbierto(!menuCursosAbierto);
              }
            }}
            style={estiloBotonMenu(vistaActiva === 'visor-curso')}
            title="Mis Cursos"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GraduationCap size={18} />
              {!colapsado && <span>Mis Cursos</span>}
            </span>
            {!colapsado && (menuCursosAbierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
          </button>

          {!colapsado && menuCursosAbierto && (
            <div style={{ paddingLeft: '14px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button
                onClick={() => {
                  setCursoActivoId('');
                  setVistaActiva('visor-curso');
                }}
                style={{
                  ...estiloBotonMenu(vistaActiva === 'visor-curso' && !cursoActivoId),
                  fontSize: '13px',
                  padding: '7px 10px'
                }}
              >
                <span>⚙️ Niveles y Cursos</span>
              </button>

              {niveles.map((nivel) => {
                const cursosDelNivel = cursos.filter((c) => c.nivel_id === nivel.id);
                const abierto = nivelesAbiertos[nivel.id] !== false;
                return (
                  <div key={nivel.id} style={{ marginTop: '2px' }}>
                    <button
                      onClick={() => toggleNivel(nivel.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        border: 'none',
                        background: 'transparent',
                        color: '#475569',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        textTransform: 'uppercase'
                      }}
                    >
                      <span>{nivel.nombre}</span>
                      {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {abierto && (
                      <div style={{ paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {cursosDelNivel.length === 0 ? (
                          <span style={{ fontSize: '11.5px', color: '#94a3b8', padding: '4px 8px' }}>
                            Sin cursos
                          </span>
                        ) : (
                          cursosDelNivel.map((curso) => (
                            <button
                              key={curso.id}
                              onClick={() => {
                                setCursoActivoId(curso.id);
                                setVistaActiva('visor-curso');
                              }}
                              style={{
                                ...estiloBotonMenu(vistaActiva === 'visor-curso' && cursoActivoId === curso.id),
                                fontSize: '13px',
                                padding: '6px 10px'
                              }}
                            >
                              <span>{curso.nombre}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Evaluaciones */}
        <div style={{ marginTop: '4px' }}>
          <button
            onClick={() => {
              if (colapsado) {
                setColapsado(false);
                setMenuEvalAbierto(true);
              } else {
                setMenuEvalAbierto(!menuEvalAbierto);
              }
            }}
            style={estiloBotonMenu(vistaActiva === 'evaluaciones-creadas' || vistaActiva === 'crear-evaluacion')}
            title="Evaluaciones"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FolderOpen size={18} />
              {!colapsado && <span>Evaluaciones</span>}
            </span>
            {!colapsado && (menuEvalAbierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
          </button>

          {!colapsado && menuEvalAbierto && (
            <div style={{ paddingLeft: '14px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button
                onClick={() => setVistaActiva('evaluaciones-creadas')}
                style={{
                  ...estiloBotonMenu(vistaActiva === 'evaluaciones-creadas'),
                  fontSize: '13px',
                  padding: '8px 10px'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderOpen size={15} />
                  <span>Evaluaciones Creadas</span>
                </span>
              </button>

              <button
                onClick={() => setVistaActiva('crear-evaluacion')}
                style={{
                  ...estiloBotonMenu(vistaActiva === 'crear-evaluacion'),
                  fontSize: '13px',
                  padding: '8px 10px'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FilePlus2 size={15} />
                  <span>Crear Evaluación</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Pie de barra lateral con perfil activo y botón cerrar sesión */}
      {!colapsado && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '999px',
                background: esAdmin ? '#dbeafe' : '#e2e8f0',
                color: esAdmin ? '#1d4ed8' : '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
                fontSize: '14px',
                flexShrink: 0
              }}
            >
              {(profesor?.nombre || 'P').charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {profesor?.nombre || 'Docente'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {esAdmin ? 'Admin / UTP' : 'Docente'} • {profesor?.asignatura || 'Matemática'}
              </div>
            </div>
          </div>

          <button
            onClick={onCerrarSesion}
            style={{
              width: '100%',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '7px',
              padding: '7px 10px',
              fontSize: '12.5px',
              fontWeight: '600',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      )}
    </aside>
  );
}
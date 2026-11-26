import React, { useState } from 'react';
import {
  Home, User, GraduationCap, FilePlus2,
  ChevronDown, ChevronRight, Menu, X, CheckSquare, Users, LogOut, Calendar
} from 'lucide-react';

const ETIQUETAS_ROL = {
  admin: 'Administrador',
  utp: 'UTP',
  jefe_depto: 'Jefe de Depto.',
  docente: 'Docente'
};

export default function Sidebar({
  vistaActiva,
  setVistaActiva,
  niveles,
  cursos,
  evaluaciones,
  nivelActivoId,
  setNivelActivoId,
  cursoActivoId,
  setCursoActivoId,
  onAbrirEvaluacion,
  profesor,
  permisos = {},
  onCerrarSesion,
  aniosDisponibles = [2026],
  anioEscolarActivo = 2026,
  onCambiarAnioEscolar
}) {
  const [colapsado, setColapsado] = useState(false);
  const [menuCursosAbierto, setMenuCursosAbierto] = useState(false);
  const [nivelesAbiertos, setNivelesAbiertos] = useState({});
  const [cursosAbiertos, setCursosAbiertos] = useState({});

  const toggleNivel = (e, nivelId) => {
    e.stopPropagation();
    setNivelesAbiertos((prev) => ({
      ...prev,
      [nivelId]: !prev[nivelId]
    }));
  };

  const toggleCurso = (e, cursoId) => {
    e.stopPropagation();
    setCursosAbiertos((prev) => ({
      ...prev,
      [cursoId]: !prev[cursoId]
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

  const puedeGestionarUsuarios = profesor?.rol === 'admin' || Boolean(permisos.gestionar_usuarios);
  const puedeConfigurarCursos = profesor?.rol === 'admin' || Boolean(permisos.configurar_cursos);
  const puedeCrearEvaluaciones = profesor?.rol === 'admin' || permisos.crear_evaluaciones !== false;
  const etiquetaRolActual = ETIQUETAS_ROL[profesor?.rol] || 'Docente';

  return (
    <aside
      style={{
        width: colapsado ? '68px' : '270px',
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
          <div
            onClick={() => setVistaActiva('inicio')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
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

      {/* Selector Global de Año Escolar */}
      {!colapsado && (
        <div
          style={{
            padding: '10px 14px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: '#1e3a8a' }}>
            <Calendar size={15} color="#2563eb" />
            Año Escolar:
          </span>

          <select
            value={anioEscolarActivo}
            onChange={(e) => onCambiarAnioEscolar && onCambiarAnioEscolar(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              borderRadius: '7px',
              border: '1px solid #93c5fd',
              background: '#ffffff',
              color: '#1e3a8a',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {aniosDisponibles.map((anio) => (
              <option key={anio} value={anio}>
                {anio}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Navegación */}
      <nav style={{ padding: '12px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        <button
          onClick={() => setVistaActiva('inicio')}
          style={estiloBotonMenu(vistaActiva === 'inicio')}
          title="Panel Principal"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Home size={18} />
            {!colapsado && <span>Inicio</span>}
          </span>
        </button>

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

        {puedeGestionarUsuarios && (
          <button
            onClick={() => setVistaActiva('usuarios')}
            style={estiloBotonMenu(vistaActiva === 'usuarios')}
            title="Administrar Cuentas y Roles"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={18} />
              {!colapsado && <span>Cuentas y Roles</span>}
            </span>
          </button>
        )}

        {/* Mis Cursos */}
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
            style={estiloBotonMenu(
              vistaActiva === 'visor-curso' ||
              vistaActiva === 'panel-nivel' ||
              vistaActiva === 'panel-curso' ||
              vistaActiva === 'detalle-evaluacion'
            )}
            title={`Mis Cursos (${anioEscolarActivo})`}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GraduationCap size={18} />
              {!colapsado && <span>Mis Cursos ({anioEscolarActivo})</span>}
            </span>
            {!colapsado && (menuCursosAbierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
          </button>

          {!colapsado && menuCursosAbierto && (
            <div style={{ paddingLeft: '10px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {puedeConfigurarCursos && (
                <button
                  onClick={() => {
                    setCursoActivoId('');
                    setVistaActiva('visor-curso');
                  }}
                  style={{
                    ...estiloBotonMenu(vistaActiva === 'visor-curso' && !cursoActivoId),
                    fontSize: '12.5px',
                    padding: '7px 10px',
                    color: '#475569'
                  }}
                >
                  <span>⚙️ Configurar Cursos y Año</span>
                </button>
              )}

              {niveles.map((nivel) => {
                const cursosDelNivel = cursos.filter((c) => c.nivel_id === nivel.id);
                const nivelAbierto = Boolean(nivelesAbiertos[nivel.id]);
                const esNivelSeleccionado = vistaActiva === 'panel-nivel' && nivelActivoId === nivel.id;

                return (
                  <div key={nivel.id} style={{ marginTop: '2px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: '6px',
                        background: esNivelSeleccionado ? '#eff6ff' : 'transparent'
                      }}
                    >
                      <button
                        onClick={() => {
                          setNivelActivoId(nivel.id);
                          setCursoActivoId('');
                          setVistaActiva('panel-nivel');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          border: 'none',
                          background: 'transparent',
                          color: esNivelSeleccionado ? '#1d4ed8' : '#334155',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          textAlign: 'left',
                          textTransform: 'uppercase'
                        }}
                      >
                        {nivel.nombre}
                      </button>
                      <button
                        onClick={(e) => toggleNivel(e, nivel.id)}
                        style={{
                          padding: '6px 8px',
                          border: 'none',
                          background: 'transparent',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {nivelAbierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </div>

                    {nivelAbierto && (
                      <div style={{ paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                        {cursosDelNivel.length === 0 ? (
                          <span style={{ fontSize: '11.5px', color: '#94a3b8', padding: '4px 8px' }}>
                            Sin cursos en {anioEscolarActivo}
                          </span>
                        ) : (
                          cursosDelNivel.map((curso) => {
                            const evalsDelCurso = evaluaciones.filter(
                              (ev) => ev.curso_id === curso.id || (!ev.curso_id && ev.nivel_id === nivel.id)
                            );
                            const cursoAbierto = Boolean(cursosAbiertos[curso.id]);
                            const esCursoSeleccionado = vistaActiva === 'panel-curso' && cursoActivoId === curso.id;

                            return (
                              <div key={curso.id}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    borderRadius: '6px',
                                    background: esCursoSeleccionado ? '#eff6ff' : 'transparent'
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      setNivelActivoId(nivel.id);
                                      setCursoActivoId(curso.id);
                                      setVistaActiva('panel-curso');
                                    }}
                                    style={{
                                      flex: 1,
                                      padding: '6px 8px',
                                      border: 'none',
                                      background: 'transparent',
                                      color: esCursoSeleccionado ? '#1d4ed8' : '#334155',
                                      fontSize: '13px',
                                      fontWeight: esCursoSeleccionado ? '700' : '500',
                                      cursor: 'pointer',
                                      textAlign: 'left'
                                    }}
                                  >
                                    {curso.nombre}
                                  </button>
                                  {evalsDelCurso.length > 0 && (
                                    <button
                                      onClick={(e) => toggleCurso(e, curso.id)}
                                      style={{
                                        padding: '5px 8px',
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                      }}
                                    >
                                      {cursoAbierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                    </button>
                                  )}
                                </div>

                                {cursoAbierto && evalsDelCurso.length > 0 && (
                                  <div style={{ paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', borderLeft: '1px solid #e2e8f0', marginLeft: '8px' }}>
                                    {evalsDelCurso.map((ev) => (
                                      <button
                                        key={`${curso.id}-${ev.id}`}
                                        onClick={() => onAbrirEvaluacion(ev, curso.id)}
                                        style={{
                                          padding: '5px 8px',
                                          border: 'none',
                                          borderRadius: '5px',
                                          background: 'transparent',
                                          color: '#475569',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                        }}
                                        title={ev.titulo}
                                      >
                                        - {ev.titulo}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Crear Evaluación */}
        {puedeCrearEvaluaciones && (
          <button
            onClick={() => setVistaActiva('crear-evaluacion')}
            style={{
              ...estiloBotonMenu(vistaActiva === 'crear-evaluacion'),
              marginTop: '6px',
              background: vistaActiva === 'crear-evaluacion' ? '#2563eb' : '#f1f5f9',
              color: vistaActiva === 'crear-evaluacion' ? '#ffffff' : '#0f172a',
              fontWeight: '700'
            }}
            title="Crear Nueva Evaluación"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FilePlus2 size={18} />
              {!colapsado && <span>Crear Evaluación</span>}
            </span>
          </button>
        )}
      </nav>

      {/* Pie de barra lateral */}
      {!colapsado && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '999px',
                background: profesor?.rol === 'admin' ? '#dbeafe' : profesor?.rol === 'utp' ? '#ede9fe' : profesor?.rol === 'jefe_depto' ? '#d1fae5' : '#e2e8f0',
                color: profesor?.rol === 'admin' ? '#1d4ed8' : profesor?.rol === 'utp' ? '#6d28d9' : profesor?.rol === 'jefe_depto' ? '#047857' : '#334155',
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
                {etiquetaRolActual} • {profesor?.asignatura || 'Matemática'}
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
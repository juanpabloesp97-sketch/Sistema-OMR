export const ROLES_META = [
  { id: 'admin', label: 'Administrador', color: '#1e3a8a', bg: '#dbeafe' },
  { id: 'utp', label: 'UTP', color: '#6d28d9', bg: '#ede9fe' },
  { id: 'jefe_depto', label: 'Jefe de Depto.', color: '#047857', bg: '#d1fae5' },
  { id: 'docente', label: 'Docente', color: '#334155', bg: '#f1f5f9' }
];

export const ROLES_LISTA = ROLES_META.map((r) => r.id);

export const PERMISOS_DEFAULT = {
  admin: {
    gestionar_usuarios: true,
    configurar_cursos: true,
    ver_todos_cursos: true,
    editar_nominas: true,
    eximir_estudiantes: true,
    crear_evaluaciones: true,
    ver_evals_colegio: true,
    ver_evals_depto: true,
    editar_evals_ajenas: true,
    escanear_hojas: true,
    corregir_manual_ajenas: true,
    descargar_reportes: true
  },
  utp: {
    gestionar_usuarios: false,
    configurar_cursos: false,
    ver_todos_cursos: true,
    editar_nominas: false,
    eximir_estudiantes: false,
    crear_evaluaciones: true,
    ver_evals_colegio: true,
    ver_evals_depto: true,
    editar_evals_ajenas: false,
    escanear_hojas: true,
    corregir_manual_ajenas: false,
    descargar_reportes: true
  },
  jefe_depto: {
    gestionar_usuarios: false,
    configurar_cursos: false,
    ver_todos_cursos: true,
    editar_nominas: true,
    eximir_estudiantes: true,
    crear_evaluaciones: true,
    ver_evals_colegio: false,
    ver_evals_depto: true,
    editar_evals_ajenas: false,
    escanear_hojas: true,
    corregir_manual_ajenas: false,
    descargar_reportes: true
  },
  docente: {
    gestionar_usuarios: false,
    configurar_cursos: false,
    ver_todos_cursos: false,
    editar_nominas: true,
    eximir_estudiantes: true,
    crear_evaluaciones: true,
    ver_evals_colegio: false,
    ver_evals_depto: false,
    editar_evals_ajenas: false,
    escanear_hojas: true,
    corregir_manual_ajenas: false,
    descargar_reportes: true
  }
};

export const MATRIZ_DEFECTO = PERMISOS_DEFAULT;

export const FILAS_PERMISOS = [
  { key: 'gestionar_usuarios', categoria: '1. Cuentas y Permisos', label: 'Crear/suspender cuentas y asignar roles/cursos' },
  { key: 'configurar_cursos', categoria: '2. Estructura y Nóminas', label: 'Crear o eliminar Niveles y Cursos del colegio' },
  { key: 'ver_todos_cursos', categoria: '2. Estructura y Nóminas', label: 'Ver todos los niveles y cursos (no solo los asignados)' },
  { key: 'editar_nominas', categoria: '2. Estructura y Nóminas', label: 'Subir Excel de estudiantes y agregar alumnos a listas' },
  { key: 'eximir_estudiantes', categoria: '2. Estructura y Nóminas', label: 'Eximir / deseximir estudiantes en evaluaciones' },
  { key: 'crear_evaluaciones', categoria: '3. Evaluaciones y Pautas', label: 'Crear evaluaciones propias y compartir/importar pautas' },
  { key: 'ver_evals_colegio', categoria: '3. Evaluaciones y Pautas', label: 'Supervisar evaluaciones de TODO el colegio (todas las asignaturas)' },
  { key: 'ver_evals_depto', categoria: '3. Evaluaciones y Pautas', label: 'Supervisar evaluaciones de su Departamento / Asignatura' },
  { key: 'editar_evals_ajenas', categoria: '3. Evaluaciones y Pautas', label: 'Editar pauta, escala, PDF o eliminar evaluaciones de otros' },
  { key: 'escanear_hojas', categoria: '4. Escaneo y Reportes', label: 'Imprimir hojas y escanear (cámara / PDF) en sus pruebas' },
  { key: 'corregir_manual_ajenas', categoria: '4. Escaneo y Reportes', label: 'Corregir lectura manual (P1–P30) o borrar escaneos en pruebas ajenas' },
  { key: 'descargar_reportes', categoria: '4. Escaneo y Reportes', label: 'Ver gráficos, visor de hoja escaneada y descargar Excel / PDFs' }
];

export function normalizarMatrizPermisos(parcial = {}) {
  const resultado = {};
  ROLES_LISTA.forEach((rolId) => {
    resultado[rolId] = {
      ...PERMISOS_DEFAULT[rolId],
      ...(parcial?.[rolId] || {})
    };
  });
  return resultado;
}

export function obtenerPermisosRol(matriz, rolId) {
  const normalizada = normalizarMatrizPermisos(matriz);
  return normalizada[rolId] || normalizada.docente;
}
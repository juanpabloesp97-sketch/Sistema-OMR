export const CATEGORIAS_PERMISOS = [
  {
    titulo: '1. Evaluaciones y Pautas',
    items: [
      { key: 'crear_evaluaciones', label: 'Crear evaluaciones' },
      { key: 'ver_evals_depto', label: 'Ver evaluaciones de otros en su departamento / asignatura' },
      { key: 'ver_evals_colegio', label: 'Ver evaluaciones de otros en todo el colegio' },
      { key: 'editar_evals_propias', label: 'Editar evaluaciones propias / de sus niveles asignados' },
      { key: 'editar_evals_depto', label: 'Editar evaluaciones de otros en su departamento' },
      { key: 'editar_evals_colegio', label: 'Editar evaluaciones de otros en todo el colegio' },
      { key: 'borrar_evals_propias', label: 'Borrar evaluaciones propias / de sus niveles asignados' },
      { key: 'borrar_evals_depto', label: 'Borrar evaluaciones de otros en su departamento' },
      { key: 'borrar_evals_colegio', label: 'Borrar evaluaciones de otros en todo el colegio' },
      { key: 'recalcular_notas_propias', label: 'Recalcular notas al editar pauta en pruebas propias' },
      { key: 'recalcular_notas_depto', label: 'Recalcular notas al editar pauta en pruebas del depto' },
      { key: 'recalcular_notas_colegio', label: 'Recalcular notas al editar pauta en pruebas del colegio' },
      { key: 'compartir_pautas', label: 'Compartir e importar pautas entre colegas' }
    ]
  },
  {
    titulo: '2. Escaneo de Hojas OMR',
    items: [
      { key: 'escanear_propias', label: 'Escanear hojas de respuesta en pruebas propias / de su aula' },
      { key: 'escanear_depto', label: 'Escanear hojas de respuesta en pruebas de otros del depto' },
      { key: 'escanear_colegio', label: 'Escanear hojas de respuesta en pruebas de todo el colegio' },
      { key: 'eliminar_escaneos_propias', label: 'Eliminar escaneos en pruebas propias / de su aula' },
      { key: 'eliminar_escaneos_depto', label: 'Eliminar escaneos en pruebas del depto' },
      { key: 'eliminar_escaneos_colegio', label: 'Eliminar escaneos en pruebas del colegio' }
    ]
  },
  {
    titulo: '3. Respuestas de Estudiantes',
    items: [
      { key: 'ver_respuestas_depto', label: 'Ver respuestas y hojas escaneadas de otros en el depto' },
      { key: 'ver_respuestas_colegio', label: 'Ver respuestas y hojas escaneadas de todo el colegio' },
      { key: 'editar_respuestas_propias', label: 'Editar respuestas de estudiantes en pruebas propias' },
      { key: 'editar_respuestas_depto', label: 'Editar respuestas de estudiantes en pruebas de otros del depto' },
      { key: 'editar_respuestas_colegio', label: 'Editar respuestas de estudiantes en todas las pruebas del colegio' }
    ]
  },
  {
    titulo: '4. Visor de Resultados y Reportes',
    items: [
      { key: 'ver_resultados_depto', label: 'Ver pruebas y resultados de otros en el depto' },
      { key: 'ver_resultados_colegio', label: 'Ver pruebas y resultados de toda la escuela' },
      { key: 'exportar_reportes_propias', label: 'Exportar reportes (PDF / Excel) de pruebas propias' },
      { key: 'exportar_reportes_depto', label: 'Exportar reportes (PDF / Excel) de pruebas del depto' },
      { key: 'exportar_reportes_colegio', label: 'Exportar reportes (PDF / Excel) de pruebas del colegio' }
    ]
  },
  {
    titulo: '5. Estructura Escolar y Nóminas',
    items: [
      { key: 'crear_niveles', label: 'Crear niveles escolares' },
      { key: 'crear_cursos', label: 'Crear cursos' },
      { key: 'ver_todos_cursos', label: 'Ver todos los niveles y cursos del colegio' },
      { key: 'agregar_estudiantes', label: 'Agregar estudiantes en cursos asignados' },
      { key: 'eliminar_estudiantes', label: 'Eliminar estudiantes en cursos asignados' },
      { key: 'eximir_estudiantes_propias', label: 'Eximir estudiantes en pruebas propias / de su aula' },
      { key: 'eximir_estudiantes_ajenas', label: 'Eximir estudiantes en pruebas de otros (depto / colegio)' }
    ]
  },
  {
    titulo: '6. Perfiles Docentes y Sistema',
    items: [
      { key: 'crear_perfiles', label: 'Crear perfiles docentes y asignar cursos' },
      { key: 'editar_perfiles', label: 'Editar perfiles docentes, roles y estado' },
      { key: 'gestionar_permisos', label: 'Configurar matriz de permisos por rol' }
    ]
  }
];

const generarPermisosRol = (listaActivos) => {
  const setActivos = new Set(listaActivos);
  const mapa = {};
  CATEGORIAS_PERMISOS.forEach((cat) => {
    cat.items.forEach((it) => {
      mapa[it.key] = setActivos.has(it.key);
    });
  });
  return mapa;
};

const TODAS_LAS_CLAVES = CATEGORIAS_PERMISOS.flatMap((c) => c.items.map((i) => i.key));

const CLAVES_DOCENTE = [
  'crear_evaluaciones',
  'editar_evals_propias',
  'borrar_evals_propias',
  'recalcular_notas_propias',
  'compartir_pautas',
  'escanear_propias',
  'eliminar_escaneos_propias',
  'editar_respuestas_propias',
  'exportar_reportes_propias',
  'agregar_estudiantes',
  'eliminar_estudiantes',
  'eximir_estudiantes_propias'
];

const CLAVES_JEFE_DEPTO = [
  ...CLAVES_DOCENTE,
  'ver_evals_depto',
  'editar_evals_depto',
  'borrar_evals_depto',
  'recalcular_notas_depto',
  'escanear_depto',
  'eliminar_escaneos_depto',
  'ver_respuestas_depto',
  'editar_respuestas_depto',
  'ver_resultados_depto',
  'exportar_reportes_depto',
  'ver_todos_cursos',
  'eximir_estudiantes_ajenas'
];

const CLAVES_UTP = [
  ...CLAVES_JEFE_DEPTO,
  'ver_evals_colegio',
  'editar_evals_colegio',
  'borrar_evals_colegio',
  'recalcular_notas_colegio',
  'escanear_colegio',
  'eliminar_escaneos_colegio',
  'ver_respuestas_colegio',
  'editar_respuestas_colegio',
  'ver_resultados_colegio',
  'exportar_reportes_colegio',
  'crear_niveles',
  'crear_cursos',
  'crear_perfiles',
  'editar_perfiles'
];

export const PERMISOS_RESPALDO = {
  admin: generarPermisosRol(TODAS_LAS_CLAVES),
  utp: generarPermisosRol(CLAVES_UTP),
  jefe_depto: generarPermisosRol(CLAVES_JEFE_DEPTO),
  docente: generarPermisosRol(CLAVES_DOCENTE)
};
import { obtenerOAsPorNivel as obtenerOAsMatematicaLegacy } from './oaMatematica';
import { OA_LENGUAJE } from './curriculo/oaLenguaje';
import { OA_CIENCIAS } from './curriculo/oaCiencias';
import { OA_HISTORIA } from './curriculo/oaHistoria';
import { OA_INGLES } from './curriculo/oaIngles';

export const ASIGNATURAS_POR_NIVEL = {
  basica_1_6: [
    'Matemática',
    'Lenguaje y Comunicación',
    'Ciencias Naturales',
    'Historia, Geografía y Ciencias Sociales',
    'Inglés'
  ],
  basica_7_8: [
    'Matemática',
    'Lengua y Literatura',
    'Ciencias Naturales',
    'Historia, Geografía y Ciencias Sociales',
    'Inglés'
  ],
  media_1_2: [
    'Matemática',
    'Lengua y Literatura',
    'Inglés',
    'Historia, Geografía y Ciencias Sociales',
    'Biología',
    'Física',
    'Química'
  ],
  media_3_4: [
    'Matemática',
    'Lengua y Literatura',
    'Inglés',
    'Educación Ciudadana',
    'Ciencias para la Ciudadanía'
  ]
};

export const TODAS_ASIGNATURAS_ESCRITAS = [
  'Matemática',
  'Lenguaje y Comunicación',
  'Lengua y Literatura',
  'Inglés',
  'Ciencias Naturales',
  'Biología',
  'Física',
  'Química',
  'Historia, Geografía y Ciencias Sociales',
  'Educación Ciudadana',
  'Ciencias para la Ciudadanía'
];

export function normalizarClaveNivel(nivelNombre = '') {
  const txt = String(nivelNombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!txt) return '';
  if (txt.includes('1') && txt.includes('bas')) return '1_basico';
  if (txt.includes('2') && txt.includes('bas')) return '2_basico';
  if (txt.includes('3') && txt.includes('bas')) return '3_basico';
  if (txt.includes('4') && txt.includes('bas')) return '4_basico';
  if (txt.includes('5') && txt.includes('bas')) return '5_basico';
  if (txt.includes('6') && txt.includes('bas')) return '6_basico';
  if (txt.includes('7') && txt.includes('bas')) return '7_basico';
  if (txt.includes('8') && txt.includes('bas')) return '8_basico';

  if ((txt.includes('1') || txt.includes('i ')) && txt.includes('med')) return '1_medio';
  if ((txt.includes('2') || txt.includes('ii')) && txt.includes('med')) return '2_medio';
  if ((txt.includes('3') || txt.includes('iii')) && txt.includes('med')) return '3_medio';
  if ((txt.includes('4') || txt.includes('iv')) && txt.includes('med')) return '4_medio';

  if (txt.startsWith('i ') || txt === 'i° medio' || txt === '1° medio') return '1_medio';
  if (txt.startsWith('ii') || txt === 'ii° medio' || txt === '2° medio') return '2_medio';
  if (txt.startsWith('iii') || txt === 'iii° medio' || txt === '3° medio') return '3_medio';
  if (txt.startsWith('iv') || txt === 'iv° medio' || txt === '4° medio') return '4_medio';

  return '';
}

export function obtenerAsignaturasPorNivel(nivelNombre = '') {
  const clave = normalizarClaveNivel(nivelNombre);
  if (['1_basico', '2_basico', '3_basico', '4_basico', '5_basico', '6_basico'].includes(clave)) {
    return ASIGNATURAS_POR_NIVEL.basica_1_6;
  }
  if (['7_basico', '8_basico'].includes(clave)) {
    return ASIGNATURAS_POR_NIVEL.basica_7_8;
  }
  if (['1_medio', '2_medio'].includes(clave)) {
    return ASIGNATURAS_POR_NIVEL.media_1_2;
  }
  if (['3_medio', '4_medio'].includes(clave)) {
    return ASIGNATURAS_POR_NIVEL.media_3_4;
  }
  return TODAS_ASIGNATURAS_ESCRITAS;
}

function normalizarClaveAsignatura(asignatura = '') {
  const txt = String(asignatura || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!txt || txt.includes('matem')) return 'matematica';
  if (txt.includes('lenguaje') || txt.includes('lengua') || txt.includes('literatura')) return 'lenguaje';
  if (txt.includes('ingles') || txt.includes('english')) return 'ingles';
  if (txt.includes('biolog')) return 'biologia';
  if (txt.includes('fisic')) return 'fisica';
  if (txt.includes('quimic')) return 'quimica';
  if (txt.includes('ciencia') && txt.includes('ciudadan')) return 'ciencias_ciudadania';
  if (txt.includes('ciencia')) return 'ciencias';
  if (txt.includes('ciudadan')) return 'educacion_ciudadana';
  if (txt.includes('historia') || txt.includes('geograf')) return 'historia';
  return 'otra';
}

const OA_MATEMATICA_MEDIA = {
  '1_medio': [
    { codigo: 'OA 1', descripcion: 'Calcular operaciones con números racionales en forma simbólica.' },
    { codigo: 'OA 2', descripcion: 'Mostrar que comprenden las potencias de base racional y exponente entero.' },
    { codigo: 'OA 3', descripcion: 'Desarrollar los productos notables de manera concreta, pictórica y simbólica.' },
    { codigo: 'OA 4', descripcion: 'Resolver sistemas de ecuaciones lineales (2x2) relacionados con problemas de la vida diaria y de otras asignaturas.' },
    { codigo: 'OA 5', descripcion: 'Graficar relaciones lineales en dos variables de la forma f(x, y) = ax + by.' },
    { codigo: 'OA 6', descripcion: 'Desarrollar la fórmula de los valores del área y del perímetro de sectores y segmentos circulares.' },
    { codigo: 'OA 7', descripcion: 'Desarrollar las fórmulas para encontrar el área de la superficie y el volumen del cono.' },
    { codigo: 'OA 8', descripcion: 'Mostrar que comprenden el concepto de homotecia relacionándola con la perspectiva, el funcionamiento de instrumentos ópticos y el ojo humano.' },
    { codigo: 'OA 9', descripcion: 'Desarrollar el teorema de Tales mediante las propiedades de la homotecia, para aplicarlo en la resolución de problemas.' },
    { codigo: 'OA 10', descripcion: 'Aplicar propiedades de semejanza y de proporcionalidad a modelos a escala y otras situaciones de la vida diaria y otras asignaturas.' },
    { codigo: 'OA 11', descripcion: 'Representar el concepto de homotecia de forma vectorial, relacionándolo con el producto de un vector por un escalar.' },
    { codigo: 'OA 12', descripcion: 'Registrar distribuciones de dos características distintas, de una misma población, en una tabla de doble entrada y en una nube de puntos.' },
    { codigo: 'OA 13', descripcion: 'Comparar poblaciones mediante la confección de gráficos "xy" para dos atributos de muestras, de manera concreta y pictórica.' },
    { codigo: 'OA 14', descripcion: 'Desarrollar las reglas de las probabilidades, la regla aditiva, la regla multiplicativa y la combinación de ambas.' },
    { codigo: 'OA 15', descripcion: 'Mostrar que comprenden el concepto de azar experimentando con la tabla de Galton y paseos aleatorios sencillos.' }
  ],
  '2_medio': [
    { codigo: 'OA 1', descripcion: 'Realizar cálculos y estimaciones que involucren operaciones con números reales.' },
    { codigo: 'OA 2', descripcion: 'Mostrar que comprenden las relaciones entre potencias, raíces enésimas y logaritmos.' },
    { codigo: 'OA 3', descripcion: 'Mostrar que comprenden la función cuadrática f(x)= ax² + bx + c (a ≠ 0).' },
    { codigo: 'OA 4', descripcion: 'Resolver, de manera concreta, pictórica y simbólica o usando herramientas tecnológicas, ecuaciones cuadráticas.' },
    { codigo: 'OA 5', descripcion: 'Mostrar que comprenden la inversa de una función utilizando la metáfora de una máquina.' },
    { codigo: 'OA 6', descripcion: 'Explicar el cambio porcentual constante en intervalos de tiempo por medio de situaciones de la vida real y de otras asignaturas.' },
    { codigo: 'OA 7', descripcion: 'Desarrollar las fórmulas del área de la superficie y del volumen de la esfera.' },
    { codigo: 'OA 8', descripcion: 'Mostrar que comprenden las razones trigonométricas de seno, coseno y tangente en triángulos rectángulos.' },
    { codigo: 'OA 9', descripcion: 'Aplicar las razones trigonométricas en diversos contextos en la resolución de problemas.' },
    { codigo: 'OA 10', descripcion: 'Mostrar que comprenden las variables aleatorias finitas.' },
    { codigo: 'OA 11', descripcion: 'Utilizar permutaciones y la combinatoria sencilla para calcular probabilidades de eventos y resolver problemas.' },
    { codigo: 'OA 12', descripcion: 'Mostrar que comprenden el rol de la probabilidad en la sociedad.' }
  ],
  '3_medio': [
    { codigo: 'OA 1', descripcion: 'Resolver problemas de situaciones cotidianas y otras asignaturas, que impliquen el uso de medidas de dispersión y toma de decisiones.' },
    { codigo: 'OA 2', descripcion: 'Tomar decisiones en situaciones de incerteza que involucren el análisis de datos estadísticos con medidas de dispersión y probabilidades condicionales.' },
    { codigo: 'OA 3', descripcion: 'Aplicar modelos matemáticos que describen fenómenos o situaciones de crecimiento y decrecimiento, que involucran las funciones exponencial y logarítmica.' },
    { codigo: 'OA 4', descripcion: 'Resolver problemas de geometría euclidiana que involucran relaciones métricas entre ángulos, arcos, cuerdas y secantes en la circunferencia.' }
  ],
  '4_medio': [
    { codigo: 'OA 1', descripcion: 'Fundamentar decisiones en el ámbito financiero y económico personal o comunitario, a partir de modelos que consideren porcentajes, tasas de interés e índices económicos.' },
    { codigo: 'OA 2', descripcion: 'Fundamentar decisiones en situaciones de incerteza, a partir del análisis crítico de datos estadísticos y con base en los modelos binomial y normal.' },
    { codigo: 'OA 3', descripcion: 'Construir modelos de situaciones o fenómenos de crecimiento, decrecimiento y periodicidad que involucran funciones potencias de exponente entero y trigonométricas.' },
    { codigo: 'OA 4', descripcion: 'Resolver problemas acerca de rectas y circunferencias en el plano, mediante su representación analítica.' }
  ]
};

const CATALOGO_COMPLETO = {
  matematica: OA_MATEMATICA_MEDIA,
  lenguaje: OA_LENGUAJE,
  ingles: OA_INGLES,
  ciencias: OA_CIENCIAS.ciencias,
  biologia: OA_CIENCIAS.biologia,
  fisica: OA_CIENCIAS.fisica,
  quimica: OA_CIENCIAS.quimica,
  ciencias_ciudadania: OA_CIENCIAS.ciencias_ciudadania,
  historia: OA_HISTORIA.historia,
  educacion_ciudadana: OA_HISTORIA.educacion_ciudadana
};

export function obtenerOAsPorAsignaturaYNivel(asignatura = 'Matemática', nivelNombre = '') {
  const claveAsig = normalizarClaveAsignatura(asignatura);
  const claveNivel = normalizarClaveNivel(nivelNombre);

  if (claveAsig === 'matematica') {
    const legacy = obtenerOAsMatematicaLegacy(nivelNombre);
    if (Array.isArray(legacy) && legacy.length > 0) return legacy;
  }

  if (!claveNivel) return [];
  const mapaAsig = CATALOGO_COMPLETO[claveAsig];
  if (!mapaAsig) return [];

  return mapaAsig[claveNivel] || [];
}
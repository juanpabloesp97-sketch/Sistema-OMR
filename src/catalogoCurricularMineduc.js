import { obtenerOAsPorNivel as obtenerOAsMatematicaLegacy } from './oaMatematica';

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

const CATALOGO_OA = {
  matematica: {
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
      { codigo: 'OA 3', descripcion: 'Construir modelos de situaciones o fenómenos de crecimiento, decrecimiento y periodicidad que involucren funciones potencias de exponente entero y trigonométricas.' },
      { codigo: 'OA 4', descripcion: 'Resolver problemas acerca de rectas y circunferencias en el plano, mediante su representación analítica.' }
    ]
  },

  lenguaje: {
    '1_basico': [
      { codigo: 'OA 3', descripcion: 'Identificar los sonidos que componen las palabras (conciencia fonológica), reconociendo, separando y combinando sus fonemas y sílabas.' },
      { codigo: 'OA 4', descripcion: 'Leer palabras aisladas y en contexto, aplicando su conocimiento de la correspondencia letra-sonido en diferentes combinaciones.' },
      { codigo: 'OA 5', descripcion: 'Leer textos breves en voz alta para adquirir fluidez pronunciando cada palabra con precisión.' },
      { codigo: 'OA 8', descripcion: 'Demostrar comprensión de narraciones que aborden temas que les sean familiares, extrayendo información explícita e implícita.' },
      { codigo: 'OA 10', descripcion: 'Leer independientemente y comprender textos no literarios escritos con oraciones simples (cartas, notas, instrucciones y artículos informativos).' },
      { codigo: 'OA 13', descripcion: 'Experimentar con la escritura para comunicar hechos, ideas y sentimientos, entre otros.' }
    ],
    '2_basico': [
      { codigo: 'OA 2', descripcion: 'Leer en voz alta para adquirir fluidez pronunciando cada palabra con precisión y respetando el punto seguido y el punto aparte.' },
      { codigo: 'OA 5', descripcion: 'Demostrar comprensión de las narraciones leídas extrayendo información explícita e implícita y reconstruyendo la secuencia de las acciones.' },
      { codigo: 'OA 7', descripcion: 'Leer independientemente y comprender textos no literarios (cartas, notas, instrucciones y artículos informativos) para entretenerse y ampliar su conocimiento.' },
      { codigo: 'OA 12', descripcion: 'Escribir frecuentemente, para desarrollar la creatividad y expresar sus ideas, textos como poemas, diarios de vida, anécdotas, cartas y recados.' },
      { codigo: 'OA 17', descripcion: 'Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad.' }
    ],
    '3_basico': [
      { codigo: 'OA 2', descripcion: 'Comprender textos aplicando estrategias de comprensión lectora (relacionar información, visualizar, recapitular, formular preguntas).' },
      { codigo: 'OA 4', descripcion: 'Profundizar su comprensión de las narraciones leídas extrayendo información explícita e implícita y determinando consecuencias de hechos.' },
      { codigo: 'OA 6', descripcion: 'Leer independientemente y comprender textos no literarios (cartas, biografías, relatos históricos, instrucciones, libros y artículos informativos).' },
      { codigo: 'OA 12', descripcion: 'Escribir frecuentemente para desarrollar la creatividad y expresar sus ideas (poemas, diarios de vida, cuentos, anécdotas, cartas).' },
      { codigo: 'OA 18', descripcion: 'Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad, cuidando la ortografía y concordancia.' }
    ],
    '4_basico': [
      { codigo: 'OA 2', descripcion: 'Comprender textos aplicando estrategias de comprensión lectora (relacionar información con conocimientos previos, formular preguntas, subrayar).' },
      { codigo: 'OA 4', descripcion: 'Profundizar su comprensión de las narraciones leídas extrayendo información explícita e implícita, describiendo ambientes y comparando personajes.' },
      { codigo: 'OA 6', descripcion: 'Leer independientemente y comprender textos no literarios para ampliar su conocimiento del mundo y formarse una opinión.' },
      { codigo: 'OA 11', descripcion: 'Escribir frecuentemente para desarrollar la creatividad y expresar sus ideas, textos como poemas, diarios de vida, cuentos, anécdotas y cartas.' },
      { codigo: 'OA 17', descripcion: 'Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad, empleando conectores y vocabulario variado.' }
    ],
    '5_basico': [
      { codigo: 'OA 3', descripcion: 'Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo, desarrollar su imaginación y reconocer su valor social y cultural.' },
      { codigo: 'OA 4', descripcion: 'Analizar aspectos relevantes de narraciones leídas para profundizar su comprensión, interpretando el lenguaje figurado y acciones de personajes.' },
      { codigo: 'OA 6', descripcion: 'Leer independientemente y comprender textos no literarios (cartas, biografías, relatos históricos, libros y artículos informativos, noticias).' },
      { codigo: 'OA 14', descripcion: 'Escribir creativamente narraciones (relatos de experiencias personales, noticias, cuentos, etc.) que tengan una estructura clara y utilicen conectores adecuados.' },
      { codigo: 'OA 18', descripcion: 'Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad, aplicando reglas ortográficas y gramaticales.' }
    ],
    '6_basico': [
      { codigo: 'OA 3', descripcion: 'Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo y desarrollar su imaginación.' },
      { codigo: 'OA 4', descripcion: 'Analizar aspectos relevantes de las narraciones leídas para profundizar su comprensión, identificando acciones principales, motivaciones y ambiente.' },
      { codigo: 'OA 6', descripcion: 'Leer independientemente y comprender textos no literarios para ampliar su conocimiento del mundo y formarse una opinión, extrayendo información explícita e implícita.' },
      { codigo: 'OA 14', descripcion: 'Escribir creativamente narraciones que incluyan una secuencia lógica de eventos, inicio, desarrollo y desenlace, y descripciones expresivas.' },
      { codigo: 'OA 18', descripcion: 'Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad.' }
    ],
    '7_basico': [
      { codigo: 'OA 3', descripcion: 'Analizar las narraciones leídas para enriquecer su comprensión, considerando conflictos, personajes tipo, narrador y contexto sociocultural.' },
      { codigo: 'OA 7', descripcion: 'Formular una interpretación de los textos literarios, considerando su experiencia personal y conocimientos, un dilema presentado y la relación con el contexto.' },
      { codigo: 'OA 8', descripcion: 'Analizar y evaluar textos con finalidad argumentativa como columnas de opinión, cartas y discursos, considerando postura, argumentos y recursos.' },
      { codigo: 'OA 9', descripcion: 'Analizar y evaluar textos de los medios de comunicación, como noticias, reportajes, cartas al director, textos publicitarios o de las redes sociales.' },
      { codigo: 'OA 15', descripcion: 'Planificar, escribir, revisar, reescribir y editar sus textos en función del contexto, el destinatario y el propósito.' }
    ],
    '8_basico': [
      { codigo: 'OA 3', descripcion: 'Analizar las narraciones leídas para enriquecer su comprensión, considerando el o los conflictos de la historia, personajes, narrador y disposición temporal.' },
      { codigo: 'OA 4', descripcion: 'Analizar los poemas leídos para enriquecer su comprensión, considerando cómo el lenguaje poético apela a los sentidos, sugiere estados de ánimo y crea imágenes.' },
      { codigo: 'OA 8', descripcion: 'Formular una interpretación de los textos literarios leídos o vistos, que sea coherente con su análisis, considerando hipótesis sobre el sentido de la obra.' },
      { codigo: 'OA 9', descripcion: 'Analizar y evaluar textos con finalidad argumentativa como columnas de opinión, cartas y discursos, identificando tesis, argumentos y contraargumentos.' },
      { codigo: 'OA 16', descripcion: 'Planificar, escribir, revisar, reescribir y editar sus textos en función del contexto, el destinatario y el propósito.' }
    ],
    '1_medio': [
      { codigo: 'OA 3', descripcion: 'Analizar las narraciones leídas para enriquecer su comprensión, considerando la evolución de los personajes, relaciones intertextuales y perspectiva del narrador.' },
      { codigo: 'OA 4', descripcion: 'Analizar los textos dramáticos leídos o vistos, para enriquecer su comprensión, considerando el conflicto dramático, personajes y visión de mundo.' },
      { codigo: 'OA 8', descripcion: 'Formular una interpretación de los textos literarios leídos o vistos, que sea coherente con su análisis, considerando la visión de mundo y contexto histórico.' },
      { codigo: 'OA 9', descripcion: 'Analizar y evaluar textos con finalidad argumentativa, distinguiendo hechos de opiniones, evaluando la validez de argumentos y recursos persuasivos.' },
      { codigo: 'OA 15', descripcion: 'Planificar, escribir, revisar, reescribir y editar sus textos en función del contexto, el destinatario y el propósito.' }
    ],
    '2_medio': [
      { codigo: 'OA 3', descripcion: 'Analizar las narraciones leídas para enriquecer su comprensión, considerando el efecto estético de los recursos narrativos, símbolos y motivos literarios.' },
      { codigo: 'OA 4', descripcion: 'Analizar los poemas leídos para enriquecer su comprensión, considerando el uso del lenguaje figurado, ritmo, sonoridad y visión de mundo.' },
      { codigo: 'OA 8', descripcion: 'Formular una interpretación de los textos literarios leídos o vistos, que sea coherente con su análisis, relacionando la obra con su contexto de producción y recepción.' },
      { codigo: 'OA 9', descripcion: 'Analizar y evaluar textos con finalidad argumentativa, evaluando la consistencia del razonamiento, falacias argumentativas y recursos retóricos.' },
      { codigo: 'OA 15', descripcion: 'Planificar, escribir, revisar, reescribir y editar sus textos en función del contexto, el destinatario y el propósito.' }
    ],
    '3_medio': [
      { codigo: 'OA 1', descripcion: 'Formular interpretaciones surgidas de sus análisis literarios, considerando la contribución de los recursos literarios a la construcción del sentido de la obra.' },
      { codigo: 'OA 2', descripcion: 'Reflexionar sobre el efecto estético de las obras leídas, evaluando cómo la obra dialoga con las experiencias personales y puntos de vista propios.' },
      { codigo: 'OA 3', descripcion: 'Analizar críticamente textos de diversos géneros discursivos no literarios orales, escritos y audiovisuales, evaluando posturas, sesgos e ideologías.' },
      { codigo: 'OA 6', descripcion: 'Producir textos (orales, escritos o audiovisuales) coherentes y cohesionados para comunicar sus análisis e interpretaciones de textos, desarrollar posturas y explorar creativamente.' }
    ],
    '4_medio': [
      { codigo: 'OA 1', descripcion: 'Formular interpretaciones de obras que aborden un mismo tema o problema, comparando la relación de cada obra con sus contextos de producción y recepción.' },
      { codigo: 'OA 2', descripcion: 'Proponer distintas perspectivas de lectura sobre una obra literaria a partir de criterios estéticos, históricos, culturales o teóricos.' },
      { codigo: 'OA 3', descripcion: 'Evaluar críticamente textos de diversos géneros no literarios (orales, escritos y audiovisuales), analizando estrategias argumentativas, validez y confiabilidad.' },
      { codigo: 'OA 6', descripcion: 'Producir textos coherentes y cohesionados para comunicar sus análisis e interpretaciones de textos, desarrollar posturas fundamentadas y explorar creativamente.' }
    ]
  },

  ingles: {
    '1_basico': [
      { codigo: 'OA 1', descripcion: 'Comprender textos leídos por un adulto o en formato audiovisual, breves y simples, como rimas, chants, canciones y cuentos.' },
      { codigo: 'OA 5', descripcion: 'Reaccionar a lo escuchado, estableciendo relaciones con experiencias personales y/o expresando preferencias, sentimientos u opiniones.' },
      { codigo: 'OA 10', descripcion: 'Reproducir chants, rimas y canciones muy breves y simples para familiarizarse con los sonidos propios del inglés.' }
    ],
    '2_basico': [
      { codigo: 'OA 1', descripcion: 'Comprender textos leídos por un adulto o en formato audiovisual, breves y simples, reconociendo vocabulario temático y expresiones de uso frecuente.' },
      { codigo: 'OA 6', descripcion: 'Leer y demostrar comprensión de textos como cuentos, rimas, chants, tarjetas de saludo, instrucciones y textos informativos, identificando ideas generales.' },
      { codigo: 'OA 12', descripcion: 'Participar en interacciones de la clase y exposiciones muy breves y simples acerca de temas conocidos o de otras asignaturas.' }
    ],
    '3_basico': [
      { codigo: 'OA 1', descripcion: 'Comprender textos leídos por un adulto o en formato audiovisual, breves y simples, identificando propósito, personajes, acciones y lugares.' },
      { codigo: 'OA 6', descripcion: 'Leer y demostrar comprensión de textos como cuentos, rimas, chants, instrucciones y textos informativos, identificando ideas generales e información explícita.' },
      { codigo: 'OA 13', descripcion: 'Escribir (por ejemplo: copiar o completar) palabras y oraciones simples de acuerdo a un modelo, acerca de temas conocidos o de otras asignaturas.' }
    ],
    '4_basico': [
      { codigo: 'OA 1', descripcion: 'Comprender textos leídos por un adulto o en formato audiovisual, breves y simples, identificando ideas generales e información específica.' },
      { codigo: 'OA 6', descripcion: 'Leer y demostrar comprensión de textos como cuentos, poemas, chants, cartas, invitaciones, menús, recetas, instrucciones, emails y textos informativos.' },
      { codigo: 'OA 14', descripcion: 'Escribir, sobre la base de imágenes, para identificar animales, acciones, objetos y partes de la casa, ocupaciones, lugares, comida y describir brevemente.' }
    ],
    '5_basico': [
      { codigo: 'OA 1', descripcion: 'Escuchar y demostrar comprensión de información explícita en textos adaptados y auténticos simples, tanto no literarios como literarios.' },
      { codigo: 'OA 5', descripcion: 'Leer y demostrar comprensión de textos adaptados y auténticos simples no literarios, que contengan palabras de uso frecuente, familias de palabras y repetición.' },
      { codigo: 'OA 9', descripcion: 'Usar el conocimiento del inglés en la comprensión y producción de textos breves y claros, con el fin de construir una postura personal crítica.' },
      { codigo: 'OA 14', descripcion: 'Completar y escribir, de acuerdo a un modelo y con apoyo de lenguaje visual, textos no literarios y textos literarios con el propósito de compartir información.' }
    ],
    '6_basico': [
      { codigo: 'OA 1', descripcion: 'Escuchar y demostrar comprensión de información explícita en textos adaptados y auténticos simples, identificando tema, ideas generales y detalles específicos.' },
      { codigo: 'OA 5', descripcion: 'Leer y demostrar comprensión de textos adaptados y auténticos simples no literarios y literarios, identificando ideas principales, secuencia y vocabulario.' },
      { codigo: 'OA 12', descripcion: 'Participar en diálogos con pares y profesores al realizar funciones comunicativas como saludar, describir, expresar preferencias y pedir información.' },
      { codigo: 'OA 14', descripcion: 'Escribir, de acuerdo a un modelo y con apoyo de lenguaje visual, textos no literarios y literarios para compartir información en torno a los temas del año.' }
    ],
    '7_basico': [
      { codigo: 'OA 1', descripcion: 'Demostrar comprensión de ideas generales e información explícita en textos orales adaptados y auténticos simples, literarios y no literarios.' },
      { codigo: 'OA 8', descripcion: 'Demostrar conocimiento y uso del lenguaje en conversaciones, discusiones y exposiciones por medio de estructuras gramaticales y vocabulario del nivel.' },
      { codigo: 'OA 9', descripcion: 'Demostrar comprensión de ideas generales e información explícita en textos adaptados y auténticos simples, en formato impreso o digital.' },
      { codigo: 'OA 14', descripcion: 'Escribir una variedad de textos breves, como cuentos, correos electrónicos, folletos, rimas, descripciones, utilizando los pasos del proceso de escritura.' }
    ],
    '8_basico': [
      { codigo: 'OA 1', descripcion: 'Demostrar comprensión de ideas generales e información explícita en textos orales adaptados y auténticos simples, literarios y no literarios.' },
      { codigo: 'OA 9', descripcion: 'Demostrar comprensión de ideas generales e información explícita en textos adaptados y auténticos simples, en formato impreso o digital, acerca de temas variados.' },
      { codigo: 'OA 12', descripcion: 'Identificar y usar estrategias para apoyar la comprensión de los textos leídos (skimming, scanning, hacer predicciones, inferir por contexto).' },
      { codigo: 'OA 14', descripcion: 'Escribir una variedad de textos breves, como cuentos, correos electrónicos, folletos, descripciones, biografías, instrucciones y resúmenes.' }
    ],
    '1_medio': [
      { codigo: 'OA 1', descripcion: 'Demostrar comprensión de ideas generales e información explícita en textos orales adaptados y auténticos simples, literarios y no literarios.' },
      { codigo: 'OA 9', descripcion: 'Demostrar comprensión de ideas generales e información explícita en textos adaptados y auténticos simples, en formato impreso o digital, acerca de temas variados.' },
      { codigo: 'OA 11', descripcion: 'Demostrar comprensión de textos literarios (como canciones o poemas, tiras cómicas, cuentos breves y novelas adaptadas) identificando temas y personajes.' },
      { codigo: 'OA 14', descripcion: 'Escribir una variedad de textos, como cuentos, correos electrónicos, artículos, folletos, rimas, descripciones, biografías, instrucciones, cartas y resúmenes.' }
    ],
    '2_medio': [
      { codigo: 'OA 1', descripcion: 'Demostrar comprensión de ideas generales e información explícita en textos orales adaptados y auténticos simples, literarios y no literarios.' },
      { codigo: 'OA 9', descripcion: 'Demostrar comprensión de ideas generales e información explícita en textos adaptados y auténticos simples, en formato impreso o digital, acerca de temas variados.' },
      { codigo: 'OA 12', descripcion: 'Seleccionar y usar estrategias para apoyar la comprensión de los textos leídos (prelectura, lectura rápida, focalizada y poslectura).' },
      { codigo: 'OA 14', descripcion: 'Escribir una variedad de textos, como cuentos, correos electrónicos, artículos, folletos, descripciones, biografías, cartas, resúmenes y ensayos breves.' }
    ],
    '3_medio': [
      { codigo: 'OA 1', descripcion: 'Comprender información central de textos orales y escritos en contextos relacionados con sus intereses e inquietudes, con el fin de conocer las maneras en que otras culturas abordan dichos contextos.' },
      { codigo: 'OA 2', descripcion: 'Producir textos orales y escritos claros en contextos relacionados con sus intereses e inquietudes, con el fin de expresar una postura personal crítica.' },
      { codigo: 'OA 3', descripcion: 'Utilizar su conocimiento del inglés en la comprensión y producción de textos orales y escritos breves y claros, con el fin de construir una postura personal crítica.' },
      { codigo: 'OA 4', descripcion: 'Producir y comprender con fluidez textos orales y escritos breves y claros en situaciones comunicativas que involucren otras visiones de mundo y la propia.' }
    ],
    '4_medio': [
      { codigo: 'OA 1', descripcion: 'Comprender información central de textos orales y escritos en contextos relacionados con sus intereses e inquietudes, evaluando diversas perspectivas culturales.' },
      { codigo: 'OA 2', descripcion: 'Producir textos orales y escritos claros en contextos relacionados con sus intereses e inquietudes, argumentando una postura personal fundamentada.' },
      { codigo: 'OA 3', descripcion: 'Utilizar su conocimiento del inglés en la comprensión y producción de textos orales y escritos claros y cohesionados en contextos académicos y ciudadanos.' },
      { codigo: 'OA 4', descripcion: 'Producir y comprender con fluidez textos orales y escritos en situaciones comunicativas complejas que involucren intercambio intercultural y pensamiento crítico.' }
    ]
  },

  ciencias: {
    '1_basico': [
      { codigo: 'OA 1', descripcion: 'Reconocer y observar, por medio de la exploración, que los seres vivos crecen, responden a estímulos del medio, se reproducen y necesitan agua, alimento y aire.' },
      { codigo: 'OA 6', descripcion: 'Identificar y describir la ubicación y la función de los sentidos proponiendo medidas para protegerlos y para prevenir situaciones de riesgo.' },
      { codigo: 'OA 8', descripcion: 'Explorar y describir los diferentes tipos de materiales en diversos objetos, clasificándolos según sus propiedades (goma-flexible, plástico-impermeable, etc.).' },
      { codigo: 'OA 11', descripcion: 'Describir y registrar el ciclo diario y las diferencias entre el día y la noche, a partir de la observación del Sol, la Luna, las estrellas y la luminosidad.' }
    ],
    '2_basico': [
      { codigo: 'OA 1', descripcion: 'Observar, describir y clasificar los vertebrados en mamíferos, aves, reptiles, anfibios y peces, a partir de características como cubierta corporal y presencia de mamas.' },
      { codigo: 'OA 3', descripcion: 'Observar y comparar las características de las etapas del ciclo de vida de distintos animales (mamíferos, aves, insectos y anfibios).' },
      { codigo: 'OA 7', descripcion: 'Identificar la ubicación y explicar la función de algunas partes del cuerpo que son fundamentales para vivir: corazón, pulmones, estómago, esqueleto y músculos.' },
      { codigo: 'OA 9', descripcion: 'Observar y describir, por medio de la investigación experimental, algunas características del agua (escurrir, adaptarse a la forma del recipiente, disolver).' }
    ],
    '3_basico': [
      { codigo: 'OA 1', descripcion: 'Observar y describir, por medio de la investigación experimental, las necesidades de las plantas y su relación con la raíz, el tallo y las hojas.' },
      { codigo: 'OA 6', descripcion: 'Clasificar los alimentos, distinguiendo sus efectos sobre la salud y proponer hábitos alimenticios saludables.' },
      { codigo: 'OA 8', descripcion: 'Distinguir fuentes naturales y artificiales de luz, como el Sol, las ampolletas y el fuego, entre otras.' },
      { codigo: 'OA 11', descripcion: 'Describir las características de algunos de los componentes del Sistema Solar (Sol, planetas, lunas, cometas y asteroides) en relación con su tamaño y ubicación.' }
    ],
    '4_basico': [
      { codigo: 'OA 1', descripcion: 'Reconocer, por medio de la exploración, que un ecosistema está compuesto por elementos vivos (animales, plantas, etc.) y no vivos (piedras, agua, tierra, etc.).' },
      { codigo: 'OA 5', descripcion: 'Identificar y describir, usando modelos, estructuras del sistema esquelético y algunas de sus funciones como protección, soporte y movimiento.' },
      { codigo: 'OA 9', descripcion: 'Demostrar, por medio de la investigación experimental, que la materia tiene masa y ocupa espacio, usando materiales del entorno.' },
      { codigo: 'OA 12', descripcion: 'Demostrar, por medio de la investigación experimental, los efectos de la aplicación de fuerzas sobre objetos, considerando cambios en la forma, la rapidez y la dirección.' }
    ],
    '5_basico': [
      { codigo: 'OA 1', descripcion: 'Reconocer y explicar que los seres vivos están formados por una o más células y que estas se organizan en tejidos, órganos y sistemas.' },
      { codigo: 'OA 2', descripcion: 'Identificar y describir por medio de modelos las estructuras básicas del sistema digestivo y sus funciones en la digestión, la absorción y la eliminación.' },
      { codigo: 'OA 4', descripcion: 'Explicar la función de transporte del sistema circulatorio (sustancias alimenticias, oxígeno y dióxido de carbono), identificando sus estructuras básicas.' },
      { codigo: 'OA 12', descripcion: 'Describir la distribución del agua dulce y salada en la Tierra, considerando océanos, glaciares, ríos y lagos, aguas subterráneas, nubes y vapor de agua.' }
    ],
    '6_basico': [
      { codigo: 'OA 1', descripcion: 'Explicar, a partir de una investigación experimental, los requerimientos de agua, dióxido de carbono y energía lumínica para la producción de azúcar y liberación de oxígeno en la fotosíntesis.' },
      { codigo: 'OA 4', descripcion: 'Identificar y describir las funciones de las principales estructuras del sistema reproductor humano femenino y masculino.' },
      { codigo: 'OA 8', descripcion: 'Explicar que la energía es necesaria para que los objetos cambien y los seres vivos realicen sus procesos vitales y que la mayoría de los recursos energéticos proviene del Sol.' },
      { codigo: 'OA 16', descripcion: 'Describir las características de las capas de la Tierra (atmósfera, litósfera e hidrósfera) que posibilitan el desarrollo de la vida y proveen recursos.' }
    ],
    '7_basico': [
      { codigo: 'OA 2', descripcion: 'Explicar la formación de un nuevo individuo, considerando el ciclo menstrual, la participación de espermatozoides y ovocitos, y métodos de control de la natalidad.' },
      { codigo: 'OA 5', descripcion: 'Comparar, usando modelos, microorganismos como virus, bacterias y hongos, en relación con características estructurales y efectos sobre la salud humana.' },
      { codigo: 'OA 7', descripcion: 'Planificar y conducir una investigación experimental para proveer evidencias que expliquen los efectos de las fuerzas gravitacional, de roce y elástica.' },
      { codigo: 'OA 14', descripcion: 'Investigar experimentalmente y explicar la clasificación de la materia en sustancias puras y mezclas (homogéneas y heterogéneas) y procedimientos de separación.' }
    ],
    '8_basico': [
      { codigo: 'OA 1', descripcion: 'Explicar que los modelos de la célula han evolucionado sobre la base de evidencias, como las aportadas por científicos como Hooke, Leeuwenhoek, Virchow, Schleiden y Schwann.' },
      { codigo: 'OA 2', descripcion: 'Desarrollar modelos que expliquen la relación entre la función de una célula y sus partes, considerando sus estructuras (núcleo, citoplasma, membrana, pared, cloroplastos, mitocondrias).' },
      { codigo: 'OA 8', descripcion: 'Analizar las fuerzas eléctricas, considerando los tipos de electricidad, métodos de electrización y construcción de circuitos eléctricos simples.' },
      { codigo: 'OA 12', descripcion: 'Investigar y analizar cómo ha evolucionado el conocimiento de la constitución de la materia, considerando los aportes de Dalton, Thomson, Rutherford y Bohr.' }
    ]
  },

  biologia: {
    '1_medio': [
      { codigo: 'OA 2', descripcion: 'Analizar e interpretar datos para proveer de evidencias que apoyen que la diversidad de organismos es el resultado de la evolución.' },
      { codigo: 'OA 4', descripcion: 'Investigar y explicar cómo se organizan e interactúan los seres vivos en diversos ecosistemas, a partir de ejemplos de Chile, considerando flujo de materia y energía.' },
      { codigo: 'OA 6', descripcion: 'Desarrollar modelos que expliquen el ciclo del carbono, el nitrógeno, el agua y el fósforo, y su importancia biológica.' }
    ],
    '2_medio': [
      { codigo: 'OA 1', descripcion: 'Explicar cómo el sistema nervioso coordina las acciones del organismo para adaptarse a estímulos del ambiente por medio de señales transmitidas por neuronas.' },
      { codigo: 'OA 5', descripcion: 'Explicar y comparar los métodos de regulación de la fertilidad, considerando criterios éticos, biológicos y de salud sexual y reproductiva.' },
      { codigo: 'OA 7', descripcion: 'Explicar la transmisión de genes de generación en generación por medio de la meiosis y la fecundación, considerando mutaciones y variabilidad genética.' }
    ]
  },

  fisica: {
    '1_medio': [
      { codigo: 'OA 9', descripcion: 'Demostrar que comprende, por medio de la creación de modelos y experimentos, que las ondas transmiten energía y que se pueden reflejar, refractar y absorber.' },
      { codigo: 'OA 10', descripcion: 'Explicar fenómenos del sonido (tono, intensidad, timbre, efecto Doppler) y de la luz (espectro electromagnético, espejos y lentes) a partir de sus propiedades ondulatorias.' },
      { codigo: 'OA 13', descripcion: 'Describir el origen y propagación de la energía sísmica y las características de las capas internas de la Tierra.' }
    ],
    '2_medio': [
      { codigo: 'OA 9', descripcion: 'Analizar, sobre la base de la experimentación, el movimiento rectilíneo uniforme y acelerado de un objeto respecto de un sistema de referencia espacio-temporal.' },
      { codigo: 'OA 10', descripcion: 'Explicar, por medio de investigaciones experimentales, los efectos que tiene una fuerza neta sobre un objeto, utilizando las leyes de Newton y el diagrama de cuerpo libre.' },
      { codigo: 'OA 12', descripcion: 'Investigar y analizar aplicaciones de las leyes de conservación de la energía mecánica y del momentum lineal en situaciones cotidianas.' }
    ]
  },

  quimica: {
    '1_medio': [
      { codigo: 'OA 17', descripcion: 'Investigar experimentalmente y explicar, usando evidencias, que la fermentación, la combustión y la oxidación de metales son reacciones químicas.' },
      { codigo: 'OA 18', descripcion: 'Desarrollar modelos que expliquen la conservación de la masa en reacciones químicas y el balanceo de ecuaciones químicas.' },
      { codigo: 'OA 20', descripcion: 'Establecer relaciones cuantitativas entre reactantes y productos en reacciones químicas (estequiometría) y explicar la utilidad del mol.' }
    ],
    '2_medio': [
      { codigo: 'OA 15', descripcion: 'Explicar, por medio de modelos y la experimentación, las propiedades de las soluciones en ejemplos cercanos, considerando estado físico, solubilidad y concentración.' },
      { codigo: 'OA 17', descripcion: 'Crear modelos del carbono y explicar sus propiedades como base para la formación de moléculas orgánicas e hidrocarburos.' },
      { codigo: 'OA 18', descripcion: 'Reconocer los principales grupos funcionales orgánicos (alcoholes, aldehídos, cetonas, ácidos carboxílicos, aminas) y su relevancia biológica e industrial.' }
    ]
  },

  ciencias_ciudadania: {
    '3_medio': [
      { codigo: 'OA 1', descripcion: 'Analizar, sobre la base de la investigación, factores biológicos, ambientales y sociales que influyen en la salud humana y la prevención de enfermedades.' },
      { codigo: 'OA 3', descripcion: 'Analizar, a partir de modelos, riesgos de origen natural o provocados por la acción humana en su contexto local y evaluar medidas de mitigación.' },
      { codigo: 'OA 6', descripcion: 'Evaluar las implicancias sociales, económicas, éticas y ambientales en controversias públicas que involucran ciencia y tecnología.' }
    ],
    '4_medio': [
      { codigo: 'OA 2', descripcion: 'Explicar, basado en investigaciones y modelos, cómo los avances tecnológicos permiten prevenir, diagnosticar y tratar enfermedades.' },
      { codigo: 'OA 4', descripcion: 'Investigar y comunicar cómo la aplicación del conocimiento científico y tecnológico contribuye al desarrollo sustentable y el uso eficiente de recursos.' },
      { codigo: 'OA 7', descripcion: 'Analizar críticamente evidencias científicas en debates actuales sobre cambio climático, energía y biodiversidad.' }
    ]
  },

  historia: {
    '1_basico': [
      { codigo: 'OA 1', descripcion: 'Nombrar y secuenciar días de la semana y meses del año, utilizando calendarios, e identificar el año en curso.' },
      { codigo: 'OA 5', descripcion: 'Reconocer los símbolos representativos de Chile (bandera, escudo e himno nacional) y describir costumbres y actividades propias de la comunidad.' },
      { codigo: 'OA 9', descripcion: 'Identificar a Chile en mapas, incluyendo la cordillera de los Andes, el océano Pacífico, su región, su capital y su localidad.' }
    ],
    '2_basico': [
      { codigo: 'OA 1', descripcion: 'Describir los modos de vida de algunos pueblos originarios de Chile en el período precolombino (ubicaciones geográficas, formas de habitar, alimentación y costumbres).' },
      { codigo: 'OA 3', descripcion: 'Distinguir los diversos aportes a la sociedad chilena proveniente de los pueblos originarios y de los españoles.' },
      { codigo: 'OA 7', descripcion: 'Ubicar Chile, Santiago, la propia región y su capital en el globo terráqueo o en mapas, y describir la ubicación relativa de países limítrofes.' }
    ],
    '3_basico': [
      { codigo: 'OA 1', descripcion: 'Reconocer aspectos de la vida cotidiana de la civilización griega de la Antigüedad e identificar algunos elementos de su legado a sociedades del presente.' },
      { codigo: 'OA 2', descripcion: 'Reconocer aspectos de la vida cotidiana de la civilización romana de la Antigüedad e identificar algunos elementos de su legado (idioma, derecho, arquitectura).' },
      { codigo: 'OA 7', descripcion: 'Distinguir hemisferios, círculo del Ecuador, trópicos, polos, continentes y océanos del planeta en mapas y globos terráqueos.' }
    ],
    '4_basico': [
      { codigo: 'OA 1', descripcion: 'Describir la civilización maya, considerando ubicación geográfica, organización política, actividades económicas, formas de cultivo y organización social.' },
      { codigo: 'OA 2', descripcion: 'Describir la civilización azteca, considerando ubicación geográfica, organización política y extensión, la ciudad de Tenochtitlán y religión.' },
      { codigo: 'OA 3', descripcion: 'Describir la civilización inca, considerando ubicación geográfica, organización política, sistema de caminos y correos, religión y formas de cultivo.' },
      { codigo: 'OA 8', descripcion: 'Describir distintos paisajes del continente americano, considerando climas, ríos, población, idiomas, países y grandes ciudades.' }
    ],
    '5_basico': [
      { codigo: 'OA 1', descripcion: 'Explicar los viajes de descubrimiento de Cristóbal Colón, de Hernando de Magallanes y de algún otro explorador, considerando sus objetivos, rutas y avances.' },
      { codigo: 'OA 2', descripcion: 'Describir el proceso de conquista de América y de Chile, incluyendo a los principales actores (Corona española, Iglesia católica y hombres y mujeres protagonistas).' },
      { codigo: 'OA 6', descripcion: 'Explicar aspectos centrales de la Colonia, como la dependencia de las colonias americanas de la metrópoli, el rol de la Iglesia católica y el surgimiento de una sociedad mestiza.' },
      { codigo: 'OA 9', descripcion: 'Caracterizar las grandes zonas de Chile y sus paisajes (Norte Grande, Norte Chico, Zona Central, Zona Sur y Zona Austral), considerando ubicación, clima y recursos.' }
    ],
    '6_basico': [
      { codigo: 'OA 1', descripcion: 'Explicar los múltiples factores que impulsaron el desarrollo de los procesos de independencia de las colonias americanas y de Chile.' },
      { codigo: 'OA 2', descripcion: 'Explicar el desarrollo del proceso de independencia de Chile, considerando actores y bandos que se enfrentaron, hombres y mujeres destacados y etapas.' },
      { codigo: 'OA 6', descripcion: 'Caracterizar los principales aspectos que definieron el período de riqueza aportada por la explotación del salitre a fines del siglo XIX y comienzos del XX.' },
      { codigo: 'OA 15', descripcion: 'Explicar algunos elementos fundamentales de la organización democrática de Chile, incluyendo la división de poderes del Estado y la representación ciudadana.' }
    ],
    '7_basico': [
      { codigo: 'OA 1', descripcion: 'Explicar el proceso de hominización, reconociendo las principales etapas de la evolución de la especie humana y la dispersión del Homo sapiens.' },
      { codigo: 'OA 3', descripcion: 'Explicar que en las primeras civilizaciones la formación de Estados organizados y el ejercicio del poder estuvieron marcados por la centralización y la religión.' },
      { codigo: 'OA 5', descripcion: 'Caracterizar el mar Mediterráneo como ecúmene y como espacio de circulación e intercambio, e inferir cómo sus características geográficas influyeron en Grecia y Roma.' },
      { codigo: 'OA 12', descripcion: 'Analizar las transformaciones que se producen en Europa a partir del siglo XII, considerando el renacimiento de la vida urbana, el comercio y las universidades.' }
    ],
    '8_basico': [
      { codigo: 'OA 1', descripcion: 'Analizar, apoyándose en diversas fuentes, la centralidad del ser humano y su capacidad de transformar el mundo en las expresiones culturales del Humanismo y del Renacimiento.' },
      { codigo: 'OA 2', descripcion: 'Comparar la sociedad medieval y moderna, considerando los cambios que implicó la ruptura de la unidad religiosa de Europa y el surgimiento del Estado moderno.' },
      { codigo: 'OA 11', descripcion: 'Analizar el proceso de formación de la sociedad colonial americana considerando elementos como la evangelización, la esclavitud y el mestizaje.' },
      { codigo: 'OA 18', descripcion: 'Explicar el concepto de Derechos Humanos y los principios que los sustentan (universalidad, indivisibilidad, interdependencia e imprescriptibilidad).' }
    ],
    '1_medio': [
      { codigo: 'OA 1', descripcion: 'Explicar las ideas republicanas y liberales y su relación con las transformaciones políticas y económicas de América y de Europa durante el siglo XIX.' },
      { codigo: 'OA 8', descripcion: 'Analizar el período de formación de la República de Chile como un proceso que implicó el enfrentamiento de distintas visiones sobre el modo de organizar al país.' },
      { codigo: 'OA 10', descripcion: 'Explicar que Chile durante el siglo XIX se insertó en los procesos de industrialización del mundo atlántico y en los mercados internacionales mediante la exportación de materias primas.' },
      { codigo: 'OA 23', descripcion: 'Explicar que los problemas de una sociedad implican la existencia de diversas interpretaciones sobre sus causas y soluciones.' }
    ],
    '2_medio': [
      { codigo: 'OA 1', descripcion: 'Relacionar la transformación cultural del período de entreguerras con la ruptura de los cánones culturales tradicionales y el surgimiento de la cultura de masas.' },
      { codigo: 'OA 2', descripcion: 'Analizar la crisis del Estado liberal decimonónico a comienzos del siglo XX, considerando la Gran Depresión de 1929 y el surgimiento de los totalitarismos.' },
      { codigo: 'OA 4', descripcion: 'Evaluar las consecuencias de la Segunda Guerra Mundial, considerando el Holocausto, la creación de la ONU y el inicio de la Guerra Fría.' },
      { codigo: 'OA 16', descripcion: 'Explicar que durante la dictadura militar se suprimió el Estado de derecho y se violaron sistemáticamente los Derechos Humanos en Chile.' }
    ]
  },

  educacion_ciudadana: {
    '3_medio': [
      { codigo: 'OA 1', descripcion: 'Identificar los fundamentos, atributos y dimensiones de la democracia y la ciudadanía, considerando las libertades fundamentales de las personas.' },
      { codigo: 'OA 3', descripcion: 'Reflexionar personal y grupalmente sobre diversas formas de participación y su aporte al fortalecimiento del bien común en una sociedad democrática.' },
      { codigo: 'OA 6', descripcion: 'Evaluar las características y el funcionamiento de la institucionalidad democrática, las formas de representación y su impacto en la ciudadanía.' }
    ],
    '4_medio': [
      { codigo: 'OA 2', descripcion: 'Participar de forma corresponsable y ética en la búsqueda de estrategias y soluciones a desafíos, problemas y conflictos en diversas escalas.' },
      { codigo: 'OA 5', descripcion: 'Evaluar las relaciones entre el Estado y el mercado, considerando temas como sueldos justos, productividad, carga tributaria, comercio justo y desarrollo sustentable.' },
      { codigo: 'OA 8', descripcion: 'Tomar decisiones fundadas en principios éticos, valores y virtudes públicas en las prácticas ciudadanas, resguardando la dignidad de las personas.' }
    ]
  }
};

export function obtenerOAsPorAsignaturaYNivel(asignatura = 'Matemática', nivelNombre = '') {
  const claveAsig = normalizarClaveAsignatura(asignatura);
  const claveNivel = normalizarClaveNivel(nivelNombre);

  if (claveAsig === 'matematica') {
    const legacy = obtenerOAsMatematicaLegacy(nivelNombre);
    if (Array.isArray(legacy) && legacy.length > 0) return legacy;
  }

  if (!claveNivel) return [];
  const mapaAsig = CATALOGO_OA[claveAsig];
  if (!mapaAsig) return [];

  return mapaAsig[claveNivel] || [];
}
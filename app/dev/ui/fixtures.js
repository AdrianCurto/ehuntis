// Fixtures neutros sin PII ni dependencias de red para el catalogo visual /dev/ui

export const mockCustomCategories = [
  'Clases',
  'Exámenes',
  'Entregas',
  'Tutorías',
  'Estudio',
  'Personal',
];

export const mockCustomEvent = {
  id: 'evt-mock-01',
  title: 'Entrega de Práctica 1',
  subjects: ['Entrega de Práctica 1'],
  date: 20261117,
  startTime: 900, // 09:00
  endTime: 1030, // 10:30
  category: 'Entregas',
  color: 2,
  colorIndex: 2,
  location: 'Aula Virtual',
  rooms: ['Aula Virtual'],
  notes: 'Subir memoria en formato PDF al aula virtual antes del cierre.',
  recurrence: { type: 'none', date: 20261117 },
  createdAt: 1731750000000,
  updatedAt: 1731750000000,
};

export const mockRecurringCustomEvent = {
  id: 'evt-mock-02',
  title: 'Tutoría grupal semanal',
  subjects: ['Tutoría grupal semanal'],
  date: 20261117,
  startTime: 1100, // 11:00
  endTime: 1200, // 12:00
  category: 'Tutorías',
  color: 4,
  colorIndex: 4,
  location: 'Despacho 2.3',
  rooms: ['Despacho 2.3'],
  notes: 'Revisión de dudas del tema 3 en despacho.',
  recurrence: {
    type: 'weekly',
    daysOfWeek: [2],
    startDate: 20261101,
    endDate: 20261220,
    exceptions: [],
  },
  createdAt: 1731750000000,
  updatedAt: 1731750000000,
};

export const mockLesson = {
  id: 1001,
  lessonKey: 'lesson-1001',
  date: 20261117,
  startTime: 900,
  endTime: 1100,
  subjects: ['Sistemas Operativos'],
  subjectIds: [10],
  rooms: ['P1G2A'],
  teachers: ['Profesor Demo'],
  classes: ['Grado Informática'],
  type: 'Laboratorio',
  kl: [{ id: 1, name: 'Sistemas Operativos' }],
  su: [{ id: 10, name: 'Sistemas Operativos', longname: 'Sistemas Operativos' }],
  ro: [{ id: 20, name: 'P1G2A' }],
  te: [{ id: 30, name: 'Profesor Demo', longname: 'Profesor Demo' }],
  subgroup: 'Lab 1',
  colorIndex: 0,
};

export const mockEditedLesson = {
  ...mockLesson,
  id: 1002,
  lessonKey: 'lesson-1002',
  rawDate: 20261117,
  rawStartTime: 900,
  rawEndTime: 1100,
  rawRooms: ['P1G2A'],
  startTime: 930,
  endTime: 1130,
  customStartTime: 930,
  customEndTime: 1130,
  customRooms: ['P2G4B'],
  rooms: ['P2G4B'],
  customNotes: 'Clase cambiada al aula de informática 4.',
  notes: 'Clase cambiada al aula de informática 4.',
  isOverridden: true,
  _hasChanges: true,
};

export const mockSwapCandidates = [
  {
    id: 1003,
    lessonKey: 'lesson-1003',
    date: 20261118,
    startTime: 1100,
    endTime: 1300,
    subjects: ['Redes de Computadores'],
    subjectIds: [20],
    rooms: ['P1G3A'],
    teachers: ['Profesora Redes'],
    classes: ['Grado Informática'],
    type: 'Magistral',
    kl: [{ id: 2, name: 'Redes de Computadores' }],
    su: [{ id: 20, name: 'Redes de Computadores' }],
    ro: [{ id: 21, name: 'P1G3A' }],
    te: [{ id: 31, name: 'Profesora Redes' }],
    subgroup: 'Teoría',
    colorIndex: 1,
  },
  {
    id: 1004,
    lessonKey: 'lesson-1004',
    date: 20261119,
    startTime: 1500,
    endTime: 1700,
    subjects: ['Bases de Datos'],
    subjectIds: [30],
    rooms: ['P0G1A'],
    teachers: ['Profesor BD'],
    classes: ['Grado Informática'],
    type: 'Prácticas',
    kl: [{ id: 3, name: 'Bases de Datos' }],
    su: [{ id: 30, name: 'Bases de Datos' }],
    ro: [{ id: 22, name: 'P0G1A' }],
    te: [{ id: 32, name: 'Profesor BD' }],
    subgroup: 'Prácticas',
    colorIndex: 3,
  },
];

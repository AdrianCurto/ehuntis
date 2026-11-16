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
  date: 20261117,
  startTime: 900, // 09:00
  endTime: 1030, // 10:30
  category: 'Entregas',
  color: 2,
  notes: 'Subir memoria en formato PDF al aula virtual antes del cierre.',
  recurrence: 'none',
  createdAt: 1731750000000,
  updatedAt: 1731750000000,
};

export const mockRecurringCustomEvent = {
  id: 'evt-mock-02',
  title: 'Tutoría grupal semanal',
  date: 20261117,
  startTime: 1100, // 11:00
  endTime: 1200, // 12:00
  category: 'Tutorías',
  color: 4,
  notes: 'Revisión de dudas del tema 3 en despacho.',
  recurrence: 'weekly',
  dayOfWeek: 2,
  startDate: 20261101,
  endDate: 20261220,
  exceptions: [],
  createdAt: 1731750000000,
  updatedAt: 1731750000000,
};

export const mockLesson = {
  id: 1001,
  date: 20261117,
  startTime: 900,
  endTime: 1100,
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
  customStartTime: 930,
  customEndTime: 1130,
  customRoom: 'P2G4B',
  customNote: 'Clase cambiada al aula de informática 4.',
  _hasChanges: true,
};

export const mockSwapCandidates = [
  {
    id: 1003,
    date: 20261118,
    startTime: 1100,
    endTime: 1300,
    kl: [{ id: 2, name: 'Redes de Computadores' }],
    su: [{ id: 20, name: 'Redes de Computadores' }],
    ro: [{ id: 21, name: 'P1G3A' }],
    te: [{ id: 31, name: 'Profesora Redes' }],
    subgroup: 'Teoría',
    colorIndex: 1,
  },
  {
    id: 1004,
    date: 20261119,
    startTime: 1500,
    endTime: 1700,
    kl: [{ id: 3, name: 'Bases de Datos' }],
    su: [{ id: 30, name: 'Bases de Datos' }],
    ro: [{ id: 22, name: 'P0G1A' }],
    te: [{ id: 32, name: 'Profesor BD' }],
    subgroup: 'Prácticas',
    colorIndex: 3,
  },
];

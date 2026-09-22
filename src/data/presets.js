// Liste des challenges "presets" proposés par l'app.
// unit = unité affichée dans le suivi de progression (km, reps, %, etc.)
// usesGPS = true si le challenge peut être suivi automatiquement via le GPS

export const CHALLENGE_PRESETS = [
  {
    id: 'running',
    label: 'Course à pied',
    category: 'Sport',
    unit: 'km',
    usesGPS: true,
    icon: '🏃',
    defaultTarget: 50,
  },
  {
    id: 'pushups',
    label: 'Pompes',
    category: 'Sport',
    unit: 'reps',
    usesGPS: false,
    icon: '💪',
    defaultTarget: 500,
  },
  {
    id: 'cycling',
    label: 'Vélo',
    category: 'Sport',
    unit: 'km',
    usesGPS: true,
    icon: '🚴',
    defaultTarget: 100,
  },
  {
    id: 'swimming',
    label: 'Natation',
    category: 'Sport',
    unit: 'km',
    usesGPS: false,
    icon: '🏊',
    defaultTarget: 5,
  },
  {
    id: 'skiing',
    label: 'Ski',
    category: 'Sport',
    unit: 'km',
    usesGPS: false,
    icon: '⛷️',
    defaultTarget: 20,
  },
  {
    id: 'game_completion',
    label: 'Finir un jeu vidéo',
    category: 'Loisir',
    unit: '% terminé',
    usesGPS: false,
    icon: '🎮',
    defaultTarget: 100,
  },
  {
    id: 'custom',
    label: 'Challenge personnalisé',
    category: 'Autre',
    unit: 'unités',
    usesGPS: false,
    icon: '✨',
    defaultTarget: 100,
  },
];

// Durées prédéfinies pour un challenge (en heures)
export const DURATION_PRESETS = [
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '1 semaine', hours: 24 * 7 },
  { label: 'Personnalisé', hours: null },
];

export const RECURRENCE_PRESETS = [
  { label: 'Chaque jour', hours: 24 },
  { label: 'Chaque semaine', hours: 168 },
  { label: 'Chaque mois', hours: 720 },
  { label: 'Personnalisé', hours: null },
];

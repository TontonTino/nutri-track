// Interrupteur mock / vrai backend : mettre USE_MOCK à false quand l'API d'Alya est publiée,
// ou définir EXPO_PUBLIC_USE_MOCK=false et EXPO_PUBLIC_API_URL dans l'environnement.
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// Valeurs provisoires tant qu'il n'y a pas d'authentification (hors périmètre du MVP).
export const AGENT_ID = 'agent-demo';
export const CENTRE_ID = 'centre-demo';

// Interrupteur mock / vrai backend : EXPO_PUBLIC_USE_MOCK=false et EXPO_PUBLIC_API_URL pour utiliser l'API d'Alya.
// Par défaut, le mock n'est actif qu'en développement : une version installée sur le terrain ne doit jamais afficher de
// résultats simulés sans qu'on l'ait demandé. Quand il est actif, un bandeau « mode démo » est toujours visible.
const enDeveloppement = typeof __DEV__ !== 'undefined' && __DEV__;
export const USE_MOCK = (process.env.EXPO_PUBLIC_USE_MOCK ?? (enDeveloppement ? 'true' : 'false')) !== 'false';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// Valeurs provisoires tant qu'il n'y a pas d'authentification (hors périmètre du MVP).
export const AGENT_ID = 'agent-demo';
export const CENTRE_ID = 'centre-demo';

// Au-delà de ce délai sans réponse du serveur, l'app considère qu'il n'y a pas de connexion utilisable.
export const DELAI_RESEAU_MS = 8000;

// Nouvelle tentative de synchronisation tant que des dépistages restent en attente (serveur injoignable
// alors que le réseau est présent : le module de synchronisation ne détecte alors aucun retour de réseau).
export const INTERVALLE_RELANCE_SYNC_MS = 60000;

// Estimation du PB par photo et calibration (module de Lionel, prototype) : désactivée par défaut. Elle suppose une largeur
// de bras constante et n'est pas assez fiable pour le terrain ; la lecture assistée du brassard la remplace.
// EXPO_PUBLIC_VISION_CALIBRATION=true la réactive pour la démonstration.
export const VISION_CALIBRATION_ACTIVE = process.env.EXPO_PUBLIC_VISION_CALIBRATION === 'true';

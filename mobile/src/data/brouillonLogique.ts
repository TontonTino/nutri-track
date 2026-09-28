// Logique pure du brouillon de formulaire (voir data/brouillon.ts pour le stockage sur disque, séparé ici pour
// rester testable sans dépendre d'expo-file-system, qui importe react-native).
export interface Brouillon {
  enregistreLe: string; // ISO 8601
  identifiant: string; // code, nom ou patiente saisi ; peut être vide
  champs: Record<string, string>;
}

function estRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

// Un brouillon corrompu ou d'un format inconnu ne doit jamais faire planter l'écran de consentement : on le
// traite comme absent (même prudence que lireMesures() dans data/historique.ts).
export function estBrouillonValide(x: unknown): x is Brouillon {
  if (!estRecord(x)) return false;
  if (typeof x.enregistreLe !== 'string' || typeof x.identifiant !== 'string') return false;
  if (!estRecord(x.champs)) return false;
  return Object.values(x.champs).every((v) => typeof v === 'string');
}

// Un formulaire encore vide ne vaut pas la peine d'être écrit sur le disque.
export function brouillonEstVide(identifiant: string, champs: Record<string, string>): boolean {
  return identifiant.trim() === '' && Object.values(champs).every((v) => v.trim() === '');
}

// Heure locale au format « 14h32 ». Le Burkina Faso est en UTC+0 toute l'année : lire directement les
// composantes UTC de l'horodatage ISO donne l'heure locale de l'agent, sans dépendre du fuseau de l'appareil
// qui exécute ce code (déterministe, donc testable).
export function formaterHeure(iso: string): string {
  const heureMinute = iso.slice(11, 16);
  return /^\d{2}:\d{2}$/.test(heureMinute) ? heureMinute.replace(':', 'h') : '';
}

// Résumé affiché à l'agent avant qu'il décide de reprendre ou non ce brouillon : il doit pouvoir reconnaître de
// qui il s'agit (ou constater que non) avant de le réappliquer.
export function etiquetteBrouillon(b: Brouillon): string {
  const heure = formaterHeure(b.enregistreLe);
  const qui = b.identifiant.trim() || 'sans nom';
  return heure ? `${qui} — ${heure}` : qui;
}

// --- Pont entre l'écran de consentement (qui lit le brouillon et demande la décision de l'agent) et le
// formulaire (qui l'applique) — même schéma que vision/session.ts : une valeur posée, lue une seule fois.
let brouillonAAppliquer: Brouillon | null = null;

export function definirBrouillonAAppliquer(b: Brouillon | null): void {
  brouillonAAppliquer = b;
}

export function consommerBrouillonAAppliquer(): Brouillon | null {
  const b = brouillonAAppliquer;
  brouillonAAppliquer = null;
  return b;
}

// Aides communes aux formulaires de saisie.
import { ApiError } from './apiError';

export type Erreurs = Partial<Record<string, string>>;

// Accepte la virgule décimale (« 12,5 »), fréquente à la saisie. null = vide ou non numérique.
export function versNombre(texte: string): number | null {
  const propre = texte.trim().replace(',', '.');
  if (propre === '') return null;
  const n = Number(propre);
  return Number.isFinite(n) ? n : null;
}

export function versEntier(texte: string): number | null {
  const n = versNombre(texte);
  return n !== null && Number.isInteger(n) ? n : null;
}

// Date AAAA-MM-JJ valide, pas dans le futur.
export function dateValide(texte: string, aujourdhui = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte.trim());
  if (!m) return false;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  const existe = d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour;
  return existe && d.getTime() <= aujourdhui.getTime();
}

export function dateDuJour(maintenant = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${p(maintenant.getMonth() + 1)}-${p(maintenant.getDate())}`;
}

// Traduit une erreur d'appel en état d'affichage. Le formulaire n'est jamais vidé : seul le champ fautif est
// signalé, et une bannière résume l'erreur.
export function erreurPourFormulaire(
  e: unknown,
  libellesChamps: Record<string, string>,
): { erreurs: Erreurs; general: string } {
  if (e instanceof ApiError && e.kind === 'hors_plage' && e.champ) {
    return {
      erreurs: { [e.champ]: e.message },
      general: `Valeur à corriger : ${libellesChamps[e.champ] ?? e.champ}.`,
    };
  }
  if (e instanceof ApiError && e.kind === 'hors_plage') {
    return { erreurs: {}, general: e.message };
  }
  return { erreurs: {}, general: e instanceof Error ? e.message : 'Une erreur est survenue. Réessayez.' };
}

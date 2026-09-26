// Session de capture assistée : mémoire partagée entre les écrans de vision de Lionel et le formulaire Enfant.
// Tout reste sur le téléphone (la vision doit fonctionner sans réseau). Règle d'or du contrat : aucune estimation n'est
// exploitable tant que l'agent ne l'a pas confirmée ou corrigée sur l'écran de confirmation.

export type StatutValidation = 'confirmee' | 'corrigee' | 'rejetee';

export interface ResultatVision {
  valeur_mm: number; // valeur retenue par l'agent
  valeur_estimee_mm: number | null; // estimation de l'heuristique (null en saisie directe)
  score_confiance: number | null;
  statut: 'confirmee' | 'corrigee';
  methode: string;
  date_validation: string;
}

interface CaptureEnregistree {
  valeur_estimee?: number | null;
  score_confiance?: number | null;
  methode_mesure?: string;
}

interface Decision {
  statut: StatutValidation;
  valeur_validee: number | null;
  date_validation?: string;
}

const parametresParEcran = new Map<string, Record<string, unknown>>();
const captures = new Map<string, CaptureEnregistree>();
let resultat: ResultatVision | null = null;
let compteur = 0;

export function reinitialiserSession(): void {
  parametresParEcran.clear();
  captures.clear();
  resultat = null;
}

export function definirParametres(ecran: string, params: Record<string, unknown>): void {
  parametresParEcran.set(ecran, params);
}

export function lireParametres(ecran: string): Record<string, unknown> {
  return parametresParEcran.get(ecran) ?? {};
}

export function enregistrerCapture(payload: CaptureEnregistree): string {
  compteur += 1;
  const id = `capture-locale-${compteur}`;
  captures.set(id, payload);
  return id;
}

// Décision de l'agent. Une capture rejetée ne produit aucune valeur exploitable.
export function enregistrerDecision(id: string, decision: Decision): void {
  const capture = captures.get(id);
  if (!capture) throw new Error(`Capture inconnue : ${id}`);
  if (decision.statut === 'rejetee' || decision.valeur_validee === null || !Number.isFinite(decision.valeur_validee)) {
    resultat = null;
    return;
  }
  resultat = {
    valeur_mm: Math.round(decision.valeur_validee * 10) / 10,
    valeur_estimee_mm: capture.valeur_estimee ?? null,
    // Sans estimation de la caméra (valeur tapée à la main), il n'y a pas de confiance à mentionner (Lionel envoie 0 par défaut).
    score_confiance: capture.valeur_estimee == null ? null : (capture.score_confiance ?? null),
    statut: decision.statut,
    methode: capture.methode_mesure ?? 'inconnue',
    date_validation: decision.date_validation ?? new Date().toISOString(),
  };
}

// Lit le résultat une seule fois : il ne doit pas être réappliqué à chaque retour sur le formulaire.
export function consommerResultat(): ResultatVision | null {
  const r = resultat;
  resultat = null;
  return r;
}

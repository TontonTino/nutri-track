// Alignement de la classification PROVISOIRE hors ligne (module de Rasmata) sur le moteur d'Alya.
// Le classifieur local de Rasmata (`sync/localClassifier.js`) diverge du moteur du serveur sur des points qui touchent à
// la sécurité : il sous-orienterait des cas hors ligne. Plutôt que de modifier son code, l'adaptateur relève le résultat
// provisoire au niveau du moteur d'Alya (jamais en dessous). Le serveur confirme dès le retour du réseau.
//
// Constantes : valeurs par défaut de la table Seuils d'Alya (seed_default_seuils, backend/app/main.py). Elles sont
// modifiables côté serveur (PUT /seuils) ; c'est pourquoi le résultat reste « provisoire ».
import type { Population } from '../types/depistage';

export interface ClassificationLocale {
  classification: string;
  orientation_declenchee: boolean;
}

export const SEUILS_MOTEUR = {
  mnaSfDenutrition: 7, // score_mna_sf <= 7 : dénutrition probable (Rasmata utilise 6)
  pbAdulteMm: 180, // personne âgée : PB < 180 mm
  pbEnceinteMm: 230, // femme enceinte : PB < 230 mm (PCIMA)
} as const;

// Statuts qui déclenchent une orientation dans le moteur d'Alya (determiner_orientation).
const ORIENTES = new Set(['sévère', 'modéré', 'dénutrition probable', 'ecart_suivi_rapproche']);

function nombre(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function alignerSurMoteur(
  population: Population,
  mesures: Record<string, unknown>,
  locale: ClassificationLocale,
): ClassificationLocale {
  let classification = locale.classification;

  if (population === 'personne_agee') {
    const score = nombre(mesures.score_mna_sf);
    const pb = nombre(mesures.pb_optionnel);
    const denutrition = (score !== null && score <= SEUILS_MOTEUR.mnaSfDenutrition) || (pb !== null && pb < SEUILS_MOTEUR.pbAdulteMm);
    classification = denutrition ? 'dénutrition probable' : 'satisfaisant';
  }

  if (population === 'enceinte') {
    const pb = nombre(mesures.pb);
    const pbFaible = pb !== null && pb < SEUILS_MOTEUR.pbEnceinteMm;
    // Un écart de hauteur utérine prime sur le PB ; sinon un PB faible donne « modéré », quelle que soit la semaine.
    if (classification !== 'ecart_suivi_rapproche' && pbFaible) classification = 'modéré';
  }

  return { classification, orientation_declenchee: ORIENTES.has(classification) };
}

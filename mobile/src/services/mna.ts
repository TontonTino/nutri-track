// Questionnaire MNA-SF (Mini Nutritional Assessment – Short Form, Kaiser et al. 2009), score sur 14.
// L'application calcule le score ; l'interprétation (normal / à risque / dénutrition) reste au moteur de
// classification du backend : elle n'est volontairement pas affichée ici.

export type IdQuestionMna = 'A' | 'B' | 'C' | 'D' | 'E';

export interface QuestionMna {
  id: IdQuestionMna;
  libelle: string;
  options: { libelle: string; points: number }[];
}

export const QUESTIONS_MNA: QuestionMna[] = [
  {
    id: 'A',
    libelle: "Baisse de l'appétit ou de la prise alimentaire ces 3 derniers mois ?",
    options: [
      { libelle: 'Baisse sévère', points: 0 },
      { libelle: 'Baisse modérée', points: 1 },
      { libelle: 'Pas de baisse', points: 2 },
    ],
  },
  {
    id: 'B',
    libelle: 'Perte de poids ces 3 derniers mois ?',
    options: [
      { libelle: 'Plus de 3 kg', points: 0 },
      { libelle: 'Ne sait pas', points: 1 },
      { libelle: 'Entre 1 et 3 kg', points: 2 },
      { libelle: 'Aucune perte', points: 3 },
    ],
  },
  {
    id: 'C',
    libelle: 'Mobilité',
    options: [
      { libelle: 'Alité ou au fauteuil', points: 0 },
      { libelle: 'Se lève, ne sort pas', points: 1 },
      { libelle: 'Sort du domicile', points: 2 },
    ],
  },
  {
    id: 'D',
    libelle: 'Stress psychologique ou maladie aiguë ces 3 derniers mois ?',
    options: [
      { libelle: 'Oui', points: 0 },
      { libelle: 'Non', points: 2 },
    ],
  },
  {
    id: 'E',
    libelle: 'Problèmes neuropsychologiques',
    options: [
      { libelle: 'Démence ou dépression sévère', points: 0 },
      { libelle: 'Démence légère', points: 1 },
      { libelle: 'Aucun problème', points: 2 },
    ],
  },
];

export type ReponsesMna = Partial<Record<IdQuestionMna, number>>;

// Question F : à défaut d'IMC (rarement disponible sur le terrain), le périmètre du mollet en cm.
export function pointsMollet(perimetreMolletCm: number): number {
  return perimetreMolletCm >= 31 ? 3 : 0;
}

// Renvoie null tant que le questionnaire n'est pas complet.
export function calculerScoreMna(reponses: ReponsesMna, perimetreMolletCm: number | null): number | null {
  if (perimetreMolletCm === null) return null;
  let total = pointsMollet(perimetreMolletCm);
  for (const q of QUESTIONS_MNA) {
    const points = reponses[q.id];
    if (points === undefined) return null;
    total += points;
  }
  return total;
}

// Déduit `perte_poids_recente` de la question B (« ne sait pas » = inconnu, donc non renseigné).
export function pertePoidsDepuisReponseB(pointsB: number | undefined): boolean | undefined {
  if (pointsB === undefined || pointsB === 1) return undefined;
  return pointsB !== 3;
}

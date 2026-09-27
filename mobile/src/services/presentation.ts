// Traduit la classification brute de l'API (chaîne libre) en catégorie d'affichage.
// Règle du cahier des charges (§5.2, §11) : jamais de « diagnostic confirmé ».
import type { Population } from '../types/depistage';

export type Categorie = 'normal' | 'modere' | 'severe' | 'inconnu';

export const ECART_GROSSESSE = 'Écart observé par rapport à la référence — suivi rapproché recommandé';

export const nomPopulation: Record<Population, string> = {
  enfant: 'Enfant (6-59 mois)',
  enceinte: 'Femme enceinte',
  personne_agee: 'Personne âgée',
};

// Minuscules, sans accents ni tirets bas : « modéré », « MODERE » et « modere » se valent.
function normaliser(brut: string): string {
  return brut
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
}

export function categorieDe(classificationBrute: string): Categorie {
  switch (normaliser(classificationBrute)) {
    case 'normal':
    case 'satisfaisant':
      return 'normal';
    case 'modere':
    case 'ecart suivi rapproche':
      return 'modere';
    case 'severe':
    case 'denutrition probable':
      return 'severe';
    default:
      return 'inconnu';
  }
}

export function libelleDe(population: Population, classificationBrute: string): string {
  const cle = normaliser(classificationBrute);
  if (cle === 'ecart suivi rapproche') return ECART_GROSSESSE;
  if (cle === 'a confirmer en ligne') return 'À confirmer en ligne';
  switch (categorieDe(classificationBrute)) {
    case 'normal':
      return population === 'enceinte' ? 'Dans la référence' : population === 'personne_agee' ? 'Situation normale' : 'Normal';
    case 'modere':
      return population === 'personne_agee' ? 'Vigilance — à surveiller' : 'Modéré';
    case 'severe':
      return population === 'personne_agee' ? 'Dénutrition probable — orientation nécessaire' : 'Sévère';
    default:
      return 'Résultat non reconnu';
  }
}

// Texte de repli, utilisé seulement si l'API ne fournit pas de `recommandation`.
export function actionParDefaut(categorie: Categorie, orientationDeclenchee: boolean): string {
  if (categorie === 'severe' || orientationDeclenchee) {
    return 'Orienter immédiatement vers un centre de santé. Aucun traitement à domicile ne doit être proposé.';
  }
  if (categorie === 'modere') {
    return 'Suivi rapproché recommandé. Conseils alimentaires généraux et nouvelle mesure lors du prochain passage.';
  }
  if (categorie === 'normal') {
    return 'Aucune orientation nécessaire. Conseils alimentaires généraux et poursuite du suivi habituel.';
  }
  return "Le résultat n'a pas pu être interprété. Refaire la mesure ou orienter par précaution vers un centre de santé.";
}

// Résumé lisible des mesures saisies, pour l'historique.
export function resumeMesures(population: Population, mesures: Record<string, unknown>): string {
  const n = (cle: string) => (typeof mesures[cle] === 'number' ? (mesures[cle] as number) : undefined);
  const parties: (string | null)[] = [];
  if (population === 'enfant') {
    parties.push(
      n('pb') !== undefined ? `PB ${n('pb')} mm` : null,
      n('poids') !== undefined ? `${n('poids')} kg` : null,
      n('taille') !== undefined ? `${n('taille')} cm` : null,
    );
  } else if (population === 'enceinte') {
    parties.push(
      n('hauteur_uterine') !== undefined ? `HU ${n('hauteur_uterine')} cm` : null,
      n('semaine_amenorrhee') !== undefined ? `SA ${n('semaine_amenorrhee')}` : null,
      n('pb') !== undefined ? `PB ${n('pb')} mm` : null,
    );
  } else {
    parties.push(
      n('score_mna_sf') !== undefined ? `MNA-SF ${n('score_mna_sf')}` : null,
      n('perimetre_mollet') !== undefined ? `mollet ${n('perimetre_mollet')} cm` : null,
      n('pb_optionnel') !== undefined ? `PB ${n('pb_optionnel')} mm` : null,
    );
  }
  return parties.filter((p): p is string => p !== null).join(' · ');
}

// Texte d'action affiché. Le texte du serveur prime, sauf pour l'écart de hauteur utérine : le serveur y joint
// aujourd'hui la recommandation d'un transfert d'urgence, qui contredit la règle du cahier des charges
// (§5.2 : signal de suivi rapproché, jamais un diagnostic ni une alarme). On affiche alors un texte cohérent ;
// l'indicateur d'orientation, lui, reste celui de l'API.
export const ACTION_ECART_GROSSESSE =
  "Un écart de hauteur utérine est un signal de suivi, pas un diagnostic. Programmer un suivi rapproché : nouvelle mesure à la prochaine consultation.";

export const ACTION_A_CONFIRMER =
  'Le dépistage est enregistré sur ce téléphone. Il sera classé dès que le réseau reviendra ; en cas de doute, orienter vers un centre de santé.';

export function actionAffichee(
  classificationBrute: string,
  recommandationServeur: string | null | undefined,
  orientationDeclenchee: boolean,
): string {
  const cle = normaliser(classificationBrute);
  if (cle === 'ecart suivi rapproche') return ACTION_ECART_GROSSESSE;
  if (cle === 'a confirmer en ligne') return ACTION_A_CONFIRMER;
  return recommandationServeur || actionParDefaut(categorieDe(classificationBrute), orientationDeclenchee);
}

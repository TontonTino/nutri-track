// Plages physiologiques : elles reflètent PHYSIOLOGICAL_RANGES du backend (app/pipeline.py, branche alya/engine-api).
// Ce ne sont PAS des seuils cliniques (ceux-ci restent côté serveur, table versionnée) : elles servent à rejeter
// une erreur de saisie avant l'appel, donc aussi sans réseau (§5.7). L'API reste l'autorité : son rejet est géré
// exactement de la même façon (voir api.ts).
import type { Population } from '../types/depistage';
import { ApiError } from './apiError';

export const PLAGES = {
  enfant: { pb: [50, 350], poids: [1.5, 35], taille: [30, 150] },
  personne_agee: { score_mna_sf: [0, 14], perimetre_mollet: [10, 60], pb_optionnel: [100, 450] },
  enceinte: { hauteur_uterine: [5, 50], semaine_amenorrhee: [4, 45], pb: [100, 450] },
} as const satisfies Record<Population, Record<string, readonly [number, number]>>;

// Libellé et unité de chaque mesure, pour des messages lisibles par l'agent.
export const LIBELLES_MESURES: Record<string, { libelle: string; unite: string }> = {
  pb: { libelle: 'Périmètre brachial', unite: 'mm' },
  pb_optionnel: { libelle: 'Périmètre brachial', unite: 'mm' },
  poids: { libelle: 'Poids', unite: 'kg' },
  taille: { libelle: 'Taille', unite: 'cm' },
  perimetre_mollet: { libelle: 'Périmètre du mollet', unite: 'cm' },
  score_mna_sf: { libelle: 'Score MNA-SF', unite: 'points' },
  hauteur_uterine: { libelle: 'Hauteur utérine', unite: 'cm' },
  semaine_amenorrhee: { libelle: "Semaine d'aménorrhée", unite: 'SA' },
};

const virgule = (n: number) => String(n).replace('.', ',');

// « Poids : 50 kg est en dehors des valeurs possibles (1,5 à 35 kg). Vérifiez la mesure. »
export function messageHorsPlage(champ: string, valeur: number, min: number, max: number): string {
  const m = LIBELLES_MESURES[champ];
  if (!m) return `${virgule(valeur)} est en dehors des valeurs possibles (${virgule(min)} à ${virgule(max)}). Vérifiez la mesure.`;
  return `${m.libelle} : ${virgule(valeur)} ${m.unite} est en dehors des valeurs possibles (${virgule(min)} à ${virgule(max)} ${m.unite}). Vérifiez la mesure.`;
}

// Lève ApiError('hors_plage') sur la première mesure hors plage, avec un message lisible.
export function verifierPlages(population: Population, mesures: object): void {
  const plages: Record<string, readonly number[]> = PLAGES[population];
  for (const [champ, [min, max]] of Object.entries(plages)) {
    const v = (mesures as Record<string, unknown>)[champ];
    if (typeof v !== 'number') continue;
    if (v < min || v > max) throw new ApiError('hors_plage', messageHorsPlage(champ, v, min, max), champ);
  }
}

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

// Lève ApiError('hors_plage') sur la première mesure hors plage, avec le format de message de l'API.
export function verifierPlages(population: Population, mesures: object): void {
  const plages: Record<string, readonly number[]> = PLAGES[population];
  for (const [champ, [min, max]] of Object.entries(plages)) {
    const v = (mesures as Record<string, unknown>)[champ];
    if (typeof v !== 'number') continue;
    if (v < min || v > max) {
      throw new ApiError(
        'hors_plage',
        `La mesure '${champ}' (${v}) est hors de la plage physiologique valide [${min}, ${max}]. Nouvelle mesure demandée.`,
        champ,
      );
    }
  }
}

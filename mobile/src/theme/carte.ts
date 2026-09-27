import { couleurs } from '../constants/theme';
import type { Echelle } from './echelle';

// Carte blanche légère : une ombre douce à la place d'une bordure, pour aérer l'interface. Tailles issues de l'échelle.
export function carteDouce(t: Echelle) {
  return {
    backgroundColor: couleurs.carte,
    borderRadius: t.rayon.l,
    shadowColor: couleurs.ombre,
    shadowOpacity: 0.07,
    shadowRadius: t.e(10),
    shadowOffset: { width: 0, height: t.e(2) },
    elevation: Math.round(t.e(2)),
  } as const;
}

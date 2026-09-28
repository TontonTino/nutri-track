import { couleurs } from '../constants/theme';
import type { Echelle } from './echelle';

// Carte blanche : une ombre douce et teintée (pas grise) à la place d'une bordure, pour un rendu premium et aéré.
// Tailles issues de l'échelle.
export function carteDouce(t: Echelle) {
  return {
    backgroundColor: couleurs.carte,
    borderRadius: t.rayon.l,
    shadowColor: couleurs.ombre,
    shadowOpacity: 0.08,
    shadowRadius: t.e(16),
    shadowOffset: { width: 0, height: t.e(6) },
    elevation: Math.round(t.e(3)),
  } as const;
}

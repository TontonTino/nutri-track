import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { calculerEchelle, type Echelle } from './echelle';

// Recalculée à chaque changement de taille de fenêtre : rotation, écran pliable, redimensionnement web.
export function useEchelle(): Echelle {
  const { width, height } = useWindowDimensions();
  return useMemo(() => calculerEchelle(width, height), [width, height]);
}

// Fabrique de styles dépendant de l'échelle. `fabrique` doit être définie hors du composant (référence stable).
export function useStyles<T>(fabrique: (t: Echelle) => T): T {
  const t = useEchelle();
  return useMemo(() => fabrique(t), [fabrique, t]);
}

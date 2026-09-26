import type { Oedemes } from '../types/depistage';

// L'API d'Alya n'accepte qu'un booléen pour `oedemes_bilateraux` (schéma Boolean strict) :
// « Incertain » n'a pas d'équivalent. En attendant la décision de l'équipe, il est envoyé
// comme « true » : la sur-orientation (vers un centre de santé) est préférée au sous-dépistage,
// et l'agent garde la main sur la suite. À REVOIR avec Alya (voir le message de livraison).
export function oedemesVersApi(valeur: Oedemes): boolean {
  return valeur === 'Oui' || valeur === 'Incertain';
}

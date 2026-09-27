import type { Oedemes } from '../types/depistage';

// Œdèmes bilatéraux : l'agent répond Oui / Non / Incertain, mais « Incertain » n'est PAS une réponse finale. Un doute se
// tranche par le test de pression (protocole PCIMA) avant l'enregistrement : le formulaire refuse « Incertain » et
// guide l'agent (voir components/AideTestPression.tsx). L'API n'accepte d'ailleurs qu'un booléen ; envoyer un doute
// comme « oui » aurait classé sévère un enfant peut-être sain, et comme « non » aurait pu manquer un vrai cas.

// Message affiché tant que l'agent n'a pas tranché.
export const MESSAGE_TEST_REQUIS = 'Faites le test de pression, puis répondez Oui ou Non.';

// Erreur de validation du champ œdèmes, ou undefined s'il est valide.
export function erreurOedemes(valeur: Oedemes | null): string | undefined {
  if (valeur === null) return 'Choisissez Oui, Non ou Incertain.';
  if (valeur === 'Incertain') return MESSAGE_TEST_REQUIS;
  return undefined;
}

// Ne doit être appelée qu'avec une réponse tranchée : « Incertain » est une erreur de programmation, jamais envoyée.
export function oedemesVersApi(valeur: Oedemes): boolean {
  if (valeur === 'Incertain') {
    throw new Error("« Incertain » doit être tranché par le test de pression avant l'envoi.");
  }
  return valeur === 'Oui';
}

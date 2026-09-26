// Règles pour un PB mesuré avec l'assistance de la caméra (logique pure, testable).
import { versNombre } from '../services/formulaire';
import type { ResultatVision } from './session';

// Valeurs de traçabilité, choisies pour s'accorder avec les autres modules :
//  - pb_source : convention d'Alya (POST /capture-vision/{id}/validation enregistre `pb_source: "vision_ai"`) ;
//  - mode_saisie : valeur documentée par Rasmata (mobile/sync/README.md : « 'vision' si ça vient du module de Lionel »).
export const PB_SOURCE_VISION = 'vision_ai';
export const MODE_SAISIE_VISION = 'vision';

// Le PB est « assisté par la caméra » seulement si une estimation existait et si l'agent ne l'a pas retapé depuis la
// confirmation : une valeur retapée est une saisie manuelle.
export function visionActive(pbTexte: string, resultat: ResultatVision | null): ResultatVision | null {
  if (!resultat) return null;
  // Sans estimation de la caméra (valeur tapée à la main sur l'écran de confirmation), c'est une saisie manuelle.
  if (resultat.valeur_estimee_mm === null) return null;
  const saisie = versNombre(pbTexte);
  return saisie !== null && saisie === resultat.valeur_mm ? resultat : null;
}

// Traçabilité de la mesure assistée : valeur estimée par l'IA distincte de la valeur validée par l'ASC (cahier des
// charges §8). Ces champs voyagent dans `mesures`, que le serveur conserve tel quel.
export function champsVision(resultat: ResultatVision) {
  return {
    pb_estime_vision: resultat.valeur_estimee_mm,
    pb_score_confiance: resultat.score_confiance,
    pb_statut_validation: resultat.statut,
    pb_methode_mesure: resultat.methode,
  };
}

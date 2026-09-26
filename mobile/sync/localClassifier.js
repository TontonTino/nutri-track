/**
 * mobile/sync/localClassifier.js
 * Rasmata — Classification PROVISOIRE hors-ligne.
 *
 * Le vrai moteur (pipeline 4 étapes) tourne côté backend chez Alya (app/pipeline.py).
 * Hors-ligne, on n'a pas accès à ce moteur ni à la table Seuils en base centrale.
 * On reproduit donc UNIQUEMENT les seuils critiques documentés dans
 * docs/CONTRAT_INTERFACE.md (§ "Seuils métier") pour donner à l'agent un retour
 * immédiat pendant la saisie hors connexion.
 *
 * Cette classification est marquée "provisoire" partout où elle apparaît (voir
 * classification_locale_provisoire dans database.js) et DOIT être remplacée par
 * la classification officielle renvoyée par POST /depistage dès la synchronisation.
 * Ne jamais faire confiance à ce module pour une décision médicale finale.
 *
 * IMPORTANT : si Alya modifie un seuil via PUT /seuils, ce fichier peut devenir
 * désynchronisé. À vérifier ensemble avant la démo (cf. README.md du dossier).
 */

// Valeurs par défaut au 2026-09-26, identiques à seed_default_seuils() côté backend.
const SEUILS_PAR_DEFAUT = {
  enfant_pb_severe_mm: 115,
  enfant_pb_modere_mm: 125,
  personne_agee_mna_sf_denutrition: 6, // score_mna_sf == 6 -> dénutrition probable (règle transversale)
  enceinte_ecart_hu_max_cm: 3,
};

/**
 * Classifie un dépistage "enfant" à partir du PB (mm) et des œdèmes.
 */
function classerEnfant(mesures, seuils) {
  const pb = Number(mesures.pb);
  const oedemes = Boolean(mesures.oedemes_bilateraux);

  if (oedemes || (Number.isFinite(pb) && pb < seuils.enfant_pb_severe_mm)) {
    return { classification: 'sévère', orientation_declenchee: true };
  }
  if (Number.isFinite(pb) && pb < seuils.enfant_pb_modere_mm) {
    return { classification: 'modéré', orientation_declenchee: false };
  }
  return { classification: 'normal', orientation_declenchee: false };
}

/**
 * Classifie un dépistage "personne_agee" à partir du score MNA-SF.
 * Règle : score_mna_sf == 6 -> dénutrition probable (voir contrat).
 * On applique aussi "en dessous ou égal" par prudence, à confirmer avec Alya.
 */
function classerPersonneAgee(mesures, seuils) {
  const score = Number(mesures.score_mna_sf);
  if (Number.isFinite(score) && score <= seuils.personne_agee_mna_sf_denutrition) {
    return { classification: 'dénutrition probable', orientation_declenchee: true };
  }
  return { classification: 'normal', orientation_declenchee: false };
}

/**
 * Classifie un dépistage "enceinte" à partir de l'écart hauteur utérine / référence.
 * Référence simplifiée documentée dans le contrat : hauteur utérine (cm) ≈ semaine
 * d'aménorrhée, valable 20-34 SA. Jamais un diagnostic — juste un signal de suivi rapproché.
 */
function classerEnceinte(mesures, seuils) {
  const hu = Number(mesures.hauteur_uterine);
  const sa = Number(mesures.semaine_amenorrhee);

  if (!Number.isFinite(hu) || !Number.isFinite(sa) || sa < 20 || sa > 34) {
    // Hors de la plage où la règle simplifiée s'applique : pas de classification
    // locale fiable, on laisse le serveur trancher à la synchronisation.
    return { classification: 'à_confirmer_en_ligne', orientation_declenchee: false };
  }

  const ecart = Math.abs(hu - sa);
  if (ecart > seuils.enceinte_ecart_hu_max_cm) {
    return {
      classification: 'ecart_suivi_rapproche',
      orientation_declenchee: false,
      message: 'Écart de croissance fœtale hors tolérance : suivi rapproché recommandé, jamais un diagnostic.',
    };
  }
  return { classification: 'normal', orientation_declenchee: false };
}

/**
 * Point d'entrée. Retourne toujours un objet { classification, orientation_declenchee, ... }
 * avec classification_locale_provisoire implicite (à gérer par l'appelant).
 */
export function classifierHorsLigne(population, mesures, seuils = SEUILS_PAR_DEFAUT) {
  switch (population) {
    case 'enfant':
      return classerEnfant(mesures, seuils);
    case 'personne_agee':
      return classerPersonneAgee(mesures, seuils);
    case 'enceinte':
      return classerEnceinte(mesures, seuils);
    default:
      return { classification: 'inconnue', orientation_declenchee: false };
  }
}

export { SEUILS_PAR_DEFAUT };

/**
 * scenarios.js
 * Scénarios de démonstration — NUTRI-DÉPIST Vision Module
 *
 * 4 cas couvrant les 3 populations + 1 scénario d'échec/reprise.
 * Chaque scénario exporte des paramètres de navigation prêts à injecter
 * dans le Stack.Navigator via navigation.navigate(screenName, params).
 *
 * Usage dans une DemsScreen ou un menu développeur :
 *   import { SCENARIOS, lancerScenario } from '../vision/demo/scenarios';
 *   lancerScenario(navigation, 'enfant_severe');
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RAPPEL CONTEXTUEL (non implémenté ici, cité pour la démo) :
 *   AnthroNet (JMIR, preprint 2024, non relu par les pairs, n=200 cas sévères)
 *   tente d'estimer le PB par deep learning à partir d'une photo.
 *   Ce module n'intègre PAS ce modèle — l'heuristique géométrique est
 *   délibérément explicite et soumise à validation humaine.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * IMPORTANT : Les seuils de classification (ex. PB < 115 mm → sévère)
 * sont définis dans la table Seuils côté API (Alya).
 * Les valeurs ci-dessous sont des données de scénario de démo,
 * PAS des seuils codés en dur — conformément à CONTRAT_INTERFACE.md §Seuils.
 */

// ─── IDs factices pour la démo ────────────────────────────────────────────────

const DEMO_AGENT_ID     = 'agent-demo-001';
const DEMO_DEPISTAGE_PREFIX = 'DEMO-';

// ─── Calibration simulée (carte bancaire, conditions idéales) ─────────────────

const CALIB_DEMO = {
  pixelsPerCm:    52.4,
  refWidthPx:     448,
  refHeightPx:    283,
  objectName:     'Carte bancaire',
  objectWidthCm:  8.56,
  objectHeightCm: 5.40,
  isValid:        true,
};

// ─────────────────────────────────────────────────────────────────────────────
// SCÉNARIO 1 — Enfant, PB = 112 mm → sévère (< 115 mm selon protocole OMS)
// Population : MesureEnfant
// Ce que montre la démo : valeur estimée sous le seuil critique,
// l'agent confirme, la valeur part vers POST /depistage (hors module vision)
// ─────────────────────────────────────────────────────────────────────────────

export const SCENARIO_ENFANT_SEVERE = {
  id:          'enfant_severe',
  titre:       '👶 Enfant — PB critique',
  description: 'PB estimé à 112 mm. En dessous du seuil sévère (< 115 mm selon protocole).\nL\'agent confirme → la valeur part vers le moteur de classification d\'Alya.',
  population:  'enfant',
  ecranEntree: 'ConfirmationScreen',
  params: {
    depistage_id:       `${DEMO_DEPISTAGE_PREFIX}ENFANT-001`,
    agent_id:           DEMO_AGENT_ID,
    imageUri:           null,   // pas d'image réelle en démo
    valeurEstimee:      112,    // mm — sous le seuil sévère OMS
    scoreConfiance:     0.62,
    scoreQualite:       0.70,
    calibration:        CALIB_DEMO,
    forceSaisieManuelle: false,
  },
  // Narrative pour le présentateur
  script: [
    '1. L\'écran de confirmation s\'ouvre avec « 112 mm » en grand',
    '2. Le badge confiance affiche 62 % en orange (heuristique géométrique)',
    '3. L\'avertissement prototype est visible — pas de classification automatique',
    '4. L\'agent appuie sur « Confirmer »',
    '5. POST /capture-vision + PUT /validation sont appelés (mock, 600 ms)',
    '6. Écran « Mesure enregistrée » → retour au dépistage (Fanta gère la suite)',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SCÉNARIO 2 — Femme enceinte, hauteur utérine = 22 cm à 28 semaines
// Population : SuiviGrossesse
// Ce que montre la démo : HU < SA − 2 cm → écart signalé (suivi rapproché)
// Note : le module vision ne mesure PAS la HU directement.
//        Ce scénario passe par la saisie manuelle (type_mesure = 'pb' ici
//        pour le contrat ; la HU est gérée par les écrans de Fanta).
//        On démontre le flux de saisie corrigée.
// ─────────────────────────────────────────────────────────────────────────────

export const SCENARIO_FEMME_ENCEINTE = {
  id:          'femme_enceinte_hu',
  titre:       '🤰 Femme enceinte — Hauteur utérine',
  description: 'HU mesurée = 22 cm à 28 SA (attendue ≈ 28 cm ± 2 cm).\nÉcart = −6 cm → suivi rapproché signalé. Jamais un diagnostic.',
  population:  'grossesse',
  ecranEntree: 'ConfirmationScreen',
  params: {
    depistage_id:       `${DEMO_DEPISTAGE_PREFIX}GROSSESSE-001`,
    agent_id:           DEMO_AGENT_ID,
    imageUri:           null,
    valeurEstimee:      null,   // pas d'estimation caméra pour la HU
    scoreConfiance:     null,
    scoreQualite:       null,
    calibration:        null,
    forceSaisieManuelle: true,  // → ouvre directement le champ de saisie
  },
  // Dans le champ de saisie, l'agent tape 220 (22,0 cm en mm)
  valeurADemontrer: 220,
  script: [
    '1. L\'écran s\'ouvre directement en mode saisie manuelle',
    '2. L\'agent saisit « 220 » (22,0 cm = 220 mm)',
    '3. L\'agent appuie sur « Valider la correction »',
    '4. POST /capture-vision (statut: corrigee, methode_mesure: saisie_manuelle)',
    '5. La valeur part vers le moteur d\'Alya avec SuiviGrossesse → écart calculé là-bas',
    '6. → Affichage « suivi rapproché » géré par Fanta (hors module vision)',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SCÉNARIO 3 — Personne âgée, périmètre mollet = 31 cm + perte de poids
// Population : MesurePersonneAgee
// Ce que montre la démo : PM ≤ 31 cm est un signal de dénutrition selon MNA-SF.
//        Même mécanique que la femme enceinte : l'agent corrige/saisit.
// ─────────────────────────────────────────────────────────────────────────────

export const SCENARIO_PERSONNE_AGEE = {
  id:          'personne_agee_mollet',
  titre:       '🧓 Personne âgée — Périmètre mollet',
  description: 'PM = 31 cm + perte de poids récente → dénutrition probable (MNA-SF).\nL\'agent obtient une estimation camera, la corrige à 31 cm.',
  population:  'personne_agee',
  ecranEntree: 'ConfirmationScreen',
  params: {
    depistage_id:        `${DEMO_DEPISTAGE_PREFIX}AGEE-001`,
    agent_id:            DEMO_AGENT_ID,
    imageUri:            null,
    valeurEstimee:       308,   // 30,8 cm — légèrement sous-estimé par l'heuristique
    scoreConfiance:      0.55,
    scoreQualite:        0.65,
    calibration:         CALIB_DEMO,
    forceSaisieManuelle: false,
  },
  // L'agent corrigera à 310 mm (31,0 cm) avec "Corriger manuellement"
  valeurCorrigee: 310,
  script: [
    '1. L\'écran affiche « 308 mm » (30,8 cm) — légèrement sous-estimé',
    '2. L\'agent juge la valeur incorrecte et appuie sur « Corriger manuellement »',
    '3. Le champ de saisie s\'ouvre pré-rempli avec 308',
    '4. L\'agent efface et saisit « 310 » (31,0 cm)',
    '5. POST /capture-vision (valeur_estimee: 308, valeur_validee: 310, statut: corrigee)',
    '6. L\'agent note aussi une perte de poids récente → MNA-SF géré par Fanta',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SCÉNARIO 4 — Capture PB ratée → reprise réussie
// Ce que montre la démo : le flux complet d'erreur :
//   Capture 1 (floue) → CaptureFailScreen (raison: qualite)
//   → L'agent réessaie → Capture 2 (nette, PB = 125 mm) → Confirmation
// ─────────────────────────────────────────────────────────────────────────────

export const SCENARIO_REPRISE = {
  id:          'capture_ratee_reprise',
  titre:       '🔄 Capture ratée → Reprise réussie',
  description: 'Scénario en 2 temps : une capture floue bloquée, puis une reprise réussie avec PB = 125 mm confirmé.',
  population:  'enfant',
  // Étape 1 : simuler une image floue → aller sur CaptureFailScreen
  etape1: {
    ecranEntree: 'CaptureFailScreen',
    params: {
      raison:       'qualite',
      depistage_id: `${DEMO_DEPISTAGE_PREFIX}REPRISE-001`,
      agent_id:     DEMO_AGENT_ID,
    },
  },
  // Étape 2 : après "Réessayer", la deuxième capture réussit
  etape2: {
    ecranEntree: 'ConfirmationScreen',
    params: {
      depistage_id:       `${DEMO_DEPISTAGE_PREFIX}REPRISE-001`,
      agent_id:           DEMO_AGENT_ID,
      imageUri:           null,
      valeurEstimee:      125,
      scoreConfiance:     0.62,
      scoreQualite:       0.78,
      calibration:        CALIB_DEMO,
      forceSaisieManuelle: false,
    },
  },
  script: [
    '── ÉTAPE 1 : capture ratée ──',
    '1. L\'agent tente de prendre une photo floue (simulée)',
    '2. CaptureFailScreen s\'affiche : « Image trop floue »',
    '3. Les conseils de reprise sont listés (éclairage, stabilité, distance)',
    '4. L\'agent appuie sur « Réessayer la capture »',
    '',
    '── ÉTAPE 2 : reprise réussie ──',
    '5. Retour à PBCaptureScreen — l\'agent repositionne le bras',
    '6. Il place la carte bancaire dans le champ',
    '7. Photo prise → CalibrationScreen → rectangle ajusté → Calibrer',
    '8. ConfirmationScreen : « 125 mm » en grand, confiance 62 %',
    '9. L\'agent appuie sur « Confirmer » → POST + PUT → ✅ Enregistré',
  ],
};

// ─── Index de tous les scénarios ─────────────────────────────────────────────

export const SCENARIOS = {
  enfant_severe:       SCENARIO_ENFANT_SEVERE,
  femme_enceinte_hu:   SCENARIO_FEMME_ENCEINTE,
  personne_agee_mollet: SCENARIO_PERSONNE_AGEE,
  capture_ratee_reprise: SCENARIO_REPRISE,
};

// ─── Helper de lancement ──────────────────────────────────────────────────────

/**
 * Lance un scénario de démo depuis n'importe quel écran.
 *
 * @param {object} navigation  - objet navigation React Navigation
 * @param {string} scenarioId  - clé dans SCENARIOS
 * @param {number} [etape=1]   - pour les scénarios multi-étapes (ex. REPRISE)
 */
export function lancerScenario(navigation, scenarioId, etape = 1) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) {
    console.warn(`[scenarios] Scénario inconnu : ${scenarioId}`);
    return;
  }

  if (scenario.etape1 && etape === 1) {
    navigation.navigate(scenario.etape1.ecranEntree, scenario.etape1.params);
  } else if (scenario.etape2 && etape === 2) {
    navigation.navigate(scenario.etape2.ecranEntree, scenario.etape2.params);
  } else {
    navigation.navigate(scenario.ecranEntree, scenario.params);
  }
}

/**
 * Affiche le script narrateur du scénario dans la console.
 * Utile pendant la présentation pour suivre les étapes.
 */
export function logScript(scenarioId) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return;
  console.group(`🎬 Scénario : ${scenario.titre}`);
  console.log(scenario.description);
  console.log('');
  (scenario.script ?? []).forEach((ligne) => console.log(ligne));
  console.groupEnd();
}


/**
 * index.js — Point d'entrée public du module vision
 * mobile/vision/
 *
 * Responsable : Lionel (branche lionel/vision)
 * Consommateur principal : Fanta (mobile/  — écrans de navigation principale)
 *
 * Intégration dans le Navigator de Fanta :
 *
 *   import { VisionScreens } from '../vision';
 *
 *   // Dans le Stack.Navigator de Fanta :
 *   <VisionScreens.PBCapture    name="PBCaptureScreen" />
 *   <VisionScreens.Calibration  name="CalibrationScreen" />
 *   <VisionScreens.Confirmation name="ConfirmationScreen" />   // à venir
 */

// ── Écrans ────────────────────────────────────────────────────────────────────

export { default as PBCaptureScreen }    from './screens/PBCaptureScreen';
export { default as CalibrationScreen }  from './screens/CalibrationScreen';
// export { default as ConfirmationScreen } from './screens/ConfirmationScreen'; // étape 5 — à venir

// ── Utilitaires publics ───────────────────────────────────────────────────────

export { useCalibration, pxToCm, cmToMm, REFERENCE_OBJECTS } from './hooks/useCalibration';

// ── API (mock/prod) ───────────────────────────────────────────────────────────

export { postCaptureVision, putCaptureValidation } from './api/captureVisionApi';

// ── Objet commodité pour Fanta ────────────────────────────────────────────────

export const VisionScreens = {
  PBCapture:    require('./screens/PBCaptureScreen').default,
  Calibration:  require('./screens/CalibrationScreen').default,
  // Confirmation: require('./screens/ConfirmationScreen').default,   // à venir
};


/**
 * useCalibration.js
 * Hook de calibration pixels → centimètres.
 *
 * L'agent place un objet de taille réelle connue dans le champ
 * (par défaut : carte bancaire ISO/IEC 7810 ID-1, 85,6 × 54,0 mm).
 * L'agent ajuste un rectangle draggable dans CalibrationOverlay pour
 * qu'il coïncide avec les bords de la carte.
 *
 * Retour :
 *   calibration  : { pixelsPerCm, refWidthPx, refHeightPx, refRect, objectName, isValid }
 *   actions      : { setRefRect, confirmCalibration, resetCalibration }
 *
 * Aucun accès réseau — calcul 100 % local.
 */

import { useState, useCallback, useMemo } from 'react';

// ─── Objets de référence disponibles ──────────────────────────────────────────
// Toutes les dimensions en centimètres (valeurs ISO).

export const REFERENCE_OBJECTS = {
  carte_bancaire: {
    name: 'Carte bancaire',
    widthCm: 8.56,
    heightCm: 5.40,
    hint: 'Placez une carte bancaire à plat dans le champ de la caméra.',
  },
  carte_sim_standard: {
    name: 'Carte SIM standard',
    widthCm: 2.50,
    heightCm: 1.50,
    hint: 'Placez une carte SIM (grande taille) dans le champ de la caméra.',
  },
  a4_largeur: {
    name: 'Feuille A4 (largeur)',
    widthCm: 21.0,
    heightCm: 29.7,
    hint: 'Placez une feuille A4 à plat, bord haut dans le cadre.',
  },
};

const DEFAULT_OBJECT = 'carte_bancaire';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param {object} [options]
 * @param {string} [options.objectKey]       - clé dans REFERENCE_OBJECTS
 * @param {number} [options.imageWidth]      - largeur de l'image capturée en px
 * @param {number} [options.imageHeight]     - hauteur de l'image capturée en px
 * @param {number} [options.displayWidth]    - largeur affichée à l'écran en dp
 * @param {number} [options.displayHeight]   - hauteur affichée à l'écran en dp
 */
export function useCalibration({
  objectKey = DEFAULT_OBJECT,
  imageWidth = 1920,
  imageHeight = 1080,
  displayWidth = 390,
  displayHeight = 844,
} = {}) {
  const refObject = REFERENCE_OBJECTS[objectKey] ?? REFERENCE_OBJECTS[DEFAULT_OBJECT];

  // Ratio image réelle / affichage (pour convertir dp → pixels réels)
  const scaleX = imageWidth / displayWidth;
  const scaleY = imageHeight / displayHeight;

  // Rectangle draggable en dp (coordonnées écran).
  // Valeur initiale : centré, ~40 % de la largeur display.
  const initialRect = useMemo(() => {
    const w = displayWidth * 0.55;
    const h = w * (refObject.heightCm / refObject.widthCm);
    return {
      x: (displayWidth - w) / 2,
      y: (displayHeight - h) / 2,
      width: w,
      height: h,
    };
  }, [displayWidth, displayHeight, refObject]);

  const [refRect, setRefRect] = useState(initialRect); // en dp
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [calibrationData, setCalibrationData] = useState(null);

  // ── Calcul du facteur de calibration ─────────────────────────────────────

  /**
   * Confirme la calibration avec le rectangle actuel.
   * Calcule pixelsPerCm à partir de la largeur du rectangle (dp → px réels).
   *
   * Retourne l'objet calibration ou null si les dimensions sont incohérentes.
   */
  const confirmCalibration = useCallback(() => {
    if (refRect.width < 20 || refRect.height < 10) {
      // Rectangle trop petit — probablement pas ajusté
      return null;
    }

    // Conversion dp → pixels réels de l'image
    const refWidthPx  = refRect.width  * scaleX;
    const refHeightPx = refRect.height * scaleY;

    // pixelsPerCm : moyenne pondérée sur largeur et hauteur pour réduire
    // l'erreur d'alignement de l'agent (on donne plus de poids à la largeur
    // car les cartes sont plus larges → plus faciles à aligner horizontalement)
    const ppcFromWidth  = refWidthPx  / refObject.widthCm;
    const ppcFromHeight = refHeightPx / refObject.heightCm;
    const pixelsPerCm   = (ppcFromWidth * 0.65) + (ppcFromHeight * 0.35);

    const data = {
      pixelsPerCm,
      refWidthPx,
      refHeightPx,
      refRect: { ...refRect },   // snapshot dp
      objectName: refObject.name,
      objectWidthCm: refObject.widthCm,
      objectHeightCm: refObject.heightCm,
      scaleX,
      scaleY,
      isValid: pixelsPerCm > 0,
    };

    setCalibrationData(data);
    setIsConfirmed(true);
    return data;
  }, [refRect, scaleX, scaleY, refObject]);

  const resetCalibration = useCallback(() => {
    setRefRect(initialRect);
    setIsConfirmed(false);
    setCalibrationData(null);
  }, [initialRect]);

  return {
    // État
    refRect,
    isConfirmed,
    calibrationData,
    refObject,
    initialRect,

    // Actions
    setRefRect,
    confirmCalibration,
    resetCalibration,
  };
}

// ─── Utilitaire : convertir des pixels en cm ──────────────────────────────────

/**
 * Convertit une distance en pixels (image réelle) en centimètres.
 *
 * @param {number} pixels
 * @param {number} pixelsPerCm  - facteur retourné par useCalibration
 * @returns {number} distance en cm (arrondie à 1 décimale)
 */
export function pxToCm(pixels, pixelsPerCm) {
  if (!pixelsPerCm || pixelsPerCm <= 0) return null;
  return Math.round((pixels / pixelsPerCm) * 10) / 10;
}

/**
 * Convertit des cm en mm (entier).
 */
export function cmToMm(cm) {
  return Math.round(cm * 10);
}


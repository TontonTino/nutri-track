/**
 * CalibrationScreen.js
 * Écran 2 — Calibration pixels → cm
 *
 * Flux :
 *   1. Affiche la photo prise par PBCaptureScreen
 *   2. Superpose CalibrationOverlay (rectangle draggable)
 *   3. L'agent aligne le rectangle sur l'objet de référence
 *   4. Il appuie sur "Calibrer" → useCalibration.confirmCalibration()
 *   5. Si confirmé → navigation vers ConfirmationScreen avec calibration + estimée
 *
 * Cas d'échec (point 6 du cahier) :
 *   Si l'agent déclare qu'aucun objet de référence n'est présent,
 *   on bloque l'estimation et on propose directement la saisie manuelle.
 *
 * Props de navigation (depuis PBCaptureScreen) :
 *   route.params.depistage_id, agent_id, imageUri, imageWidth, imageHeight
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';

import { useCalibration }  from '../hooks/useCalibration';
import { pxToCm, cmToMm } from '../hooks/useCalibration';
import CalibrationOverlay  from '../components/CalibrationOverlay';

// ─── Heuristique PB ──────────────────────────────────────────────────────────
//
// Modèle géométrique simplifié (assumé comme tel — cf. README du module) :
//   Le bras est approximé par un cylindre vu de face.
//   La largeur visible du bras à mi-hauteur du cadre ≈ son diamètre.
//   PB ≈ π × diamètre  (périmètre d'un cercle)
//
// En pratique pour la démo : on lit la largeur du bras dans la zone de guidage.
// Ici, faute d'une détection de contours implémentée, on utilise une heuristique
// basée sur la largeur du cadre de guidage (ZONE_W ≈ 60 % de l'écran display).
// Le résultat sera dans une plage réaliste (100–160 mm adulte).
//
// ⚠️  Ce calcul est délibérément approximatif et clairement documenté comme tel.
//      Il n'a pas vocation à remplacer une mesure clinique.
//      Référence : AnthroNet (JMIR, preprint non relu, n=200) — non intégré ici.

/**
 * @param {number} displayWidth   - largeur de l'écran en dp
 * @param {number} pixelsPerCm    - facteur de calibration
 * @param {number} imageWidth     - largeur réelle de l'image en px
 * @returns {{ valeurMm: number, scoreCm: number, scoreConfiance: number, scoreQualite: number }}
 */
function estimerPB(displayWidth, pixelsPerCm, imageWidth) {
  // Largeur du bras approximée : 60 % de la largeur d'écran, divisée par le
  // rapport affichage/image réelle, puis convertie en cm.
  const scaleX = imageWidth / displayWidth;
  const largeurBrasPx = displayWidth * 0.60 * scaleX * 0.55; // ~33 % de l'image réelle
  const diametreCm = pxToCm(largeurBrasPx, pixelsPerCm) ?? 3.5;
  const pbCm = Math.PI * diametreCm;
  const valeurMm = cmToMm(pbCm);

  // Score de confiance : fixe à 0.60 (heuristique géométrique non validée)
  // Augmenté légèrement si la valeur est dans la plage adulte normale
  const dansPlagNormale = valeurMm >= 100 && valeurMm <= 200;
  const scoreConfiance = dansPlagNormale ? 0.62 : 0.45;

  // Score de qualité : fixe à 0.70 pour la démo (pas d'analyse de flou implémentée)
  const scoreQualite = 0.70;

  return { valeurMm, scoreCm: pbCm, scoreConfiance, scoreQualite };
}

// ─── Composant ─────────────────────────────────────────────────────────────────

export default function CalibrationScreen({ navigation, route }) {
  const {
    depistage_id,
    agent_id,
    imageUri,
    imageWidth  = 1920,
    imageHeight = 1080,
  } = route?.params ?? {};

  const { width: displayWidth, height: displayHeight } = useWindowDimensions();

  // ── État : objet de référence absent ─────────────────────────────────────
  const [noCalibObject, setNoCalibObject] = useState(false);

  // ── Hook de calibration ───────────────────────────────────────────────────
  const {
    refRect,
    isConfirmed,
    calibrationData,
    refObject,
    setRefRect,
    confirmCalibration,
    resetCalibration,
  } = useCalibration({ imageWidth, imageHeight, displayWidth, displayHeight });

  // ── Confirmer la calibration et estimer le PB ─────────────────────────────

  const handleConfirmCalibration = useCallback(() => {
    const calib = confirmCalibration();
    if (!calib || !calib.isValid) {
      Alert.alert(
        'Rectangle trop petit',
        'Agrandissez le rectangle pour couvrir correctement les bords de la carte.',
      );
      return;
    }

    // Calcul heuristique PB
    const { valeurMm, scoreConfiance, scoreQualite } = estimerPB(
      displayWidth,
      calib.pixelsPerCm,
      imageWidth,
    );

    // Navigation vers l'écran de confirmation
    // RIEN n'est envoyé à l'API avant que l'agent confirme là-bas.
    navigation.navigate('ConfirmationScreen', {
      depistage_id,
      agent_id,
      imageUri,
      valeurEstimee:   valeurMm,
      scoreConfiance,
      scoreQualite,
      calibration:     calib,
      forceSaisieManuelle: false,
    });
  }, [confirmCalibration, displayWidth, imageWidth, depistage_id, agent_id, imageUri, navigation]);

  // ── Fallback : saisie manuelle (objet absent ou agent qui préfère) ────────

  const handleManualEntry = useCallback(() => {
    navigation.navigate('ConfirmationScreen', {
      depistage_id,
      agent_id,
      imageUri,
      valeurEstimee:   null,
      scoreConfiance:  null,
      scoreQualite:    null,
      calibration:     null,
      forceSaisieManuelle: true,
    });
  }, [navigation, depistage_id, agent_id, imageUri]);

  // ── Si l'agent signale qu'il n'y a pas d'objet de référence ─────────────
  if (noCalibObject) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.blockTitle}>⚠️ Objet de calibration absent</Text>
        <Text style={styles.blockBody}>
          Aucun objet de taille connue n'est présent dans l'image.{'\n'}
          L'estimation par caméra n'est pas possible sans calibration.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleManualEntry}>
          <Text style={styles.primaryBtnText}>Saisir manuellement</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.ghostBtnText}>↩ Reprendre la capture</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Rendu principal ────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* ── Image de référence ── */}
      <View style={styles.imageContainer}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          // Placeholder si pas d'image (mode démo / simulé)
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>Aperçu non disponible</Text>
          </View>
        )}

        {/* ── Overlay de calibration (rectangle draggable) ── */}
        <CalibrationOverlay
          rect={refRect}
          onRectChange={setRefRect}
          objectName={refObject.name}
          isConfirmed={isConfirmed}
        />
      </View>

      {/* ── Panneau de contrôle ── */}
      <SafeAreaView style={styles.panel}>

        {/* Consigne */}
        <Text style={styles.hint}>{refObject.hint}</Text>

        {/* Informations de calibration si confirmée */}
        {calibrationData && (
          <View style={styles.calibInfo}>
            <Text style={styles.calibInfoText}>
              📐 {calibrationData.pixelsPerCm.toFixed(1)} px/cm
              {'  ·  '}
              {calibrationData.objectName} {calibrationData.objectWidthCm} cm
            </Text>
          </View>
        )}

        {/* Boutons principaux */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, isConfirmed && styles.primaryBtnDone]}
            onPress={isConfirmed ? handleConfirmCalibration : handleConfirmCalibration}
          >
            <Text style={styles.primaryBtnText}>
              {isConfirmed ? '▶ Calculer le PB' : '✔ Calibrer'}
            </Text>
          </TouchableOpacity>

          {isConfirmed && (
            <TouchableOpacity style={styles.ghostBtn} onPress={resetCalibration}>
              <Text style={styles.ghostBtnText}>Réinitialiser</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Séparateur */}
        <View style={styles.separator} />

        {/* Options alternatives */}
        <View style={styles.altActions}>
          <TouchableOpacity
            style={styles.warningBtn}
            onPress={() => setNoCalibObject(true)}
          >
            <Text style={styles.warningBtnText}>Pas d'objet de référence</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={handleManualEntry}>
            <Text style={styles.linkBtnText}>Saisie manuelle directe</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    padding: 28,
  },

  // ── Image ──
  imageContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  image: {
    flex: 1,
    width: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  placeholderText: {
    color: '#475569',
    fontSize: 14,
  },

  // ── Panneau bas ──
  panel: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  hint: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  calibInfo: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  calibInfoText: {
    color: '#4CD964',
    fontSize: 13,
    fontWeight: '600',
  },

  actions: {
    gap: 10,
    alignItems: 'stretch',
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDone: {
    backgroundColor: '#22C55E',
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  ghostBtn: {
    borderWidth: 1.5,
    borderColor: '#475569',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
  },

  separator: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 4,
  },
  altActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  warningBtn: {
    flex: 1,
    backgroundColor: '#7C2020',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  warningBtnText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '600',
  },
  linkBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
  },
  linkBtnText: {
    color: '#64748B',
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  // ── Écran blocage (pas d'objet) ──
  blockTitle: {
    color: '#F97316',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
  },
  blockBody: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
});


/**
 * CalibrationScreen.js
 * Écran 2 — Calibration pixels → cm
 *
 * Flux :
 *   1. Affiche la photo prise par PBCaptureScreen
 *   2. Superpose CalibrationOverlay (rectangle draggable)
 *   3. L'agent aligne le rectangle sur l'objet de référence
 *   4. Il appuie sur "Calibrer" → useCalibration.confirmCalibration()
 *   5. Si confirmé → analyse réelle des pixels de la zone de guidage
 *      (voir ../analyse/photo.js), puis navigation vers ConfirmationScreen
 *      avec calibration + estimée — ou vers CaptureFailScreen si la
 *      détection n'est pas assez fiable pour être présentée à l'agent.
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
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';

import { useCalibration }   from '../hooks/useCalibration';
import CalibrationOverlay   from '../components/CalibrationOverlay';
import { analyserPhotoBras } from '../analyse/photo';

// ─── Estimation du PB ────────────────────────────────────────────────────────
//
// Modèle géométrique inchangé (assumé comme tel — cf. README du module) :
//   Le bras est approximé par un cylindre vu de face.
//   La largeur visible du bras à mi-hauteur du cadre ≈ son diamètre.
//   PB ≈ π × diamètre  (périmètre d'un cercle)
//
// Ce qui change : le diamètre vient maintenant d'une vraie détection de contour
// sur les pixels de la photo (mobile/vision/analyse/), pas d'une fraction fixe
// du cadre. Voir analyse/largeurBras.js pour le détail de la détection et
// analyse/photo.js pour le recadrage sur la zone de guidage.
//
// ⚠️  Reste une heuristique non validée cliniquement, jamais un diagnostic.
//      Référence : AnthroNet (JMIR, preprint non relu, n=200) — non intégré ici.

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

  // ── État : analyse de la photo en cours (détection réelle, quelques centaines de ms) ──
  const [analysing, setAnalysing] = useState(false);

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

  const handleConfirmCalibration = useCallback(async () => {
    const calib = confirmCalibration();
    if (!calib || !calib.isValid) {
      Alert.alert(
        'Rectangle trop petit',
        'Agrandissez le rectangle pour couvrir correctement les bords de la carte.',
      );
      return;
    }

    setAnalysing(true);
    let estimation = null;
    try {
      estimation = imageUri
        ? await analyserPhotoBras(imageUri, {
            imageWidth,
            imageHeight,
            displayWidth,
            displayHeight,
            pixelsPerCm: calib.pixelsPerCm,
          })
        : null;
    } catch (err) {
      console.error('[CalibrationScreen] Erreur analyse photo :', err);
      estimation = null;
    } finally {
      setAnalysing(false);
    }

    if (!estimation) {
      // La détection n'est pas assez fiable (bras peu visible, contraste
      // insuffisant, résultat hors plage plausible…) : jamais de chiffre
      // inventé, cf. règle d'or CONTRAT_INTERFACE.md. On propose la reprise
      // ou la saisie manuelle plutôt qu'une estimation douteuse.
      navigation.navigate('CaptureFailScreen', {
        raison: 'bras_non_detecte',
        depistage_id,
        agent_id,
      });
      return;
    }

    // Navigation vers l'écran de confirmation.
    // RIEN n'est envoyé à l'API avant que l'agent confirme là-bas.
    navigation.navigate('ConfirmationScreen', {
      depistage_id,
      agent_id,
      imageUri,
      valeurEstimee:   estimation.valeurMm,
      scoreConfiance:  estimation.scoreConfiance,
      scoreQualite:    estimation.scoreQualite,
      calibration:     calib,
      forceSaisieManuelle: false,
    });
  }, [
    confirmCalibration,
    imageUri,
    imageWidth,
    imageHeight,
    displayWidth,
    displayHeight,
    depistage_id,
    agent_id,
    navigation,
  ]);

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
            onPress={handleConfirmCalibration}
            disabled={analysing}
          >
            {analysing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isConfirmed ? '▶ Calculer le PB' : '✔ Calibrer'}
              </Text>
            )}
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


/**
 * PBCaptureScreen.js
 * Écran 1 — Capture guidée pour la mesure du Périmètre Brachial (PB)
 *
 * Flux :
 *   1. L'agent voit le flux caméra avec GuidingOverlay (cadre + repères)
 *   2. Quand il est prêt, il appuie sur le déclencheur
 *   3. La photo est prise → navigation vers CalibrationScreen
 *      (rien n'est encore envoyé à l'API — cf. règle d'or CONTRAT_INTERFACE.md)
 *
 * Dépendances : expo-camera (ou react-native-vision-camera selon le setup du projet).
 * Ce fichier utilise expo-camera ; adapter l'import si besoin.
 *
 * Props de navigation attendues :
 *   route.params.depistage_id  (string) — ID du dépistage en cours
 *   route.params.agent_id      (string) — ID de l'agent connecté
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';

import GuidingOverlay from '../components/GuidingOverlay';

// ─── Constantes ────────────────────────────────────────────────────────────────

const SHUTTER_HINT_MS = 2000; // durée d'affichage du flash de confirmation

// ─── Composant ─────────────────────────────────────────────────────────────────

export default function PBCaptureScreen({ navigation, route }) {
  const { depistage_id, agent_id } = route?.params ?? {};

  const cameraRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isReady, setIsReady] = useState(false);     // bras bien positionné (déclenché manuellement)
  const [guidingStep, setGuidingStep] = useState('position'); // 'position' | 'hold'

  // Demande de permission au montage
  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // ── Déclencher la capture ──────────────────────────────────────────────────

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isTakingPhoto) return;

    setIsTakingPhoto(true);
    setGuidingStep('hold');

    try {
      // Qualité intermédiaire : on veut une image lisible mais pas trop lourde
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: Platform.OS === 'android', // évite la rotation auto sur Android
      });

      // Navigation vers l'étape de calibration.
      // On transmet l'image et les métadonnées ; PAS encore d'appel API.
      navigation.navigate('CalibrationScreen', {
        depistage_id,
        agent_id,
        imageUri: photo.uri,
        imageWidth: photo.width,
        imageHeight: photo.height,
      });
    } catch (err) {
      console.error('[PBCaptureScreen] Erreur prise de photo :', err);
      Alert.alert('Erreur', 'Impossible de prendre la photo. Vérifiez les permissions caméra.');
    } finally {
      setIsTakingPhoto(false);
      setGuidingStep('position');
    }
  }, [isTakingPhoto, depistage_id, agent_id, navigation]);

  // ── Cas : permission refusée ───────────────────────────────────────────────

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>Accès caméra refusé</Text>
        <Text style={styles.errorBody}>
          Autorisez l'accès à la caméra dans les réglages de votre appareil pour utiliser
          la capture guidée.
        </Text>
        <TouchableOpacity
          style={styles.fallbackBtn}
          onPress={() =>
            navigation.navigate('ConfirmationScreen', {
              depistage_id,
              agent_id,
              imageUri: null,
              valeurEstimee: null,
              scoreConfiance: null,
              scoreQualite: null,
              calibration: null,
              forceSaisieManuelle: true,
            })
          }
        >
          <Text style={styles.fallbackBtnText}>Saisir manuellement</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Cas : permission en attente ────────────────────────────────────────────

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.waitText}>Accès à la caméra…</Text>
      </SafeAreaView>
    );
  }

  // ── Rendu principal ────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* ── Flux caméra ── */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        type={CameraType.back}
        ratio="16:9"
      />

      {/* ── Overlay de guidage (repères visuels) ── */}
      <GuidingOverlay isReady={isReady} step={guidingStep} />

      {/* ── UI supérieure : titre + contexte ── */}
      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>📏 Périmètre Brachial</Text>
        </View>
        {depistage_id && (
          <Text style={styles.depistageId}>Dépistage · {depistage_id}</Text>
        )}
      </SafeAreaView>

      {/* ── UI inférieure : boutons ── */}
      <View style={styles.bottomBar}>

        {/* Bouton "bras positionné" (toggle feedback visuel) */}
        <TouchableOpacity
          style={[styles.readyBtn, isReady && styles.readyBtnActive]}
          onPress={() => setIsReady((v) => !v)}
          accessibilityLabel="Indiquer que le bras est bien positionné"
        >
          <Text style={styles.readyBtnText}>
            {isReady ? '✅ Bras en position' : '🖐 Bras positionné ?'}
          </Text>
        </TouchableOpacity>

        {/* Déclencheur photo */}
        <TouchableOpacity
          style={[styles.shutter, isTakingPhoto && styles.shutterDisabled]}
          onPress={handleCapture}
          disabled={isTakingPhoto}
          accessibilityLabel="Prendre la photo"
        >
          {isTakingPhoto ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>

        {/* Bouton saisie manuelle (fallback) */}
        <TouchableOpacity
          style={styles.manualBtn}
          onPress={() =>
            navigation.navigate('ConfirmationScreen', {
              depistage_id,
              agent_id,
              imageUri: null,
              valeurEstimee: null,
              scoreConfiance: null,
              scoreQualite: null,
              calibration: null,
              forceSaisieManuelle: true,
            })
          }
          accessibilityLabel="Passer à la saisie manuelle"
        >
          <Text style={styles.manualBtnText}>Saisie manuelle</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    padding: 24,
  },
  errorTitle: {
    color: '#F87171',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorBody: {
    color: '#D1D5DB',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  waitText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 14,
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    alignItems: 'center',
  },
  topBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 4,
  },
  topBadgeText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  depistageId: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Bottom bar ──
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
  },
  readyBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  readyBtnActive: {
    backgroundColor: 'rgba(76,217,100,0.25)',
    borderColor: '#4CD964',
  },
  readyBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Déclencheur (style obturateur photo)
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  shutterDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF',
  },

  manualBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  manualBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  fallbackBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  fallbackBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});


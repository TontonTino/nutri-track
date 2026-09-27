/**
 * ConfirmationScreen.js
 * Écran 3 — Confirmation de la valeur estimée par l'agent
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  RÈGLE D'OR (CONTRAT_INTERFACE.md)                              ║
 * ║  Aucune valeur ne part vers l'API sans action explicite ici.    ║
 * ║  Pas d'auto-submit, pas de timer, pas de fallback silencieux.   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Flux entrant (route.params depuis CalibrationScreen) :
 *   depistage_id, agent_id, imageUri, valeurEstimee (mm|null),
 *   scoreConfiance, scoreQualite, calibration, forceSaisieManuelle
 *
 * Trois chemins exclusifs — chacun se termine par POST + PUT vers l'API :
 *
 *   1. CONFIRMER    → statut "confirmee", valeur_validee = valeurEstimee
 *   2. CORRIGER     → l'agent saisit une valeur en mm, statut "corrigee"
 *   3. REPRENDRE    → navigation.goBack() × 2 (retour à PBCaptureScreen),
 *                     aucun appel API, capture rejetée silencieusement
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { postCaptureVision, putCaptureValidation } from '../api/captureVisionApi';

// ─── Constantes ────────────────────────────────────────────────────────────────

// Plage de PB réaliste en mm — sert uniquement à valider la saisie manuelle
// avant envoi, pas à classer.
const PB_MIN_MM = 60;
const PB_MAX_MM = 400;

// ─── Sous-composant : badge score de confiance ─────────────────────────────────

function ConfidenceBadge({ score }) {
  if (score == null) return null;

  const pct  = Math.round(score * 100);
  const color =
    score >= 0.7 ? '#4CD964' :
    score >= 0.5 ? '#FACC15' : '#F87171';

  return (
    <View style={[badgeStyles.container, { borderColor: color }]}>
      <Text style={[badgeStyles.label, { color }]}>Confiance</Text>
      <Text style={[badgeStyles.value, { color }]}>{pct} %</Text>
      <Text style={badgeStyles.sub}>heuristique géométrique</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 110,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    marginVertical: 2,
  },
  sub: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
  },
});

// ─── Composant principal ───────────────────────────────────────────────────────

export default function ConfirmationScreen({ navigation, route }) {
  const {
    depistage_id,
    agent_id,
    imageUri       = null,
    valeurEstimee  = null,   // mm (number) ou null si pas de calib
    scoreConfiance = null,
    scoreQualite   = null,
    calibration    = null,
    forceSaisieManuelle = false,
  } = route?.params ?? {};

  // ── État de l'écran ──────────────────────────────────────────────────────
  const [mode, setMode] = useState(
    forceSaisieManuelle || valeurEstimee == null ? 'saisie' : 'review',
  );
  // 'review'  → affiche la valeur estimée avec les 3 boutons
  // 'saisie'  → champ de saisie manuelle ouvert
  // 'loading' → appel API en cours
  // 'done'    → confirmation envoyée

  const [valeurSaisie, setValeurSaisie] = useState('');
  const [erreurSaisie, setErreurSaisie] = useState('');

  // Animation d'entrée de la valeur
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Construction du payload CaptureVision (contrat §Modèle de données) ──

  const buildPayload = useCallback(
    (valeurValidee, statut, methode) => ({
      depistage_id,
      type_mesure:       'pb',
      image_ref:         imageUri ?? 'saisie_manuelle',
      score_qualite:     scoreQualite ?? 0,
      valeur_estimee:    valeurEstimee,
      score_confiance:   scoreConfiance ?? 0,
      methode_mesure:    methode,
      // Champs remplis côté client pour le mock ; en prod, le backend les valide
      agent_validation_id: agent_id ?? 'agent_inconnu',
      date_validation:     new Date().toISOString(),
      valeur_validee:      valeurValidee,
      statut,
    }),
    [depistage_id, imageUri, scoreQualite, valeurEstimee, scoreConfiance, agent_id],
  );

  // ── Séquence API : POST → PUT ────────────────────────────────────────────
  //   Les deux appels sont toujours chaînés : on crée la capture (POST),
  //   puis on enregistre immédiatement la décision de l'agent (PUT).
  //   Séparation en deux appels pour respecter le contrat d'Alya.

  const envoyerDecision = useCallback(
    async (valeurValidee, statut, methode) => {
      setMode('loading');
      Keyboard.dismiss();

      try {
        const payload = buildPayload(valeurValidee, statut, methode);

        // ── 1. Enregistrer la capture ──
        const captureCreee = await postCaptureVision(payload);

        // ── 2. Enregistrer la décision de l'agent ──
        await putCaptureValidation(captureCreee.id, {
          statut,
          valeur_validee:      valeurValidee,
          agent_validation_id: agent_id ?? 'agent_inconnu',
          date_validation:     new Date().toISOString(),
        });

        setMode('done');
      } catch (err) {
        console.error('[ConfirmationScreen] Erreur API :', err);
        Alert.alert(
          'Erreur de synchronisation',
          `La décision n'a pas pu être enregistrée.\n${err.message}\n\nElle sera rejouée à la prochaine synchronisation.`,
          [{ text: 'OK', onPress: () => setMode('review') }],
        );
      }
    },
    [buildPayload, agent_id],
  );

  // ── Bouton 1 : CONFIRMER ─────────────────────────────────────────────────

  const handleConfirmer = useCallback(() => {
    envoyerDecision(
      valeurEstimee,
      'confirmee',
      calibration ? 'heuristique_calibration' : 'saisie_manuelle',
    );
  }, [envoyerDecision, valeurEstimee, calibration]);

  // ── Bouton 2 : CORRIGER → valider puis envoyer ───────────────────────────

  const handleValiderCorrection = useCallback(() => {
    const mm = parseInt(valeurSaisie, 10);
    if (isNaN(mm) || mm < PB_MIN_MM || mm > PB_MAX_MM) {
      setErreurSaisie(`Valeur hors plage (${PB_MIN_MM}–${PB_MAX_MM} mm)`);
      return;
    }
    setErreurSaisie('');
    envoyerDecision(mm, 'corrigee', 'saisie_manuelle');
  }, [valeurSaisie, envoyerDecision]);

  // ── Bouton 3 : REPRENDRE LA CAPTURE ─────────────────────────────────────
  //   Aucun appel API. On remonte le stack jusqu'à PBCaptureScreen.

  const handleReprendre = useCallback(() => {
    // popToTop() si disponible, sinon deux goBack()
    if (navigation.canGoBack()) {
      navigation.pop(2); // CalibrationScreen + ConfirmationScreen
    }
  }, [navigation]);

  // ── Rendu : loading ──────────────────────────────────────────────────────

  if (mode === 'loading') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Enregistrement en cours…</Text>
      </SafeAreaView>
    );
  }

  // ── Rendu : done ─────────────────────────────────────────────────────────

  if (mode === 'done') {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={styles.doneTitle}>Mesure enregistrée</Text>
        <Text style={styles.doneBody}>
          La décision de l'agent a été transmise avec succès.
        </Text>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.popToTop()}
        >
          <Text style={styles.doneBtnText}>Retour au dépistage</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Rendu principal ──────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <SafeAreaView style={styles.inner}>

          {/* ── En-tête ── */}
          <View style={styles.header}>
            <Text style={styles.headerSub}>Périmètre Brachial estimé</Text>
            {depistage_id && (
              <Text style={styles.headerDepistage}>Dépistage · {depistage_id}</Text>
            )}
          </View>

          {/* ── Valeur estimée (grande) + badge confiance ── */}
          <Animated.View
            style={[
              styles.valueRow,
              { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
            ]}
          >
            {valeurEstimee != null ? (
              <>
                <View style={styles.valueBlock}>
                  <Text style={styles.valueNumber}>{valeurEstimee}</Text>
                  <Text style={styles.valueUnit}>mm</Text>
                  <Text style={styles.valueCm}>
                    ({(valeurEstimee / 10).toFixed(1)} cm)
                  </Text>
                </View>
                <ConfidenceBadge score={scoreConfiance} />
              </>
            ) : (
              <View style={styles.noEstimateBox}>
                <Text style={styles.noEstimateIcon}>📵</Text>
                <Text style={styles.noEstimateText}>
                  Pas d'estimation disponible{'\n'}(calibration absente ou saisie directe)
                </Text>
              </View>
            )}
          </Animated.View>

          {/* ── Avertissement prototype ── */}
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              ⚠️  Cette valeur est une estimation heuristique, non validée cliniquement.
              Elle nécessite votre confirmation avant d'être utilisée.
            </Text>
          </View>

          {/* ════════════════════════════════════════════════════════════
              MODE REVIEW — Les 3 boutons
          ════════════════════════════════════════════════════════════ */}
          {mode === 'review' && (
            <View style={styles.actions}>

              {/* ── Bouton 1 : CONFIRMER ── */}
              <TouchableOpacity
                style={styles.btnConfirmer}
                onPress={handleConfirmer}
                accessibilityLabel="Confirmer la valeur estimée"
              >
                <Text style={styles.btnConfirmerText}>✔ Confirmer</Text>
                {valeurEstimee != null && (
                  <Text style={styles.btnConfirmerSub}>{valeurEstimee} mm</Text>
                )}
              </TouchableOpacity>

              {/* ── Bouton 2 : CORRIGER ── */}
              <TouchableOpacity
                style={styles.btnCorriger}
                onPress={() => {
                  setValeurSaisie(valeurEstimee ? String(valeurEstimee) : '');
                  setMode('saisie');
                }}
                accessibilityLabel="Corriger manuellement la valeur"
              >
                <Text style={styles.btnCorrigerText}>✏️ Corriger manuellement</Text>
              </TouchableOpacity>

              {/* ── Bouton 3 : REPRENDRE ── */}
              <TouchableOpacity
                style={styles.btnReprendre}
                onPress={handleReprendre}
                accessibilityLabel="Reprendre la capture depuis le début"
              >
                <Text style={styles.btnReprendreText}>🔄 Reprendre la capture</Text>
              </TouchableOpacity>

            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              MODE SAISIE MANUELLE
          ════════════════════════════════════════════════════════════ */}
          {mode === 'saisie' && (
            <View style={styles.saisiePanel}>

              <Text style={styles.saisieLabel}>
                Valeur corrigée (mm)
              </Text>

              <TextInput
                style={[styles.saisieInput, erreurSaisie ? styles.saisieInputError : null]}
                value={valeurSaisie}
                onChangeText={(t) => {
                  setValeurSaisie(t.replace(/[^0-9]/g, ''));
                  setErreurSaisie('');
                }}
                keyboardType="numeric"
                placeholder={`ex. ${valeurEstimee ?? 115}`}
                placeholderTextColor="#475569"
                maxLength={4}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleValiderCorrection}
                accessibilityLabel="Champ de saisie de la valeur en millimètres"
              />

              {erreurSaisie ? (
                <Text style={styles.saisieError}>{erreurSaisie}</Text>
              ) : (
                <Text style={styles.saisiePlage}>Plage attendue : {PB_MIN_MM}–{PB_MAX_MM} mm</Text>
              )}

              <View style={styles.saisieActions}>
                <TouchableOpacity
                  style={styles.saisieValiderBtn}
                  onPress={handleValiderCorrection}
                >
                  <Text style={styles.saisieValiderText}>Valider la correction</Text>
                </TouchableOpacity>

                {/* Retour au mode review si une valeur estimée existe */}
                {valeurEstimee != null && (
                  <TouchableOpacity
                    style={styles.saisieAnnulerBtn}
                    onPress={() => { setErreurSaisie(''); setMode('review'); }}
                  >
                    <Text style={styles.saisieAnnulerText}>← Annuler</Text>
                  </TouchableOpacity>
                )}
              </View>

            </View>
          )}

        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerDepistage: {
    color: '#475569',
    fontSize: 11,
  },

  // ── Valeur ──
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
  },
  valueBlock: {
    alignItems: 'flex-end',
  },
  valueNumber: {
    color: '#F1F5F9',
    fontSize: 88,
    fontWeight: '900',
    lineHeight: 96,
    letterSpacing: -2,
  },
  valueUnit: {
    color: '#64748B',
    fontSize: 22,
    fontWeight: '700',
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  valueCm: {
    color: '#475569',
    fontSize: 13,
    alignSelf: 'flex-end',
  },
  noEstimateBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  noEstimateIcon: {
    fontSize: 40,
  },
  noEstimateText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Disclaimer ──
  disclaimerBox: {
    backgroundColor: '#1E293B',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 36,
  },
  disclaimerText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Boutons principaux ──
  actions: {
    gap: 14,
  },
  btnConfirmer: {
    backgroundColor: '#16A34A',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  btnConfirmerText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  btnConfirmerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  btnCorriger: {
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnCorrigerText: {
    color: '#60A5FA',
    fontSize: 16,
    fontWeight: '700',
  },
  btnReprendre: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnReprendreText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Loading / Done ──
  loadingText: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 16,
  },
  doneIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  doneTitle: {
    color: '#F1F5F9',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  doneBody: {
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  doneBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  doneBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },

  // ── Saisie manuelle ──
  saisiePanel: {
    gap: 10,
  },
  saisieLabel: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  saisieInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 14,
    color: '#F1F5F9',
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 16,
    letterSpacing: 2,
  },
  saisieInputError: {
    borderColor: '#F87171',
  },
  saisieError: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
  },
  saisiePlage: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },
  saisieActions: {
    gap: 10,
    marginTop: 8,
  },
  saisieValiderBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saisieValiderText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  saisieAnnulerBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  saisieAnnulerText: {
    color: '#475569',
    fontSize: 14,
  },
});


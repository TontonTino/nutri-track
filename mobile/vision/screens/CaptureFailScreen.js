/**
 * CaptureFailScreen.js
 * Écran de cas d'échec — capture ratée → reprise guidée
 *
 * Déclenché depuis PBCaptureScreen ou CalibrationScreen quand :
 *   - La mise au point est insuffisante (score_qualite < SEUIL_QUALITE)
 *   - L'objet de calibration est absent (cas 6 du cahier)
 *   - L'agent a appuyé sur "Reprendre la capture" dans ConfirmationScreen
 *
 * Deux sorties :
 *   A. "Réessayer" → retour à PBCaptureScreen avec les mêmes params
 *   B. "Saisir manuellement" → ConfirmationScreen en mode saisie directe
 *
 * Props de navigation attendues :
 *   route.params.raison       ('qualite'|'calibration'|'agent') — cause de l'échec
 *   route.params.depistage_id
 *   route.params.agent_id
 *   route.params.conseils     (string[])  — conseils spécifiques à afficher
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';

// ─── Messages et conseils selon la raison d'échec ─────────────────────────────

const RAISON_CONFIG = {
  qualite: {
    icon: '🌫️',
    titre: 'Image trop floue',
    description:
      'La netteté de l\'image est insuffisante pour une mesure fiable.\nAssurez-vous que la caméra est stable et que le bras est bien éclairé.',
    conseils: [
      'Appuyez une fois sur l\'écran pour forcer la mise au point',
      'Évitez les contre-jours — placez-vous face à une source lumineuse',
      'Maintenez le téléphone à 30–40 cm du bras',
      'Attendez 1–2 secondes après avoir immobilisé le bras avant de déclencher',
    ],
  },
  calibration: {
    icon: '📐',
    titre: 'Objet de calibration absent',
    description:
      'Aucun objet de taille connue n\'est visible dans l\'image.\nSans calibration, l\'estimation est impossible.',
    conseils: [
      'Placez une carte bancaire (8,56 cm × 5,40 cm) à côté du bras',
      'L\'objet doit être intégralement visible dans le champ',
      'Il doit être à la même distance de la caméra que le bras',
      'Alternative : utilisez une feuille A4 pliée en deux',
    ],
  },
  agent: {
    icon: '🔄',
    titre: 'Reprise demandée',
    description:
      'L\'agent a choisi de reprendre la capture depuis le début.\nAucune donnée n\'a été enregistrée.',
    conseils: [
      'Repositionnez le bras dans le cadre de référence',
      'Vérifiez que l\'éclairage est suffisant',
      'Placez l\'objet de calibration avant de déclencher',
    ],
  },
  inconnu: {
    icon: '⚠️',
    titre: 'Capture échouée',
    description: 'Une erreur inattendue s\'est produite lors de la capture.',
    conseils: ['Réessayez dans de meilleures conditions'],
  },
};

// ─── Composant ─────────────────────────────────────────────────────────────────

export default function CaptureFailScreen({ navigation, route }) {
  const {
    raison       = 'inconnu',
    depistage_id,
    agent_id,
    conseils: conseilsOverride, // si l'appelant veut injecter des conseils custom
  } = route?.params ?? {};

  const config   = RAISON_CONFIG[raison] ?? RAISON_CONFIG.inconnu;
  const conseils = conseilsOverride ?? config.conseils;

  // ── Réessayer : retour à PBCaptureScreen ──────────────────────────────────

  const handleReessayer = () => {
    navigation.navigate('PBCaptureScreen', { depistage_id, agent_id });
  };

  // ── Saisie manuelle directe ───────────────────────────────────────────────

  const handleSaisieManuelle = () => {
    navigation.navigate('ConfirmationScreen', {
      depistage_id,
      agent_id,
      imageUri:             null,
      valeurEstimee:        null,
      scoreConfiance:       null,
      scoreQualite:         null,
      calibration:          null,
      forceSaisieManuelle:  true,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Icône + titre ── */}
        <View style={styles.heroSection}>
          <Text style={styles.heroIcon}>{config.icon}</Text>
          <Text style={styles.heroTitle}>{config.titre}</Text>
          <Text style={styles.heroDesc}>{config.description}</Text>
        </View>

        {/* ── Conseils ── */}
        <View style={styles.conseilsCard}>
          <Text style={styles.conseilsHeader}>💡 Comment améliorer la capture</Text>
          {conseils.map((c, i) => (
            <View key={i} style={styles.conseilRow}>
              <Text style={styles.conseilBullet}>{i + 1}.</Text>
              <Text style={styles.conseilText}>{c}</Text>
            </View>
          ))}
        </View>

        {/* ── Historique de l'échec (pour la démo : badge visible) ── */}
        <View style={styles.failBadge}>
          <Text style={styles.failBadgeText}>
            Raison · {raison} · Dépistage {depistage_id ?? '—'}
          </Text>
        </View>

        {/* ── Actions ── */}
        <View style={styles.actions}>

          {/* Bouton principal : RÉESSAYER */}
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleReessayer}
            accessibilityLabel="Réessayer la capture"
          >
            <Text style={styles.btnPrimaryText}>📷 Réessayer la capture</Text>
          </TouchableOpacity>

          {/* Bouton secondaire : SAISIE MANUELLE */}
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={handleSaisieManuelle}
            accessibilityLabel="Saisir la valeur manuellement"
          >
            <Text style={styles.btnSecondaryText}>✏️ Saisir manuellement</Text>
          </TouchableOpacity>

        </View>

      </ScrollView>
    </SafeAreaView>
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
    padding: 24,
    justifyContent: 'center',
  },

  // ── Hero ──
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  heroTitle: {
    color: '#F1F5F9',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  heroDesc: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Conseils ──
  conseilsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    gap: 10,
  },
  conseilsHeader: {
    color: '#FACC15',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  conseilRow: {
    flexDirection: 'row',
    gap: 8,
  },
  conseilBullet: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    width: 18,
  },
  conseilText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },

  // ── Badge d'échec ──
  failBadge: {
    alignItems: 'center',
    marginBottom: 28,
  },
  failBadgeText: {
    color: '#334155',
    fontSize: 11,
    fontFamily: 'monospace',
  },

  // ── Actions ──
  actions: {
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  btnSecondary: {
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
});


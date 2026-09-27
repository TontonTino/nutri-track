/**
 * GuidingOverlay.js
 * Superposition de repères visuels pour le cadrage du bras (mesure PB).
 *
 * Affiché en permanence par-dessus le flux caméra dans PBCaptureScreen.
 * Ne fait aucun calcul — responsabilité unique : guider l'agent pour
 * positionner le bras dans la zone de référence.
 *
 * Props :
 *   - isReady (bool) : le bras est positionné correctement (allume les repères)
 *   - step    ('position'|'hold') : étape actuelle du guidage
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Zone centrale dans laquelle le bras doit apparaître (60 % de la largeur,
// centrée verticalement dans les 2/3 supérieurs de l'écran).
const ZONE_W = SCREEN_W * 0.60;
const ZONE_H = SCREEN_H * 0.30;
const ZONE_LEFT = (SCREEN_W - ZONE_W) / 2;
const ZONE_TOP = SCREEN_H * 0.20;

// Longueur des coins (L-shape corners)
const CORNER = 28;
const BORDER = 3;

export default function GuidingOverlay({ isReady = false, step = 'position' }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;

  // Pulsation sur le cadre quand le bras est bien positionné
  useEffect(() => {
    if (isReady) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ]),
      ).start();
      Animated.timing(colorAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      Animated.timing(colorAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    }
  }, [isReady]);

  const cornerColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#4CD964'], // blanc → vert quand prêt
  });

  const instructionText =
    step === 'hold'
      ? 'Maintenez la position…'
      : 'Centrez le bras mi-hauteur entre l\'épaule et le coude';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">

      {/* ── Assombrissement des zones hors cadre ── */}
      <View style={[styles.shade, { top: 0, left: 0, right: 0, height: ZONE_TOP }]} />
      <View style={[styles.shade, { top: ZONE_TOP, left: 0, width: ZONE_LEFT, height: ZONE_H }]} />
      <View style={[styles.shade, { top: ZONE_TOP, right: 0, width: ZONE_LEFT, height: ZONE_H }]} />
      <View style={[styles.shade, { top: ZONE_TOP + ZONE_H, left: 0, right: 0, bottom: 0 }]} />

      {/* ── Cadre de référence animé ── */}
      <Animated.View
        style={[
          styles.frameContainer,
          {
            top: ZONE_TOP,
            left: ZONE_LEFT,
            width: ZONE_W,
            height: ZONE_H,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Coins L-shape */}
        {[
          { top: 0,      left: 0,      borderTopWidth: BORDER, borderLeftWidth: BORDER },
          { top: 0,      right: 0,     borderTopWidth: BORDER, borderRightWidth: BORDER },
          { bottom: 0,   left: 0,      borderBottomWidth: BORDER, borderLeftWidth: BORDER },
          { bottom: 0,   right: 0,     borderBottomWidth: BORDER, borderRightWidth: BORDER },
        ].map((pos, i) => (
          <Animated.View
            key={i}
            style={[styles.corner, pos, { borderColor: cornerColor, width: CORNER, height: CORNER }]}
          />
        ))}

        {/* Ligne centrale pointillée (axe de mesure) */}
        <View style={styles.centerLine} />

        {/* Label axe */}
        <View style={styles.axisBadge}>
          <Text style={styles.axisBadgeText}>↔ Axe PB</Text>
        </View>
      </Animated.View>

      {/* ── Instruction contextuelle ── */}
      <View style={styles.instructionBox}>
        <Text style={styles.instructionText}>{instructionText}</Text>
      </View>

      {/* ── Repère hauteur : mi-bras ── */}
      <View style={[styles.sideMarker, { top: ZONE_TOP + ZONE_H / 2 - 1, left: ZONE_LEFT - 32 }]}>
        <Text style={styles.sideMarkerText}>mi-bras</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  shade: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  frameContainer: {
    position: 'absolute',
  },
  corner: {
    position: 'absolute',
    borderColor: '#FFFFFF',
  },
  centerLine: {
    position: 'absolute',
    top: '50%',
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed',
    borderWidth: 0, // dashed ne fonctionne pas sur Android sans workaround — ligne fine suffit
  },
  axisBadge: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  axisBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  instructionBox: {
    position: 'absolute',
    top: ZONE_TOP + ZONE_H + 20,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.70)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  instructionText: {
    color: '#FFF',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  sideMarker: {
    position: 'absolute',
    width: 60,
  },
  sideMarkerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    textAlign: 'right',
  },
});


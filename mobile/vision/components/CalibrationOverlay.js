/**
 * CalibrationOverlay.js
 * Rectangle ajustable par drag pour cadrer l'objet de référence.
 *
 * Rendu par-dessus l'image capturée dans CalibrationScreen.
 * L'agent tire les 4 poignées d'angle pour faire coïncider le rectangle
 * avec les bords de la carte bancaire (ou autre objet de référence).
 *
 * Props :
 *   rect         {x, y, width, height}  - en dp, coordonnées dans l'image affichée
 *   onRectChange (newRect) => void       - appelé à chaque déplacement
 *   objectName   string                  - nom affiché dans le badge
 *   isConfirmed  bool                   - état post-confirmation (met le cadre en vert)
 *
 * Note technique :
 *   On utilise PanResponder (inclus dans RN) pour les gestes — pas de lib externe.
 *   Chaque poignée gère son propre PanResponder et met à jour rect en conséquence.
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, PanResponder, StyleSheet, Animated } from 'react-native';

const HANDLE_SIZE = 28;   // dp — taille de la zone tactile des poignées
const MIN_SIZE    = 40;   // dp — taille minimale du rectangle

// ── Composant interne : poignée d'angle ───────────────────────────────────────

function CornerHandle({ position, onDrag, isConfirmed }) {
  const panRef = useRef(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderMove: (_, gestureState) => {
        onDrag(position, gestureState.dx, gestureState.dy);
      },
      onPanResponderRelease: () => {},
    }),
  ).current;

  const posStyle = {
    top:    position === 'tl' || position === 'tr' ? -HANDLE_SIZE / 2 : undefined,
    bottom: position === 'bl' || position === 'br' ? -HANDLE_SIZE / 2 : undefined,
    left:   position === 'tl' || position === 'bl' ? -HANDLE_SIZE / 2 : undefined,
    right:  position === 'tr' || position === 'br' ? -HANDLE_SIZE / 2 : undefined,
  };

  const borderStyle = {
    borderTopLeftRadius:     position === 'tl' ? 4 : 0,
    borderTopRightRadius:    position === 'tr' ? 4 : 0,
    borderBottomLeftRadius:  position === 'bl' ? 4 : 0,
    borderBottomRightRadius: position === 'br' ? 4 : 0,
    borderTopWidth:    position === 'tl' || position === 'tr' ? 3 : 0,
    borderBottomWidth: position === 'bl' || position === 'br' ? 3 : 0,
    borderLeftWidth:   position === 'tl' || position === 'bl' ? 3 : 0,
    borderRightWidth:  position === 'tr' || position === 'br' ? 3 : 0,
    borderColor: isConfirmed ? '#4CD964' : '#FACC15',
  };

  return (
    <View
      style={[styles.handle, posStyle, borderStyle]}
      {...panResponder.panHandlers}
    />
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function CalibrationOverlay({
  rect,
  onRectChange,
  objectName = 'Carte bancaire',
  isConfirmed = false,
}) {
  // Ref pour connaître le rect courant dans les callbacks PanResponder
  // sans créer de closure stale
  const rectRef = useRef(rect);
  rectRef.current = rect;

  // ── PanResponder du corps : déplacement global du rectangle ──────────────

  const bodyPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderMove: (_, gestureState) => {
        const r = rectRef.current;
        onRectChange({
          ...r,
          x: r.x + gestureState.dx,
          y: r.y + gestureState.dy,
        });
      },
    }),
  ).current;

  // ── Gestion d'une poignée d'angle ─────────────────────────────────────────

  const handleCornerDrag = useCallback(
    (position, dx, dy) => {
      const r = { ...rectRef.current };

      switch (position) {
        case 'tl':
          r.x     += dx;
          r.y     += dy;
          r.width  = Math.max(MIN_SIZE, r.width  - dx);
          r.height = Math.max(MIN_SIZE, r.height - dy);
          break;
        case 'tr':
          r.y     += dy;
          r.width  = Math.max(MIN_SIZE, r.width  + dx);
          r.height = Math.max(MIN_SIZE, r.height - dy);
          break;
        case 'bl':
          r.x     += dx;
          r.width  = Math.max(MIN_SIZE, r.width  - dx);
          r.height = Math.max(MIN_SIZE, r.height + dy);
          break;
        case 'br':
          r.width  = Math.max(MIN_SIZE, r.width  + dx);
          r.height = Math.max(MIN_SIZE, r.height + dy);
          break;
        default:
          break;
      }

      onRectChange(r);
    },
    [onRectChange],
  );

  const borderColor = isConfirmed ? '#4CD964' : '#FACC15';

  return (
    <>
      {/* ── Rectangle principal ── */}
      <View
        style={[
          styles.rect,
          {
            left:   rect.x,
            top:    rect.y,
            width:  rect.width,
            height: rect.height,
            borderColor,
          },
        ]}
        {...bodyPanResponder.panHandlers}
      >
        {/* Poignées d'angle */}
        {['tl', 'tr', 'bl', 'br'].map((pos) => (
          <CornerHandle
            key={pos}
            position={pos}
            onDrag={handleCornerDrag}
            isConfirmed={isConfirmed}
          />
        ))}

        {/* Badge dimensions */}
        <View style={styles.dimBadge}>
          <Text style={styles.dimText}>
            {Math.round(rect.width)} × {Math.round(rect.height)} dp
          </Text>
        </View>
      </View>

      {/* ── Légende de l'objet de référence ── */}
      <View
        style={[
          styles.legend,
          { top: rect.y + rect.height + 12, left: rect.x },
        ]}
      >
        <Text style={[styles.legendText, isConfirmed && styles.legendConfirmed]}>
          {isConfirmed ? '✅ ' : '🟡 '}
          {objectName}
          {isConfirmed ? ' — calibré' : ' — ajustez les coins'}
        </Text>
      </View>
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  rect: {
    position:    'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  handle: {
    position: 'absolute',
    width:    HANDLE_SIZE,
    height:   HANDLE_SIZE,
    backgroundColor: 'rgba(250,204,21,0.18)',
  },
  dimBadge: {
    position:        'absolute',
    top:             4,
    alignSelf:       'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:    8,
  },
  dimText: {
    color:    '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    maxWidth: 260,
  },
  legendText: {
    color:      '#FACC15',
    fontSize:   12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  legendConfirmed: {
    color: '#4CD964',
  },
});


/**
 * mobile/sync/SyncStatusBadge.js
 * Rasmata — Indicateur discret "en attente de synchronisation".
 * Ne bloque jamais l'utilisateur : rien à cliquer, rien de modal, disparaît
 * tout seul dès que la file est vide. Fanta peut le repositionner/restyler
 * librement dans ses écrans, seule la logique (props) est imposée ici.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function SyncStatusBadge({ count, syncing }) {
  if (!count && !syncing) return null;

  return (
    <View style={styles.conteneur} accessibilityLiveRegion="polite">
      {syncing ? <ActivityIndicator size="small" style={styles.spinner} /> : null}
      <Text style={styles.texte}>
        {syncing
          ? 'Synchronisation en cours…'
          : `${count} dépistage${count > 1 ? 's' : ''} en attente de synchronisation`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginVertical: 6,
  },
  spinner: { marginRight: 6 },
  texte: { fontSize: 12, color: '#92400e' },
});

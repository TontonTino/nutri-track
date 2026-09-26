// Bandeau permanent quand l'application utilise le faux serveur : évite qu'un résultat simulé soit pris pour réel.
import { StyleSheet, Text, View } from 'react-native';
import { USE_MOCK } from '../constants/config';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';

export function BandeauDemo() {
  const styles = useStyles(creerStyles);
  if (!USE_MOCK) return null;
  return (
    <View style={styles.bandeau} accessibilityRole="alert" testID="bandeau-demo">
      <Text style={styles.texte}>Mode démo : résultats simulés, sans valeur clinique</Text>
    </View>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    bandeau: { backgroundColor: '#B45309', paddingVertical: t.espace.xs, paddingHorizontal: t.espace.m },
    texte: { color: '#FFFFFF', fontSize: t.police.aide, fontWeight: '700', textAlign: 'center' },
  });

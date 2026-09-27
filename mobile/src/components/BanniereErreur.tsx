import { StyleSheet, Text, View } from 'react-native';
import { couleurs } from '../constants/theme';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';

export function BanniereErreur({ message }: { message: string | null }) {
  const styles = useStyles(creerStyles);
  if (!message) return null;
  return (
    <View style={styles.banniere} accessibilityRole="alert" testID="banniere-erreur">
      <Text style={styles.texte}>{message}</Text>
    </View>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    banniere: {
      backgroundColor: couleurs.erreurFond,
      borderColor: couleurs.erreur,
      borderWidth: t.trait / 2,
      borderRadius: t.rayon.m,
      padding: t.espace.m,
      marginBottom: t.espace.l,
    },
    texte: { color: couleurs.erreur, fontWeight: '700', fontSize: t.police.corps },
  });

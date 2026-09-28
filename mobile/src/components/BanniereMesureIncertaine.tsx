import { StyleSheet, Text, View } from 'react-native';
import { teintes } from '../constants/theme';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';

// Affichée quand un PB mesuré avec la caméra tombe près d'un seuil d'orientation : la caméra peut alors se tromper de
// catégorie. Le message ne donne aucune consigne clinique, il demande de refaire ou de faire confirmer la mesure.
export function BanniereMesureIncertaine({ visible }: { visible: boolean }) {
  const styles = useStyles(creerStyles);
  if (!visible) return null;
  return (
    <View style={styles.banniere} accessibilityRole="alert" testID="banniere-mesure-incertaine">
      <Text style={styles.titre}>{teintes.modere.symbole} Mesure proche d&apos;un seuil</Text>
      <Text style={styles.texte}>
        La caméra peut se tromper de quelques millimètres, ce qui suffit ici à changer de catégorie. Reprenez la photo dans de
        bonnes conditions (lumière franche, bras dégagé, carte bien à plat). Si la valeur reste dans cette zone, faites
        confirmer la mesure au centre de santé avant de conclure.
      </Text>
    </View>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    banniere: {
      backgroundColor: teintes.modere.fond,
      borderColor: teintes.modere.accent,
      borderWidth: t.trait / 2,
      borderRadius: t.rayon.m,
      padding: t.espace.m,
      marginBottom: t.espace.l,
      gap: t.espace.xs,
    },
    titre: { color: teintes.modere.texte, fontWeight: '800', fontSize: t.police.corps },
    texte: { color: teintes.modere.texte, fontSize: t.police.corps },
  });

import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { couleurs } from '../constants/theme';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';

interface Props {
  titre: string;
  onPress: () => void;
  chargement?: boolean;
  secondaire?: boolean;
  testID?: string;
}

export function BoutonPrincipal({ titre, onPress, chargement = false, secondaire = false, testID }: Props) {
  const styles = useStyles(creerStyles);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={chargement}
      accessibilityRole="button"
      accessibilityLabel={titre}
      style={[styles.bouton, secondaire && styles.secondaire, chargement && styles.desactive]}
    >
      {chargement ? (
        <ActivityIndicator color={secondaire ? couleurs.primaire : '#FFFFFF'} />
      ) : (
        <Text style={[styles.texte, secondaire && styles.texteSecondaire]}>{titre}</Text>
      )}
    </Pressable>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    bouton: {
      backgroundColor: couleurs.primaire,
      borderRadius: t.rayon.m,
      paddingVertical: t.espace.m,
      paddingHorizontal: t.espace.l,
      alignItems: 'center',
      minHeight: t.cibleTactile,
      justifyContent: 'center',
      marginTop: t.espace.s,
    },
    secondaire: { backgroundColor: 'transparent', borderWidth: t.trait, borderColor: couleurs.primaire },
    desactive: { opacity: 0.6 },
    texte: { color: '#FFFFFF', fontSize: t.police.sousTitre, fontWeight: '700', textAlign: 'center' },
    texteSecondaire: { color: couleurs.primaire },
  });

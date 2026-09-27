import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { couleurs } from '../constants/theme';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';

interface Props {
  titre: string;
  onPress: () => void;
  chargement?: boolean;
  secondaire?: boolean;
  discret?: boolean; // simple lien texte, pour une action de moindre importance
  testID?: string;
}

export function BoutonPrincipal({ titre, onPress, chargement = false, secondaire = false, discret = false, testID }: Props) {
  const styles = useStyles(creerStyles);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={chargement}
      accessibilityRole="button"
      accessibilityLabel={titre}
      style={[styles.bouton, secondaire && styles.secondaire, discret && styles.discret, chargement && styles.desactive]}
    >
      {chargement ? (
        <ActivityIndicator color={secondaire || discret ? couleurs.primaire : '#FFFFFF'} />
      ) : (
        <Text style={[styles.texte, (secondaire || discret) && styles.texteSecondaire]}>{titre}</Text>
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
    secondaire: { backgroundColor: 'transparent', borderWidth: t.trait / 2, borderColor: couleurs.primaire },
    discret: { backgroundColor: 'transparent', borderWidth: 0, minHeight: t.cibleTactile * 0.8 },
    desactive: { opacity: 0.6 },
    texte: { color: '#FFFFFF', fontSize: t.police.sousTitre, fontWeight: '700', textAlign: 'center' },
    texteSecondaire: { color: couleurs.primaire },
  });

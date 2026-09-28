import { LinearGradient } from 'expo-linear-gradient';
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
  compact?: boolean; // hauteur réduite (garde la cible tactile minimale) — action secondaire déjà bien identifiée par sa carte
  testID?: string;
}

export function BoutonPrincipal({ titre, onPress, chargement = false, secondaire = false, discret = false, compact = false, testID }: Props) {
  const styles = useStyles(creerStyles);
  const contenu = chargement ? (
    <ActivityIndicator color={secondaire || discret ? couleurs.primaire : '#FFFFFF'} />
  ) : (
    <Text style={[styles.texte, (secondaire || discret) && styles.texteSecondaire]}>{titre}</Text>
  );

  // Le dégradé turquoise ne porte l'action principale que sur le bouton plein (jamais secondaire/discret) : la couleur
  // reste toujours accompagnée du texte de l'action, jamais seule porteuse de sens.
  if (!secondaire && !discret) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={chargement}
        accessibilityRole="button"
        accessibilityLabel={titre}
        style={({ pressed }) => [styles.enveloppe, pressed && styles.presse, chargement && styles.desactive]}
      >
        <LinearGradient colors={couleurs.primaireDegrade} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bouton}>
          {contenu}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={chargement}
      accessibilityRole="button"
      accessibilityLabel={titre}
      style={[styles.bouton, secondaire && styles.secondaire, discret && styles.discret, compact && styles.compact, chargement && styles.desactive]}
    >
      {contenu}
    </Pressable>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    enveloppe: {
      borderRadius: t.rayon.l,
      shadowColor: couleurs.primaireFonce,
      shadowOpacity: 0.28,
      shadowRadius: t.e(12),
      shadowOffset: { width: 0, height: t.e(5) },
      elevation: Math.round(t.e(3)),
      marginTop: t.espace.s,
    },
    presse: { opacity: 0.9 },
    bouton: {
      backgroundColor: couleurs.primaire,
      borderRadius: t.rayon.l,
      paddingVertical: t.espace.m,
      paddingHorizontal: t.espace.l,
      alignItems: 'center',
      minHeight: t.cibleTactile,
      justifyContent: 'center',
    },
    secondaire: { backgroundColor: couleurs.primaireDoux, borderWidth: 0, marginTop: t.espace.s },
    discret: { backgroundColor: 'transparent', borderWidth: 0, minHeight: t.cibleTactile * 0.8, marginTop: t.espace.s },
    // Cible tactile minimale conservée (accessibilité), mais sans le remplissage vertical ni la marge du dégradé.
    compact: { minHeight: t.cibleTactile * 0.7, paddingVertical: t.espace.xs, marginTop: 0 },
    desactive: { opacity: 0.6 },
    texte: { color: '#FFFFFF', fontSize: t.police.sousTitre, fontWeight: '700', textAlign: 'center' },
    texteSecondaire: { color: couleurs.primaireFonce },
  });

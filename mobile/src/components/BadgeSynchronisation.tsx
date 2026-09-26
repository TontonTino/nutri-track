// Indicateur discret « en attente de synchronisation » (logique de Rasmata, mise en forme proportionnelle à l'écran).
// Ne bloque jamais l'utilisateur et disparaît dès que la file est vide.
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSynchro } from '../data/SynchroContext';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';

export function BadgeSynchronisation() {
  const styles = useStyles(creerStyles);
  const { nombreEnAttente, enSynchronisation } = useSynchro();
  if (!nombreEnAttente && !enSynchronisation) return null;
  return (
    <View style={styles.conteneur} accessibilityLiveRegion="polite" testID="badge-synchronisation">
      {enSynchronisation ? <ActivityIndicator size="small" color="#92400e" style={styles.spinner} /> : null}
      <Text style={styles.texte}>
        {enSynchronisation
          ? 'Synchronisation en cours…'
          : `${nombreEnAttente} dépistage${nombreEnAttente > 1 ? 's' : ''} en attente de synchronisation`}
      </Text>
    </View>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    conteneur: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: '#FEF3C7',
      borderRadius: t.rayon.l * 2,
      paddingVertical: t.espace.xs,
      paddingHorizontal: t.espace.m,
      marginVertical: t.espace.s,
    },
    spinner: { marginRight: t.espace.s },
    texte: { fontSize: t.police.aide, color: '#92400E', fontWeight: '600' },
  });

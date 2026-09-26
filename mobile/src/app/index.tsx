// Sélection de la population : trois grands boutons qui se partagent toute la hauteur de l'écran en portrait
// et toute la largeur en paysage, quelle que soit la taille de l'appareil.
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BoutonPrincipal } from '../components/BoutonPrincipal';
import { couleurs } from '../constants/theme';
import type { Echelle } from '../theme/echelle';
import { useEchelle, useStyles } from '../theme/useEchelle';

const choix: { emoji: string; titre: string; detail: string; route: Href }[] = [
  { emoji: '🧒', titre: 'Enfant', detail: '6 à 59 mois', route: '/enfant' },
  { emoji: '🤰', titre: 'Femme enceinte', detail: 'Suivi de grossesse', route: '/femme-enceinte' },
  { emoji: '🧓', titre: 'Personne âgée', detail: 'Dépistage nutritionnel', route: '/personne-agee' },
];

export default function SelectionPopulation() {
  const t = useEchelle();
  const styles = useStyles(creerStyles);
  return (
    <ScrollView contentContainerStyle={styles.conteneur}>
      <View style={styles.colonne}>
        <Text style={styles.question}>Qui souhaitez-vous dépister ?</Text>
        <View style={[styles.boutons, t.paysage && styles.boutonsPaysage]}>
          {choix.map((c) => (
            <Pressable
              key={c.titre}
              onPress={() => router.push(c.route)}
              accessibilityRole="button"
              accessibilityLabel={`${c.titre}, ${c.detail}`}
              style={({ pressed }) => [styles.bouton, pressed && styles.boutonPresse]}
            >
              <Text style={styles.emoji}>{c.emoji}</Text>
              <Text style={styles.titre}>{c.titre}</Text>
              <Text style={styles.detail}>{c.detail}</Text>
            </Pressable>
          ))}
        </View>
        <BoutonPrincipal titre="Historique des dépistages" secondaire onPress={() => router.push('/historique')} testID="bouton-historique" />
      </View>
    </ScrollView>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    conteneur: { flexGrow: 1, padding: t.espace.l, alignItems: 'center' },
    colonne: { flex: 1, width: '100%', maxWidth: t.contenuMax, gap: t.espace.m },
    question: { fontSize: t.police.titre, fontWeight: '700', color: couleurs.texte, textAlign: 'center' },
    boutons: { flex: 1, gap: t.espace.m },
    boutonsPaysage: { flexDirection: 'row', minHeight: t.ev(140) },
    bouton: {
      flex: 1,
      backgroundColor: couleurs.primaire,
      borderRadius: t.rayon.l,
      // Sur un écran court, marges et emoji suivent la hauteur disponible pour que tout tienne sans défilement.
      paddingVertical: Math.min(t.espace.l, t.ev(14)),
      paddingHorizontal: t.espace.m,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: t.ev(90),
    },
    boutonPresse: { opacity: 0.85 },
    emoji: { fontSize: Math.min(t.police.emoji, t.ev(44)), marginBottom: t.espace.xs },
    titre: { color: '#FFFFFF', fontSize: t.police.grandTitre, fontWeight: '800', textAlign: 'center' },
    detail: { color: '#DDF0E5', fontSize: t.police.corps, marginTop: t.espace.xs, textAlign: 'center' },
  });

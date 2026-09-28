// Sélection de la population : dégradé menthe plein écran, panneau d'accueil vitré (glassmorphism) et cartes
// blanches à icônes vectorielles, dans le langage visuel du reste de l'app. Grandes cibles tactiles conservées :
// c'est un outil de terrain pour des agents de santé communautaires, pas une appli grand public.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BoutonPrincipal } from '../components/BoutonPrincipal';
import { couleurs } from '../constants/theme';
import { carteDouce } from '../theme/carte';
import type { Echelle } from '../theme/echelle';
import { useEchelle, useStyles } from '../theme/useEchelle';
import type { Population } from '../types/depistage';

// Chaque choix passe d'abord par l'écran de consentement (voir app/consentement.tsx) avant le formulaire.
const choix: { icone: keyof typeof MaterialCommunityIcons.glyphMap; titre: string; detail: string; population: Population }[] = [
  { icone: 'baby-face-outline', titre: 'Enfant', detail: '6 à 59 mois', population: 'enfant' },
  { icone: 'human-pregnant', titre: 'Femme enceinte', detail: 'Suivi de grossesse', population: 'enceinte' },
  { icone: 'human-cane', titre: 'Personne âgée', detail: 'Dépistage nutritionnel', population: 'personne_agee' },
];

export default function SelectionPopulation() {
  const t = useEchelle();
  const styles = useStyles(creerStyles);
  return (
    <LinearGradient colors={couleurs.fondDegrade} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fond}>
      <ScrollView contentContainerStyle={styles.conteneur}>
        <View style={styles.colonne}>
          <LinearGradient colors={couleurs.primaireDegrade} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <BlurView intensity={40} tint="light" style={styles.heroVerre}>
              <View style={styles.heroIcone}>
                <Image source={require('../../assets/images/logo-nutridepist.webp')} style={styles.heroLogo} resizeMode="cover" accessibilityLabel="Logo NUTRI-DÉPIST" />
              </View>
              <Text style={styles.heroTitre}>NUTRI-DÉPIST</Text>
              <Text style={styles.heroLigne} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                Dépistage nutritionnel communautaire
              </Text>
              <Text style={styles.heroLigne} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                Enfants · Femmes enceintes · Personnes âgées
              </Text>
            </BlurView>
          </LinearGradient>

          <Text style={styles.question}>Qui souhaitez-vous dépister ?</Text>

          <View style={styles.boutons}>
            {choix.map((c) => (
              <Pressable
                key={c.titre}
                onPress={() => router.push({ pathname: '/consentement', params: { population: c.population } })}
                accessibilityRole="button"
                accessibilityLabel={`${c.titre}, ${c.detail}`}
                style={({ pressed }) => [styles.carte, pressed && styles.cartePressee]}
              >
                <View style={styles.icone}>
                  <MaterialCommunityIcons name={c.icone} size={t.police.emoji * 0.72} color={couleurs.primaireFonce} />
                </View>
                <View style={styles.carteTextes}>
                  <Text style={styles.titre}>{c.titre}</Text>
                  <Text style={styles.detail}>{c.detail}</Text>
                </View>
                <LinearGradient colors={couleurs.primaireDegrade} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fleche}>
                  <Ionicons name="arrow-forward" size={t.police.sousTitre} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            ))}
          </View>

          <BoutonPrincipal titre="Historique des dépistages" secondaire onPress={() => router.push('/historique')} testID="bouton-historique" />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    fond: { flex: 1 },
    // Tailles d'origine (grandes, spacieuses) conservées ; seuls les espaces verticaux entre les blocs sont
    // resserrés, juste assez pour que tout tienne sur une hauteur d'écran sans défiler (ScrollView gardé en filet
    // de sécurité pour les très petits écrans). Toujours calculé via l'échelle — jamais de valeur figée.
    conteneur: { flexGrow: 1, padding: t.espace.m, alignItems: 'center', justifyContent: 'center' },
    colonne: { width: '100%', maxWidth: t.contenuMax, gap: t.espace.l },
    hero: {
      borderRadius: t.rayon.l,
      overflow: 'hidden',
      shadowColor: couleurs.primaireFonce,
      shadowOpacity: 0.25,
      shadowRadius: t.e(16),
      shadowOffset: { width: 0, height: t.e(8) },
      elevation: Math.round(t.e(4)),
    },
    heroVerre: { padding: t.espace.l, gap: t.espace.xs, alignItems: 'flex-start', width: '100%' },
    // Carte rectangulaire (pas un cercle) que le logo remplit entièrement (cover, jamais de marge interne) : le
    // beige de fond de l'image lui-même sert de fond de carte, pour qu'aucun bord blanc ne soit visible.
    heroIcone: {
      width: t.e(112),
      height: t.e(96),
      borderRadius: t.rayon.l,
      backgroundColor: '#F7F3E9',
      borderWidth: t.trait / 2,
      borderColor: 'rgba(255,255,255,0.5)',
      marginBottom: t.espace.xs,
      overflow: 'hidden',
    },
    heroLogo: { width: '100%', height: '100%' },
    heroTitre: { color: '#FFFFFF', fontSize: t.police.grandTitre, fontWeight: '800', letterSpacing: 0.5 },
    heroLigne: { alignSelf: 'stretch', color: 'rgba(255,255,255,0.92)', fontSize: t.police.aide, fontWeight: '600' },
    question: { fontSize: t.police.grandTitre, fontWeight: '800', color: couleurs.texte },
    boutons: { gap: t.espace.m },
    carte: {
      ...carteDouce(t),
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.espace.l,
      padding: t.espace.l,
      minHeight: t.ev(96),
    },
    cartePressee: { opacity: 0.85 },
    icone: {
      width: t.e(60),
      height: t.e(60),
      borderRadius: t.e(30),
      backgroundColor: couleurs.primaireDoux,
      alignItems: 'center',
      justifyContent: 'center',
    },
    carteTextes: { flex: 1, gap: t.espace.xs },
    titre: { color: couleurs.texte, fontSize: t.police.sousTitre, fontWeight: '800' },
    detail: { color: couleurs.texteSecondaire, fontSize: t.police.aide },
    fleche: { width: t.e(40), height: t.e(40), borderRadius: t.e(20), alignItems: 'center', justifyContent: 'center' },
  });

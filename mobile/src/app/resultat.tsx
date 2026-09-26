// Écran de résultat générique : identique pour les 3 populations, seuls les paramètres changent.
// Hiérarchie : 1) le résultat (une seule zone de couleur), 2) l'action à mener, 3) quelques notes discrètes.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BoutonPrincipal } from '../components/BoutonPrincipal';
import { couleurs, teintes } from '../constants/theme';
import { actionAffichee, categorieDe, libelleDe, nomPopulation } from '../services/presentation';
import { carteDouce } from '../theme/carte';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';
import type { Population } from '../types/depistage';

const POPULATIONS: Population[] = ['enfant', 'enceinte', 'personne_agee'];
const ACCENT_NOTE = '#E08600';

function Note({ texte, accent, testID }: { texte: string; accent: string; testID?: string }) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.note} accessibilityRole="alert" testID={testID}>
      <View style={[styles.notePoint, { backgroundColor: accent }]} />
      <Text style={styles.noteTexte}>{texte}</Text>
    </View>
  );
}

export default function Resultat() {
  const styles = useStyles(creerStyles);

  // Le bouton Retour d'Android ramène à l'accueil : le formulaire déjà envoyé n'est plus accessible, ce qui évite un
  // double envoi du même dépistage.
  useEffect(() => {
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/');
      return true;
    });
    return () => abonnement.remove();
  }, []);

  const params = useLocalSearchParams<{
    population?: string;
    classification?: string;
    orientation_declenchee?: string;
    message?: string;
    recommandation?: string;
    oedemes_incertains?: string;
    historique_ok?: string;
    provisoire?: string;
    doublon?: string;
  }>();

  const population = POPULATIONS.find((p) => p === params.population);

  if (!population || !params.classification) {
    return (
      <ScrollView contentContainerStyle={styles.defilement}>
        <View style={styles.conteneur}>
          <Text style={styles.action}>Résultat indisponible. Veuillez refaire le dépistage.</Text>
          <BoutonPrincipal titre="Nouveau dépistage" onPress={() => router.replace('/')} />
        </View>
      </ScrollView>
    );
  }

  const orientation = params.orientation_declenchee === 'true';
  const categorie = categorieDe(params.classification);
  const teinte = teintes[categorie];
  const libelle = libelleDe(population, params.classification);
  const action = actionAffichee(params.classification, params.recommandation, orientation);
  const detail = params.message && params.message !== libelle ? params.message : null;

  const notes: { cle: string; texte: string; accent: string }[] = [];
  if (params.provisoire === '1') {
    notes.push({ cle: 'provisoire', texte: 'Résultat provisoire, calculé sans connexion. Le serveur le confirmera au retour du réseau.', accent: ACCENT_NOTE });
  }
  if (params.doublon === '1') {
    notes.push({ cle: 'doublon', texte: 'Ressemble à un dépistage saisi récemment : les deux sont conservés.', accent: ACCENT_NOTE });
  }
  if (params.oedemes_incertains === '1') {
    notes.push({ cle: 'oedemes', texte: 'Œdèmes incertains : confirmez par le test de pression manuel.', accent: ACCENT_NOTE });
  }
  if (params.historique_ok === '0') {
    notes.push({ cle: 'historique', texte: "Non enregistré dans l'historique du téléphone.", accent: couleurs.erreur });
  }

  return (
    <ScrollView contentContainerStyle={styles.defilement}>
      <View style={styles.conteneur}>
        <Text style={styles.population}>{nomPopulation[population]}</Text>

        <View style={[styles.resultat, { backgroundColor: teinte.fond, borderLeftColor: teinte.accent }]} accessibilityRole="summary" testID="carte-resultat">
          <View style={[styles.symbole, { backgroundColor: teinte.accent }]}>
            <Text style={styles.symboleTexte}>{teinte.symbole}</Text>
          </View>
          <View style={styles.resultatTextes}>
            <Text style={[styles.libelle, { color: teinte.texte }]}>{libelle}</Text>
            {detail ? <Text style={[styles.detail, { color: teinte.texte }]}>{detail}</Text> : null}
          </View>
        </View>

        <View style={styles.carteAction}>
          <Text style={styles.actionTitre}>Que faire</Text>
          <Text style={styles.action}>{action}</Text>
          {orientation && categorie !== 'severe' ? (
            <Text style={[styles.orientation, { color: teinte.accent }]}>Orientation vers un centre de santé déclenchée.</Text>
          ) : null}
        </View>

        {notes.length > 0 ? (
          <View style={styles.notes}>
            {notes.map((n) => (
              <Note key={n.cle} texte={n.texte} accent={n.accent} testID={n.cle === 'oedemes' ? 'avertissement-oedemes' : `avertissement-${n.cle}`} />
            ))}
          </View>
        ) : null}

        <View style={styles.boutons}>
          <BoutonPrincipal titre="Nouveau dépistage" onPress={() => router.replace('/')} testID="bouton-nouveau" />
          <BoutonPrincipal titre="Voir l'historique" discret onPress={() => router.push('/historique')} />
        </View>

        <Text style={styles.mention}>Aide au dépistage fondée sur des seuils. Elle ne remplace pas le jugement du professionnel de santé.</Text>
      </View>
    </ScrollView>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    defilement: { flexGrow: 1, alignItems: 'center' },
    conteneur: { width: '100%', maxWidth: t.contenuMax, padding: t.espace.l, paddingBottom: t.espace.xl * 2, gap: t.espace.xl },
    population: { fontSize: t.police.aide, color: couleurs.texteSecondaire, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' },
    resultat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.espace.l,
      borderRadius: t.rayon.l,
      borderLeftWidth: t.e(6),
      padding: t.espace.xl,
    },
    symbole: { width: t.e(44), height: t.e(44), borderRadius: t.e(22), alignItems: 'center', justifyContent: 'center' },
    symboleTexte: { color: '#FFFFFF', fontSize: t.police.titre, fontWeight: '800' },
    resultatTextes: { flex: 1, gap: t.espace.xs },
    libelle: { fontSize: t.police.titre, fontWeight: '800', lineHeight: t.police.titre * 1.25 },
    detail: { fontSize: t.police.corps },
    carteAction: { ...carteDouce(t), padding: t.espace.xl, gap: t.espace.s },
    actionTitre: { fontSize: t.police.aide, fontWeight: '700', color: couleurs.texteSecondaire, letterSpacing: 0.6, textTransform: 'uppercase' },
    action: { fontSize: t.police.sousTitre, color: couleurs.texte, lineHeight: t.police.sousTitre * 1.5 },
    orientation: { fontSize: t.police.corps, fontWeight: '700' },
    notes: { gap: t.espace.m },
    note: { flexDirection: 'row', alignItems: 'flex-start', gap: t.espace.m },
    notePoint: { width: t.e(8), height: t.e(8), borderRadius: t.e(4), marginTop: t.espace.s },
    noteTexte: { flex: 1, fontSize: t.police.corps, color: couleurs.texteSecondaire, lineHeight: t.police.corps * 1.4 },
    boutons: { gap: t.espace.xs },
    mention: { fontSize: t.police.petit, color: couleurs.texteSecondaire, textAlign: 'center', opacity: 0.8 },
  });

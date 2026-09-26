// Écran de résultat générique : identique pour les 3 populations, seuls les paramètres changent.
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BoutonPrincipal } from '../components/BoutonPrincipal';
import { couleurClassification, couleurs } from '../constants/theme';
import { actionAffichee, categorieDe, libelleDe, nomPopulation } from '../services/presentation';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';
import type { Population } from '../types/depistage';

const POPULATIONS: Population[] = ['enfant', 'enceinte', 'personne_agee'];

export default function Resultat() {
  const styles = useStyles(creerStyles);
  const params = useLocalSearchParams<{
    population?: string;
    classification?: string;
    orientation_declenchee?: string;
    message?: string;
    recommandation?: string;
    oedemes_incertains?: string;
    historique_ok?: string;
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
  const couleur = couleurClassification[categorie];
  const libelle = libelleDe(population, params.classification);
  const action = actionAffichee(params.classification, params.recommandation, orientation);
  const detail = params.message && params.message !== libelle ? params.message : null;

  return (
    <ScrollView contentContainerStyle={styles.defilement}>
      <View style={styles.conteneur}>
        <Text style={styles.population}>{nomPopulation[population]}</Text>

        <View style={[styles.carteResultat, { backgroundColor: couleur.fond }]} accessibilityRole="summary" testID="carte-resultat">
          <Text style={[styles.libelleResultat, { color: couleur.texte }]}>{libelle}</Text>
          {detail ? <Text style={[styles.detail, { color: couleur.texte }]}>{detail}</Text> : null}
        </View>

        <View style={styles.carteAction}>
          <Text style={styles.actionTitre}>Action recommandée</Text>
          <Text style={styles.action}>{action}</Text>
          {orientation && categorie !== 'severe' ? (
            <Text style={styles.orientation}>Orientation vers un centre de santé déclenchée.</Text>
          ) : null}
        </View>

        {params.oedemes_incertains === '1' ? (
          <View style={styles.avertissement} accessibilityRole="alert" testID="avertissement-oedemes">
            <Text style={styles.avertissementTexte}>
              {"Œdèmes signalés comme incertains : le résultat tient compte d'une possible présence d'œdèmes. Confirmez par le test de pression manuel."}
            </Text>
          </View>
        ) : null}
        {params.historique_ok === '0' ? (
          <Text style={styles.orientation}>{"Ce dépistage n'a pas pu être enregistré dans l'historique du téléphone."}</Text>
        ) : null}

        <Text style={styles.mention}>
          Ce résultat est une aide au dépistage fondée sur des seuils. Il ne remplace pas le jugement du professionnel de santé.
        </Text>

        <BoutonPrincipal titre="Nouveau dépistage" onPress={() => router.replace('/')} testID="bouton-nouveau" />
        <BoutonPrincipal titre="Voir l'historique" secondaire onPress={() => router.push('/historique')} />
      </View>
    </ScrollView>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    defilement: { flexGrow: 1, alignItems: 'center' },
    conteneur: { width: '100%', maxWidth: t.contenuMax, padding: t.espace.l, gap: t.espace.l },
    population: { fontSize: t.police.corps, color: couleurs.texteSecondaire, fontWeight: '600', textAlign: 'center' },
    carteResultat: {
      borderRadius: t.rayon.l,
      padding: t.espace.xl,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: t.ev(140),
      gap: t.espace.s,
    },
    libelleResultat: { fontSize: t.police.grandTitre, fontWeight: '800', textAlign: 'center' },
    detail: { fontSize: t.police.corps, textAlign: 'center' },
    carteAction: {
      backgroundColor: couleurs.carte,
      borderRadius: t.rayon.m,
      padding: t.espace.l,
      borderWidth: t.trait / 2,
      borderColor: couleurs.bordure,
      gap: t.espace.xs,
    },
    actionTitre: { fontSize: t.police.aide, fontWeight: '700', color: couleurs.texteSecondaire, textTransform: 'uppercase' },
    action: { fontSize: t.police.sousTitre, color: couleurs.texte, lineHeight: t.police.sousTitre * 1.45 },
    orientation: { fontSize: t.police.corps, color: couleurs.erreur, fontWeight: '700' },
    mention: { fontSize: t.police.aide, color: couleurs.texteSecondaire, textAlign: 'center' },
    avertissement: {
      backgroundColor: '#FFF4E0',
      borderColor: '#EF6C00',
      borderWidth: t.trait / 2,
      borderRadius: t.rayon.m,
      padding: t.espace.m,
    },
    avertissementTexte: { color: '#8A4B00', fontSize: t.police.corps, fontWeight: '600' },
  });

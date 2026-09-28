// Écran de consentement : passage obligé avant tout dépistage (inspiré de la façon dont Child Growth Monitor,
// de Welthungerhilfe, gère le consentement avant un scan). Explique en langage clair ce qui va être mesuré,
// précise que les photos éventuelles restent sur le téléphone puis sont supprimées, et demande une confirmation
// explicite avant de continuer.
//
// Sert aussi de point de décision pour un éventuel brouillon en attente (voir data/brouillon.ts) : l'agent voit
// à qui appartient le brouillon avant de choisir de le reprendre ou de repartir à vide — jamais une restauration
// silencieuse, pour ne pas mélanger la saisie interrompue d'une personne avec celle de la suivante.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BoutonPrincipal } from '../components/BoutonPrincipal';
import { couleurs } from '../constants/theme';
import { type Brouillon, definirBrouillonAAppliquer, effacerBrouillon, etiquetteBrouillon, lireBrouillon } from '../data/brouillon';
import { nomPopulation } from '../services/presentation';
import { carteDouce } from '../theme/carte';
import type { Echelle } from '../theme/echelle';
import { useEchelle, useStyles } from '../theme/useEchelle';
import type { Population } from '../types/depistage';

const POPULATIONS: Population[] = ['enfant', 'enceinte', 'personne_agee'];

const ROUTES: Record<Population, Href> = {
  enfant: '/enfant',
  enceinte: '/femme-enceinte',
  personne_agee: '/personne-agee',
};

// Peu d'écriture, à l'essentiel : chaque étape tient sur une seule ligne.
const MESURES: Record<Population, string> = {
  enfant: 'Bras · Poids · Taille · Œdèmes',
  enceinte: 'Hauteur utérine · Bras (brassard) · Semaine de grossesse',
  personne_agee: 'Questionnaire MNA-SF · Mollet · Bras (facultatif)',
};

// Seul le parcours Enfant prend une photo aujourd'hui (contrôle du brassard) : voir brassard/analyse.ts, qui
// l'analyse en local puis la supprime. Le prototype d'estimation par caméra (mobile/vision) est désactivé par
// défaut (VISION_CALIBRATION_ACTIVE) et suit la même règle quand il est actif.
const CONFIDENTIALITE: Record<Population, string> = {
  enfant: 'Photo du brassard analysée sur le téléphone, puis supprimée aussitôt. Jamais envoyée.',
  enceinte: 'Aucune photo prise pour ce dépistage.',
  personne_agee: 'Aucune photo prise pour ce dépistage.',
};

type NomIcone = keyof typeof Ionicons.glyphMap;

// Étape numérotée : pastille + étiquette fusionnées en une seule barre continue (numéro plus foncé, étiquette plus
// claire, même teinte), puis une carte blanche avec l'icône — mise en page à étapes numérotées, dans notre palette
// turquoise (jamais la couleur seule : chiffre + étiquette + texte).
function Etape({
  numero,
  titre,
  texte,
  icone,
  uneLigne,
  espacement,
  testID,
}: {
  numero: string;
  titre: string;
  texte: string;
  icone: NomIcone;
  uneLigne?: boolean; // le texte tient sur une seule ligne (rétrécissement automatique si besoin)
  espacement?: object; // marge au-dessus de cette étape (contrôlée au cas par cas par l'écran)
  testID?: string;
}) {
  const styles = useStyles(creerStyles);
  const t = useEchelle();
  return (
    <View style={[styles.etape, espacement]} testID={testID}>
      <View style={styles.etapeEntete}>
        <View style={styles.etapeNumero}>
          <Text style={styles.etapeNumeroTexte}>{numero}</Text>
        </View>
        <View style={styles.etapeLabel}>
          <Text style={styles.etapeLabelTexte}>{titre}</Text>
        </View>
      </View>
      <View style={[styles.carte, styles.etapeCarte]}>
        <Text
          style={[styles.etapeTexte, uneLigne && styles.etapeTexteCentre]}
          numberOfLines={uneLigne ? 1 : undefined}
          adjustsFontSizeToFit={uneLigne}
          minimumFontScale={uneLigne ? 0.7 : undefined}
        >
          {texte}
        </Text>
        <View style={styles.trait} />
        <View style={styles.etapeIcone}>
          <Ionicons name={icone} size={t.police.titre} color={couleurs.primaireFonce} />
        </View>
      </View>
    </View>
  );
}

export default function Consentement() {
  const t = useEchelle();
  const styles = useStyles(creerStyles);
  const { population: param } = useLocalSearchParams<{ population?: string }>();
  const population = POPULATIONS.find((p) => p === param);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (!population) return;
    let annule = false;
    lireBrouillon(population).then((b) => {
      if (!annule) {
        setBrouillon(b);
        setPret(true);
      }
    });
    return () => {
      annule = true;
    };
  }, [population]);

  if (!population) {
    return (
      <ScrollView contentContainerStyle={styles.defilement}>
        <View style={styles.conteneur}>
          <Text style={styles.texte}>Population inconnue.</Text>
          <BoutonPrincipal titre="Retour à l'accueil" onPress={() => router.replace('/')} />
        </View>
      </ScrollView>
    );
  }

  function reprendre() {
    definirBrouillonAAppliquer(brouillon);
    router.replace(ROUTES[population as Population]);
  }

  // « Nouvelle saisie » doit effacer l'ancien brouillon tout de suite, pas seulement au prochain envoi réussi :
  // sinon un agent qui l'a explicitement refusé (par exemple parce qu'il change de personne) le verrait
  // reproposé au prochain passage si le nouveau formulaire est lui aussi abandonné avant sa première écriture.
  async function recommencer() {
    if (brouillon) await effacerBrouillon(population as Population);
    definirBrouillonAAppliquer(null);
    router.replace(ROUTES[population as Population]);
  }

  return (
    <ScrollView contentContainerStyle={styles.defilement}>
      <View style={styles.cartePopulation}>
        <Text style={styles.population}>{nomPopulation[population]}</Text>
      </View>
      <View style={styles.conteneur}>
        <View style={styles.entete}>
          <Text style={styles.titre}>Avant de commencer</Text>
          <Text style={styles.consigne} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            Expliquez puis obtenez l’accord
          </Text>
        </View>

        <Etape testID="etape-mesures" numero="1" titre="Ce qui est mesuré" texte={MESURES[population]} icone="clipboard-outline" uneLigne />
        <Etape
          testID="etape-confidentialite"
          numero="2"
          titre="Confidentialité"
          texte={CONFIDENTIALITE[population]}
          icone="lock-closed-outline"
          espacement={styles.espaceAugmente}
        />

        <View style={styles.espaceAugmente}>
          {pret && brouillon ? (
            <View style={[styles.carte, styles.carteBrouillon]}>
              <View style={styles.carteEntete}>
                <View style={styles.carteIcone}>
                  <Ionicons name="time-outline" size={t.police.sousTitre} color={couleurs.primaireFonce} />
                </View>
                <Text style={styles.carteTitre}>Saisie non terminée trouvée</Text>
              </View>
              <Text style={styles.texte}>{etiquetteBrouillon(brouillon)}</Text>
              <BoutonPrincipal testID="bouton-reprendre-brouillon" titre="J'ai obtenu l'accord — reprendre cette saisie" onPress={reprendre} />
              <BoutonPrincipal
                testID="bouton-nouvelle-saisie"
                titre="J'ai obtenu l'accord — commencer une nouvelle saisie"
                secondaire
                onPress={recommencer}
              />
            </View>
          ) : (
            <BoutonPrincipal testID="bouton-consentement" titre="J'ai obtenu l'accord" onPress={recommencer} chargement={!pret} />
          )}
        </View>

        <View style={[styles.carteRetour, styles.espaceReduit]}>
          <BoutonPrincipal titre="Retour" discret compact onPress={() => router.replace('/')} />
        </View>
      </View>
    </ScrollView>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    defilement: { flexGrow: 1, alignItems: 'center' },
    // Espacement au cas par cas (pas un `gap` uniforme) : resserré dans le bloc de titre (entete), standard avant la
    // 1ʳᵉ carte, plus généreux entre les cartes « mesures »/« confidentialité »/bouton, réduit avant « Retour ».
    conteneur: { width: '100%', maxWidth: t.contenuMax, padding: t.espace.l, paddingBottom: t.espace.xl * 1.5 },
    entete: { gap: t.espace.xs },
    espaceAugmente: { marginTop: t.espace.xl * 1.7 },
    espaceReduit: { marginTop: t.espace.l },
    // Rattachée à la barre d'en-tête : coins du haut carrés (pas de vide au-dessus, pas d'arrondi supérieur),
    // seuls les coins du bas sont arrondis. Centrée, sans bordure — juste une ombre douce en dessous.
    cartePopulation: {
      ...carteDouce(t),
      alignSelf: 'center',
      borderWidth: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      paddingVertical: t.espace.s,
      paddingHorizontal: t.espace.xl,
      marginBottom: t.espace.l,
    },
    population: { fontSize: t.police.aide, color: couleurs.texteSecondaire, fontWeight: '600', textAlign: 'center' },
    titre: { fontSize: t.police.titre, fontWeight: '800', color: couleurs.texte, textAlign: 'center' },
    carte: { ...carteDouce(t), padding: t.espace.l, gap: t.espace.s },
    carteRetour: { ...carteDouce(t), alignItems: 'center', paddingVertical: t.espace.xs, paddingHorizontal: t.espace.s },
    carteBrouillon: { borderColor: couleurs.primaire, borderWidth: t.trait / 2, gap: t.espace.m },
    carteEntete: { flexDirection: 'row', alignItems: 'center', gap: t.espace.s, marginBottom: t.espace.xs },
    carteIcone: {
      width: t.e(32),
      height: t.e(32),
      borderRadius: t.e(16),
      backgroundColor: couleurs.primaireDoux,
      alignItems: 'center',
      justifyContent: 'center',
    },
    carteTitre: { fontSize: t.police.aide, fontWeight: '700', color: couleurs.texteSecondaire, letterSpacing: 0.4, textTransform: 'uppercase' },
    texte: { fontSize: t.police.corps, color: couleurs.texte, lineHeight: t.police.corps * 1.4 },
    consigne: { fontSize: t.police.aide, fontWeight: '700', color: couleurs.texteSecondaire, textAlign: 'center' },

    etape: { gap: t.espace.xl, marginTop: t.espace.xl * 1.4 },
    // Numéro et étiquette forment une seule barre continue (pas deux pastilles séparées) : le numéro dans la teinte
    // foncée, l'étiquette dans la teinte douce, sans espace ni angle arrondi entre les deux.
    etapeEntete: { flexDirection: 'row', alignItems: 'stretch' },
    etapeNumero: {
      minWidth: t.e(44),
      paddingHorizontal: t.espace.m,
      backgroundColor: couleurs.primaireFonce,
      borderTopLeftRadius: t.rayon.m,
      borderBottomLeftRadius: t.rayon.m,
      alignItems: 'center',
      justifyContent: 'center',
    },
    etapeNumeroTexte: { color: '#FFFFFF', fontSize: t.police.sousTitre, fontWeight: '800' },
    etapeLabel: {
      flex: 1,
      backgroundColor: couleurs.primaireDoux,
      borderTopRightRadius: t.rayon.m,
      borderBottomRightRadius: t.rayon.m,
      justifyContent: 'center',
      paddingVertical: t.espace.s,
      paddingHorizontal: t.espace.l,
    },
    etapeLabelTexte: { color: couleurs.primaireFonce, fontSize: t.police.corps, fontWeight: '800' },
    etapeCarte: { flexDirection: 'row', alignItems: 'center', gap: t.espace.m },
    // justify : sans effet visible sur le texte d'une seule ligne (mesures), justifie le paragraphe multi-lignes
    // (confidentialité).
    etapeTexte: { flex: 1, fontSize: t.police.aide, color: couleurs.texte, lineHeight: t.police.aide * 1.4, textAlign: 'justify' },
    etapeTexteCentre: { textAlign: 'center' },
    trait: { width: t.trait / 2, alignSelf: 'stretch', backgroundColor: couleurs.bordure },
    etapeIcone: {
      width: t.e(40),
      height: t.e(40),
      borderRadius: t.e(20),
      backgroundColor: couleurs.primaireDoux,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

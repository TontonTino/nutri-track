// Historique : liste chronologique des dépistages + courbe de suivi de grossesse (hauteur utérine dans le temps).
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CourbeGrossesse, type PointCourbe } from '../components/CourbeGrossesse';
import { couleurClassification, couleurs } from '../constants/theme';
import { dateCpn, type EnregistrementHistorique, listerDepistages, suiviGrossesseDe } from '../data/historique';
import { categorieDe, libelleDe, nomPopulation, resumeMesures } from '../services/presentation';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';
import type { Population } from '../types/depistage';

type Filtre = 'tous' | Population;
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Tous' },
  { valeur: 'enfant', libelle: 'Enfants' },
  { valeur: 'enceinte', libelle: 'Femmes enceintes' },
  { valeur: 'personne_agee', libelle: 'Personnes âgées' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Pastilles<T extends string>({ options, valeur, onChange }: { options: { valeur: T; libelle: string }[]; valeur: T | null; onChange: (v: T) => void }) {
  const styles = useStyles(creerStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pastilles}>
      {options.map((o) => (
        <Pressable
          key={o.valeur}
          onPress={() => onChange(o.valeur)}
          accessibilityRole="button"
          accessibilityState={{ selected: o.valeur === valeur }}
          style={[styles.pastille, o.valeur === valeur && styles.pastilleActive]}
        >
          <Text style={[styles.pastilleTexte, o.valeur === valeur && styles.pastilleTexteActive]}>{o.libelle}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function Historique() {
  const styles = useStyles(creerStyles);
  const [donnees, setDonnees] = useState<EnregistrementHistorique[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [patienteChoisie, setPatienteChoisie] = useState<string | null>(null);

  // Rechargé à chaque retour sur l'écran, pour voir le dépistage qui vient d'être fait.
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      listerDepistages()
        .then((d) => actif && (setDonnees(d), setErreur(null)))
        .catch(() => actif && setErreur("Impossible de lire l'historique enregistré sur ce téléphone."));
      return () => {
        actif = false;
      };
    }, []),
  );

  const patientes = useMemo(() => {
    const vues: string[] = [];
    for (const d of donnees ?? []) {
      if (d.population === 'enceinte' && d.personne_ref && !vues.includes(d.personne_ref)) vues.push(d.personne_ref);
    }
    return vues;
  }, [donnees]);

  const patiente = patienteChoisie && patientes.includes(patienteChoisie) ? patienteChoisie : (patientes[0] ?? null);
  const suivi = useMemo(() => (donnees && patiente ? suiviGrossesseDe(donnees, patiente) : []), [donnees, patiente]);
  const points: PointCourbe[] = suivi.flatMap((s) => {
    const mesuree = s.mesures.hauteur_uterine;
    const attendue = s.mesures.semaine_amenorrhee;
    return typeof mesuree === 'number' && typeof attendue === 'number' ? [{ date: dateCpn(s), mesuree, attendue }] : [];
  });

  const affiches = (donnees ?? []).filter((d) => filtre === 'tous' || d.population === filtre);

  const entete = (
    <View>
      <Pastilles options={FILTRES} valeur={filtre} onChange={setFiltre} />

      {patiente ? (
        <View style={styles.carte} testID="suivi-grossesse">
          <Text style={styles.titreSection}>Suivi de grossesse</Text>
          {patientes.length > 1 ? (
            <Pastilles options={patientes.map((p) => ({ valeur: p, libelle: p }))} valeur={patiente} onChange={setPatienteChoisie} />
          ) : (
            <Text style={styles.sousTitre}>Patiente : {patiente}</Text>
          )}
          {points.length >= 2 ? (
            <CourbeGrossesse points={points} />
          ) : (
            <Text style={styles.sousTitre}>
              Une seule consultation enregistrée : résultat ponctuel, aucune tendance à afficher.
              {points[0] ? ` Hauteur utérine ${points[0].mesuree} cm à ${points[0].attendue} SA.` : ''}
            </Text>
          )}
        </View>
      ) : null}

      <Text style={styles.titreSection}>Dépistages ({affiches.length})</Text>
    </View>
  );

  if (erreur) {
    return (
      <View style={styles.vide}>
        <Text style={styles.videTexte}>{erreur}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={affiches}
      keyExtractor={(d) => d.id}
      style={styles.cadre}
      contentContainerStyle={styles.liste}
      ListHeaderComponent={entete}
      ListEmptyComponent={
        donnees === null ? null : (
          <View style={styles.vide}>
            <Text style={styles.videTexte}>Aucun dépistage enregistré pour le moment.</Text>
          </View>
        )
      }
      renderItem={({ item }) => {
        const couleur = couleurClassification[categorieDe(item.classification)];
        return (
          <View style={styles.ligne} testID="ligne-historique">
            <View style={styles.ligneHaut}>
              <Text style={styles.ligneTitre}>
                {nomPopulation[item.population]}
                {item.personne_ref ? ` — ${item.personne_ref}` : ''}
              </Text>
              <Text style={styles.ligneDate}>{formatDate(item.date_saisie)}</Text>
            </View>
            <Text style={styles.ligneMesures}>{resumeMesures(item.population, item.mesures)}</Text>
            <View style={[styles.etiquette, { backgroundColor: couleur.fond }]}>
              <Text style={[styles.etiquetteTexte, { color: couleur.texte }]} numberOfLines={2}>
                {libelleDe(item.population, item.classification)}
              </Text>
            </View>
            {item.orientation_declenchee ? <Text style={styles.orientation}>Orientation vers un centre de santé déclenchée</Text> : null}
            {item.oedemes_incertains ? <Text style={styles.note}>Œdèmes incertains : à confirmer par le test de pression</Text> : null}
          </View>
        );
      }}
    />
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    cadre: { width: '100%', maxWidth: t.contenuMax, alignSelf: 'center' },
    liste: { padding: t.espace.l, paddingBottom: t.espace.xl * 1.5, gap: t.espace.m },
    pastilles: { gap: t.espace.s, paddingBottom: t.espace.m },
    pastille: {
      borderWidth: t.trait,
      borderColor: couleurs.bordure,
      borderRadius: t.rayon.l * 2,
      paddingHorizontal: t.espace.l,
      paddingVertical: t.espace.s,
      minHeight: t.cibleTactile * 0.8,
      justifyContent: 'center',
      backgroundColor: couleurs.carte,
    },
    pastilleActive: { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire },
    pastilleTexte: { color: couleurs.texte, fontWeight: '600', fontSize: t.police.corps },
    pastilleTexteActive: { color: '#FFFFFF' },
    carte: {
      backgroundColor: couleurs.carte,
      borderRadius: t.rayon.m,
      borderWidth: t.trait / 2,
      borderColor: couleurs.bordure,
      padding: t.espace.m,
      marginBottom: t.espace.m,
      gap: t.espace.s,
    },
    titreSection: { fontSize: t.police.sousTitre, fontWeight: '800', color: couleurs.texte, marginBottom: t.espace.xs },
    sousTitre: { fontSize: t.police.aide, color: couleurs.texteSecondaire },
    ligne: {
      backgroundColor: couleurs.carte,
      borderRadius: t.rayon.m,
      borderWidth: t.trait / 2,
      borderColor: couleurs.bordure,
      padding: t.espace.m,
      gap: t.espace.xs,
    },
    ligneHaut: { flexDirection: 'row', justifyContent: 'space-between', gap: t.espace.s, flexWrap: 'wrap' },
    ligneTitre: { fontSize: t.police.corps, fontWeight: '700', color: couleurs.texte, flexShrink: 1 },
    ligneDate: { fontSize: t.police.aide, color: couleurs.texteSecondaire },
    ligneMesures: { fontSize: t.police.aide, color: couleurs.texteSecondaire },
    etiquette: { alignSelf: 'flex-start', borderRadius: t.rayon.s, paddingHorizontal: t.espace.m, paddingVertical: t.espace.xs, maxWidth: '100%' },
    etiquetteTexte: { fontSize: t.police.aide, fontWeight: '700' },
    orientation: { fontSize: t.police.aide, fontWeight: '700', color: couleurs.erreur },
    note: { fontSize: t.police.aide, color: couleurs.texteSecondaire, fontStyle: 'italic' },
    vide: { padding: t.espace.xl, alignItems: 'center' },
    videTexte: { fontSize: t.police.corps, color: couleurs.texteSecondaire, textAlign: 'center' },
  });

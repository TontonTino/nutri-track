// Historique : liste chronologique des dépistages + courbe de suivi de grossesse (hauteur utérine dans le temps).
// Mise en page aérée : cartes légères, une seule pastille de couleur par dépistage, notes discrètes.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CourbeGrossesse, type PointCourbe } from '../components/CourbeGrossesse';
import { couleurs, teintes } from '../constants/theme';
import { useSynchro } from '../data/SynchroContext';
import { dateCpn, type EnregistrementHistorique, listerDepistages, suiviGrossesseDe } from '../data/historique';
import { categorieDe, libelleDe, resumeMesures } from '../services/presentation';
import { carteDouce } from '../theme/carte';
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
const ACCENT_ATTENTE = '#E08600';
const NOMS_COURTS: Record<Population, string> = { enfant: 'Enfant', enceinte: 'Femme enceinte', personne_agee: 'Personne âgée' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Pastilles<T extends string>({ options, valeur, onChange }: { options: { valeur: T; libelle: string }[]; valeur: T | null; onChange: (v: T) => void }) {
  const styles = useStyles(creerStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pastilles}>
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <Pressable
            key={o.valeur}
            onPress={() => onChange(o.valeur)}
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            style={[styles.pastille, actif && styles.pastilleActive]}
          >
            <Text style={[styles.pastilleTexte, actif && styles.pastilleTexteActive]}>{o.libelle}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function LigneNote({ texte, accent }: { texte: string; accent: string }) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.noteLigne}>
      <View style={[styles.notePoint, { backgroundColor: accent }]} />
      <Text style={styles.noteTexte}>{texte}</Text>
    </View>
  );
}

export default function Historique() {
  const styles = useStyles(creerStyles);
  const { nombreEnAttente, enSynchronisation, forcerSync } = useSynchro();
  const [donnees, setDonnees] = useState<EnregistrementHistorique[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [patienteChoisie, setPatienteChoisie] = useState<string | null>(null);

  const monte = useRef(true);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const charger = useCallback(() => {
    listerDepistages()
      .then((d) => {
        if (!monte.current) return;
        setDonnees(d);
        setErreur(null);
      })
      .catch(() => monte.current && setErreur("Impossible de lire l'historique enregistré sur ce téléphone."));
  }, []);

  // Rechargé à chaque retour sur l'écran (pour voir le dépistage qui vient d'être fait)
  // et à chaque changement d'état de la synchronisation.
  useFocusEffect(useCallback(() => charger(), [charger]));
  useEffect(() => charger(), [charger, nombreEnAttente, enSynchronisation]);

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
    <View style={styles.entete}>
      {nombreEnAttente > 0 ? (
        <View style={styles.attenteCarte} testID="carte-attente">
          <View style={[styles.notePoint, { backgroundColor: ACCENT_ATTENTE }]} />
          <Text style={styles.attenteTexte}>
            {nombreEnAttente} dépistage{nombreEnAttente > 1 ? 's' : ''} en attente de synchronisation
          </Text>
          <Pressable onPress={() => void forcerSync()} disabled={enSynchronisation} accessibilityRole="button" accessibilityLabel="Synchroniser maintenant" testID="bouton-synchroniser">
            <Text style={styles.attenteAction}>{enSynchronisation ? 'En cours…' : 'Synchroniser'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Pastilles options={FILTRES} valeur={filtre} onChange={setFiltre} />

      {patiente ? (
        <View style={styles.carteSuivi} testID="suivi-grossesse">
          <Text style={styles.titreCarte}>Suivi de grossesse</Text>
          {patientes.length > 1 ? (
            <Pastilles options={patientes.map((p) => ({ valeur: p, libelle: p }))} valeur={patiente} onChange={setPatienteChoisie} />
          ) : (
            <Text style={styles.sousTitre}>Patiente : {patiente}</Text>
          )}
          {points.length >= 2 ? (
            <CourbeGrossesse points={points} />
          ) : (
            <Text style={styles.sousTitre}>
              Une seule consultation enregistrée : aucune tendance à afficher.
              {points[0] ? ` Hauteur utérine ${points[0].mesuree} cm à ${points[0].attendue} SA.` : ''}
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.titreSection}>
        <Text style={styles.titreSectionTexte}>Dépistages</Text>
        <Text style={styles.compteur}>{affiches.length}</Text>
      </View>
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
        const teinte = teintes[categorieDe(item.classification)];
        const attente = !item.synchronise ? (item.provisoire ? 'En attente de synchronisation · résultat provisoire' : 'En attente de synchronisation') : null;
        return (
          <View style={styles.ligne} testID="ligne-historique">
            <View style={styles.ligneHaut}>
              <Text style={styles.ligneTitre} numberOfLines={1}>
                {item.personne_ref ?? NOMS_COURTS[item.population]}
              </Text>
              <Text style={styles.ligneDate}>
                {item.personne_ref ? `${NOMS_COURTS[item.population]}  ·  ` : ''}
                {formatDate(item.date_saisie)}
              </Text>
            </View>
            <Text style={styles.ligneMesures}>{resumeMesures(item.population, item.mesures)}</Text>
            <View style={[styles.etiquette, { backgroundColor: teinte.fond }]}>
              <View style={[styles.etiquettePoint, { backgroundColor: teinte.accent }]} />
              <Text style={[styles.etiquetteTexte, { color: teinte.texte }]}>{libelleDe(item.population, item.classification)}</Text>
            </View>
            {item.orientation_declenchee || attente || item.conflit_ambigu || item.oedemes_incertains ? (
              <View style={styles.notes}>
                {item.orientation_declenchee ? <LigneNote texte="Orientation vers un centre de santé" accent={couleurs.erreur} /> : null}
                {attente ? <LigneNote texte={attente} accent={ACCENT_ATTENTE} /> : null}
                {item.conflit_ambigu ? <LigneNote texte="Possible doublon : à vérifier par le centre de santé" accent={ACCENT_ATTENTE} /> : null}
                {item.oedemes_incertains ? <LigneNote texte="Œdèmes incertains : à confirmer" accent={ACCENT_ATTENTE} /> : null}
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    cadre: { width: '100%', maxWidth: t.contenuMax, alignSelf: 'center' },
    liste: { padding: t.espace.l, paddingBottom: t.espace.xl * 2, gap: t.espace.l },
    entete: { gap: t.espace.l },
    pastilles: { gap: t.espace.s, paddingVertical: t.espace.xs },
    pastille: {
      borderRadius: t.rayon.l * 2,
      paddingHorizontal: t.espace.l,
      paddingVertical: t.espace.s,
      minHeight: t.cibleTactile * 0.75,
      justifyContent: 'center',
      backgroundColor: '#E9EEEB',
    },
    pastilleActive: { backgroundColor: couleurs.primaire },
    pastilleTexte: { color: couleurs.texteSecondaire, fontWeight: '600', fontSize: t.police.corps },
    pastilleTexteActive: { color: '#FFFFFF' },
    attenteCarte: { ...carteDouce(t), flexDirection: 'row', alignItems: 'center', gap: t.espace.m, paddingVertical: t.espace.m, paddingHorizontal: t.espace.l },
    attenteTexte: { flex: 1, fontSize: t.police.aide, color: couleurs.texteSecondaire },
    attenteAction: { fontSize: t.police.corps, fontWeight: '700', color: couleurs.primaire, paddingVertical: t.espace.xs },
    carteSuivi: { ...carteDouce(t), padding: t.espace.xl, gap: t.espace.m },
    titreCarte: { fontSize: t.police.sousTitre, fontWeight: '800', color: couleurs.texte },
    sousTitre: { fontSize: t.police.aide, color: couleurs.texteSecondaire, lineHeight: t.police.aide * 1.4 },
    titreSection: { flexDirection: 'row', alignItems: 'baseline', gap: t.espace.s, marginTop: t.espace.s },
    titreSectionTexte: { fontSize: t.police.titre, fontWeight: '800', color: couleurs.texte },
    compteur: { fontSize: t.police.corps, fontWeight: '700', color: couleurs.texteSecondaire },
    ligne: { ...carteDouce(t), padding: t.espace.xl, gap: t.espace.m },
    ligneHaut: { gap: t.espace.xs },
    ligneTitre: { fontSize: t.police.sousTitre, fontWeight: '800', color: couleurs.texte },
    ligneDate: { fontSize: t.police.aide, color: couleurs.texteSecondaire },
    ligneMesures: { fontSize: t.police.corps, color: couleurs.texteSecondaire },
    etiquette: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: t.espace.s, borderRadius: t.rayon.m, paddingHorizontal: t.espace.m, paddingVertical: t.espace.s, maxWidth: '100%' },
    etiquettePoint: { width: t.e(9), height: t.e(9), borderRadius: t.e(5) },
    etiquetteTexte: { flexShrink: 1, fontSize: t.police.corps, fontWeight: '700' },
    notes: { gap: t.espace.s, paddingTop: t.espace.xs },
    noteLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: t.espace.m },
    notePoint: { width: t.e(8), height: t.e(8), borderRadius: t.e(4), marginTop: t.espace.s },
    noteTexte: { flex: 1, fontSize: t.police.aide, color: couleurs.texteSecondaire, lineHeight: t.police.aide * 1.4 },
    vide: { padding: t.espace.xl, alignItems: 'center' },
    videTexte: { fontSize: t.police.corps, color: couleurs.texteSecondaire, textAlign: 'center' },
  });

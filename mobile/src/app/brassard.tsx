// Lecture assistée du brassard PB : la caméra photographie la bande, l'agent tape la valeur lue, et l'app contrôle que
// la couleur visible correspond à cette valeur. Aucune estimation de l'IA n'entre dans le classement.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoutonPrincipal } from '../components/BoutonPrincipal';
import { ChampNumerique } from '../components/ChampNumerique';
import { analyserPhoto, supprimerPhoto } from '../brassard/analyse';
import { type AnalyseCouleur, controleCouleur, NOM_ZONE, type ZoneBrassard, zoneDepuisPb } from '../brassard/couleur';
import { definirLecture } from '../brassard/lecture';
import { couleurs } from '../constants/theme';
import { versNombre } from '../services/formulaire';
import { verifierPlages } from '../services/plages';
import type { Echelle } from '../theme/echelle';
import { useEchelle, useStyles } from '../theme/useEchelle';

const COULEURS_ZONE: Record<ZoneBrassard, { fond: string; texte: string }> = {
  rouge: { fond: '#C62828', texte: '#FFFFFF' },
  jaune: { fond: '#F9A825', texte: '#3A2A00' },
  vert: { fond: '#2E7D32', texte: '#FFFFFF' },
};

interface Photo {
  uri: string;
  width: number;
  height: number;
}

function Pastille({ zone, libelle }: { zone: ZoneBrassard; libelle: string }) {
  const styles = useStyles(creerStyles);
  const c = COULEURS_ZONE[zone];
  return (
    <View style={[styles.pastille, { backgroundColor: c.fond }]}>
      <Text style={[styles.pastilleTexte, { color: c.texte }]}>{libelle}</Text>
    </View>
  );
}

export default function LectureBrassardEcran() {
  const t = useEchelle();
  const styles = useStyles(creerStyles);
  const marges = useSafeAreaInsets();
  const [permission, demanderPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const photoRef = useRef<Photo | null>(null);
  const [etape, setEtape] = useState<'camera' | 'analyse' | 'lecture'>('camera');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseCouleur | null>(null);
  const [valeur, setValeur] = useState('');
  const [erreur, setErreur] = useState<string | undefined>();
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);

  // La photo n'est jamais gardée : effacée à la reprise, à la validation, et si l'écran est quitté.
  const purger = useCallback(() => {
    supprimerPhoto(photoRef.current?.uri);
    photoRef.current = null;
  }, []);
  useEffect(() => purger, [purger]);

  async function prendrePhoto() {
    if (!camera.current) return;
    setErreurPhoto(null);
    setEtape('analyse');
    try {
      const p = await camera.current.takePictureAsync({ quality: 0.5, exif: false });
      const nouvelle = { uri: p.uri, width: p.width, height: p.height };
      photoRef.current = nouvelle;
      setPhoto(nouvelle);
      setAnalyse(await analyserPhoto(nouvelle.uri, nouvelle.width, nouvelle.height));
      setEtape('lecture');
    } catch {
      // Photo ou analyse impossible : on n'empêche pas la lecture, seulement le contrôle de couleur.
      setAnalyse({ detectee: null, parts: { rouge: 0, jaune: 0, vert: 0 }, pixelsAnalyses: 0 });
      setErreurPhoto("Le contrôle de couleur n'a pas pu être fait. Vous pouvez quand même saisir la valeur lue.");
      setEtape(photoRef.current ? 'lecture' : 'camera');
    }
  }

  function reprendre() {
    purger();
    setPhoto(null);
    setAnalyse(null);
    setValeur('');
    setErreur(undefined);
    setErreurPhoto(null);
    setEtape('camera');
  }

  function utiliser() {
    const mm = versNombre(valeur);
    if (mm === null) {
      setErreur('Saisissez la valeur lue sur le brassard, en millimètres.');
      return;
    }
    try {
      verifierPlages('enfant', { pb: mm });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Valeur hors plage.');
      return;
    }
    const detectee = analyse?.detectee ?? null;
    definirLecture({ valeur_mm: mm, controle: controleCouleur(mm, detectee), couleur_detectee: detectee });
    purger();
    router.dismissTo('/enfant');
  }

  function annuler() {
    purger();
    router.back();
  }

  // --- Permission caméra ---
  if (!permission) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={[styles.centre, { paddingTop: marges.top + t.espace.l }]}>
        <Text style={styles.titreClair}>Caméra</Text>
        <Text style={styles.texteClair}>
          {"La caméra sert à photographier la bande du brassard pour contrôler la valeur lue. La photo n'est pas conservée."}
        </Text>
        {permission.canAskAgain ? (
          <BoutonPrincipal titre="Autoriser la caméra" onPress={() => void demanderPermission()} />
        ) : (
          <Text style={styles.texteClair}>Autorisez la caméra dans les réglages du téléphone, ou saisissez la valeur sans photo.</Text>
        )}
        <BoutonPrincipal titre="Saisir sans photo" secondaire onPress={annuler} />
      </View>
    );
  }

  // --- Lecture de la valeur ---
  if (etape === 'lecture') {
    const mm = versNombre(valeur);
    const zoneSaisie = mm !== null ? zoneDepuisPb(mm) : null;
    const detectee = analyse?.detectee ?? null;
    const controle = mm !== null ? controleCouleur(mm, detectee) : null;
    return (
      <ScrollView style={styles.fondClair} contentContainerStyle={[styles.lecture, { paddingTop: marges.top + t.espace.l, paddingBottom: marges.bottom + t.espace.xl }]}>
        <View style={styles.colonne}>
          <Text style={styles.titreSombre}>Valeur lue sur le brassard</Text>
          {photo ? <Image source={{ uri: photo.uri }} style={styles.miniature} resizeMode="cover" accessibilityLabel="Photo du brassard" /> : null}

          <View style={styles.ligne}>
            <Text style={styles.etiquette}>Couleur vue sur la photo</Text>
            {detectee ? <Pastille zone={detectee} libelle={NOM_ZONE[detectee]} /> : <Text style={styles.neutre}>non détectée</Text>}
          </View>
          {erreurPhoto ? <Text style={styles.neutre}>{erreurPhoto}</Text> : null}

          <ChampNumerique
            testID="champ-lecture-brassard"
            libelle="Valeur lue sur le brassard"
            unite="mm"
            valeur={valeur}
            onChange={(v) => {
              setValeur(v);
              setErreur(undefined);
            }}
            erreur={erreur}
            aide="Là où la bande se ferme autour du bras. Exemple : 112"
          />

          {zoneSaisie ? (
            <View style={styles.ligne}>
              <Text style={styles.etiquette}>Cette valeur correspond à la zone</Text>
              <Pastille zone={zoneSaisie} libelle={NOM_ZONE[zoneSaisie]} />
            </View>
          ) : null}

          {controle === 'incoherent' && detectee && zoneSaisie ? (
            <View style={styles.alerte} accessibilityRole="alert" testID="alerte-incoherence">
              <Text style={styles.alerteTexte}>
                {`Vérifiez : la bande photographiée semble ${NOM_ZONE[detectee]}, mais ${mm} mm correspond à la zone ${NOM_ZONE[zoneSaisie]}. Relisez le brassard ou corrigez la valeur. Vous pouvez aussi continuer si vous êtes sûr de votre lecture.`}
              </Text>
            </View>
          ) : null}
          {controle === 'coherent' ? <Text style={styles.ok}>La couleur photographiée correspond à la valeur.</Text> : null}

          <BoutonPrincipal testID="bouton-utiliser-lecture" titre="Utiliser cette valeur" onPress={utiliser} />
          <BoutonPrincipal titre="Reprendre la photo" secondaire onPress={reprendre} />
        </View>
      </ScrollView>
    );
  }

  // --- Caméra ---
  return (
    <View style={styles.fondCamera}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
      <View style={[styles.hautCamera, { paddingTop: marges.top + t.espace.s }]} pointerEvents="box-none">
        <Pressable onPress={annuler} accessibilityRole="button" accessibilityLabel="Annuler" style={styles.annuler}>
          <Text style={styles.annulerTexte}>Annuler</Text>
        </Pressable>
        <Text style={styles.consigne}>Cadrez la fenêtre de lecture du brassard dans le rectangle</Text>
      </View>
      <View style={styles.cadreZone} pointerEvents="none">
        <View style={styles.cadre} />
      </View>
      <View style={[styles.basCamera, { paddingBottom: marges.bottom + t.espace.l }]}>
        {etape === 'analyse' ? (
          <ActivityIndicator size="large" color="#FFFFFF" />
        ) : (
          <Pressable onPress={() => void prendrePhoto()} accessibilityRole="button" accessibilityLabel="Prendre la photo" testID="declencheur" style={styles.declencheur}>
            <View style={styles.declencheurInterieur} />
          </Pressable>
        )}
        <Pressable onPress={annuler} accessibilityRole="button" accessibilityLabel="Saisir sans photo">
          <Text style={styles.sansPhoto}>Saisir sans photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    centre: { flex: 1, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', padding: t.espace.xl, gap: t.espace.m },
    titreClair: { color: '#FFFFFF', fontSize: t.police.titre, fontWeight: '800' },
    texteClair: { color: '#DDDDDD', fontSize: t.police.corps, textAlign: 'center' },
    fondClair: { flex: 1, backgroundColor: couleurs.fond },
    lecture: { flexGrow: 1, alignItems: 'center' },
    colonne: { width: '100%', maxWidth: t.contenuMax, paddingHorizontal: t.espace.l, gap: t.espace.m },
    titreSombre: { fontSize: t.police.titre, fontWeight: '800', color: couleurs.texte },
    miniature: { width: '100%', aspectRatio: 2, borderRadius: t.rayon.m, backgroundColor: '#DDDDDD' },
    ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.espace.m },
    etiquette: { fontSize: t.police.corps, color: couleurs.texteSecondaire, flexShrink: 1 },
    neutre: { fontSize: t.police.aide, color: couleurs.texteSecondaire },
    pastille: { borderRadius: t.rayon.l * 2, paddingHorizontal: t.espace.l, paddingVertical: t.espace.xs },
    pastilleTexte: { fontSize: t.police.corps, fontWeight: '800', textTransform: 'uppercase' },
    alerte: { backgroundColor: '#FFF4E0', borderColor: '#EF6C00', borderWidth: t.trait / 2, borderRadius: t.rayon.m, padding: t.espace.m },
    alerteTexte: { color: '#8A4B00', fontSize: t.police.corps, fontWeight: '600' },
    ok: { fontSize: t.police.corps, color: '#2E7D32', fontWeight: '700' },
    fondCamera: { flex: 1, backgroundColor: '#000000' },
    hautCamera: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: t.espace.l, gap: t.espace.m },
    annuler: { alignSelf: 'flex-start', paddingVertical: t.espace.s, paddingRight: t.espace.l, minHeight: t.cibleTactile, justifyContent: 'center' },
    annulerTexte: { color: '#FFFFFF', fontSize: t.police.sousTitre, fontWeight: '700' },
    consigne: { color: '#FFFFFF', fontSize: t.police.sousTitre, fontWeight: '700', textAlign: 'center' },
    cadreZone: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    cadre: { width: '60%', height: '18%', borderWidth: t.trait * 1.5, borderColor: '#FFFFFF', borderRadius: t.rayon.m },
    basCamera: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: t.espace.l },
    declencheur: { width: t.e(76), height: t.e(76), borderRadius: t.e(38), borderWidth: t.trait * 1.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    declencheurInterieur: { width: t.e(58), height: t.e(58), borderRadius: t.e(29), backgroundColor: '#FFFFFF' },
    sansPhoto: { color: '#FFFFFF', fontSize: t.police.corps, fontWeight: '600', textDecorationLine: 'underline' },
  });

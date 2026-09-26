// Saisie manuelle Enfant : MesureEnfant(pb, pb_source, poids, taille, oedemes_bilateraux, oedemes_source).
// Œdèmes : Oui / Non / Incertain, mais « Incertain » doit être tranché par le test de pression avant la validation
// (voir services/mappings.ts et components/AideTestPression.tsx) : l'API n'accepte qu'un booléen.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AideTestPression } from '../components/AideTestPression';
import { BanniereErreur } from '../components/BanniereErreur';
import { BoutonPrincipal } from '../components/BoutonPrincipal';
import { ChampNumerique } from '../components/ChampNumerique';
import { ChoixUnique } from '../components/ChoixUnique';
import { effectuerDepistage, paramsResultat } from '../services/depistage';
import { useEnvoiUnique } from '../services/useEnvoiUnique';
import { AGENT_ID, VISION_CALIBRATION_ACTIVE } from '../constants/config';
import { champsBrassard, consommerLecture, type LectureBrassard, lectureActive } from '../brassard/lecture';
import { champsVision, MODE_SAISIE_VISION, PB_SOURCE_VISION, visionActive } from '../vision/mesureAssistee';
import { consommerResultat, definirParametres, reinitialiserSession, type ResultatVision } from '../vision/session';
import { type Erreurs, erreurPourFormulaire, versNombre } from '../services/formulaire';
import { erreurOedemes, oedemesVersApi } from '../services/mappings';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';
import type { MesureEnfant, Oedemes } from '../types/depistage';

const OPTIONS_OEDEMES: readonly Oedemes[] = ['Oui', 'Non', 'Incertain'];
const LIBELLES_CHAMPS: Record<string, string> = {
  pb: 'Périmètre brachial',
  poids: 'Poids',
  taille: 'Taille',
  oedemes_bilateraux: 'Œdèmes bilatéraux',
};

export default function SaisieEnfant() {
  const styles = useStyles(creerStyles);
  // Les champs restent en texte : une erreur ne vide jamais le formulaire.
  const [code, setCode] = useState('');
  const [pb, setPb] = useState('');
  const [poids, setPoids] = useState('');
  const [taille, setTaille] = useState('');
  const [oedemes, setOedemes] = useState<Oedemes | null>(null);
  const [vision, setVision] = useState<ResultatVision | null>(null);
  const [lecture, setLecture] = useState<LectureBrassard | null>(null);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const { chargement: envoiEnCours, lancer } = useEnvoiUnique();

  // Retour de la lecture du brassard ou de la capture assistée : le PB validé par l'agent remplit le champ
  // (jamais une estimation brute de l'IA).
  useFocusEffect(
    useCallback(() => {
      const lue = consommerLecture();
      if (lue) {
        setLecture(lue);
        setVision(null);
        setPb(String(lue.valeur_mm));
        setErreurs((e) => ({ ...e, pb: undefined }));
        setErreurGenerale(null);
        return;
      }
      const resultat = consommerResultat();
      if (!resultat) return;
      setVision(resultat);
      setLecture(null);
      setPb(String(resultat.valeur_mm));
      setErreurs((e) => ({ ...e, pb: undefined }));
      setErreurGenerale(null);
    }, []),
  );

  function ouvrirLectureBrassard() {
    router.push('/brassard');
  }

  function lancerCapture() {
    reinitialiserSession();
    definirParametres('PBCaptureScreen', { agent_id: AGENT_ID });
    router.push('/vision/capture');
  }

  const visionEnCours = visionActive(pb, vision);
  const lectureEnCours = lectureActive(pb, lecture);

  function modifier(champ: string, maj: (v: string) => void) {
    return (texte: string) => {
      maj(texte);
      if (erreurs[champ]) {
        setErreurs((e) => ({ ...e, [champ]: undefined }));
        setErreurGenerale(null);
      }
    };
  }

  async function valider() {
    setErreurGenerale(null);
    const pbN = versNombre(pb);
    const poidsN = versNombre(poids);
    const tailleN = versNombre(taille);

    const locales: Erreurs = {};
    if (pbN === null) locales.pb = 'Saisissez le périmètre brachial (nombre).';
    if (poidsN === null) locales.poids = 'Saisissez le poids (nombre).';
    if (tailleN === null) locales.taille = 'Saisissez la taille (nombre).';
    const erreurOed = erreurOedemes(oedemes);
    if (erreurOed) locales.oedemes_bilateraux = erreurOed;
    if (Object.keys(locales).length > 0) {
      setErreurs(locales);
      return;
    }

    const assiste = visionActive(pb, vision);
    const mesure: MesureEnfant = {
      pb: pbN as number,
      pb_source: assiste ? PB_SOURCE_VISION : 'manuel',
      poids: poidsN as number,
      taille: tailleN as number,
      oedemes_bilateraux: oedemesVersApi(oedemes as Oedemes),
      oedemes_source: 'clinique',
      ...(assiste ? champsVision(assiste) : {}),
      ...(lectureActive(pb, lecture) ? champsBrassard(lecture as LectureBrassard) : {}),
    };
    const options = {
      personneRef: code,
      modeSaisie: assiste ? MODE_SAISIE_VISION : 'manuel',
    };

    await lancer(async () => {
      try {
        const resultat = await effectuerDepistage('enfant', mesure, options);
        setErreurs({});
        router.replace({ pathname: '/resultat', params: paramsResultat('enfant', resultat) });
      } catch (e) {
        const { erreurs: nouvelles, general } = erreurPourFormulaire(e, LIBELLES_CHAMPS);
        setErreurs(nouvelles);
        setErreurGenerale(general);
      }
    });
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.defilement} keyboardShouldPersistTaps="handled">
        <View style={styles.conteneur}>
        <BanniereErreur message={erreurGenerale} />

        <ChampNumerique
          testID="champ-code"
          libelle="Code ou nom de l'enfant (facultatif)"
          valeur={code}
          onChange={setCode}
          clavier="default"
          aide="Reste sur ce téléphone, pour retrouver le dépistage dans l'historique."
        />
        <ChampNumerique
          testID="champ-pb"
          libelle="Périmètre brachial (PB)"
          unite="mm"
          valeur={pb}
          onChange={modifier('pb', setPb)}
          erreur={erreurs.pb}
          aide={
            lectureEnCours
              ? lectureEnCours.controle === 'coherent'
                ? 'Lu sur le brassard. La couleur photographiée correspond à la valeur.'
                : lectureEnCours.controle === 'incoherent'
                  ? 'Lu sur le brassard. Attention : la couleur photographiée ne correspondait pas à la valeur.'
                  : 'Lu sur le brassard.'
              : visionEnCours
                ? `Mesuré avec la caméra et ${visionEnCours.statut === 'corrigee' ? 'corrigé' : 'confirmé'} par vous. Modifiez le champ pour saisir à la main.`
                : 'Mesure au brassard, en millimètres. Exemple : 112'
          }
        />
        <View style={styles.blocCamera}>
          <BoutonPrincipal titre="Photographier le brassard (contrôle)" secondaire onPress={ouvrirLectureBrassard} testID="bouton-brassard" />
          {VISION_CALIBRATION_ACTIVE ? (
            <BoutonPrincipal titre="Estimer par calibration (prototype)" secondaire onPress={lancerCapture} testID="bouton-camera" />
          ) : null}
        </View>
        <ChampNumerique testID="champ-poids" libelle="Poids" unite="kg" valeur={poids} onChange={modifier('poids', setPoids)} erreur={erreurs.poids} />
        <ChampNumerique testID="champ-taille" libelle="Taille" unite="cm" valeur={taille} onChange={modifier('taille', setTaille)} erreur={erreurs.taille} />
        <ChoixUnique
          libelle="Œdèmes bilatéraux"
          options={OPTIONS_OEDEMES}
          valeur={oedemes}
          onChange={(v) => {
            setOedemes(v);
            if (erreurs.oedemes_bilateraux) setErreurs((e) => ({ ...e, oedemes_bilateraux: undefined }));
          }}
          erreur={erreurs.oedemes_bilateraux}
        />
        {oedemes === 'Incertain' ? (
          <AideTestPression
            onResultat={(reponse) => {
              setOedemes(reponse);
              setErreurs((e) => ({ ...e, oedemes_bilateraux: undefined }));
              setErreurGenerale(null);
            }}
          />
        ) : null}

        <BoutonPrincipal testID="bouton-valider" titre="Valider" onPress={valider} chargement={envoiEnCours} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    flex: { flex: 1 },
    defilement: { flexGrow: 1, alignItems: 'center' },
    conteneur: { width: '100%', maxWidth: t.contenuMax, padding: t.espace.l, paddingBottom: t.espace.xl * 1.5 },
    blocCamera: { marginTop: t.espace.xs, marginBottom: t.espace.xl, gap: t.espace.xs },
  });

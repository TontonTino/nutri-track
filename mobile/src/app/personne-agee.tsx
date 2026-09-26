// Saisie manuelle Personne âgée : MesurePersonneAgee(perimetre_mollet, pb_optionnel, perte_poids_recente, score_mna_sf).
// Deux modes : questionnaire MNA-SF (score calculé par l'application) ou saisie directe du score déjà connu.
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BanniereErreur } from '../components/BanniereErreur';
import { BoutonPrincipal } from '../components/BoutonPrincipal';
import { ChampNumerique } from '../components/ChampNumerique';
import { ChoixUnique } from '../components/ChoixUnique';
import { couleurs } from '../constants/theme';
import { effectuerDepistage, paramsResultat } from '../services/depistage';
import { type Erreurs, erreurPourFormulaire, versEntier, versNombre } from '../services/formulaire';
import { calculerScoreMna, type IdQuestionMna, pertePoidsDepuisReponseB, QUESTIONS_MNA } from '../services/mna';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';
import type { MesurePersonneAgee } from '../types/depistage';

type Mode = 'Questionnaire MNA-SF' | 'Saisir le score';
const MODES: readonly Mode[] = ['Questionnaire MNA-SF', 'Saisir le score'];
type PertePoidsChoix = 'Oui' | 'Non' | 'Ne sait pas';
const OPTIONS_PERTE: readonly PertePoidsChoix[] = ['Oui', 'Non', 'Ne sait pas'];

const LIBELLES_CHAMPS: Record<string, string> = {
  perimetre_mollet: 'Périmètre du mollet',
  pb_optionnel: 'Périmètre brachial',
  score_mna_sf: 'Score MNA-SF',
};

export default function SaisiePersonneAgee() {
  const styles = useStyles(creerStyles);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<Mode>('Questionnaire MNA-SF');
  const [choix, setChoix] = useState<Partial<Record<IdQuestionMna, string>>>({});
  const [mollet, setMollet] = useState('');
  const [pbOpt, setPbOpt] = useState('');
  const [scoreDirect, setScoreDirect] = useState('');
  const [perte, setPerte] = useState<PertePoidsChoix | null>(null);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const questionnaire = mode === 'Questionnaire MNA-SF';
  const pointsParQuestion = Object.fromEntries(
    QUESTIONS_MNA.flatMap((q) => {
      const o = q.options.find((opt) => opt.libelle === choix[q.id]);
      return o ? [[q.id, o.points]] : [];
    }),
  ) as Partial<Record<IdQuestionMna, number>>;
  const molletN = versNombre(mollet);
  const scoreCalcule = calculerScoreMna(pointsParQuestion, molletN);

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
    const pbN = versNombre(pbOpt);
    const locales: Erreurs = {};

    if (mollet.trim() !== '' && molletN === null) locales.perimetre_mollet = 'Périmètre du mollet : nombre attendu.';
    if (pbOpt.trim() !== '' && pbN === null) locales.pb_optionnel = 'Périmètre brachial : nombre attendu.';

    let score: number | null;
    let pertePoids: boolean | undefined;
    if (questionnaire) {
      if (molletN === null && !locales.perimetre_mollet) locales.perimetre_mollet = 'Le périmètre du mollet est nécessaire (question F du questionnaire).';
      const manquantes = QUESTIONS_MNA.filter((q) => pointsParQuestion[q.id] === undefined);
      if (manquantes.length > 0) locales.questionnaire = `Répondez aux questions ${manquantes.map((q) => q.id).join(', ')}.`;
      score = scoreCalcule;
      pertePoids = pertePoidsDepuisReponseB(pointsParQuestion.B);
    } else {
      score = versEntier(scoreDirect);
      if (score === null) locales.score_mna_sf = 'Saisissez le score MNA-SF (nombre entier de 0 à 14).';
      pertePoids = perte === 'Oui' ? true : perte === 'Non' ? false : undefined;
    }
    if (Object.keys(locales).length > 0) {
      setErreurs(locales);
      return;
    }

    const mesure: MesurePersonneAgee = {
      score_mna_sf: score as number,
      ...(molletN !== null ? { perimetre_mollet: molletN } : {}),
      ...(pbN !== null ? { pb_optionnel: pbN } : {}),
      ...(pertePoids !== undefined ? { perte_poids_recente: pertePoids } : {}),
    };
    const options = { personneRef: code };

    setEnvoiEnCours(true);
    try {
      const resultat = await effectuerDepistage('personne_agee', mesure, options);
      setErreurs({});
      router.push({ pathname: '/resultat', params: paramsResultat('personne_agee', resultat, options) });
    } catch (e) {
      const { erreurs: nouvelles, general } = erreurPourFormulaire(e, LIBELLES_CHAMPS);
      setErreurs(nouvelles);
      setErreurGenerale(general);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.defilement} keyboardShouldPersistTaps="handled">
        <View style={styles.conteneur}>
        <BanniereErreur message={erreurGenerale} />

        <ChampNumerique
          testID="champ-code"
          libelle="Code ou nom de la personne (facultatif)"
          valeur={code}
          onChange={setCode}
          clavier="default"
          aide="Reste sur ce téléphone, pour retrouver le dépistage dans l'historique."
        />

        <ChampNumerique
          testID="champ-mollet"
          libelle="Périmètre du mollet"
          unite="cm"
          valeur={mollet}
          onChange={modifier('perimetre_mollet', setMollet)}
          erreur={erreurs.perimetre_mollet}
          aide={questionnaire ? 'Utilisé pour la question F du questionnaire. Exemple : 31' : 'Facultatif. Exemple : 31'}
        />
        <ChampNumerique
          testID="champ-pb"
          libelle="Périmètre brachial (PB), facultatif"
          unite="mm"
          valeur={pbOpt}
          onChange={modifier('pb_optionnel', setPbOpt)}
          erreur={erreurs.pb_optionnel}
        />

        <ChoixUnique libelle="Score MNA-SF" options={MODES} valeur={mode} onChange={setMode} />

        {questionnaire ? (
          <View>
            {QUESTIONS_MNA.map((q) => (
              <ChoixUnique
                key={q.id}
                vertical
                libelle={`${q.id}. ${q.libelle}`}
                options={q.options.map((o) => o.libelle)}
                valeur={choix[q.id] ?? null}
                onChange={(v) => {
                  setChoix((c) => ({ ...c, [q.id]: v }));
                  if (erreurs.questionnaire) setErreurs((e) => ({ ...e, questionnaire: undefined }));
                }}
              />
            ))}
            {erreurs.questionnaire ? <Text style={styles.erreur}>{erreurs.questionnaire}</Text> : null}
            <View style={styles.score} testID="score-mna">
              <Text style={styles.scoreTexte}>
                {scoreCalcule !== null ? `Score MNA-SF : ${scoreCalcule} / 14` : 'Score MNA-SF : questionnaire incomplet'}
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <ChampNumerique
              testID="champ-score"
              libelle="Score MNA-SF"
              unite="0 à 14"
              valeur={scoreDirect}
              onChange={modifier('score_mna_sf', setScoreDirect)}
              erreur={erreurs.score_mna_sf}
              clavier="number-pad"
            />
            <ChoixUnique libelle="Perte de poids récente" options={OPTIONS_PERTE} valeur={perte} onChange={setPerte} />
          </View>
        )}

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
    erreur: { color: couleurs.erreur, fontSize: t.police.aide, fontWeight: '600', marginBottom: t.espace.m },
    score: { backgroundColor: couleurs.carte, borderColor: couleurs.bordure, borderWidth: t.trait / 2, borderRadius: t.rayon.m, padding: t.espace.m, marginBottom: t.espace.s },
    scoreTexte: { fontSize: t.police.sousTitre, fontWeight: '700', color: couleurs.texte },
  });

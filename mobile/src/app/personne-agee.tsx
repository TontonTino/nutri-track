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
import { consommerBrouillonAAppliquer, effacerBrouillon } from '../data/brouillon';
import { useSauvegardeBrouillon } from '../data/useSauvegardeBrouillon';
import { effectuerDepistage, paramsResultat } from '../services/depistage';
import { useEnvoiUnique } from '../services/useEnvoiUnique';
import { type Erreurs, erreurPourFormulaire, versEntier, versNombre } from '../services/formulaire';
import { calculerScoreMna, type IdQuestionMna, pertePoidsDepuisReponseB, QUESTIONS_MNA } from '../services/mna';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';
import type { MesurePersonneAgee } from '../types/depistage';

type Mode = 'Questionnaire' | 'Score direct';
const MODES: readonly Mode[] = ['Questionnaire', 'Score direct'];
type PertePoidsChoix = 'Oui' | 'Non' | 'Ne sait pas';
const OPTIONS_PERTE: readonly PertePoidsChoix[] = ['Oui', 'Non', 'Ne sait pas'];

const LIBELLES_CHAMPS: Record<string, string> = {
  perimetre_mollet: 'Périmètre du mollet',
  pb_optionnel: 'Périmètre brachial',
  score_mna_sf: 'Score MNA-SF',
};

// Le questionnaire (choix par question) est structuré : on le range dans le brouillon sous forme de JSON, avec
// une lecture défensive au retour (un brouillon corrompu ne doit jamais faire planter l'écran).
function lireChoixInitial(json: string | undefined): Partial<Record<IdQuestionMna, string>> {
  if (!json) return {};
  try {
    const p: unknown = JSON.parse(json);
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as Partial<Record<IdQuestionMna, string>>) : {};
  } catch {
    return {};
  }
}

export default function SaisiePersonneAgee() {
  const styles = useStyles(creerStyles);
  // Brouillon éventuel proposé par l'écran de consentement (voir data/brouillon.ts) : consommé une seule fois.
  const [brouillonInitial] = useState(() => consommerBrouillonAAppliquer());
  const initChamps = brouillonInitial?.champs ?? {};
  const [code, setCode] = useState(brouillonInitial?.identifiant ?? '');
  const [mode, setMode] = useState<Mode>(MODES.find((m) => m === initChamps.mode) ?? 'Questionnaire');
  const [choix, setChoix] = useState<Partial<Record<IdQuestionMna, string>>>(() => lireChoixInitial(initChamps.choix));
  const [mollet, setMollet] = useState(initChamps.mollet ?? '');
  const [pbOpt, setPbOpt] = useState(initChamps.pbOpt ?? '');
  const [scoreDirect, setScoreDirect] = useState(initChamps.scoreDirect ?? '');
  const [perte, setPerte] = useState<PertePoidsChoix | null>(OPTIONS_PERTE.find((o) => o === initChamps.perte) ?? null);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const { chargement: envoiEnCours, lancer } = useEnvoiUnique();

  useSauvegardeBrouillon('personne_agee', code, {
    mode,
    mollet,
    pbOpt,
    scoreDirect,
    perte: perte ?? '',
    // Chaîne vide (pas "{}") tant qu'aucune réponse n'est cochée, pour que brouillonEstVide() détecte
    // correctement un formulaire encore vierge.
    choix: Object.keys(choix).length > 0 ? JSON.stringify(choix) : '',
  });

  const questionnaire = mode === 'Questionnaire';
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

    await lancer(async () => {
      try {
        const resultat = await effectuerDepistage('personne_agee', mesure, options);
        setErreurs({});
        await effacerBrouillon('personne_agee');
        router.replace({ pathname: '/resultat', params: paramsResultat('personne_agee', resultat) });
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
        {brouillonInitial ? <Text style={styles.brouillonRepris} testID="brouillon-repris">Brouillon repris automatiquement.</Text> : null}

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
    brouillonRepris: { color: couleurs.primaire, fontWeight: '600', fontSize: t.police.aide, marginBottom: t.espace.m },
  });

// Saisie manuelle Enfant : MesureEnfant(pb, pb_source, poids, taille, oedemes_bilateraux, oedemes_source).
// L'ASC choisit Oui / Non / Incertain ; l'API attend un booléen (voir services/mappings.ts).
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { BanniereErreur } from '../components/BanniereErreur';
import { BoutonPrincipal } from '../components/BoutonPrincipal';
import { ChampNumerique } from '../components/ChampNumerique';
import { ChoixUnique } from '../components/ChoixUnique';
import { effectuerDepistage, paramsResultat } from '../services/depistage';
import { type Erreurs, erreurPourFormulaire, versNombre } from '../services/formulaire';
import { oedemesVersApi } from '../services/mappings';
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
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

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
    if (oedemes === null) locales.oedemes_bilateraux = 'Choisissez Oui, Non ou Incertain.';
    if (Object.keys(locales).length > 0) {
      setErreurs(locales);
      return;
    }

    const mesure: MesureEnfant = {
      pb: pbN as number,
      pb_source: 'manuel',
      poids: poidsN as number,
      taille: tailleN as number,
      oedemes_bilateraux: oedemesVersApi(oedemes as Oedemes),
      oedemes_source: 'clinique',
    };
    const options = { personneRef: code, oedemesIncertains: oedemes === 'Incertain' };

    setEnvoiEnCours(true);
    try {
      const resultat = await effectuerDepistage('enfant', mesure, options);
      setErreurs({});
      router.push({ pathname: '/resultat', params: paramsResultat('enfant', resultat, options) });
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
          aide="Mesure au brassard, en millimètres. Exemple : 112"
        />
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
  });

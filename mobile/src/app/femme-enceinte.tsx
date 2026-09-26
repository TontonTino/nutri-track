// Saisie manuelle Femme enceinte : SuiviGrossesse(personne_id, date_cpn, hauteur_uterine, hauteur_uterine_source, pb,
// semaine_amenorrhee). Le texte de l'écart de hauteur utérine vient de l'API (« Écart observé par rapport à la
// référence — suivi rapproché recommandé ») : jamais un diagnostic.
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { BanniereErreur } from '../components/BanniereErreur';
import { BoutonPrincipal } from '../components/BoutonPrincipal';
import { ChampNumerique } from '../components/ChampNumerique';
import { effectuerDepistage, paramsResultat } from '../services/depistage';
import { useEnvoiUnique } from '../services/useEnvoiUnique';
import { dateDuJour, dateValide, type Erreurs, erreurPourFormulaire, versEntier, versNombre } from '../services/formulaire';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';
import type { SuiviGrossesse } from '../types/depistage';

const LIBELLES_CHAMPS: Record<string, string> = {
  personne_id: 'Patiente',
  date_cpn: 'Date de la CPN',
  semaine_amenorrhee: "Semaine d'aménorrhée",
  hauteur_uterine: 'Hauteur utérine',
  pb: 'Périmètre brachial',
};

export default function SaisieFemmeEnceinte() {
  const styles = useStyles(creerStyles);
  const [patiente, setPatiente] = useState('');
  const [dateCpn, setDateCpn] = useState(dateDuJour());
  const [sa, setSa] = useState('');
  const [hu, setHu] = useState('');
  const [pb, setPb] = useState('');
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const { chargement: envoiEnCours, lancer } = useEnvoiUnique();

  const saNombre = versEntier(sa);
  const horsFenetre = saNombre !== null && (saNombre < 20 || saNombre > 34);

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
    const saN = versEntier(sa);
    const huN = versNombre(hu);
    const pbN = versNombre(pb);

    const locales: Erreurs = {};
    if (patiente.trim() === '') locales.personne_id = 'Saisissez un code ou un nom pour retrouver la patiente.';
    if (!dateValide(dateCpn)) locales.date_cpn = 'Date invalide (format AAAA-MM-JJ, pas dans le futur).';
    if (saN === null) locales.semaine_amenorrhee = "Saisissez la semaine d'aménorrhée (nombre entier).";
    if (huN === null) locales.hauteur_uterine = 'Saisissez la hauteur utérine (nombre).';
    if (pbN === null) locales.pb = 'Saisissez le périmètre brachial (nombre).';
    if (Object.keys(locales).length > 0) {
      setErreurs(locales);
      return;
    }

    const mesure: SuiviGrossesse = {
      personne_id: patiente.trim(),
      date_cpn: dateCpn.trim(),
      hauteur_uterine: huN as number,
      hauteur_uterine_source: 'mètre_ruban',
      pb: pbN as number,
      semaine_amenorrhee: saN as number,
    };
    const options = { personneRef: patiente };

    await lancer(async () => {
      try {
        const resultat = await effectuerDepistage('enceinte', mesure, options);
        setErreurs({});
        router.replace({ pathname: '/resultat', params: paramsResultat('enceinte', resultat) });
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
          testID="champ-patiente"
          libelle="Patiente"
          valeur={patiente}
          onChange={modifier('personne_id', setPatiente)}
          erreur={erreurs.personne_id}
          clavier="default"
          aide="Code ou nom : sert à suivre la même patiente d'une CPN à l'autre."
        />
        <ChampNumerique
          testID="champ-date-cpn"
          libelle="Date de la consultation (CPN)"
          valeur={dateCpn}
          onChange={modifier('date_cpn', setDateCpn)}
          erreur={erreurs.date_cpn}
          clavier="numbers-and-punctuation"
          aide="Format AAAA-MM-JJ. Préremplie avec la date du jour."
        />
        <ChampNumerique
          testID="champ-sa"
          libelle="Semaine d'aménorrhée"
          unite="SA"
          valeur={sa}
          onChange={modifier('semaine_amenorrhee', setSa)}
          erreur={erreurs.semaine_amenorrhee}
          clavier="number-pad"
          aide={horsFenetre ? 'Le repère « hauteur utérine ≈ semaine d’aménorrhée » est valable entre 20 et 34 SA.' : undefined}
        />
        <ChampNumerique
          testID="champ-hu"
          libelle="Hauteur utérine"
          unite="cm"
          valeur={hu}
          onChange={modifier('hauteur_uterine', setHu)}
          erreur={erreurs.hauteur_uterine}
          aide="Mesure au mètre ruban, en centimètres. Exemple : 22"
        />
        <ChampNumerique
          testID="champ-pb"
          libelle="Périmètre brachial (PB)"
          unite="mm"
          valeur={pb}
          onChange={modifier('pb', setPb)}
          erreur={erreurs.pb}
          aide="Mesure au brassard, en millimètres. Exemple : 210"
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

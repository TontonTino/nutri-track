import { type KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';
import { couleurs } from '../constants/theme';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';

interface Props {
  libelle: string;
  unite?: string;
  valeur: string;
  onChange: (texte: string) => void;
  erreur?: string;
  aide?: string;
  clavier?: KeyboardTypeOptions;
  placeholder?: string;
  testID?: string;
}

// Champ de formulaire : l'erreur met le champ en évidence (bordure + fond rouges) sans effacer la saisie.
export function ChampNumerique({ libelle, unite, valeur, onChange, erreur, aide, clavier = 'decimal-pad', placeholder, testID }: Props) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.bloc}>
      <Text style={styles.libelle}>
        {libelle}
        {unite ? ` (${unite})` : ''}
      </Text>
      <TextInput
        testID={testID}
        style={[styles.input, erreur ? styles.inputErreur : null]}
        value={valeur}
        onChangeText={onChange}
        keyboardType={clavier}
        placeholder={placeholder}
        placeholderTextColor={couleurs.texteSecondaire}
        accessibilityLabel={libelle}
      />
      {erreur ? (
        <Text style={styles.erreur} accessibilityRole="alert">
          {erreur}
        </Text>
      ) : aide ? (
        <Text style={styles.aide}>{aide}</Text>
      ) : null}
    </View>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    bloc: { marginBottom: t.espace.l },
    libelle: { fontSize: t.police.corps, fontWeight: '600', color: couleurs.texte, marginBottom: t.espace.xs },
    input: {
      borderWidth: t.trait,
      borderColor: couleurs.bordure,
      borderRadius: t.rayon.m,
      backgroundColor: couleurs.carte,
      paddingHorizontal: t.espace.m,
      paddingVertical: t.espace.m,
      minHeight: t.cibleTactile,
      fontSize: t.police.sousTitre,
      color: couleurs.texte,
    },
    inputErreur: { borderColor: couleurs.erreur, backgroundColor: couleurs.erreurFond },
    erreur: { color: couleurs.erreur, fontSize: t.police.aide, marginTop: t.espace.xs, fontWeight: '600' },
    aide: { color: couleurs.texteSecondaire, fontSize: t.police.aide, marginTop: t.espace.xs },
  });

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { couleurs } from '../constants/theme';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';

interface Props<T extends string> {
  libelle: string;
  options: readonly T[];
  valeur: T | null;
  onChange: (valeur: T) => void;
  erreur?: string;
  vertical?: boolean;
}

export function ChoixUnique<T extends string>({ libelle, options, valeur, onChange, erreur, vertical = false }: Props<T>) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.bloc}>
      <Text style={styles.libelle}>{libelle}</Text>
      <View style={[styles.rangee, vertical && styles.colonne]}>
        {options.map((option) => {
          const actif = option === valeur;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="button"
              accessibilityLabel={option}
              accessibilityState={{ selected: actif }}
              style={[styles.option, vertical && styles.optionVerticale, actif && styles.optionActive, erreur && !actif ? styles.optionErreur : null]}
            >
              <Text style={[styles.texte, actif && styles.texteActif]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {erreur ? (
        <Text style={styles.erreur} accessibilityRole="alert">
          {erreur}
        </Text>
      ) : null}
    </View>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    bloc: { marginBottom: t.espace.l },
    libelle: { fontSize: t.police.corps, fontWeight: '600', color: couleurs.texte, marginBottom: t.espace.xs },
    rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: t.espace.s },
    colonne: { flexDirection: 'column', flexWrap: 'nowrap' },
    option: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: t.e(84),
      minHeight: t.cibleTactile,
      borderWidth: t.trait,
      borderColor: couleurs.bordure,
      borderRadius: t.rayon.m,
      backgroundColor: couleurs.carte,
      paddingVertical: t.espace.m,
      paddingHorizontal: t.espace.s,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionVerticale: { flexBasis: 'auto', flexGrow: 0, alignItems: 'flex-start', paddingHorizontal: t.espace.m },
    optionActive: { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire },
    optionErreur: { borderColor: couleurs.erreur },
    texte: { fontSize: t.police.corps, fontWeight: '600', color: couleurs.texte, textAlign: 'center' },
    texteActif: { color: '#FFFFFF' },
    erreur: { color: couleurs.erreur, fontSize: t.police.aide, marginTop: t.espace.xs, fontWeight: '600' },
  });

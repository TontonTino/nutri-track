// Guide le test de pression quand l'agent hésite sur les œdèmes bilatéraux (protocole PCIMA) : l'agent réalise le geste
// puis répond Oui ou Non. Tant qu'il n'a pas tranché, le formulaire ne peut pas être validé.
import { StyleSheet, Text, View } from 'react-native';
import { couleurs } from '../constants/theme';
import { ETAPES_TEST_PRESSION } from '../services/testPression';
import { carteDouce } from '../theme/carte';
import type { Echelle } from '../theme/echelle';
import { useStyles } from '../theme/useEchelle';
import { BoutonPrincipal } from './BoutonPrincipal';


interface Props {
  onResultat: (reponse: 'Oui' | 'Non') => void;
}

export function AideTestPression({ onResultat }: Props) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.carte} testID="aide-test-pression">
      <Text style={styles.titre}>Faites le test de pression</Text>
      {ETAPES_TEST_PRESSION.map((etape, i) => (
        <View key={etape} style={styles.etape}>
          <View style={styles.numero}>
            <Text style={styles.numeroTexte}>{i + 1}</Text>
          </View>
          <Text style={styles.etapeTexte}>{etape}</Text>
        </View>
      ))}
      <Text style={styles.question}>Résultat du test ?</Text>
      <BoutonPrincipal titre="Creux visible sur les deux pieds : Oui" secondaire onPress={() => onResultat('Oui')} testID="test-pression-oui" />
      <BoutonPrincipal titre="Pas de creux, ou un seul pied : Non" secondaire onPress={() => onResultat('Non')} testID="test-pression-non" />
    </View>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    carte: { ...carteDouce(t), padding: t.espace.xl, gap: t.espace.m, marginBottom: t.espace.l, borderLeftWidth: t.e(5), borderLeftColor: '#E08600' },
    titre: { fontSize: t.police.sousTitre, fontWeight: '800', color: couleurs.texte },
    etape: { flexDirection: 'row', alignItems: 'flex-start', gap: t.espace.m },
    numero: { width: t.e(26), height: t.e(26), borderRadius: t.e(13), backgroundColor: '#FFF3E2', alignItems: 'center', justifyContent: 'center' },
    numeroTexte: { fontSize: t.police.aide, fontWeight: '800', color: '#6B3A00' },
    etapeTexte: { flex: 1, fontSize: t.police.corps, color: couleurs.texte, lineHeight: t.police.corps * 1.4 },
    question: { fontSize: t.police.corps, fontWeight: '700', color: couleurs.texteSecondaire, marginTop: t.espace.s },
  });

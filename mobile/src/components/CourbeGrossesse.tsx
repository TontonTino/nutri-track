// Courbe de suivi de grossesse : hauteur utérine mesurée dans le temps, comparée à la référence
// (hauteur utérine attendue en cm ≈ semaine d'aménorrhée). Dessinée en SVG, sans dépendance de graphiques.
// Toutes les dimensions (hauteur, marges, traits, polices) dépendent de la taille réelle de l'écran.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { couleurs } from '../constants/theme';
import { borner, type Echelle } from '../theme/echelle';
import { useEchelle, useStyles } from '../theme/useEchelle';

export interface PointCourbe {
  date: string; // AAAA-MM-JJ
  mesuree: number; // hauteur utérine mesurée (cm)
  attendue: number; // référence (cm)
}

const COULEUR_MESURE = couleurs.primaire;
const COULEUR_REF = '#8A97A0';

function formatCourt(date: string): string {
  const [, m, j] = date.split('-');
  return m && j ? `${j}/${m}` : date;
}

export function CourbeGrossesse({ points }: { points: PointCourbe[] }) {
  const t = useEchelle();
  const styles = useStyles(creerStyles);
  const [largeur, setLargeur] = useState(0);

  // La courbe occupe une part de la hauteur de l'écran, bornée pour rester lisible en portrait comme en paysage.
  const hauteurTotale = borner(t.hauteur * 0.3, t.e(150), t.e(320));
  const marge = { haut: t.e(16), bas: t.e(34), gauche: t.e(40), droite: t.e(16) };
  const hauteurUtile = hauteurTotale - marge.haut - marge.bas;
  const largeurUtile = Math.max(largeur - marge.gauche - marge.droite, 1);

  const valeurs = points.flatMap((p) => [p.mesuree, p.attendue]);
  const min = Math.floor(Math.min(...valeurs) - 2);
  const max = Math.ceil(Math.max(...valeurs) + 2);

  const x = (i: number) => marge.gauche + (points.length === 1 ? largeurUtile / 2 : (i / (points.length - 1)) * largeurUtile);
  const y = (v: number) => marge.haut + (1 - (v - min) / (max - min)) * hauteurUtile;
  const ligne = (cle: 'mesuree' | 'attendue') => points.map((p, i) => `${x(i)},${y(p[cle])}`).join(' ');

  return (
    <View onLayout={(e) => setLargeur(e.nativeEvent.layout.width)} testID="courbe-grossesse">
      {largeur > 0 ? (
        <Svg width={largeur} height={hauteurTotale} accessibilityLabel="Courbe de la hauteur utérine dans le temps">
          {[min, (min + max) / 2, max].map((v) => (
            <Line key={v} x1={marge.gauche} x2={largeur - marge.droite} y1={y(v)} y2={y(v)} stroke={couleurs.bordure} strokeWidth={t.trait / 2} />
          ))}
          {[min, max].map((v) => (
            <SvgText key={`t${v}`} x={marge.gauche - t.espace.xs} y={y(v) + t.police.petit / 3} fontSize={t.police.petit} fill={couleurs.texteSecondaire} textAnchor="end">
              {v}
            </SvgText>
          ))}
          <Polyline points={ligne('attendue')} fill="none" stroke={COULEUR_REF} strokeWidth={t.trait} strokeDasharray={`${t.e(6)} ${t.e(4)}`} />
          <Polyline points={ligne('mesuree')} fill="none" stroke={COULEUR_MESURE} strokeWidth={t.trait * 1.5} />
          {points.map((p, i) => (
            <Circle key={`${p.date}-${i}`} cx={x(i)} cy={y(p.mesuree)} r={t.e(5)} fill={COULEUR_MESURE} />
          ))}
          {points.map((p, i) => (
            <SvgText key={`d${p.date}-${i}`} x={x(i)} y={hauteurTotale - t.espace.m} fontSize={t.police.petit} fill={couleurs.texteSecondaire} textAnchor="middle">
              {formatCourt(p.date)}
            </SvgText>
          ))}
        </Svg>
      ) : null}
      <View style={styles.legende}>
        <Text style={[styles.legendeTexte, { color: COULEUR_MESURE }]}>● Hauteur utérine mesurée (cm)</Text>
        <Text style={[styles.legendeTexte, { color: COULEUR_REF }]}>- - Référence attendue (cm)</Text>
      </View>
    </View>
  );
}

const creerStyles = (t: Echelle) =>
  StyleSheet.create({
    legende: { flexDirection: 'row', flexWrap: 'wrap', gap: t.espace.m, marginTop: t.espace.xs },
    legendeTexte: { fontSize: t.police.aide, fontWeight: '600' },
  });

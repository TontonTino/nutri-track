# Valider la mesure du PB par la caméra

La caméra est la seule méthode de mesure du PB dans l'app. Elle n'a **jamais été comparée à un ruban** : ce document explique comment mesurer son erreur réelle, puis quoi en faire.

## Pourquoi c'est nécessaire

Les seuils d'orientation sont serrés (sévère < 115 mm, modéré < 125 mm). Une erreur de 10 mm suffit à ranger un enfant dans la mauvaise catégorie. L'erreur la plus grave est de **classer moins gravement** un enfant qui l'est davantage. Par ailleurs, l'app déduit le PB de la largeur vue de profil (PB ≈ π × largeur) : un bras n'est pas un cylindre parfait, donc un biais systématique est probable.

## Protocole (20 mesures minimum, 30 ou plus si possible)

Pour chaque bras :

1. Mesurer au **ruban PB**, à 1 mm près, et noter la valeur **avant** de toucher au téléphone.
2. Photographier avec l'app (Enfant → « Mesurer le bras avec la caméra »), placer la carte, « Calculer le PB ».
3. Sur l'écran de confirmation, **saisir la valeur du ruban** (« Corriger »), sauf si la caméra donne exactement la même valeur. Ne jamais confirmer « pour aller vite » : une confirmation donne un écart nul et fausse les statistiques.
4. Varier les conditions : lumière franche et faible, fonds clairs et sombres, tons de peau différents, bras plus ou moins fins. Inclure des valeurs proches de 115 et de 125 mm, qui sont celles qui comptent.

Avec l'accord du parent ou du tuteur pour un enfant. La photo est effacée du téléphone après l'analyse.

L'app doit tourner en mode réel (`EXPO_PUBLIC_USE_MOCK=false`), sinon rien n'arrive au serveur.

## Lire les résultats

`GET https://nutri-track-4j3t.onrender.com/statistiques/vision`

| Champ | À regarder |
|---|---|
| `ecart_absolu_moyen_mm` | Erreur typique de la caméra. |
| `biais_moyen_mm` | Positif : la caméra sous-estime le PB. Un biais stable se corrige par un facteur. |
| `part_dans_5_mm`, `part_dans_10_mm` | Part des mesures suffisamment justes. |
| `n_estimation_moins_grave_que_retenu` | Enfants que la caméra aurait classés moins gravement. **Doit rester à 0 ou presque.** |
| `par_methode` | Compare `pixels_zone_pose` (détection du bras) et `pixels_zone_fixe` (zone de guidage). Dit si la détection de pose sert à quelque chose. |

## Quoi faire des chiffres

- Fixer `MARGE_INCERTITUDE_VISION_MM` (`mobile/src/vision/mesureAssistee.ts`, provisoire à 10 mm) à l'écart sous lequel tombent au moins 90 % des mesures.
- Si cette marge dépasse environ 15 mm, la caméra ne sait pas distinguer les catégories : la présenter comme une aide au repérage, pas comme une mesure.
- Si `pixels_zone_pose` n'améliore rien, retirer la détection de pose (moins de code, pas de téléchargement du modèle).
- Décider avec un référent clinique si le classement d'une mesure par caméra doit être plus prudent que celui d'une mesure au ruban. Ce n'est pas encore le cas : le serveur classe les deux de la même façon.

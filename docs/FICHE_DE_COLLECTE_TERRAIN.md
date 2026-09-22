# NUTRI-TRACK — Guide & Fiche de Collecte de Données Terrain
**Projet :** IDEAthon Digital Impact Challenge 2026  
**Établissement :** ISGE-BF  
**Équipe :** KABA Fanta, KIEMDE Alya, KABRE Rasmata, NITIEMA Lionel  
**Cadre :** Enquête auprès des structures sanitaires de référence (CHU Bogodogo, CHUP Charles de Gaulle, CMA Saaba, CMA Boulmiougou)

---

## 📋 Protocole de Visite & Éthique
1. **Présentation :** Remettre la lettre officielle signée par la Direction Générale de l'ISGE-BF.
2. **Confidentialité absolue :** Préciser immédiatement qu'**aucune donnée nominative ou médicale individuelle d'enfants n'est demandée**. Seules des données **agrégées, logistiques et opérationnelles** sur les intrants nutritionnels (ATPE / RUTF / Plumpy'Nut) sont collectées.
3. **Interlocuteurs cibles :** 
   - Le Médecin-Chef de District (MCD) ou son adjoint
   - Le Pharmacien / Gestionnaire du Dépôt Répartiteur du District
   - Le Responsable de l'Unité Nutritionnelle (CREN / CRENI / CRENAS)

---

# PARTIE A : FICHE DE COLLECTE DES DONNÉES LOGISTIQUES (Remplissage)

### 1. Identification de la Structure
- **Nom de la structure visitée :** __________________________________________________
- **Type de structure :** [ ] CHU / CHUP  [ ] CMA / District  [ ] CSPS
- **Nom et fonction de l'interlocuteur :** ____________________________________________
- **Date de l'entretien :** _____ / _____ / 2026

---

### 2. Gestion des Intrants Nutritionnels (RUTF / ATPE / Plumpy'Nut)
- **Unité de gestion usuelle :** 
  [ ] Cartons (combien de sachets par carton ? : ________ )  
  [ ] Sachets individuels
- **Stock physique actuel :** ________ cartons (soit ________ sachets)
- **Stock de sécurité officiel configuré :** ________ jours de consommation (ou ________ cartons)
- **Règles de réserve :** Existe-t-il une quantité réservée pour les enfants déjà admis en traitement ? 
  [ ] Oui  [ ] Non  
  *Si oui, comment est-elle estimée ?* __________________________________________________

---

### 3. Flux & Consommations (Reconstitution sur les 3 à 6 derniers mois)
*Remplir si possible pour les mois récents (ou moyenne mensuelle) :*

| Mois / Période | Stock Initial (cartons) | Entrées / Livraisons reçues (cartons) | Sorties / Distributions réalisées (cartons) | Stock Final en rayon (cartons) | Nombre d'enfants en file active |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mois M-3** | | | | | |
| **Mois M-2** | | | | | |
| **Mois M-1** | | | | | |
| **Mois en cours**| | | | | | |

- **Consommation moyenne observée :** ________ sachets/jour ou ________ cartons/semaine
- **Dotation moyenne par enfant :** ________ sachets par jour pendant ________ semaines

---

### 4. Historique des Tensions et Ruptures de Stock
- **Nombre d'épisodes de rupture au cours des 12 derniers mois :** ________ fois
- **Durée moyenne d'une rupture :** ________ jours
- **Délai moyen entre la commande et la livraison officielle (Lead Time) :** ________ jours / semaines
- **Quelles sont les causes principales ?**  
  [ ] Rupture au niveau central (dépôt national / CAMEG)  
  [ ] Retard de transport / logistique  
  [ ] Flambée soudaine d'admissions (afflux de déplacés, pic saisonnier)  
  [ ] Retard dans la remontée des rapports de consommation

---

### 5. Pratique Réelle du Rééquilibrage Inter-Centres (Dépannages Locaux)
- **Avez-vous déjà effectué un transfert de dépannage vers/depuis un autre centre ?** [ ] Oui  [ ] Non
- **Si OUI, sur quelle base ?**
  - Qui prend l'initiative de la demande ? ____________________________________________
  - Qui donne l'accord final obligatoire ? _____________________________________________
  - Quel moyen de communication est utilisé ? [ ] Téléphone [ ] WhatsApp [ ] Ordre écrit [ ] Déplacement
  - Quel est le délai moyen pour concrétiser le transfert ? ________ heures / jours
  - Moyen de transport utilisé : [ ] Moto du centre [ ] Véhicule de supervision [ ] Ambulance [ ] Autre : ________
  - Rayon kilométrique d'intervention habituel : ________ km max

---

# PARTIE B : GUIDE D'ENTRETIEN QUALITATIF (Questions ouvertes)

### Questions pour le Médecin-Chef de District (MCD) :
1. *« Lorsqu'un CSPS périphérique vous signale qu'il n'a plus que quelques jours de Plumpy'Nut, quel est votre premier réflexe opérationnel ? »*
2. *« Qu'est-ce qui vous freine le plus aujourd'hui pour demander à un CSPS voisin de dépanner : la peur de le mettre en difficulté, le manque de visibilité sur son stock exact, ou la lenteur de la procédure ? »*
3. *« Si une application sur votre téléphone vous proposait une recommandation calculée disant : 'Le centre A peut donner 5 cartons au centre B sans se fragiliser', avec un bouton Valider/Refuser, l'utiliseriez-vous ? Quels critères supplémentaires vérifieriez-vous ? »*

### Questions pour le Pharmacien / Gestionnaire d'Intrants :
1. *« Quels outils utilisez-vous actuellement pour suivre les stocks (registres papier, fiches de stock, DHIS2, logiciel local) ? À quelle fréquence sont-ils mis à jour ? »*
2. *« À partir de quel seuil considérez-vous qu'un centre est en situation d'alerte orange (tension) et en alerte rouge (risque imminent) ? »*
3. *« Comment calculez-vous la part de stock non mobilisable (stock de sécurité + traitement en cours des enfants) ? »*

### Questions pour le Responsable Nutrition (CREN / CRENI) :
1. *« Que se passe-t-il concrètement pour un enfant sévèrement malnutri en cas de rupture de stock de 3 jours ? Est-il réorienté, ou le traitement est-il fractionné ? »*
2. *« Quelle est la saisonnalité de la malnutrition dans votre zone (période de soudure, pic de cas) ? »*

---

## 🎯 Ce que l'équipe doit en tirer au retour
À l'issue de la visite, vous devez être capables de renseigner :
1. Les **seuils réels de sécurité** (en jours ou en cartons) pour alimenter les constantes de `backend/core/decision_engine.py`.
2. Le **délai de réaction actuel** (ex: *"Aujourd'hui, il faut 72h pour organiser un dépannage manuel"* vs *"NUTRI-TRACK permet une proposition en 1 minute et une validation en un clic"*).
3. Une **série de données réelles anonymisées sur 3 mois** pour faire tourner le simulateur avec des chiffres authentiques du Burkina Faso pendant le pitch !

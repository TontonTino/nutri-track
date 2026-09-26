# Business Model Canvas — NUTRI-DÉPIST

*Modèle B2B/B2G par licence de district sanitaire. Brouillon de travail (Rasmata),
à challenger avec l'équipe — notamment la tarification, purement indicative.*

| Bloc | Contenu |
|---|---|
| **Segments de clientèle** | 1) Districts sanitaires / Directions Régionales de la Santé (acheteur institutionnel principal, B2G) — 2) ONG opérant des programmes nutrition (ALIMA, Croix-Rouge, Helen Keller Intl…) qui gèrent leurs propres équipes d'ASC (B2B) — 3) Bailleurs/fondations finançant un district pilote pour le compte du MSHP (B2G indirect) |
| **Proposition de valeur** | Dépistage nutritionnel fiable, standardisé (protocole PCIMA), **utilisable sans réseau** par les ASC en zone rurale, avec remontée automatique et alertes en temps quasi-réel dès que la connexion revient. Réduit les pertes de données papier, accélère l'orientation des cas sévères, donne au district un tableau de bord agrégé (`/stats`, `/alertes`) pour piloter ses stocks d'intrants et ses tournées. La vision par ordinateur assiste la mesure sans jamais remplacer la validation de l'agent (principe directeur du projet) — argument de confiance clé face à des utilisateurs qui doivent rester légalement responsables du diagnostic. |
| **Canaux** | Démonstration directe aux Directions Régionales de la Santé et aux coordinations ONG ; relais via la Direction de la Nutrition du MSHP (validation institutionnelle = accélérateur d'adoption) ; présence lors d'événements nutrition/santé numérique (SUN Movement, forums UNICEF/PAM) ; bouche-à-oreille terrain via les superviseurs d'ASC déjà formés. |
| **Relation client** | Déploiement accompagné (formation des ASC + des superviseurs de centre), support à distance pendant la phase pilote, comité de suivi trimestriel avec le district (revue des seuils, des taux d'orientation, des anomalies de sync). Pas de self-service pur au démarrage : la confiance clinique se construit par l'accompagnement. |
| **Sources de revenus** | Licence annuelle **par district sanitaire** (nombre de CSPS/ASC couverts), avec palier réduit pour les ONG déployant sur plusieurs districts. Option "pack déploiement" ponctuel (formation initiale + configuration des seuils locaux) facturée à part. Financement possible en année 1 par un bailleur (UNICEF, fondation) plutôt que directement par le district, le temps de démontrer l'impact. |
| **Ressources clés** | Le moteur de classification conforme PCIMA (propriété intellectuelle cœur du produit) ; la couche hors-ligne/synchronisation (différenciateur terrain) ; la relation de confiance avec la Direction de la Nutrition pour la validation des seuils ; l'équipe technique pour le support pendant la phase pilote. |
| **Activités clés** | Maintenance et mise à jour du protocole de classification quand les seuils nationaux évoluent ; support terrain et formation ; collecte de retours d'ASC pour améliorer l'ergonomie hors-ligne ; production de rapports agrégés pour les districts et bailleurs. |
| **Partenaires clés** | Direction de la Nutrition — MSHP (légitimité protocolaire) ; ONG opérationnelles comme premiers pilotes (cycle de décision plus court qu'un marché public) ; UNICEF / PAM comme financeurs potentiels de la phase pilote ; Groupe Nutriset comme partenaire produit (lien dépistage → intrants thérapeutiques) ; opérateurs télécom locaux pour d'éventuels partenariats data à coût réduit pour les ASC. |
| **Structure de coûts** | Développement et maintenance logicielle ; hébergement du backend central (PostgreSQL) ; formation et support terrain (le poste le plus lourd en Afrique de l'Ouest rurale) ; connectivité/équipement si l'app est fournie avec du matériel ; coûts de conformité/validation clinique du protocole. |

## Pourquoi B2B/B2G et pas B2C

Les utilisateurs finaux (ASC) ne paient jamais directement — ils sont salariés ou
bénévoles d'une structure (district sanitaire ou ONG). Le modèle de licence
institutionnelle colle donc à la réalité du secteur : c'est le district ou l'ONG qui
budgétise, pas l'agent de terrain. C'est aussi le modèle déjà utilisé par des
dispositifs numériques santé comparables déployés au Sahel.

## Prochaine étape suggérée

Valider avec l'équipe (notamment Alya côté coûts d'hébergement backend réels) avant
de figer un montant de licence dans le rapport final — les chiffres ci-dessus sont
volontairement qualitatifs plutôt que chiffrés, faute de données de coût fiables à ce
stade du hackathon.

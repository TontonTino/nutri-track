"""
Script de données de démonstration pour NUTRI-DÉPIST.
Génère un jeu de données réalistes (dépistages enfants, femmes enceintes, personnes âgées).
Exécution: python seed_demo_data.py
"""

from app.database import SessionLocal, Base, engine
from app import models, pipeline

Base.metadata.create_all(bind=engine)
db = SessionLocal()

from app.main import seed_default_seuils
seed_default_seuils(db)

seuils_dict = {s.type_mesure: s.valeur_seuil for s in db.query(models.Seuils).all()}

demo_data = [
    # Enfants
    {
        "population": "enfant",
        "mesures": {"pb": 112.0, "pb_source": "vision_ai", "oedemes_bilateraux": False},
        "agent_id": "AGENT_COMMUNAUTAIRE_01",
        "centre_id": "CENTRE_SANTE_CENTRAL",
        "mode_saisie": "ocr_photo"
    },
    {
        "population": "enfant",
        "mesures": {"pb": 120.0, "pb_source": "ruban_muac", "oedemes_bilateraux": False},
        "agent_id": "AGENT_COMMUNAUTAIRE_01",
        "centre_id": "CENTRE_SANTE_CENTRAL",
        "mode_saisie": "manuel"
    },
    {
        "population": "enfant",
        "mesures": {"pb": 135.0, "pb_source": "ruban_muac", "oedemes_bilateraux": False},
        "agent_id": "AGENT_COMMUNAUTAIRE_02",
        "centre_id": "DISPENSAIRE_NORD",
        "mode_saisie": "manuel"
    },
    # Personnes âgées
    {
        "population": "personne_agee",
        "mesures": {"score_mna_sf": 6, "perte_poids_recente": True},
        "agent_id": "AGENT_COMMUNAUTAIRE_02",
        "centre_id": "DISPENSAIRE_NORD",
        "mode_saisie": "manuel"
    },
    {
        "population": "personne_agee",
        "mesures": {"score_mna_sf": 12, "perte_poids_recente": False},
        "agent_id": "AGENT_COMMUNAUTAIRE_03",
        "centre_id": "CENTRE_SANTE_CENTRAL",
        "mode_saisie": "manuel"
    },
    # Femmes enceintes
    {
        "population": "enceinte",
        "mesures": {"personne_id": "FEMME_8842", "hauteur_uterine": 22.0, "semaine_amenorrhee": 28, "hauteur_uterine_source": "mètre_ruban"},
        "agent_id": "SAGE_FEMME_01",
        "centre_id": "CENTRE_CPN_01",
        "mode_saisie": "mètre_ruban"
    },
    {
        "population": "enceinte",
        "mesures": {"personne_id": "FEMME_8842", "hauteur_uterine": 27.5, "semaine_amenorrhee": 28, "hauteur_uterine_source": "mètre_ruban"},
        "agent_id": "SAGE_FEMME_01",
        "centre_id": "CENTRE_CPN_01",
        "mode_saisie": "mètre_ruban"
    }
]

print("[INFO] Injection des donnees de demo dans nutri_depist.db...")

for item in demo_data:
    p_res = pipeline.run_pipeline(item["population"], item["mesures"], seuils_dict)
    dep = models.Depistage(
        population=item["population"],
        mesures=item["mesures"],
        agent_id=item["agent_id"],
        centre_id=item["centre_id"],
        classification=p_res["classification"],
        orientation_declenchee=p_res["orientation_declenchee"],
        mode_saisie=item["mode_saisie"]
    )
    db.add(dep)

db.commit()
print("[OK] 7 depistages de demo injectes avec succes.")
db.close()

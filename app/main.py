from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.database import Base, engine, get_db
from app import models, schemas, pipeline

# Initialiser les tables SQLite/PostgreSQL au démarrage
Base.metadata.create_all(bind=engine)


def seed_default_seuils(db: Session):
    """Initialise la table Seuils si elle est vide (Aucun seuil codé en dur hors DB)."""
    defaults = [
        {"population": "enfant", "type_mesure": "pb_severe", "valeur_seuil": 115.0, "version_protocole": "OMS 2024"},
        {"population": "enfant", "type_mesure": "pb_modere", "valeur_seuil": 125.0, "version_protocole": "OMS 2024"},
        {"population": "personne_agee", "type_mesure": "score_mna_sf_denutrition", "valeur_seuil": 7.0, "version_protocole": "MNA-SF Standard"},
        {"population": "enceinte", "type_mesure": "ecart_hu_max", "valeur_seuil": 3.0, "version_protocole": "CPN OMS 2024"},
    ]
    
    count = db.query(models.Seuils).count()
    if count == 0:
        for item in defaults:
            seuil = models.Seuils(
                population=item["population"],
                type_mesure=item["type_mesure"],
                valeur_seuil=item["valeur_seuil"],
                version_protocole=item["version_protocole"],
                date_application=datetime.now(timezone.utc)
            )
            db.add(seuil)
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = next(get_db())
    seed_default_seuils(db)
    yield


app = FastAPI(
    title="NUTRI-DÉPIST API",
    description="Backend & Moteur de classification pour le dépistage nutritionnel communautaire",
    version="1.0.0",
    lifespan=lifespan
)

# CORS pour intégration Mobile & Vision AI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_seuils_dict(db: Session) -> dict:
    """Charge les seuils dynamiques depuis la base de données."""
    seuils = db.query(models.Seuils).all()
    res = {}
    for s in seuils:
        res[s.type_mesure] = s.valeur_seuil
    return res


# --- ENDPOINTS PRINCIPAUX ---

@app.post("/depistage", response_model=schemas.DepistageResponse, status_code=status.HTTP_201_CREATED)
def créer_depistage(payload: schemas.DepistageCreate, db: Session = Depends(get_db)):
    """
    Crée un nouveau dépistage.
    1. Charge les seuils depuis la table de configuration 'seuils'
    2. Exécute le pipeline 4 étapes (Validation, Interprétation, Classification, Orientation)
    3. Enregistre dans Depistage et la table fille spécifique (MesureEnfant, SuiviGrossesse, MesurePersonneAgee)
    """
    seuils_dict = get_current_seuils_dict(db)

    try:
        pipeline_res = pipeline.run_pipeline(
            population=payload.population,
            mesures=payload.mesures,
            seuils=seuils_dict
        )
    except pipeline.OutOfRangeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erreur de mesure: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    classification = pipeline_res["classification"]
    orientation_declenchee = pipeline_res["orientation_declenchee"]

    # Création du dépistage principal
    depistage = models.Depistage(
        population=payload.population,
        mesures=payload.mesures,
        date=datetime.now(timezone.utc),
        agent_id=payload.agent_id,
        centre_id=payload.centre_id,
        classification=classification,
        orientation_declenchee=orientation_declenchee,
        mode_saisie=payload.mode_saisie
    )
    db.add(depistage)
    db.flush()  # Récupère depistage.id

    # Enregistrement dans les tables de détails spécifiques (selon la population)
    if payload.population == "enfant":
        m = payload.mesures
        mesure_enfant = models.MesureEnfant(
            depistage_id=depistage.id,
            pb=m.get("pb"),
            pb_source=m.get("pb_source", "manuel"),
            poids=m.get("poids"),
            taille=m.get("taille"),
            oedemes_bilateraux=m.get("oedemes_bilateraux", False),
            oedemes_source=m.get("oedemes_source", "clinique")
        )
        db.add(mesure_enfant)

    elif payload.population == "personne_agee":
        m = payload.mesures
        mesure_pa = models.MesurePersonneAgee(
            depistage_id=depistage.id,
            perimetre_mollet=m.get("perimetre_mollet"),
            pb_optionnel=m.get("pb_optionnel"),
            perte_poids_recente=m.get("perte_poids_recente"),
            score_mna_sf=m.get("score_mna_sf")
        )
        db.add(mesure_pa)

    elif payload.population == "enceinte":
        m = payload.mesures
        interp = pipeline_res["interpretation"]
        suivi = models.SuiviGrossesse(
            personne_id=m.get("personne_id", "UNKNOWN"),
            date_cpn=datetime.now(timezone.utc),
            hauteur_uterine=m.get("hauteur_uterine"),
            hauteur_uterine_source=m.get("hauteur_uterine_source", "mètre_ruban"),
            pb=m.get("pb"),
            semaine_amenorrhee=m.get("semaine_amenorrhee"),
            hauteur_uterine_attendue=interp.get("hauteur_uterine_attendue", 0.0),
            ecart_croissance_foetale=interp.get("ecart_croissance_foetale", 0.0)
        )
        db.add(suivi)

    db.commit()
    db.refresh(depistage)

    response_data = {
        "id": depistage.id,
        "population": depistage.population,
        "mesures": depistage.mesures,
        "date": depistage.date,
        "agent_id": depistage.agent_id,
        "centre_id": depistage.centre_id,
        "classification": depistage.classification,
        "orientation_declenchee": depistage.orientation_declenchee,
        "mode_saisie": depistage.mode_saisie,
        "message": pipeline_res["classification_detail"].get("message"),
        "recommandation": pipeline_res["orientation"].get("recommandation")
    }

    return response_data


@app.get("/depistage/{id}", response_model=schemas.DepistageResponse)
def obtenir_depistage(id: int, db: Session = Depends(get_db)):
    """Récupère un dépistage par son ID."""
    depistage = db.query(models.Depistage).filter(models.Depistage.id == id).first()
    if not depistage:
        raise HTTPException(status_code=404, detail="Dépistage introuvable")

    return depistage


@app.get("/alertes", response_model=List[schemas.DepistageResponse])
def obtenir_alertes(db: Session = Depends(get_db)):
    """Liste tous les dépistages graves/critiques en attente d'orientation."""
    alertes = db.query(models.Depistage).filter(
        models.Depistage.orientation_declenchee == True
    ).order_by(models.Depistage.date.desc()).all()
    return alertes


@app.get("/seuils", response_model=List[schemas.SeuilResponse])
def obtenir_seuils(db: Session = Depends(get_db)):
    """Liste tous les seuils de configuration actifs."""
    seuils = db.query(models.Seuils).all()
    return seuils


class UpdateSeuilPayload(BaseModel):
    population: str
    type_mesure: str
    nouvelle_valeur: float
    agent_id: str
    version_protocole: Optional[str] = "Mis à jour"


@app.put("/seuils", response_model=schemas.SeuilResponse)
def mettre_a_jour_seuil(payload: UpdateSeuilPayload, db: Session = Depends(get_db)):
    """
    Met à jour la valeur d'un seuil dans la table de configuration et journalise la modification
    dans JournalValidationSeuils.
    """
    seuil = db.query(models.Seuils).filter(
        models.Seuils.population == payload.population,
        models.Seuils.type_mesure == payload.type_mesure
    ).first()

    if not seuil:
        raise HTTPException(
            status_code=404,
            detail=f"Seuil non trouvé pour population '{payload.population}' et type_mesure '{payload.type_mesure}'"
        )

    ancienne_valeur = seuil.valeur_seuil
    seuil.valeur_seuil = payload.nouvelle_valeur
    if payload.version_protocole:
        seuil.version_protocole = payload.version_protocole
    seuil.date_application = datetime.now(timezone.utc)

    # Log in JournalValidationSeuils
    journal = models.JournalValidationSeuils(
        seuil_id=seuil.id,
        ancienne_valeur=ancienne_valeur,
        nouvelle_valeur=payload.nouvelle_valeur,
        agent_id=payload.agent_id,
        date=datetime.now(timezone.utc)
    )
    db.add(journal)
    db.commit()
    db.refresh(seuil)

    return seuil


# --- ENDPOINTS COMPLÉMENTAIRES (SUIVI & STATISTIQUES DASHBOARD) ---

@app.get("/suivi-grossesse/{personne_id}", response_model=List[schemas.SuiviGrossesseResponse])
def obtenir_suivi_grossesse(personne_id: str, db: Session = Depends(get_db)):
    """
    Récupère l'historique des consultations CPN / suivi de grossesse pour une femme donnée.
    Permet de suivre la courbe d'évolution de la hauteur utérine au fil des semaines d'aménorrhée.
    """
    suivis = db.query(models.SuiviGrossesse).filter(
        models.SuiviGrossesse.personne_id == personne_id
    ).order_by(models.SuiviGrossesse.semaine_amenorrhee.asc()).all()
    return suivis


@app.get("/stats", response_model=schemas.StatsResponse)
def obtenir_statistiques(db: Session = Depends(get_db)):
    """
    Fournit un résumé statistique agrégé pour alimenter les tableaux de bord et métriques globales du hackathon.
    """
    total_depistages = db.query(models.Depistage).count()
    total_alertes = db.query(models.Depistage).filter(models.Depistage.orientation_declenchee == True).count()

    # Par population
    pop_counts = db.query(models.Depistage.population, func.count(models.Depistage.id)).group_by(models.Depistage.population).all()
    par_population = {pop: count for pop, count in pop_counts}

    # Par classification
    classif_counts = db.query(models.Depistage.classification, func.count(models.Depistage.id)).group_by(models.Depistage.classification).all()
    par_classification = {cl: count for cl, count in classif_counts}

    return {
        "total_depistages": total_depistages,
        "total_alertes": total_alertes,
        "par_population": par_population,
        "par_classification": par_classification
    }

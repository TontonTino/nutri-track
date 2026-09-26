import csv
import io
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Response, Request
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from pydantic import BaseModel

from app.database import Base, engine, get_db
from app import models, schemas, pipeline

# Horodatage du démarrage du serveur pour le calcul d'uptime
START_TIME = time.time()

# Cache mémoire pour les seuils
_SEUILS_CACHE: Optional[Dict[str, float]] = None

# Initialiser les tables SQLite/PostgreSQL au démarrage
Base.metadata.create_all(bind=engine)


def seed_default_seuils(db: Session):
    """Initialise la table Seuils selon le Protocole National PCIMA Burkina Faso 2014."""
    defaults = [
        {"population": "enfant", "type_mesure": "pb_severe", "valeur_seuil": 115.0, "version_protocole": "PCIMA Burkina Faso 2014"},
        {"population": "enfant", "type_mesure": "pb_modere", "valeur_seuil": 125.0, "version_protocole": "PCIMA Burkina Faso 2014"},
        {"population": "personne_agee", "type_mesure": "score_mna_sf_denutrition", "valeur_seuil": 7.0, "version_protocole": "MNA-SF Standard"},
        {"population": "personne_agee", "type_mesure": "pb_severe_adulte", "valeur_seuil": 180.0, "version_protocole": "PCIMA Burkina Faso 2014"},
        {"population": "enceinte", "type_mesure": "pb_enceinte_seuil", "valeur_seuil": 230.0, "version_protocole": "PCIMA Burkina Faso 2014"},
        {"population": "enceinte", "type_mesure": "ecart_hu_max", "valeur_seuil": 3.0, "version_protocole": "CPN PCIMA 2014"},
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
    description="Backend & Moteur de classification haute performance (Conforme PCIMA Burkina Faso 2014 & OMS)",
    version="1.3.0",
    lifespan=lifespan
)

# 1. CORS pour intégration Mobile & Vision AI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Compression GZip pour accélérer les réseaux mobiles 2G/3G lents
app.add_middleware(GZipMiddleware, minimum_size=500)

# 3. Middleware de mesure du temps d'exécution (Performance Latency Tracker)
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = round((time.time() - start_time) * 1000, 2)  # temps en millisecondes
    response.headers["X-Process-Time-ms"] = str(process_time)
    return response


def get_current_seuils_dict(db: Session, force_refresh: bool = False) -> dict:
    """Charge et met en cache les seuils dynamiques depuis la base de données (Sub-millisecond lookup)."""
    global _SEUILS_CACHE
    if _SEUILS_CACHE is None or force_refresh:
        seuils = db.query(models.Seuils).all()
        _SEUILS_CACHE = {s.type_mesure: s.valeur_seuil for s in seuils}
    return _SEUILS_CACHE


# --- ENDPOINTS SYSTÈME & HEALTH CHECK ---

@app.get("/health", tags=["Système"])
def health_check(db: Session = Depends(get_db)):
    """
    Endpoint de diagnostic système : vérifie l'état de la base de données, 
    l'uptime du serveur, et la version du protocole actif.
    """
    uptime_seconds = round(time.time() - START_TIME, 2)
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    total_depistages = db.query(models.Depistage).count()

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "uptime_seconds": uptime_seconds,
        "protocol": "PCIMA Burkina Faso 2014 / OMS 2006",
        "engine_version": "1.3.0-optimized-production",
        "total_depistages_enregistres": total_depistages,
        "timestamp": datetime.now(timezone.utc)
    }


# --- ENDPOINTS CAPTURE VISION AI (LIONEL & RASMATA) ---

@app.post("/capture-vision", response_model=schemas.CaptureVisionResponse, status_code=status.HTTP_201_CREATED, tags=["Vision AI (Lionel & Rasmata)"])
def enregistrer_capture_vision(payload: schemas.CaptureVisionCreate, db: Session = Depends(get_db)):
    """
    Reçoit la mesure estimée par le module Vision AI (heuristique MVP / caméra).
    Prépare la capture en attente de validation par l'Agent de Santé Communautaire (ASC).
    Principe : L'IA assiste, l'ASC valide.
    """
    capture = models.CaptureVision(
        population=payload.population,
        type_mesure=payload.type_mesure,
        valeur_estimee=payload.valeur_estimee,
        score_confiance=payload.score_confiance,
        image_metadata=payload.image_metadata,
        statut_validation="en_attente",
        agent_id=payload.agent_id,
        centre_id=payload.centre_id,
        date_capture=datetime.now(timezone.utc)
    )
    db.add(capture)
    db.commit()
    db.refresh(capture)

    msg = f"Mesure de {payload.type_mesure.upper()} estimée à {payload.valeur_estimee}. Veuillez valider ou corriger la valeur."

    res = schemas.CaptureVisionResponse.model_validate(capture)
    res.message_asc = msg
    return res


@app.post("/capture-vision/{id}/validation", response_model=schemas.DepistageResponse, status_code=status.HTTP_200_OK, tags=["Vision AI (Lionel & Rasmata)"])
@app.put("/capture-vision/{id}/validation", response_model=schemas.DepistageResponse, status_code=status.HTTP_200_OK, tags=["Vision AI (Lionel & Rasmata)"])
def valider_capture_vision(id: int, payload: schemas.CaptureVisionValidationPayload, db: Session = Depends(get_db)):
    """
    L'Agent de Santé Communautaire (ASC) valide ou corrige la valeur suggérée par la Vision AI.
    Une fois validé, exécute le pipeline de classification 4 étapes et enregistre le dépistage officiel.
    """
    capture = db.query(models.CaptureVision).filter(models.CaptureVision.id == id).first()
    if not capture:
        raise HTTPException(status_code=404, detail="Capture Vision introuvable")

    capture.valeur_validee = payload.valeur_validee
    capture.statut_validation = payload.statut_validation

    mesures = {}
    if capture.type_mesure == "pb":
        mesures["pb"] = payload.valeur_validee
        mesures["pb_source"] = "vision_ai"
        mesures["oedemes_bilateraux"] = payload.oedemes_bilateraux
        mesures["poids"] = payload.poids
        mesures["taille"] = payload.taille
    elif capture.type_mesure == "hauteur_uterine":
        mesures["hauteur_uterine"] = payload.valeur_validee
        mesures["hauteur_uterine_source"] = "vision_ai"
        mesures["personne_id"] = payload.personne_id or "FEMME_VISION"
        mesures["semaine_amenorrhee"] = payload.semaine_amenorrhee or 28

    seuils_dict = get_current_seuils_dict(db)

    try:
        pipeline_res = pipeline.run_pipeline(
            population=capture.population,
            mesures=mesures,
            seuils=seuils_dict
        )
    except pipeline.OutOfRangeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erreur de mesure après validation: {str(e)}"
        )

    depistage = models.Depistage(
        population=capture.population,
        mesures=mesures,
        date=datetime.now(timezone.utc),
        agent_id=payload.agent_id,
        centre_id=capture.centre_id,
        classification=pipeline_res["classification"],
        orientation_declenchee=pipeline_res["orientation_declenchee"],
        mode_saisie="ocr_photo"
    )
    db.add(depistage)
    db.flush()

    capture.depistage_id = depistage.id
    db.commit()
    db.refresh(depistage)

    return {
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


# --- ENDPOINTS PRINCIPAUX ---

@app.post("/depistage", response_model=schemas.DepistageResponse, status_code=status.HTTP_201_CREATED, tags=["Dépistages"])
def créer_depistage(payload: schemas.DepistageCreate, db: Session = Depends(get_db)):
    """
    Crée un nouveau dépistage.
    1. Charge les seuils (depuis le cache haute performance)
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
    db.flush()

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


@app.get("/depistage/{id}", response_model=schemas.DepistageResponse, tags=["Dépistages"])
def obtenir_depistage(id: int, db: Session = Depends(get_db)):
    """Récupère un dépistage par son ID."""
    depistage = db.query(models.Depistage).filter(models.Depistage.id == id).first()
    if not depistage:
        raise HTTPException(status_code=404, detail="Dépistage introuvable")

    return depistage


@app.get("/alertes", response_model=List[schemas.DepistageResponse], tags=["Alertes"])
def obtenir_alertes(db: Session = Depends(get_db)):
    """Liste tous les dépistages graves/critiques en attente d'orientation."""
    alertes = db.query(models.Depistage).filter(
        models.Depistage.orientation_declenchee == True
    ).order_by(models.Depistage.date.desc()).all()
    return alertes


@app.get("/seuils", response_model=List[schemas.SeuilResponse], tags=["Configuration Seuils"])
def obtenir_seuils(db: Session = Depends(get_db)):
    """Liste tous les seuils de configuration actifs."""
    seuils = db.query(models.Seuils).all()
    return seuils


class UpdateSeuilPayload(BaseModel):
    population: str
    type_mesure: str
    nouvelle_valeur: float
    agent_id: str
    version_protocole: Optional[str] = "PCIMA Burkina Faso 2014"


@app.put("/seuils", response_model=schemas.SeuilResponse, tags=["Configuration Seuils"])
def mettre_a_jour_seuil(payload: UpdateSeuilPayload, db: Session = Depends(get_db)):
    """
    Met à jour la valeur d'un seuil dans la table de configuration, journalise la modification
    dans JournalValidationSeuils, et invalide le cache mémoire des seuils.
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

    get_current_seuils_dict(db, force_refresh=True)

    return seuil


# --- ENDPOINTS COMPLÉMENTAIRES (SUIVI & STATISTIQUES DASHBOARD) ---

@app.get("/suivi-grossesse/{personne_id}", response_model=List[schemas.SuiviGrossesseResponse], tags=["Suivi Maternité"])
def obtenir_suivi_grossesse(personne_id: str, db: Session = Depends(get_db)):
    """
    Récupère l'historique des consultations CPN / suivi de grossesse pour une femme donnée.
    Permet de suivre la courbe d'évolution de la hauteur utérine au fil des semaines d'aménorrhée.
    """
    suivis = db.query(models.SuiviGrossesse).filter(
        models.SuiviGrossesse.personne_id == personne_id
    ).order_by(models.SuiviGrossesse.semaine_amenorrhee.asc()).all()
    return suivis


@app.get("/stats", response_model=schemas.StatsResponse, tags=["Statistiques Dashboard"])
def obtenir_statistiques(db: Session = Depends(get_db)):
    """
    Fournit un résumé statistique agrégé pour alimenter les tableaux de bord et métriques globales du hackathon.
    """
    total_depistages = db.query(models.Depistage).count()
    total_alertes = db.query(models.Depistage).filter(models.Depistage.orientation_declenchee == True).count()

    pop_counts = db.query(models.Depistage.population, func.count(models.Depistage.id)).group_by(models.Depistage.population).all()
    par_population = {pop: count for pop, count in pop_counts}

    classif_counts = db.query(models.Depistage.classification, func.count(models.Depistage.id)).group_by(models.Depistage.classification).all()
    par_classification = {cl: count for cl, count in classif_counts}

    return {
        "total_depistages": total_depistages,
        "total_alertes": total_alertes,
        "par_population": par_population,
        "par_classification": par_classification
    }


# --- BONUS EXPORTS & FICHES D'ORIENTATION IMPRIMABLES ---

@app.get("/alertes/export/csv", tags=["Exportation & Rapports"])
def exporter_alertes_csv(db: Session = Depends(get_db)):
    """Exporte la liste de toutes les alertes en fichier CSV téléchargeable."""
    alertes = db.query(models.Depistage).filter(models.Depistage.orientation_declenchee == True).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Numero_MA", "Population", "Date", "Agent_ID", "Centre_ID", "Classification", "Mode_Saisie", "Mesures"])

    for a in alertes:
        num_ma = pipeline.generer_numero_ma("RBM", "DDG", a.centre_id, a.date.year, a.id)
        writer.writerow([
            a.id, num_ma, a.population, a.date.strftime("%Y-%m-%d %H:%M:%S"),
            a.agent_id, a.centre_id, a.classification, a.mode_saisie, str(a.mesures)
        ])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=alertes_nutri_depist.csv"}
    )


@app.get("/alertes/{id}/fiche-orientation", response_class=HTMLResponse, tags=["Exportation & Rapports"])
def obtenir_fiche_orientation(id: int, db: Session = Depends(get_db)):
    """
    Génère une fiche d'orientation médicale d'urgence imprimable (HTML/PDF) 
    conforme à la norme PCIMA Burkina Faso.
    """
    depistage = db.query(models.Depistage).filter(models.Depistage.id == id).first()
    if not depistage:
        raise HTTPException(status_code=404, detail="Dépistage non trouvé")

    num_ma = pipeline.generer_numero_ma("RBM", "DDG", depistage.centre_id, depistage.date.year, depistage.id)

    html_content = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Fiche d'Orientation Médicale - PCIMA Burkina Faso</title>
        <style>
            body {{ font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; padding: 20px; color: #1e293b; }}
            .card {{ max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }}
            .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ef4444; padding-bottom: 15px; margin-bottom: 20px; }}
            .logo {{ font-size: 18px; font-weight: bold; color: #dc2626; letter-spacing: 0.5px; }}
            .badge-urgent {{ background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-weight: bold; padding: 6px 12px; border-radius: 20px; font-size: 13px; text-transform: uppercase; }}
            .section-title {{ font-size: 14px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-top: 20px; margin-bottom: 10px; }}
            .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; font-size: 14px; }}
            .info-label {{ font-weight: bold; color: #475569; }}
            .recommandation-box {{ background: #fff1f2; border-left: 4px solid #e11d48; padding: 15px; border-radius: 4px; margin-top: 20px; font-size: 14px; color: #9f1239; }}
            .footer-sig {{ margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }}
            @media print {{ body {{ background: white; padding: 0; }} .card {{ box-shadow: none; border: none; }} }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <div class="logo">🇧🇫 NUTRI-DÉPIST &bull; FICHE DE TRANSFERT PCIMA</div>
                <div class="badge-urgent">PRIORITÉ URGENTE</div>
            </div>

            <div class="info-grid">
                <div><span class="info-label">Numéro Unique MA :</span> <code>{num_ma}</code></div>
                <div><span class="info-label">Date :</span> {depistage.date.strftime('%d/%m/%Y %H:%M')}</div>
                <div><span class="info-label">Population :</span> {depistage.population.capitalize()}</div>
                <div><span class="info-label">Agent Saisisseur :</span> {depistage.agent_id}</div>
                <div><span class="info-label">Centre d'Origine :</span> {depistage.centre_id}</div>
                <div><span class="info-label">Classification :</span> <strong>{depistage.classification.upper()}</strong></div>
            </div>

            <div class="section-title">Mesures Relevées</div>
            <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px;">
                {str(depistage.mesures)}
            </div>

            <div class="recommandation-box">
                <strong>🚨 RECOMMANDATION PCIMA BURKINA FASO :</strong><br>
                Prise en charge médicale et nutritionnelle spécialisée requise. Transfert immédiat vers la structure hospitalière de référence (PCI / CSPS).
            </div>

            <div class="footer-sig">
                <div>Conforme Protocole National PCIMA 2014 &bull; Ministère de la Santé</div>
                <div>Signature / Tampon Agent : ______________________</div>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

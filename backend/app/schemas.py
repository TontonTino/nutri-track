from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime

# --- Seuils Schemas ---
class SeuilBase(BaseModel):
    population: str
    type_mesure: str
    valeur_seuil: float
    version_protocole: str
    date_application: Optional[datetime] = None

class SeuilCreate(SeuilBase):
    pass

class SeuilUpdate(BaseModel):
    valeur_seuil: float
    agent_id: str
    version_protocole: Optional[str] = None

class SeuilResponse(SeuilBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# --- Specific Population Measurement Schemas ---
class MesureEnfantInput(BaseModel):
    pb: float  # en mm
    pb_source: str = "manuel"
    poids: Optional[float] = None
    taille: Optional[float] = None
    oedemes_bilateraux: bool = False
    oedemes_source: str = "clinique"

class SuiviGrossesseInput(BaseModel):
    personne_id: str
    date_cpn: Optional[datetime] = None
    hauteur_uterine: float  # en cm
    hauteur_uterine_source: str = "mètre_ruban"
    pb: Optional[float] = None
    semaine_amenorrhee: int

class SuiviGrossesseResponse(BaseModel):
    id: int
    personne_id: str
    date_cpn: datetime
    hauteur_uterine: float
    hauteur_uterine_source: str
    pb: Optional[float] = None
    semaine_amenorrhee: int
    hauteur_uterine_attendue: float
    ecart_croissance_foetale: float

    model_config = ConfigDict(from_attributes=True)

class MesurePersonneAgeeInput(BaseModel):
    perimetre_mollet: Optional[float] = None
    pb_optionnel: Optional[float] = None
    perte_poids_recente: Optional[bool] = None
    score_mna_sf: int  # 0 à 14

# --- Dépistage Schemas ---
class DepistageCreate(BaseModel):
    population: str  # "enfant", "enceinte", "personne_agee"
    mesures: Dict[str, Any]
    agent_id: str
    centre_id: str
    mode_saisie: str = "manuel"

class DepistageResponse(BaseModel):
    id: int
    population: str
    mesures: Dict[str, Any]
    date: datetime
    agent_id: str
    centre_id: str
    classification: str
    orientation_declenchee: bool
    mode_saisie: str
    message: Optional[str] = None
    recommandation: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- Capture Vision AI Schemas ---
class CaptureVisionCreate(BaseModel):
    population: str  # "enfant", "enceinte", "personne_agee"
    type_mesure: str = "pb"  # "pb", "hauteur_uterine"
    valeur_estimee: float
    score_confiance: Optional[float] = 0.95
    image_metadata: Optional[Dict[str, Any]] = None
    agent_id: str
    centre_id: str

class CaptureVisionValidationPayload(BaseModel):
    valeur_validee: float
    statut_validation: str = "valide"  # "valide", "corrige", "rejete"
    agent_id: str
    personne_id: Optional[str] = None
    semaine_amenorrhee: Optional[int] = None
    oedemes_bilateraux: bool = False
    poids: Optional[float] = None
    taille: Optional[float] = None

class CaptureVisionResponse(BaseModel):
    id: int
    population: str
    type_mesure: str
    valeur_estimee: float
    score_confiance: Optional[float] = None
    statut_validation: str
    valeur_validee: Optional[float] = None
    agent_id: str
    centre_id: str
    date_capture: datetime
    depistage_id: Optional[int] = None
    message_asc: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- Stats Schema ---
class StatsResponse(BaseModel):
    total_depistages: int
    total_alertes: int
    par_population: Dict[str, int]
    par_classification: Dict[str, int]

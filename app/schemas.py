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

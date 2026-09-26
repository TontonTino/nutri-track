import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Depistage(Base):
    __tablename__ = "depistage"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    population = Column(String, nullable=False, index=True)  # "enfant", "enceinte", "personne_agee"
    mesures = Column(JSON, nullable=False)
    date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    agent_id = Column(String, nullable=False)
    centre_id = Column(String, nullable=False)
    classification = Column(String, nullable=False)
    orientation_declenchee = Column(Boolean, default=False, nullable=False)
    mode_saisie = Column(String, nullable=False)

    # Relationships
    mesure_enfant = relationship("MesureEnfant", back_populates="depistage", uselist=False, cascade="all, delete-orphan")
    mesure_personne_agee = relationship("MesurePersonneAgee", back_populates="depistage", uselist=False, cascade="all, delete-orphan")


class CaptureVision(Base):
    __tablename__ = "capture_vision"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    population = Column(String, nullable=False, index=True)
    type_mesure = Column(String, nullable=False)  # "pb", "hauteur_uterine"
    valeur_estimee = Column(Float, nullable=False)
    score_confiance = Column(Float, nullable=True)  # ex: 0.95
    image_metadata = Column(JSON, nullable=True)
    statut_validation = Column(String, default="en_attente", nullable=False)  # "en_attente", "valide", "corrige", "rejete"
    valeur_validee = Column(Float, nullable=True)
    agent_id = Column(String, nullable=False)
    centre_id = Column(String, nullable=False)
    date_capture = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    depistage_id = Column(Integer, ForeignKey("depistage.id"), nullable=True)


class Seuils(Base):
    __tablename__ = "seuils"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    population = Column(String, nullable=False, index=True)
    type_mesure = Column(String, nullable=False, index=True)
    valeur_seuil = Column(Float, nullable=False)
    version_protocole = Column(String, nullable=False)
    date_application = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    validations = relationship("JournalValidationSeuils", back_populates="seuil")


class JournalValidationSeuils(Base):
    __tablename__ = "journal_validation_seuils"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    seuil_id = Column(Integer, ForeignKey("seuils.id"), nullable=False)
    ancienne_valeur = Column(Float, nullable=False)
    nouvelle_valeur = Column(Float, nullable=False)
    agent_id = Column(String, nullable=False)
    date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    seuil = relationship("Seuils", back_populates="validations")


class MesureEnfant(Base):
    __tablename__ = "mesure_enfant"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    depistage_id = Column(Integer, ForeignKey("depistage.id"), nullable=False)
    pb = Column(Float, nullable=False)
    pb_source = Column(String, nullable=False)
    poids = Column(Float, nullable=True)
    taille = Column(Float, nullable=True)
    oedemes_bilateraux = Column(Boolean, default=False, nullable=False)
    oedemes_source = Column(String, nullable=False)

    depistage = relationship("Depistage", back_populates="mesure_enfant")


class SuiviGrossesse(Base):
    __tablename__ = "suivi_grossesse"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    personne_id = Column(String, nullable=False, index=True)
    date_cpn = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    hauteur_uterine = Column(Float, nullable=False)
    hauteur_uterine_source = Column(String, nullable=False)
    pb = Column(Float, nullable=True)
    semaine_amenorrhee = Column(Integer, nullable=False)
    hauteur_uterine_attendue = Column(Float, nullable=False)
    ecart_croissance_foetale = Column(Float, nullable=False)


class MesurePersonneAgee(Base):
    __tablename__ = "mesure_personne_agee"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    depistage_id = Column(Integer, ForeignKey("depistage.id"), nullable=False)
    perimetre_mollet = Column(Float, nullable=True)
    pb_optionnel = Column(Float, nullable=True)
    perte_poids_recente = Column(Boolean, nullable=True)
    score_mna_sf = Column(Integer, nullable=False)

    depistage = relationship("Depistage", back_populates="mesure_personne_agee")

from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class Centre(db.Model):
    __tablename__ = "centres"

    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(120), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)

    stock = db.relationship(
        "Stock", back_populates="centre", uselist=False, cascade="all, delete-orphan"
    )
    distributions = db.relationship(
        "Distribution", back_populates="centre", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "nom": self.nom,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Stock(db.Model):
    """Snapshot courant du stock d'un centre (mis a jour via la saisie USSD)."""

    __tablename__ = "stocks"

    id = db.Column(db.Integer, primary_key=True)
    centre_id = db.Column(
        db.Integer, db.ForeignKey("centres.id"), unique=True, nullable=False
    )
    stock_physique = db.Column(db.Float, nullable=False, default=0)
    stock_reserve = db.Column(db.Float, nullable=False, default=0)
    stock_securite = db.Column(db.Float, nullable=False, default=0)
    consommation_quotidienne = db.Column(db.Float, nullable=False, default=0)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    centre = db.relationship("Centre", back_populates="stock")

    def to_dict(self):
        return {
            "id": self.id,
            "centre_id": self.centre_id,
            "stock_physique": self.stock_physique,
            "stock_reserve": self.stock_reserve,
            "stock_securite": self.stock_securite,
            "consommation_quotidienne": self.consommation_quotidienne,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Distribution(db.Model):
    """Enregistrement d'une distribution/consommation declaree par l'ASC."""

    __tablename__ = "distributions"

    id = db.Column(db.Integer, primary_key=True)
    centre_id = db.Column(db.Integer, db.ForeignKey("centres.id"), nullable=False)
    quantite = db.Column(db.Float, nullable=False)
    date = db.Column(db.DateTime, default=utcnow)

    centre = db.relationship("Centre", back_populates="distributions")

    def to_dict(self):
        return {
            "id": self.id,
            "centre_id": self.centre_id,
            "quantite": self.quantite,
            "date": self.date.isoformat() if self.date else None,
        }


class Transfert(db.Model):
    """Proposition/decision de transfert entre un centre donneur et un centre receveur."""

    __tablename__ = "transferts"

    STATUTS = ("propose", "valide", "refuse")

    id = db.Column(db.Integer, primary_key=True)
    centre_donneur_id = db.Column(db.Integer, db.ForeignKey("centres.id"), nullable=False)
    centre_receveur_id = db.Column(db.Integer, db.ForeignKey("centres.id"), nullable=False)
    quantite = db.Column(db.Float, nullable=False)
    statut = db.Column(db.String(20), nullable=False, default="propose")
    date_creation = db.Column(db.DateTime, default=utcnow)
    date_decision = db.Column(db.DateTime, nullable=True)
    decide_par = db.Column(db.String(120), nullable=True)

    centre_donneur = db.relationship("Centre", foreign_keys=[centre_donneur_id])
    centre_receveur = db.relationship("Centre", foreign_keys=[centre_receveur_id])

    def to_dict(self):
        return {
            "id": self.id,
            "centre_donneur_id": self.centre_donneur_id,
            "centre_receveur_id": self.centre_receveur_id,
            "quantite": self.quantite,
            "statut": self.statut,
            "date_creation": self.date_creation.isoformat() if self.date_creation else None,
            "date_decision": self.date_decision.isoformat() if self.date_decision else None,
            "decide_par": self.decide_par,
        }


class Historique(db.Model):
    """Journal des evenements (maj stock, distribution, transfert propose/valide/refuse)."""

    __tablename__ = "historique"

    id = db.Column(db.Integer, primary_key=True)
    type_evenement = db.Column(db.String(50), nullable=False)
    centre_id = db.Column(db.Integer, db.ForeignKey("centres.id"), nullable=True)
    description = db.Column(db.String(255), nullable=False)
    date = db.Column(db.DateTime, default=utcnow)

    centre = db.relationship("Centre")

    def to_dict(self):
        return {
            "id": self.id,
            "type_evenement": self.type_evenement,
            "centre_id": self.centre_id,
            "description": self.description,
            "date": self.date.isoformat() if self.date else None,
        }

from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models import Centre, Historique, Stock, Transfert, utcnow

transferts_bp = Blueprint("transferts", __name__, url_prefix="/api/transferts")


@transferts_bp.get("")
def list_transferts():
    statut = request.args.get("statut")
    query = Transfert.query
    if statut is not None:
        if statut not in Transfert.STATUTS:
            return jsonify({"error": f"Statut invalide. Valeurs possibles : {Transfert.STATUTS}"}), 400
        query = query.filter_by(statut=statut)
    transferts = query.order_by(Transfert.date_creation.desc()).all()
    return jsonify([t.to_dict() for t in transferts])


@transferts_bp.get("/<int:transfert_id>")
def get_transfert(transfert_id):
    transfert = db.get_or_404(Transfert, transfert_id)
    return jsonify(transfert.to_dict())


@transferts_bp.post("")
def create_transfert():
    """Enregistre une proposition de transfert (etape DECIDE, calculee par NUTRI-SWITCH).

    Ne deplace aucun stock : la proposition reste en statut 'propose' jusqu'a
    validation explicite du MCD via /valider ou /refuser (etape ACT).
    """
    payload = request.get_json(silent=True) or {}
    donneur_id = payload.get("centre_donneur_id")
    receveur_id = payload.get("centre_receveur_id")
    quantite = payload.get("quantite")

    if donneur_id is None or receveur_id is None or quantite is None:
        return jsonify(
            {"error": "Les champs 'centre_donneur_id', 'centre_receveur_id' et 'quantite' sont requis."}
        ), 400
    if donneur_id == receveur_id:
        return jsonify({"error": "Le centre donneur et le centre receveur doivent etre differents."}), 400
    if quantite <= 0:
        return jsonify({"error": "La quantite doit etre positive."}), 400

    donneur = db.get_or_404(Centre, donneur_id)
    receveur = db.get_or_404(Centre, receveur_id)

    transfert = Transfert(
        centre_donneur_id=donneur.id,
        centre_receveur_id=receveur.id,
        quantite=quantite,
        statut="propose",
    )
    db.session.add(transfert)
    db.session.add(
        Historique(
            type_evenement="transfert_propose",
            centre_id=donneur.id,
            description=f"Proposition de transfert de {quantite} sachets de {donneur.nom} vers {receveur.nom}.",
        )
    )
    db.session.commit()
    return jsonify(transfert.to_dict()), 201


@transferts_bp.put("/<int:transfert_id>/valider")
def valider_transfert(transfert_id):
    """Validation explicite du MCD (etape ACT). Applique reellement le mouvement de stock."""
    transfert = db.get_or_404(Transfert, transfert_id)
    if transfert.statut != "propose":
        return jsonify({"error": f"Ce transfert est deja au statut '{transfert.statut}'."}), 409

    payload = request.get_json(silent=True) or {}

    stock_donneur = Stock.query.filter_by(centre_id=transfert.centre_donneur_id).first()
    stock_receveur = Stock.query.filter_by(centre_id=transfert.centre_receveur_id).first()
    if stock_donneur is None or stock_receveur is None:
        return jsonify({"error": "Stock introuvable pour le donneur ou le receveur."}), 409
    if stock_donneur.stock_physique < transfert.quantite:
        return jsonify({"error": "Le donneur ne dispose plus d'un stock physique suffisant."}), 409

    stock_donneur.stock_physique -= transfert.quantite
    stock_receveur.stock_physique += transfert.quantite

    transfert.statut = "valide"
    transfert.date_decision = utcnow()
    transfert.decide_par = payload.get("decide_par")

    db.session.add(
        Historique(
            type_evenement="transfert_valide",
            centre_id=transfert.centre_donneur_id,
            description=(
                f"Transfert de {transfert.quantite} sachets valide par "
                f"{transfert.decide_par or 'le MCD'}."
            ),
        )
    )
    db.session.commit()
    return jsonify(transfert.to_dict())


@transferts_bp.put("/<int:transfert_id>/refuser")
def refuser_transfert(transfert_id):
    """Refus explicite du MCD (etape ACT). Aucun mouvement de stock n'est applique."""
    transfert = db.get_or_404(Transfert, transfert_id)
    if transfert.statut != "propose":
        return jsonify({"error": f"Ce transfert est deja au statut '{transfert.statut}'."}), 409

    payload = request.get_json(silent=True) or {}
    transfert.statut = "refuse"
    transfert.date_decision = utcnow()
    transfert.decide_par = payload.get("decide_par")

    db.session.add(
        Historique(
            type_evenement="transfert_refuse",
            centre_id=transfert.centre_donneur_id,
            description=(
                f"Transfert de {transfert.quantite} sachets refuse par "
                f"{transfert.decide_par or 'le MCD'}."
            ),
        )
    )
    db.session.commit()
    return jsonify(transfert.to_dict())

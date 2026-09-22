from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models import Centre, Distribution, Historique, Stock

distributions_bp = Blueprint("distributions", __name__, url_prefix="/api/distributions")


@distributions_bp.get("")
def list_distributions():
    centre_id = request.args.get("centre_id", type=int)
    query = Distribution.query
    if centre_id is not None:
        query = query.filter_by(centre_id=centre_id)
    distributions = query.order_by(Distribution.date.desc()).all()
    return jsonify([d.to_dict() for d in distributions])


@distributions_bp.post("")
def create_distribution():
    """Declaration d'une distribution/consommation par l'ASC (etape SEE)."""
    payload = request.get_json(silent=True) or {}
    centre_id = payload.get("centre_id")
    quantite = payload.get("quantite")

    if centre_id is None or quantite is None:
        return jsonify({"error": "Les champs 'centre_id' et 'quantite' sont requis."}), 400
    if quantite <= 0:
        return jsonify({"error": "La quantite doit etre positive."}), 400

    centre = db.get_or_404(Centre, centre_id)
    distribution = Distribution(centre_id=centre.id, quantite=quantite)
    db.session.add(distribution)

    stock = Stock.query.filter_by(centre_id=centre.id).first()
    if stock is not None:
        stock.stock_physique = max(0, stock.stock_physique - quantite)

    db.session.add(
        Historique(
            type_evenement="distribution",
            centre_id=centre.id,
            description=f"Distribution de {quantite} sachets pour {centre.nom}.",
        )
    )
    db.session.commit()
    return jsonify(distribution.to_dict()), 201

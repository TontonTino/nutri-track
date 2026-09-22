from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models import Centre, Stock

centres_bp = Blueprint("centres", __name__, url_prefix="/api/centres")


@centres_bp.get("")
def list_centres():
    centres = Centre.query.order_by(Centre.nom).all()
    result = []
    for centre in centres:
        data = centre.to_dict()
        data["stock"] = centre.stock.to_dict() if centre.stock else None
        result.append(data)
    return jsonify(result)


@centres_bp.get("/<int:centre_id>")
def get_centre(centre_id):
    centre = db.get_or_404(Centre, centre_id)
    data = centre.to_dict()
    data["stock"] = centre.stock.to_dict() if centre.stock else None
    return jsonify(data)


@centres_bp.post("")
def create_centre():
    payload = request.get_json(silent=True) or {}
    nom = (payload.get("nom") or "").strip()
    if not nom:
        return jsonify({"error": "Le champ 'nom' est requis."}), 400
    if Centre.query.filter_by(nom=nom).first():
        return jsonify({"error": f"Le centre '{nom}' existe deja."}), 409

    centre = Centre(nom=nom)
    db.session.add(centre)
    db.session.flush()

    stock = Stock(
        centre_id=centre.id,
        stock_physique=payload.get("stock_physique", 0),
        stock_reserve=payload.get("stock_reserve", 0),
        stock_securite=payload.get("stock_securite", 0),
        consommation_quotidienne=payload.get("consommation_quotidienne", 0),
    )
    db.session.add(stock)
    db.session.commit()

    data = centre.to_dict()
    data["stock"] = stock.to_dict()
    return jsonify(data), 201

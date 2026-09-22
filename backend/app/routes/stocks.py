from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models import Centre, Historique, Stock

stocks_bp = Blueprint("stocks", __name__, url_prefix="/api/stocks")


@stocks_bp.get("")
def list_stocks():
    stocks = Stock.query.all()
    return jsonify([stock.to_dict() for stock in stocks])


@stocks_bp.get("/<int:centre_id>")
def get_stock(centre_id):
    stock = Stock.query.filter_by(centre_id=centre_id).first_or_404()
    return jsonify(stock.to_dict())


@stocks_bp.put("/<int:centre_id>")
def update_stock(centre_id):
    """Saisie/mise a jour du stock d'un centre (etape SEE, simulateur USSD)."""
    centre = db.get_or_404(Centre, centre_id)
    stock = Stock.query.filter_by(centre_id=centre_id).first()
    if stock is None:
        stock = Stock(centre_id=centre_id)
        db.session.add(stock)

    payload = request.get_json(silent=True) or {}
    for field in (
        "stock_physique",
        "stock_reserve",
        "stock_securite",
        "consommation_quotidienne",
    ):
        if field in payload:
            setattr(stock, field, payload[field])

    db.session.add(
        Historique(
            type_evenement="stock_maj",
            centre_id=centre.id,
            description=f"Mise a jour du stock pour {centre.nom}.",
        )
    )
    db.session.commit()
    return jsonify(stock.to_dict())

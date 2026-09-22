from app.extensions import db
from app.models import Centre, Stock

DEMO_CENTRES = [
    {
        "nom": "Kaya Nord",
        "stock_physique": 100,
        "stock_reserve": 40,
        "stock_securite": 20,
        "consommation_quotidienne": 8,
    },
    {
        "nom": "Kaya Sud",
        "stock_physique": 350,
        "stock_reserve": 100,
        "stock_securite": 60,
        "consommation_quotidienne": 10,
    },
    {
        "nom": "Kaya Centre",
        "stock_physique": 180,
        "stock_reserve": 50,
        "stock_securite": 30,
        "consommation_quotidienne": 6,
    },
]


def seed_demo_data():
    """Insere les centres de demonstration du cas d'usage de reference, si absents."""
    for entry in DEMO_CENTRES:
        centre = Centre.query.filter_by(nom=entry["nom"]).first()
        if centre is None:
            centre = Centre(nom=entry["nom"])
            db.session.add(centre)
            db.session.flush()

        if centre.stock is None:
            stock = Stock(
                centre_id=centre.id,
                stock_physique=entry["stock_physique"],
                stock_reserve=entry["stock_reserve"],
                stock_securite=entry["stock_securite"],
                consommation_quotidienne=entry["consommation_quotidienne"],
            )
            db.session.add(stock)

    db.session.commit()

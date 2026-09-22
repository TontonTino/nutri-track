from flask import Flask
from flask_cors import CORS

from app.extensions import db
from config import Config


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    CORS(app)

    from app.routes.centres import centres_bp
    from app.routes.stocks import stocks_bp
    from app.routes.distributions import distributions_bp
    from app.routes.transferts import transferts_bp

    app.register_blueprint(centres_bp)
    app.register_blueprint(stocks_bp)
    app.register_blueprint(distributions_bp)
    app.register_blueprint(transferts_bp)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app

import pytest

from app import create_app
from app.extensions import db
from app.seed import seed_demo_data
from config import TestingConfig


@pytest.fixture
def app():
    flask_app = create_app(TestingConfig)
    with flask_app.app_context():
        db.create_all()
        seed_demo_data()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()

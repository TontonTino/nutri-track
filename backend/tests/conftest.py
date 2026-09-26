"""
conftest.py — fixture partagée pour tout le dossier tests/.

CONSTAT (Rasmata) : `tests/test_api.py` crée son propre moteur SQLite en mémoire
et fait `app.dependency_overrides[get_db] = ...` au niveau module. Si un second
fichier de test (ex: test_security_centre_isolation.py) fait la même chose avec
SON PROPRE moteur, seul le dernier fichier importé par pytest "gagne" cet override
pour toute la session — l'autre se retrouve à interroger un moteur sans tables
("no such table: seuils") et tous ses tests échouent. Constaté en testant
`pytest tests/` avec les deux fichiers présents en même temps.

Cette fixture autouse règle le problème sans toucher à test_api.py : elle
réapplique l'override juste avant CHAQUE test (donc après l'import de tous les
modules), vers un unique moteur partagé, tables créées et seuils par défaut
chargés. test_api.py continue de faire son propre `Base.metadata.create_all`
sur son moteur local à lui — c'est inoffensif, ce moteur n'est simplement plus
celui utilisé par l'app pendant les tests.

À terme, le plus propre serait que tous les fichiers de test utilisent cette
fixture plutôt que de recréer leur propre moteur (à proposer à Alya).
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app, seed_default_seuils

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def _override_get_db():
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def base_de_test_partagee():
    app.dependency_overrides[get_db] = _override_get_db
    Base.metadata.drop_all(bind=_engine)
    Base.metadata.create_all(bind=_engine)
    db = _TestingSessionLocal()
    seed_default_seuils(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=_engine)

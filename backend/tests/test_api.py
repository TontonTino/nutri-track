def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok"}


def test_list_centres_returns_demo_data(client):
    resp = client.get("/api/centres")
    assert resp.status_code == 200
    noms = {c["nom"] for c in resp.get_json()}
    assert {"Kaya Nord", "Kaya Sud", "Kaya Centre"}.issubset(noms)


def test_get_stock_matches_scenario_kaya_nord(client):
    centres = client.get("/api/centres").get_json()
    kaya_nord = next(c for c in centres if c["nom"] == "Kaya Nord")

    resp = client.get(f"/api/stocks/{kaya_nord['id']}")
    assert resp.status_code == 200
    stock = resp.get_json()
    assert stock["stock_physique"] == 100
    assert stock["stock_reserve"] == 40
    assert stock["stock_securite"] == 20
    assert stock["consommation_quotidienne"] == 8


def test_create_distribution_decreases_stock_physique(client):
    centres = client.get("/api/centres").get_json()
    kaya_nord = next(c for c in centres if c["nom"] == "Kaya Nord")

    resp = client.post(
        "/api/distributions",
        json={"centre_id": kaya_nord["id"], "quantite": 10},
    )
    assert resp.status_code == 201

    stock = client.get(f"/api/stocks/{kaya_nord['id']}").get_json()
    assert stock["stock_physique"] == 90


def test_create_distribution_requires_valid_payload(client):
    resp = client.post("/api/distributions", json={"centre_id": 1})
    assert resp.status_code == 400


def test_create_centre(client):
    resp = client.post("/api/centres", json={"nom": "Dori"})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["nom"] == "Dori"
    assert data["stock"]["stock_physique"] == 0

    resp_duplicate = client.post("/api/centres", json={"nom": "Dori"})
    assert resp_duplicate.status_code == 409


def _centre_id(client, nom):
    centres = client.get("/api/centres").get_json()
    return next(c for c in centres if c["nom"] == nom)["id"]


def test_transfert_scenario_kaya_sud_vers_kaya_nord(client):
    kaya_nord_id = _centre_id(client, "Kaya Nord")
    kaya_sud_id = _centre_id(client, "Kaya Sud")

    resp = client.post(
        "/api/transferts",
        json={
            "centre_donneur_id": kaya_sud_id,
            "centre_receveur_id": kaya_nord_id,
            "quantite": 72,
        },
    )
    assert resp.status_code == 201
    transfert = resp.get_json()
    assert transfert["statut"] == "propose"

    # Tant que ce n'est pas valide, aucun stock ne doit bouger.
    stock_nord = client.get(f"/api/stocks/{kaya_nord_id}").get_json()
    assert stock_nord["stock_physique"] == 100

    resp_validation = client.put(
        f"/api/transferts/{transfert['id']}/valider",
        json={"decide_par": "Dr. Test"},
    )
    assert resp_validation.status_code == 200
    assert resp_validation.get_json()["statut"] == "valide"

    stock_nord = client.get(f"/api/stocks/{kaya_nord_id}").get_json()
    stock_sud = client.get(f"/api/stocks/{kaya_sud_id}").get_json()
    assert stock_nord["stock_physique"] == 172  # 100 + 72
    assert stock_sud["stock_physique"] == 278  # 350 - 72


def test_transfert_refuse_ne_modifie_pas_le_stock(client):
    kaya_nord_id = _centre_id(client, "Kaya Nord")
    kaya_sud_id = _centre_id(client, "Kaya Sud")

    transfert = client.post(
        "/api/transferts",
        json={"centre_donneur_id": kaya_sud_id, "centre_receveur_id": kaya_nord_id, "quantite": 50},
    ).get_json()

    resp = client.put(f"/api/transferts/{transfert['id']}/refuser")
    assert resp.status_code == 200
    assert resp.get_json()["statut"] == "refuse"

    stock_sud = client.get(f"/api/stocks/{kaya_sud_id}").get_json()
    assert stock_sud["stock_physique"] == 350

    # Un transfert deja tranche ne peut plus etre revalide.
    resp_double = client.put(f"/api/transferts/{transfert['id']}/valider")
    assert resp_double.status_code == 409


def test_transfert_donneur_receveur_identiques_refuse(client):
    kaya_nord_id = _centre_id(client, "Kaya Nord")
    resp = client.post(
        "/api/transferts",
        json={"centre_donneur_id": kaya_nord_id, "centre_receveur_id": kaya_nord_id, "quantite": 10},
    )
    assert resp.status_code == 400

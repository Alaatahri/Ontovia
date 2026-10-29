"""Référentiels (CRUD génériques), délivrance en pharmacie et chat IA."""
import json

import pytest

REFERENTIELS = {
    "medecins": {"champs": {"prenom": "Test", "nom": "Medecin", "specialite": "Dermatologie", "email": "t@m.tn"}},
    "personnel": {"classe": "Infirmier", "champs": {"prenom": "Test", "nom": "Infirmier"}, "relations": {"lieux": ["Pharm_Ennasr"]}},
    "pharmacies": {"champs": {"nom": "Pharmacie Test", "ville": "Bizerte"}, "relations": {"stock": ["Med_Doliprane"]}},
    "maladies": {"champs": {"nom": "Otite", "description": "Inflammation de l'oreille."}},
    "conditions": {"champs": {"nom": "Insuffisance cardiaque légère"}},
    "molecules": {"champs": {"nom": "Ciprofloxacine"}},
    "laboratoires": {"champs": {"nom": "Saiph", "pays": "Tunisie"}},
}


def test_referentiel_specs(client):
    types = {s["type"] for s in client.get("/api/referentiels").json()}
    assert types == set(REFERENTIELS)


@pytest.mark.parametrize("entity_type", list(REFERENTIELS))
def test_referentiel_crud(client, entity_type):
    body = REFERENTIELS[entity_type]
    created = client.post(f"/api/referentiels/{entity_type}", json=body)
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["champs"]["nom"] == body["champs"]["nom"]
    # recherche
    found = client.get(f"/api/referentiels/{entity_type}", params={"q": body["champs"]["nom"][:5]}).json()
    assert item["id"] in {x["id"] for x in found}
    # modification
    body2 = {**body, "champs": {**body["champs"], "nom": body["champs"]["nom"] + " modifié"}}
    updated = client.put(f"/api/referentiels/{entity_type}/{item['id']}", json=body2)
    assert updated.status_code == 200 and updated.json()["champs"]["nom"].endswith("modifié")
    # suppression
    assert client.delete(f"/api/referentiels/{entity_type}/{item['id']}").status_code == 204
    assert client.get(f"/api/referentiels/{entity_type}/{item['id']}").status_code == 404


@pytest.mark.parametrize("entity_type,entity_id", [
    ("maladies", "Mal_Migraine"), ("medecins", "Doc_RimKhelifi"), ("laboratoires", "Lab_GSK"),
    ("molecules", "Mol_Amoxicilline"), ("pharmacies", "Pharm_Ennasr"), ("conditions", "Cond_Grossesse"),
])
def test_referentiel_delete_in_use_is_refused(client, entity_type, entity_id):
    r = client.delete(f"/api/referentiels/{entity_type}/{entity_id}")
    assert r.status_code == 409 and "utilisé" in r.json()["detail"]


def test_referentiel_validation(client):
    assert client.post("/api/referentiels/maladies", json={"champs": {"nom": ""}}).status_code == 422
    assert client.post("/api/referentiels/medecins", json={"champs": {"prenom": "a", "nom": "b", "specialite": "c",
                                                                      "email": "pas-un-mail"}}).status_code == 422
    assert client.post("/api/referentiels/personnel", json={"classe": "Patient", "champs": {"prenom": "a", "nom": "b"}}).status_code == 422
    assert client.post("/api/referentiels/pharmacies", json={"champs": {"nom": "P"}, "relations": {"stock": ["Mal_Migraine"]}}).status_code == 422
    assert client.get("/api/referentiels/inconnu").status_code == 404


def test_personnel_change_class_and_pharmacy_link(client):
    p = client.post("/api/referentiels/personnel", json=REFERENTIELS["personnel"]).json()
    assert p["classe"] == "Infirmier"
    staff = client.get("/api/referentiels/pharmacies/Pharm_Ennasr").json()["relations"]["personnel"]
    assert p["id"] in {x["id"] for x in staff}
    p2 = client.put(f"/api/referentiels/personnel/{p['id']}", json={**REFERENTIELS["personnel"], "classe": "Pharmacien"}).json()
    assert p2["classe"] == "Pharmacien"
    assert [x["id"] for x in client.get("/api/referentiels/personnel", params={"classe": "Pharmacien"}).json()].count(p["id"]) == 1
    client.delete(f"/api/referentiels/personnel/{p['id']}")


def test_medecin_indicators(client):
    m = client.get("/api/referentiels/medecins/Doc_RimKhelifi").json()
    activite = {i["label"]: i["valeur"] for i in m["indicateurs"][0]["items"]}
    assert activite["Prescriptions"] == 2 and activite["Prescriptions à risque"] == 2


# ---------- Délivrance en pharmacie ----------

def test_delivery_workflow(client):
    pharmacies = client.get("/api/prescriptions/Presc_005/pharmacies").json()
    assert pharmacies[0]["id"] == "Pharm_ElManar" and pharmacies[0]["complete"]
    # stock insuffisant
    r = client.post("/api/prescriptions/Presc_005/delivrer", json={"pharmacieId": "Pharm_Ennasr"})
    assert r.status_code == 409 and set(r.json()["manquants"]) == {"Med_Aspirine", "Med_Coumadine"}
    # risque détecté → confirmation requise
    r = client.post("/api/prescriptions/Presc_005/delivrer", json={"pharmacieId": "Pharm_ElManar"})
    assert r.status_code == 409 and r.json()["confirmationRequise"]
    r = client.post("/api/prescriptions/Presc_005/delivrer", json={"pharmacieId": "Pharm_ElManar", "forcer": True})
    assert r.status_code == 200 and r.json()["statut"] == "Délivrée" and r.json()["pharmacie"]["id"] == "Pharm_ElManar"
    # une seule délivrance ; ordonnance délivrée non modifiable
    assert client.post("/api/prescriptions/Presc_005/delivrer", json={"pharmacieId": "Pharm_ElManar", "forcer": True}).status_code == 409
    body = {"patientId": "Pat_YoussefHammami", "medecinId": "Doc_HichemSaidi", "medicamentIds": ["Med_Coumadine"],
            "datePrescription": "2026-10-01"}
    assert client.put("/api/prescriptions/Presc_005", json=body).status_code == 409
    assert "Presc_005" in {p["id"] for p in client.get("/api/prescriptions", params={"statut": "Délivrée"}).json()}
    # annulation
    assert client.delete("/api/prescriptions/Presc_005/delivrance").json()["statut"] == "En attente"


def test_availability_and_medicament_pharmacies(client):
    dispo = client.get("/api/pharmacies/disponibilite", params={"medicaments": "Med_Coumadine,Med_Doliprane"}).json()
    assert {p["id"] for p in dispo if p["complete"]} == {"Pharm_ElManar", "Pharm_Sousse"}
    assert {p["id"] for p in client.get("/api/medicaments/Med_Aspirine").json()["pharmacies"]} == {"Pharm_CentraleTunis", "Pharm_ElManar"}


def test_new_nlp_intents(client):
    cases = {
        "Où trouver le Coumadine ?": ("pharmacies_medicament", {"Pharmacie El Manar", "Pharmacie du Centre Sousse"}),
        "Qui travaille à la pharmacie Ennasr ?": ("personnel_pharmacie", {"Walid Mejri"}),
        "Combien de pharmacies ?": ("compter", {4}),
    }
    for question, (intent, expected) in cases.items():
        r = client.post("/api/nlp/query", json={"question": question}).json()
        assert r["intention"]["id"] == intent, question
        assert {list(x.values())[0] for x in r["resultats"]} == expected, question


# ---------- Chat IA (sans LLM pendant les tests : NEXORA_LLM=off) ----------

def _chat(client, message, contexte=None, historique=None):
    events = []
    with client.stream("POST", "/api/chat", json={"message": message, "contexte": contexte, "historique": historique or []}) as r:
        assert r.status_code == 200
        for line in r.iter_lines():
            events.append(json.loads(line))
    return events


def test_chat_stream_and_follow_up_context(client):
    events = _chat(client, "Quelles sont les contre-indications de l'aspirine ?")
    assert [e["type"] for e in events] == ["analyse", "token", "fin"]
    assert events[0]["mode"] == "donnees" and events[0]["sparql"].startswith("PREFIX") and "Grossesse" in events[1]["text"]
    contexte = events[-1]["contexte"]
    assert contexte["entite"]["id"] == "Med_Aspirine" and contexte["intention"] == "contre_indications_medicament"
    # question de suivi sans entité : l'aspirine est reprise du contexte
    follow = _chat(client, "Et avec quoi interagit-elle ?", contexte=contexte)
    assert follow[0]["intention"]["id"] == "interactions_medicament"
    assert follow[0]["entite"]["id"] == "Med_Aspirine" and "Coumadine" in follow[1]["text"]
    # relance pure : l'intention précédente est rejouée
    again = _chat(client, "tu es sûr ?", contexte=follow[-1]["contexte"])
    assert again[0]["mode"] == "suivi" and again[0]["intention"]["id"] == "interactions_medicament"


def test_chat_modes_guide_navigation_general(client):
    guide = _chat(client, "Comment ajouter un patient ?")
    assert guide[0]["mode"] == "guide" and guide[0]["guide"][0]["chemin"] == "/admin/patients/nouveau"
    assert "](/admin/patients/nouveau)" in guide[1]["text"]
    nav = _chat(client, "Ouvre la page des pharmacies")
    assert nav[0]["mode"] == "navigation" and nav[0]["navigation"]["chemin"] == "/admin/pharmacies"
    # salutation : jamais de relance de la question précédente, même avec un contexte
    hello = _chat(client, "bonjour", contexte={"entite": {"id": "Med_Aspirine"}, "intention": "fiche"})
    assert hello[0]["mode"] == "general" and hello[-1]["modele"] is None
    # fiche d'un élément
    fiche = _chat(client, "Parle-moi de la migraine")
    assert fiche[0]["intention"]["id"] == "fiche" and "Céphalée" in fiche[1]["text"]


def test_chat_status(client):
    assert client.get("/api/chat/statut").json()["disponible"] is False


def test_patient_synthesis_stream(client):
    with client.stream("POST", "/api/chat/synthese/patients/Pat_SalmaTrabelsi") as r:
        events = [json.loads(l) for l in r.iter_lines()]
    assert events[0]["type"] == "donnees" and "Grossesse" in events[0]["texte"]
    assert events[-1]["type"] == "fin"
    assert client.post("/api/chat/synthese/patients/Inconnu").status_code == 404

from rdflib import Graph

from app.core.graph_store import store


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


# ---------- Module 1 : médicaments ----------

def test_list_search_and_filter_medicaments(client):
    assert len(client.get("/api/medicaments").json()) == 13
    assert [m["nom"] for m in client.get("/api/medicaments", params={"q": "dolip"}).json()] == ["Doliprane"]
    noms = {m["nom"] for m in client.get("/api/medicaments", params={"maladie": "Mal_Migraine"}).json()}
    assert noms == {"Aspirine", "Doliprane", "Advil", "Imigrane", "Avlocardyl"}
    gsk = {m["nom"] for m in client.get("/api/medicaments", params={"laboratoire": "Lab_GSK"}).json()}
    assert gsk == {"Clamoxyl", "Augmentin", "Ventoline", "Imigrane"}


def test_medicament_crud_persists_to_owl(client):
    payload = {
        "nom": 'Test "Forte" 500', "dosage": "500 mg", "formeGalenique": "Comprimé",
        "laboratoireId": "Lab_Sanofi", "moleculeIds": ["Mol_Paracetamol"], "maladieIds": ["Mal_Fievre"],
        "contreIndicationIds": ["Mal_InsuffisanceHepatique", "Cond_Grossesse"], "interactionIds": ["Med_Coumadine"],
    }
    created = client.post("/api/medicaments", json=payload)
    assert created.status_code == 201, created.text
    med = created.json()
    assert med["nom"] == 'Test "Forte" 500'
    assert {c["type"] for c in med["contreIndications"]} == {"Maladie", "ConditionPhysiologique"}

    # L'interaction symétrique est visible depuis l'autre médicament
    coumadine = client.get("/api/medicaments/Med_Coumadine").json()
    assert med["id"] in {i["id"] for i in coumadine["interactions"]}

    # Persistance : le fichier OWL relu contient le nouvel individu
    reloaded = Graph().parse(str(store.path), format="xml")
    assert any(str(s).endswith(med["id"]) for s in reloaded.subjects())

    payload.update(nom="Test modifié", interactionIds=[], contreIndicationIds=[])
    updated = client.put(f"/api/medicaments/{med['id']}", json=payload).json()
    assert updated["nom"] == "Test modifié" and updated["interactions"] == [] and updated["contreIndications"] == []
    coumadine = client.get("/api/medicaments/Med_Coumadine").json()
    assert med["id"] not in {i["id"] for i in coumadine["interactions"]}

    assert client.delete(f"/api/medicaments/{med['id']}").status_code == 204
    assert client.get(f"/api/medicaments/{med['id']}").status_code == 404


def test_medicament_validation(client):
    assert client.post("/api/medicaments", json={"nom": ""}).status_code == 422
    bad_ref = client.post("/api/medicaments", json={"nom": "X", "moleculeIds": ["Mal_Migraine"]})
    assert bad_ref.status_code == 422
    injection = client.post("/api/medicaments", json={"nom": "X", "moleculeIds": ["a> ?p ?o } ; DROP ALL ; #"]})
    assert injection.status_code == 422


def test_delete_medicament_used_in_prescription_is_refused(client):
    r = client.delete("/api/medicaments/Med_Aspirine")
    assert r.status_code == 409
    assert "Presc_005" in r.json()["prescriptions"]


# ---------- Module 2 : patients ----------

def test_patient_crud(client):
    payload = {"prenom": "Test", "nom": "Patient", "age": 40, "sexe": "F",
               "maladieIds": ["Mal_Asthme"], "conditionIds": ["Cond_Grossesse"], "allergieIds": ["Mol_Ibuprofene"]}
    p = client.post("/api/patients", json=payload).json()
    assert p["nomComplet"] == "Test Patient" and p["age"] == 40
    assert [m["id"] for m in client.get("/api/patients", params={"q": "test pat"}).json()] == [p["id"]]
    payload.update(age=41, maladieIds=[])
    p2 = client.put(f"/api/patients/{p['id']}", json=payload).json()
    assert p2["age"] == 41 and p2["maladies"] == []
    assert client.delete(f"/api/patients/{p['id']}").status_code == 204
    assert client.post("/api/patients", json={**payload, "age": -1}).status_code == 422


def test_patient_age_filter(client):
    ages = [p["age"] for p in client.get("/api/patients", params={"ageMin": 60}).json()]
    assert ages and all(a >= 60 for a in ages)


def test_delete_patient_with_prescriptions_is_refused(client):
    assert client.delete("/api/patients/Pat_AhmedBenAli").status_code == 409


# ---------- Module 3 : prescriptions ----------

def test_prescription_risks(client):
    detail = client.get("/api/prescriptions/Presc_005").json()
    types = {r["type"] for r in detail["analyseRisques"]["risques"]}
    assert types == {"CONTRE_INDICATION", "INTERACTION"}
    assert client.get("/api/prescriptions/Presc_006").json()["nbRisques"] == 0


def test_check_risks_draft(client):
    r = client.post("/api/prescriptions/verifier-risques",
                    json={"patientId": "Pat_InesJaziri", "medicamentIds": ["Med_Clamoxyl", "Med_Augmentin"]}).json()
    assert {x["type"] for x in r["risques"]} == {"ALLERGIE", "REDONDANCE"}


def test_prescription_crud(client):
    payload = {"patientId": "Pat_KarimJebali", "medecinId": "Doc_AmelFerchichi",
               "medicamentIds": ["Med_Aspirine"], "datePrescription": "2026-10-20", "posologie": "1/j", "dureeJours": 3}
    p = client.post("/api/prescriptions", json=payload).json()
    # Karim est asthmatique et allergique à l'acide acétylsalicylique
    assert {r["type"] for r in p["analyseRisques"]["risques"]} == {"CONTRE_INDICATION", "ALLERGIE"}
    payload["medicamentIds"] = ["Med_Ventoline"]
    assert client.put(f"/api/prescriptions/{p['id']}", json=payload).json()["nbRisques"] == 0
    assert client.delete(f"/api/prescriptions/{p['id']}").status_code == 204
    assert client.post("/api/prescriptions", json={**payload, "medecinId": "Pat_KarimJebali"}).status_code == 422


# ---------- Module 4 : NLP ----------

def test_nlp_core_intents(client):
    cases = {
        "Quels médicaments traitent la migraine ?": "traitement_maladie",
        "Quelles sont les contre-indications de l'aspirine ?": "contre_indications_medicament",
        "Quels patients souffrent de migraine ?": "patients_condition",
        "Qu'est-ce qui soigne la migrane ?": "traitement_maladie",
        "Qui a de l'asthme ?": "patients_condition",
        "Quels médicaments éviter pendant la grossesse ?": "contre_indiques_condition",
    }
    for question, intent in cases.items():
        r = client.post("/api/nlp/query", json={"question": question}).json()
        assert r["compris"], question
        assert r["intention"]["id"] == intent, question
        assert r["resultats"], question
        assert "SELECT" in r["sparql"]


def test_nlp_not_understood(client):
    r = client.post("/api/nlp/query", json={"question": "Bonjour, il fait beau"}).json()
    assert r["compris"] is False and r["suggestions"]


def test_sparql_console_is_read_only(client):
    ok = client.post("/api/sparql", json={"query": "PREFIX nx: <http://www.nexora.org/ontologie/pharma#> "
                                                    "SELECT ?m WHERE { ?m a nx:Medicament }"})
    assert ok.status_code == 200 and len(ok.json()["resultats"]) == 13
    assert client.post("/api/sparql", json={"query": "DELETE WHERE { ?s ?p ?o }"}).status_code == 422


# ---------- API IA ----------

def test_ia_similar_medicaments(client):
    r = client.get("/api/ia/medicaments/Med_Clamoxyl/similaires").json()
    assert r["similaires"][0]["id"] == "Med_Augmentin"  # même molécule (amoxicilline) et même indication
    assert any("Amoxicilline" in p for p in r["similaires"][0]["pointsCommuns"])


def test_ia_recommendations_exclude_unsafe(client):
    r = client.get("/api/ia/patients/Pat_SalmaTrabelsi/recommandations").json()
    migraine = next(x for x in r["recommandations"] if x["maladie"]["id"] == "Mal_Migraine")
    recommandes = {m["id"] for m in migraine["recommandes"]}
    exclus = {m["id"] for m in migraine["exclus"]}
    # Salma : asthme + grossesse → Aspirine, Advil (grossesse) et Avlocardyl (asthme) exclus
    assert {"Med_Aspirine", "Med_Advil", "Med_Avlocardyl"} <= exclus
    assert "Med_Doliprane" in recommandes


def test_ia_alternatives(client):
    r = client.post("/api/ia/alternatives",
                    json={"patientId": "Pat_AhmedBenAli", "medicamentIds": ["Med_Imigrane"]}).json()
    alt = r["remplacements"][0]
    assert alt["medicament"]["id"] == "Med_Imigrane"
    assert alt["alternatives"] and all(a["id"] != "Med_Imigrane" for a in alt["alternatives"])


def test_ia_public_checker(client):
    r = client.post("/api/ia/verificateur", json={"medicamentIds": ["Med_Aspirine", "Med_Coumadine"],
                                                  "conditionIds": ["Cond_Grossesse"], "allergieIds": []}).json()
    assert {x["type"] for x in r["risques"]} == {"CONTRE_INDICATION", "INTERACTION"}


# ---------- Ontologie et statistiques ----------

def test_ontology_schema_and_graph(client):
    schema = client.get("/api/ontologie/schema").json()
    assert {"nx:Patient", "nx:Medicament"} <= {c["id"] for c in schema["classes"]}
    assert any(a["axiome"] == "owl:disjointWith" for a in schema["axiomes"])
    graph = client.get("/api/ontologie/graphe/Med_Aspirine").json()
    assert {"Mal_Migraine", "Lab_Bayer", "Presc_005"} <= {n["id"] for n in graph["nodes"]}


def test_stats_charts(client):
    s = client.get("/api/stats").json()
    assert s["classes"]["Medicament"] >= 13
    assert s["graphiques"]["patientsParMaladie"] and s["graphiques"]["risquesParType"]


# ---------- Liaison avec Protégé ----------

def test_external_edit_is_reloaded(client):
    """Un enregistrement fait dans Protégé (fichier modifié sur le disque) est vu immédiatement par l'API."""
    import os
    from rdflib import OWL, RDF, RDFS, XSD, Graph, Literal, Namespace

    nx = Namespace("http://www.nexora.org/ontologie/pharma#")
    g = Graph().parse(str(store.path), format="xml")
    s = nx.Med_DepuisProtege
    for t in [(s, RDF.type, OWL.NamedIndividual), (s, RDF.type, nx.Medicament),
              (s, nx.nom, Literal("DepuisProtege", datatype=XSD.string)), (s, RDFS.label, Literal("DepuisProtege"))]:
        g.add(t)
    g.serialize(str(store.path), format="xml")
    st = os.stat(store.path)
    os.utime(store.path, ns=(st.st_atime_ns, st.st_mtime_ns + 1_000_000))  # garantit une date différente

    assert [m["id"] for m in client.get("/api/medicaments", params={"q": "depuisprot"}).json()] == ["Med_DepuisProtege"]
    info = client.get("/api/ontologie/fichier").json()
    assert info["rechargementsAuto"] >= 1 and info["erreur"] is None
    assert client.delete("/api/medicaments/Med_DepuisProtege").status_code == 204


def test_created_individual_has_label(client):
    p = client.post("/api/patients", json={"prenom": "Label", "nom": "Test", "age": 30, "sexe": "M"}).json()
    g = Graph().parse(str(store.path), format="xml")
    from rdflib import RDFS, URIRef
    assert str(g.value(URIRef("http://www.nexora.org/ontologie/pharma#" + p["id"]), RDFS.label)) == "Label Test"
    client.delete(f"/api/patients/{p['id']}")


# ---------- Toutes les routes de lecture, avec les paramètres envoyés par le front-end ----------

def test_every_read_route_answers_200(client):
    """Les pages appellent ces routes avec des paramètres vides ou remplis : aucune ne doit renvoyer 500."""
    routes = [
        ("/api/health", {}), ("/api/references", {}), ("/api/stats", {}), ("/api/nlp/exemples", {}),
        ("/api/medicaments", {}), ("/api/medicaments", {"q": "a", "maladie": "Mal_Migraine", "molecule": "Mol_Ibuprofene",
                                                        "laboratoire": "Lab_Pfizer"}),
        ("/api/medicaments/Med_Aspirine", {}),
        ("/api/patients", {}), ("/api/patients", {"q": "a", "maladie": "Mal_Asthme", "condition": "Cond_Grossesse",
                                                  "ageMin": 18, "ageMax": 39}),
        ("/api/patients/Pat_AhmedBenAli", {}),
        ("/api/prescriptions", {}), ("/api/prescriptions", {"q": "khelifi"}),
        ("/api/prescriptions", {"patient": "Pat_AhmedBenAli", "medecin": "Doc_RimKhelifi", "risque": "true"}),
        ("/api/prescriptions", {"risque": "false"}), ("/api/prescriptions", {"medicament": "Med_Aspirine"}),
        ("/api/prescriptions/Presc_001", {}),
        ("/api/ia/medicaments/Med_Advil/similaires", {}), ("/api/ia/patients/Pat_SalmaTrabelsi/recommandations", {}),
        ("/api/ontologie/schema", {}), ("/api/ontologie/graphe/Pat_AhmedBenAli", {}), ("/api/ontologie/fichier", {}),
        ("/api/sparql/prefixes", {}),
    ]
    for path, params in routes:
        r = client.get(path, params=params)
        assert r.status_code == 200, f"{path} {params} → {r.status_code} {r.text[:200]}"
    # filtres combinés : résultat cohérent
    assert [p["id"] for p in client.get("/api/prescriptions", params={"q": "khelifi", "risque": "true"}).json()] == ["Presc_002", "Presc_001"]
    assert client.get("/api/medicaments/Inconnu").status_code == 404
    assert client.get("/api/prescriptions", params={"patient": "pas valide !"}).status_code == 422

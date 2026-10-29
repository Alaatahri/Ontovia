"""Module 3 — Prescriptions : requêtes SPARQL de lecture et de mise à jour."""
from __future__ import annotations

from rdflib import URIRef

from app.core.common import create_individual, delete_individual, group_refs, ref, replace_properties, resolve_refs, subject_iri
from app.core.errors import ConflictError
from app.core.graph_store import cached, store
from app.core.rdf import NX, date_lit, int_lit, iri, local_id, new_id, string_lit, to_python, values_block
from app.modules.prescriptions.risks import detect_risks, detect_risks_all
from app.modules.prescriptions.schemas import PrescriptionIn, RisqueCheckIn

BASE_QUERY = """
SELECT ?presc ?date ?posologie ?duree ?pat ?patPrenom ?patNom ?doc ?docPrenom ?docNom ?docSpecialite
       ?statut ?pharm ?pharmNom ?dateDeliv WHERE {{
  ?presc a nx:Prescription .
  OPTIONAL {{ ?presc nx:statut ?statut }}
  OPTIONAL {{ ?presc nx:dateDelivrance ?dateDeliv }}
  OPTIONAL {{ ?presc nx:delivreePar ?pharm . ?pharm nx:nom ?pharmNom }}
  OPTIONAL {{ ?presc nx:datePrescription ?date }}
  OPTIONAL {{ ?presc nx:posologie ?posologie }}
  OPTIONAL {{ ?presc nx:dureeJours ?duree }}
  OPTIONAL {{ ?presc nx:concernePatient ?pat .
             ?pat nx:nom ?patNom .
             OPTIONAL {{ ?pat nx:prenom ?patPrenom }} }}
  OPTIONAL {{ ?presc nx:prescritePar ?doc .
             ?doc nx:nom ?docNom .
             OPTIONAL {{ ?doc nx:prenom ?docPrenom }}
             OPTIONAL {{ ?doc nx:specialite ?docSpecialite }} }}
  {filters}
}}
ORDER BY DESC(?date) ?presc
"""

MEDICAMENTS_QUERY = """
SELECT ?s ?t ?tNom WHERE {{
  {values}
  ?s nx:prescritMedicament ?t .
  OPTIONAL {{ ?t nx:nom ?tNom }}
}}
"""

EN_ATTENTE, DELIVREE = "En attente", "Délivrée"
MANAGED_PREDICATES = [NX.concernePatient, NX.prescritePar, NX.prescritMedicament, NX.datePrescription,
                      NX.posologie, NX.dureeJours]


def _full_name(prenom, nom) -> str:
    return " ".join(str(to_python(x)) for x in (prenom, nom) if x is not None)


def _serialize(row: dict, meds: dict, with_risks: bool) -> dict:
    medicaments = meds.get(local_id(row["presc"]), {}).get("rel", [])
    result = {
        "id": local_id(row["presc"]),
        "datePrescription": to_python(row.get("date")),
        "posologie": to_python(row.get("posologie")),
        "dureeJours": to_python(row.get("duree")),
        "patient": {"id": local_id(row["pat"]), "nom": _full_name(row.get("patPrenom"), row.get("patNom"))}
        if row.get("pat") is not None else None,
        "medecin": {
            "id": local_id(row["doc"]),
            "nom": "Dr " + _full_name(row.get("docPrenom"), row.get("docNom")),
            "specialite": to_python(row.get("docSpecialite")),
        } if row.get("doc") is not None else None,
        "medicaments": medicaments,
        "statut": to_python(row.get("statut")) or EN_ATTENTE,
        "pharmacie": ref(row["pharm"], row.get("pharmNom")) if row.get("pharm") is not None else None,
        "dateDelivrance": to_python(row.get("dateDeliv")),
    }
    if with_risks:
        # Fiche détaillée : analyse complète avec les requêtes SPARQL affichées dans l'interface
        if row.get("pat") is not None and medicaments:
            analyse = detect_risks(row["pat"], [iri(m["id"]) for m in medicaments])
        else:
            analyse = {"risques": [], "methode": "", "avertissement": "", "requetes": []}
        result["analyseRisques"] = analyse
        result["nbRisques"] = len(analyse["risques"])
    else:
        # Liste : comptage issu de la détection groupée (4 requêtes pour toutes les prescriptions)
        result["nbRisques"] = len(detect_risks_all().get(result["id"], []))
    return result


def _medicaments(subjects: list[URIRef]) -> dict:
    if not subjects:
        return {}
    return group_refs(store.select(MEDICAMENTS_QUERY.format(values=values_block("s", subjects))))


@cached
def list_prescriptions(q: str | None = None, patient: str | None = None, medecin: str | None = None,
                       medicament: str | None = None, risque: bool | None = None,
                       statut: str | None = None) -> list[dict]:
    filters, bindings = [], {}
    if q:
        filters.append(
            'FILTER(CONTAINS(LCASE(CONCAT(COALESCE(STR(?patPrenom), ""), " ", COALESCE(STR(?patNom), ""), " ", '
            'COALESCE(STR(?docPrenom), ""), " ", COALESCE(STR(?docNom), ""))), LCASE(?q)))'
        )
        bindings["q"] = string_lit(q)
    if patient:
        filters.append("?presc nx:concernePatient ?patientFiltre .")
        bindings["patientFiltre"] = iri(patient)
    if medecin:
        filters.append("?presc nx:prescritePar ?medecinFiltre .")
        bindings["medecinFiltre"] = iri(medecin)
    if medicament:
        filters.append("?presc nx:prescritMedicament ?medicament .")
        bindings["medicament"] = iri(medicament)
    rows = store.select(BASE_QUERY.format(filters="\n  ".join(filters)), bindings)
    meds = _medicaments([row["presc"] for row in rows])
    results = [_serialize(row, meds, with_risks=False) for row in rows]
    if risque is not None:
        results = [r for r in results if (r["nbRisques"] > 0) == risque]
    if statut:
        results = [r for r in results if r["statut"] == statut]
    return results


def get_prescription(presc_id: str) -> dict:
    uri = subject_iri(presc_id, "Prescription", "Prescription")
    row = store.select(BASE_QUERY.format(filters=""), {"presc": uri})[0]
    return _serialize(row, _medicaments([uri]), with_risks=True)


def _triples(uri: URIRef, data: PrescriptionIn) -> list[tuple]:
    patient = resolve_refs([data.patientId], "Patient", "patientId")[0]
    medecin = resolve_refs([data.medecinId], "Medecin", "medecinId")[0]
    medicaments = resolve_refs(data.medicamentIds, "Medicament", "medicamentIds")
    triples = [
        (uri, NX.concernePatient, patient),
        (uri, NX.prescritePar, medecin),
        (uri, NX.datePrescription, date_lit(data.datePrescription)),
        *((uri, NX.prescritMedicament, m) for m in medicaments),
    ]
    if data.posologie:
        triples.append((uri, NX.posologie, string_lit(data.posologie)))
    if data.dureeJours:
        triples.append((uri, NX.dureeJours, int_lit(data.dureeJours)))
    return triples


def create_prescription(data: PrescriptionIn) -> dict:
    uri = iri(new_id("Presc", data.datePrescription.strftime("%Y%m%d")))
    create_individual(uri, "Prescription", [*_triples(uri, data), (uri, NX.statut, string_lit(EN_ATTENTE))])
    return get_prescription(local_id(uri))


def update_prescription(presc_id: str, data: PrescriptionIn) -> dict:
    uri = subject_iri(presc_id, "Prescription", "Prescription")
    if get_prescription(presc_id)["statut"] == DELIVREE:
        raise ConflictError("Une ordonnance déjà délivrée ne peut plus être modifiée. Annulez d'abord la délivrance.")
    replace_properties(uri, MANAGED_PREDICATES, _triples(uri, data))
    return get_prescription(presc_id)


def delete_prescription(presc_id: str) -> None:
    # Une prescription n'est la cible d'aucune relation : on retire simplement ses triplets.
    delete_individual(subject_iri(presc_id, "Prescription", "Prescription"))


def check_risks(data: RisqueCheckIn) -> dict:
    """Analyse d'un brouillon de prescription (utilisée en direct par le formulaire)."""
    patient = resolve_refs([data.patientId], "Patient", "patientId")[0]
    medicaments = resolve_refs(data.medicamentIds, "Medicament", "medicamentIds")
    names = {local_id(r["s"]): ref(r["s"], r["n"]) for r in
             store.select(f"SELECT ?s ?n WHERE {{ {values_block('s', medicaments)} ?s nx:nom ?n }}")}
    result = detect_risks(patient, medicaments)
    result["medicaments"] = list(names.values())
    return result


# ---------- Métier avancé : délivrance en pharmacie ----------

DISPONIBILITE_QUERY = """
SELECT ?pharm ?pharmNom ?ville ?horaires ?m ?mNom ?dispo WHERE {{
  {meds}
  ?pharm a nx:Pharmacie ; nx:nom ?pharmNom .
  OPTIONAL {{ ?pharm nx:ville ?ville }}
  OPTIONAL {{ ?pharm nx:horaires ?horaires }}
  ?m nx:nom ?mNom .
  BIND(EXISTS {{ ?pharm nx:disposeDe ?m }} AS ?dispo)
}}
"""


def pharmacies_disponibilite(medicament_ids: list[str]) -> list[dict]:
    """Pour chaque pharmacie : médicaments disponibles / manquants parmi la liste demandée."""
    meds = resolve_refs(medicament_ids, "Medicament", "medicaments")
    if not meds:
        return []
    by_pharm: dict[str, dict] = {}
    for r in store.select(DISPONIBILITE_QUERY.format(meds=values_block("m", meds))):
        pid = local_id(r["pharm"])
        entry = by_pharm.setdefault(pid, {"id": pid, "nom": to_python(r["pharmNom"]), "ville": to_python(r.get("ville")),
                                          "horaires": to_python(r.get("horaires")), "disponibles": [], "manquants": []})
        bucket = "disponibles" if to_python(r["dispo"]) else "manquants"
        entry[bucket].append({"id": local_id(r["m"]), "nom": to_python(r["mNom"])})
    result = list(by_pharm.values())
    for e in result:
        e["complete"] = not e["manquants"]
    result.sort(key=lambda e: (not e["complete"], -len(e["disponibles"]), e["nom"]))
    return result


def pharmacies_pour_prescription(presc_id: str) -> list[dict]:
    p = get_prescription(presc_id)
    return pharmacies_disponibilite([m["id"] for m in p["medicaments"]])


def delivrer(presc_id: str, pharmacie_id: str, date, forcer: bool = False) -> dict:
    """Délivre l'ordonnance dans une pharmacie. Règles métier :
    - une ordonnance n'est délivrée qu'une fois ;
    - la pharmacie doit disposer de tous les médicaments prescrits (nx:disposeDe) ;
    - si un risque est détecté, le pharmacien doit confirmer explicitement (pharmacovigilance)."""
    uri = subject_iri(presc_id, "Prescription", "Prescription")
    pharmacie = resolve_refs([pharmacie_id], "Pharmacie", "pharmacieId")[0]
    p = get_prescription(presc_id)
    if p["statut"] == DELIVREE:
        par = p["pharmacie"]["nom"] if p["pharmacie"] else "une pharmacie"
        raise ConflictError(f"Cette ordonnance a déjà été délivrée par {par}.")
    dispo = next(e for e in pharmacies_disponibilite([m["id"] for m in p["medicaments"]]) if e["id"] == pharmacie_id)
    if dispo["manquants"]:
        raise ConflictError(f"{dispo['nom']} ne dispose pas de : {', '.join(m['nom'] for m in dispo['manquants'])}.",
                            {"manquants": [m["id"] for m in dispo["manquants"]]})
    if p["nbRisques"] and not forcer:
        raise ConflictError(f"Cette ordonnance présente {p['nbRisques']} risque(s) détecté(s). "
                            "Confirmez la délivrance après vérification.", {"confirmationRequise": True})
    replace_properties(uri, [NX.statut, NX.delivreePar, NX.dateDelivrance], [
        (uri, NX.statut, string_lit(DELIVREE)), (uri, NX.delivreePar, pharmacie), (uri, NX.dateDelivrance, date_lit(date)),
    ])
    return get_prescription(presc_id)


def annuler_delivrance(presc_id: str) -> dict:
    uri = subject_iri(presc_id, "Prescription", "Prescription")
    replace_properties(uri, [NX.statut, NX.delivreePar, NX.dateDelivrance], [(uri, NX.statut, string_lit(EN_ATTENTE))])
    return get_prescription(presc_id)

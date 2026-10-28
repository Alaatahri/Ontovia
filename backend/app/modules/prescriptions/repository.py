"""Module 3 — Prescriptions : requêtes SPARQL de lecture et de mise à jour."""
from __future__ import annotations

from rdflib import URIRef

from app.core.common import create_individual, delete_individual, group_refs, ref, replace_properties, resolve_refs, subject_iri
from app.core.graph_store import cached, store
from app.core.rdf import NX, date_lit, int_lit, iri, local_id, new_id, string_lit, to_python, values_block
from app.modules.prescriptions.risks import detect_risks, detect_risks_all
from app.modules.prescriptions.schemas import PrescriptionIn, RisqueCheckIn

BASE_QUERY = """
SELECT ?presc ?date ?posologie ?duree ?pat ?patPrenom ?patNom ?doc ?docPrenom ?docNom ?docSpecialite WHERE {{
  ?presc a nx:Prescription .
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
                       medicament: str | None = None, risque: bool | None = None) -> list[dict]:
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
    create_individual(uri, "Prescription", _triples(uri, data))
    return get_prescription(local_id(uri))


def update_prescription(presc_id: str, data: PrescriptionIn) -> dict:
    uri = subject_iri(presc_id, "Prescription", "Prescription")
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

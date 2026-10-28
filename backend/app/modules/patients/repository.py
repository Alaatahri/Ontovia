"""Module 2 — Patients : requêtes SPARQL de lecture et de mise à jour."""
from __future__ import annotations

from rdflib import URIRef

from app.core.common import create_individual, delete_individual, group_refs, replace_properties, resolve_refs, subject_iri
from app.core.errors import ConflictError
from app.core.graph_store import store
from app.core.rdf import NX, int_lit, iri, local_id, new_id, string_lit, to_python, values_block
from app.modules.patients.schemas import PatientIn

BASE_QUERY = """
SELECT ?p ?prenom ?nom ?age ?sexe WHERE {{
  ?p a nx:Patient ;
     nx:nom ?nom .
  OPTIONAL {{ ?p nx:prenom ?prenom }}
  OPTIONAL {{ ?p nx:age ?age }}
  OPTIONAL {{ ?p nx:sexe ?sexe }}
  {filters}
}}
ORDER BY LCASE(STR(?nom)) LCASE(STR(?prenom))
"""

RELATIONS_QUERY = """
SELECT ?s ?rel ?t ?tNom WHERE {{
  {values}
  {{ ?s nx:souffreDe ?t . BIND("maladies" AS ?rel) }}
  UNION {{ ?s nx:presenteCondition ?t . BIND("conditions" AS ?rel) }}
  UNION {{ ?s nx:estAllergiqueA ?t . BIND("allergies" AS ?rel) }}
  OPTIONAL {{ ?t nx:nom ?tNom }}
}}
"""

PRESCRIPTIONS_QUERY = """
SELECT ?presc ?date ?medecin ?medecinNom WHERE {
  ?presc a nx:Prescription ;
         nx:concernePatient ?p .
  OPTIONAL { ?presc nx:datePrescription ?date }
  OPTIONAL { ?presc nx:prescritePar ?medecin . ?medecin nx:nom ?medecinNom }
}
ORDER BY DESC(?date)
"""

RELATION_KEYS = ("maladies", "conditions", "allergies")
MANAGED_PREDICATES = [NX.prenom, NX.nom, NX.age, NX.sexe, NX.souffreDe, NX.presenteCondition, NX.estAllergiqueA]


def _serialize(row: dict, relations: dict) -> dict:
    rels = relations.get(local_id(row["p"]), {})
    prenom, nom = to_python(row.get("prenom")), to_python(row["nom"])
    return {
        "id": local_id(row["p"]),
        "prenom": prenom,
        "nom": nom,
        "nomComplet": " ".join(x for x in (prenom, nom) if x),
        "age": to_python(row.get("age")),
        "sexe": to_python(row.get("sexe")),
        **{key: rels.get(key, []) for key in RELATION_KEYS},
    }


def _relations(subjects: list[URIRef]) -> dict:
    if not subjects:
        return {}
    return group_refs(store.select(RELATIONS_QUERY.format(values=values_block("s", subjects))))


def list_patients(q: str | None = None, maladie: str | None = None, condition: str | None = None,
                  age_min: int | None = None, age_max: int | None = None) -> list[dict]:
    filters, bindings = [], {}
    if q:
        filters.append("FILTER(CONTAINS(LCASE(CONCAT(COALESCE(STR(?prenom), \"\"), \" \", STR(?nom))), LCASE(?q)))")
        bindings["q"] = string_lit(q)
    if maladie:
        filters.append("?p nx:souffreDe ?maladie .")
        bindings["maladie"] = iri(maladie)
    if condition:
        filters.append("?p nx:presenteCondition ?condition .")
        bindings["condition"] = iri(condition)
    if age_min is not None:
        filters.append("FILTER(?age >= ?ageMin)")
        bindings["ageMin"] = int_lit(age_min)
    if age_max is not None:
        filters.append("FILTER(?age <= ?ageMax)")
        bindings["ageMax"] = int_lit(age_max)
    rows = store.select(BASE_QUERY.format(filters="\n  ".join(filters)), bindings)
    relations = _relations([row["p"] for row in rows])
    return [_serialize(row, relations) for row in rows]


def _prescriptions(uri: URIRef) -> list[dict]:
    return [
        {
            "id": local_id(r["presc"]),
            "date": to_python(r.get("date")),
            "medecin": to_python(r.get("medecinNom")),
        }
        for r in store.select(PRESCRIPTIONS_QUERY, {"p": uri})
    ]


def get_patient(patient_id: str) -> dict:
    uri = subject_iri(patient_id, "Patient", "Patient")
    row = store.select(BASE_QUERY.format(filters=""), {"p": uri})[0]
    result = _serialize(row, _relations([uri]))
    result["prescriptions"] = _prescriptions(uri)
    return result


def _triples(uri: URIRef, data: PatientIn) -> list[tuple]:
    triples = [
        (uri, NX.prenom, string_lit(data.prenom)),
        (uri, NX.nom, string_lit(data.nom)),
        (uri, NX.age, int_lit(data.age)),
        (uri, NX.sexe, string_lit(data.sexe)),
    ]
    relations = [
        (data.maladieIds, "Maladie", "maladieIds", NX.souffreDe),
        (data.conditionIds, "ConditionPhysiologique", "conditionIds", NX.presenteCondition),
        (data.allergieIds, "Molecule", "allergieIds", NX.estAllergiqueA),
    ]
    for ids, cls, field, pred in relations:
        triples.extend((uri, pred, t) for t in resolve_refs(ids, cls, field))
    return triples


def create_patient(data: PatientIn) -> dict:
    uri = iri(new_id("Pat", data.prenom, data.nom))
    create_individual(uri, "Patient", _triples(uri, data))
    return get_patient(local_id(uri))


def update_patient(patient_id: str, data: PatientIn) -> dict:
    uri = subject_iri(patient_id, "Patient", "Patient")
    replace_properties(uri, MANAGED_PREDICATES, _triples(uri, data))
    return get_patient(patient_id)


def delete_patient(patient_id: str) -> None:
    uri = subject_iri(patient_id, "Patient", "Patient")
    prescriptions = _prescriptions(uri)
    if prescriptions:
        ids = [p["id"] for p in prescriptions]
        raise ConflictError(
            f"Ce patient possède {len(ids)} prescription(s) : {', '.join(ids)}. "
            "Supprimez-les avant de supprimer le patient.",
            {"prescriptions": ids},
        )
    delete_individual(uri)

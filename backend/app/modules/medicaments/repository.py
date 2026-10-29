"""Module 1 — Médicaments : requêtes SPARQL de lecture et de mise à jour."""
from __future__ import annotations

from rdflib import URIRef

from app.core.common import (create_individual, delete_individual, group_refs, ref, replace_properties,
                             resolve_refs, subject_iri)
from app.core.errors import ConflictError
from app.core.graph_store import store
from app.core.rdf import NX, iri, local_id, new_id, string_lit, to_python, values_block
from app.modules.medicaments.schemas import MedicamentIn

BASE_QUERY = """
SELECT ?m ?nom ?dosage ?forme ?description ?labo ?laboNom WHERE {{
  ?m a nx:Medicament ;
     nx:nom ?nom .
  OPTIONAL {{ ?m nx:dosage ?dosage }}
  OPTIONAL {{ ?m nx:formeGalenique ?forme }}
  OPTIONAL {{ ?m nx:description ?description }}
  OPTIONAL {{ ?m nx:fabriquePar ?labo . ?labo nx:nom ?laboNom }}
  {filters}
}}
ORDER BY LCASE(STR(?nom))
"""

RELATIONS_QUERY = """
SELECT ?s ?rel ?t ?tNom ?tType WHERE {{
  {values}
  {{ ?s nx:contientMolecule ?t . BIND("molecules" AS ?rel) }}
  UNION {{ ?s nx:traite ?t . BIND("maladies" AS ?rel) }}
  UNION {{ ?s nx:aContreIndication ?t . BIND("contreIndications" AS ?rel)
          OPTIONAL {{ ?t a ?tType . FILTER(?tType IN (nx:Maladie, nx:ConditionPhysiologique)) }} }}
  UNION {{ ?s nx:interagitAvec|^nx:interagitAvec ?t . BIND("interactions" AS ?rel) }}
  OPTIONAL {{ ?t nx:nom ?tNom }}
}}
"""

PRESCRIPTIONS_QUERY = """
SELECT ?p ?date WHERE {
  ?p a nx:Prescription ;
     nx:prescritMedicament ?m .
  OPTIONAL { ?p nx:datePrescription ?date }
}
ORDER BY ?p
"""

PHARMACIES_QUERY = """
SELECT ?ph ?nom ?ville WHERE {
  ?ph a nx:Pharmacie ; nx:disposeDe ?m ; nx:nom ?nom .
  OPTIONAL { ?ph nx:ville ?ville }
}
ORDER BY ?nom
"""

RELATION_KEYS = ("molecules", "maladies", "contreIndications", "interactions")
MANAGED_PREDICATES = [NX.nom, NX.dosage, NX.formeGalenique, NX.description, NX.fabriquePar,
                      NX.contientMolecule, NX.traite, NX.aContreIndication, NX.interagitAvec]


def _serialize(row: dict, relations: dict) -> dict:
    rels = relations.get(local_id(row["m"]), {})
    return {
        "id": local_id(row["m"]),
        "nom": to_python(row["nom"]),
        "dosage": to_python(row.get("dosage")),
        "formeGalenique": to_python(row.get("forme")),
        "description": to_python(row.get("description")),
        "laboratoire": ref(row["labo"], row.get("laboNom")) if row.get("labo") is not None else None,
        **{key: rels.get(key, []) for key in RELATION_KEYS},
    }


def _relations(subjects: list[URIRef]) -> dict:
    if not subjects:
        return {}
    return group_refs(store.select(RELATIONS_QUERY.format(values=values_block("s", subjects))))


def list_medicaments(q: str | None = None, maladie: str | None = None, molecule: str | None = None,
                     laboratoire: str | None = None) -> list[dict]:
    filters, bindings = [], {}
    if q:
        filters.append("FILTER(CONTAINS(LCASE(STR(?nom)), LCASE(?q)))")
        bindings["q"] = string_lit(q)
    if maladie:
        filters.append("?m nx:traite ?maladie .")
        bindings["maladie"] = iri(maladie)
    if molecule:
        filters.append("?m nx:contientMolecule ?molecule .")
        bindings["molecule"] = iri(molecule)
    if laboratoire:
        filters.append("?m nx:fabriquePar ?laboFiltre .")
        bindings["laboFiltre"] = iri(laboratoire)
    rows = store.select(BASE_QUERY.format(filters="\n  ".join(filters)), bindings)
    relations = _relations([row["m"] for row in rows])
    return [_serialize(row, relations) for row in rows]


def get_medicament(med_id: str) -> dict:
    uri = subject_iri(med_id, "Medicament", "Médicament")
    row = store.select(BASE_QUERY.format(filters=""), {"m": uri})[0]
    result = _serialize(row, _relations([uri]))
    prescriptions = store.select(PRESCRIPTIONS_QUERY, {"m": uri})
    result["prescriptions"] = [{"id": local_id(p["p"]), "date": to_python(p.get("date"))} for p in prescriptions]
    result["pharmacies"] = [
        {"id": local_id(r["ph"]), "nom": to_python(r["nom"]), "ville": to_python(r.get("ville"))}
        for r in store.select(PHARMACIES_QUERY, {"m": uri})
    ]
    return result


def _triples(uri: URIRef, data: MedicamentIn) -> list[tuple]:
    triples = [(uri, NX.nom, string_lit(data.nom))]
    for field, pred in (("dosage", NX.dosage), ("formeGalenique", NX.formeGalenique),
                        ("description", NX.description)):
        value = getattr(data, field)
        if value:
            triples.append((uri, pred, string_lit(value)))
    if data.laboratoireId:
        labo = resolve_refs([data.laboratoireId], "Laboratoire", "laboratoireId")[0]
        triples.append((uri, NX.fabriquePar, labo))
    relations = [
        (data.moleculeIds, "Molecule", "moleculeIds", NX.contientMolecule),
        (data.maladieIds, "Maladie", "maladieIds", NX.traite),
        (data.contreIndicationIds, ("Maladie", "ConditionPhysiologique"), "contreIndicationIds",
         NX.aContreIndication),
        ([i for i in data.interactionIds if i != local_id(uri)], "Medicament", "interactionIds",
         NX.interagitAvec),
    ]
    for ids, cls, field, pred in relations:
        triples.extend((uri, pred, t) for t in resolve_refs(ids, cls, field))
    return triples


def create_medicament(data: MedicamentIn) -> dict:
    uri = iri(new_id("Med", data.nom))
    create_individual(uri, "Medicament", _triples(uri, data))
    return get_medicament(local_id(uri))


def update_medicament(med_id: str, data: MedicamentIn) -> dict:
    uri = subject_iri(med_id, "Medicament", "Médicament")
    replace_properties(uri, MANAGED_PREDICATES, _triples(uri, data), incoming=[NX.interagitAvec])
    return get_medicament(med_id)


def delete_medicament(med_id: str) -> None:
    uri = subject_iri(med_id, "Medicament", "Médicament")
    used = store.select(PRESCRIPTIONS_QUERY, {"m": uri})
    if used:
        ids = [local_id(p["p"]) for p in used]
        raise ConflictError(
            f"Ce médicament figure dans {len(ids)} prescription(s) : {', '.join(ids)}. "
            "Retirez-le de ces prescriptions avant de le supprimer.",
            {"prescriptions": ids},
        )
    # Supprime aussi les relations entrantes (interactions déclarées par d'autres médicaments).
    delete_individual(uri)

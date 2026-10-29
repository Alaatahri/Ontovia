"""Listes de référence (pour les sélecteurs des formulaires) et statistiques du graphe (tableau de bord)."""
from fastapi import APIRouter

from app.core.common import ref
from app.core.graph_store import cached, store
from app.core.rdf import to_python

router = APIRouter(prefix="/api", tags=["Références et statistiques"])

REFERENCE_QUERY = """
SELECT ?s ?nom ?prenom ?extra WHERE {{
  {values}
  ?s a ?cls ;
     nx:nom ?nom .
  OPTIONAL {{ ?s nx:prenom ?prenom }}
  OPTIONAL {{ ?s nx:specialite ?extra }}
}}
ORDER BY LCASE(STR(?nom))
"""

REFERENCE_CLASSES = {
    "molecules": "Molecule",
    "maladies": "Maladie",
    "conditions": "ConditionPhysiologique",
    "laboratoires": "Laboratoire",
    "medecins": "Medecin",
    "medicaments": "Medicament",
    "patients": "Patient",
    "pharmacies": "Pharmacie",
    "personnel": ("Pharmacien", "Infirmier"),
}

COUNTS_QUERY = """
SELECT ?classe (COUNT(DISTINCT ?x) AS ?nombre) WHERE {
  VALUES ?classe { nx:Medicament nx:Molecule nx:Maladie nx:ConditionPhysiologique nx:Patient
                   nx:Medecin nx:Prescription nx:Laboratoire nx:Pharmacie nx:Pharmacien nx:Infirmier }
  OPTIONAL { ?x a ?classe }
}
GROUP BY ?classe
"""

PATIENTS_PAR_MALADIE = """
SELECT ?label (COUNT(DISTINCT ?p) AS ?valeur) WHERE {
  ?p a nx:Patient ; nx:souffreDe ?m .
  ?m nx:nom ?label .
}
GROUP BY ?label
ORDER BY DESC(?valeur) ?label
"""

MEDICAMENTS_PAR_LABO = """
SELECT ?label (COUNT(DISTINCT ?m) AS ?valeur) WHERE {
  ?m a nx:Medicament ; nx:fabriquePar ?l .
  ?l nx:nom ?label .
}
GROUP BY ?label
ORDER BY DESC(?valeur) ?label
"""

PRESCRIPTIONS_PAR_MOIS = """
SELECT ?label (COUNT(?p) AS ?valeur) WHERE {
  ?p a nx:Prescription ; nx:datePrescription ?d .
  BIND(SUBSTR(STR(?d), 1, 7) AS ?label)
}
GROUP BY ?label
ORDER BY ?label
"""

MEDICAMENTS_LES_PLUS_PRESCRITS = """
SELECT ?label (COUNT(DISTINCT ?p) AS ?valeur) WHERE {
  ?p a nx:Prescription ; nx:prescritMedicament ?m .
  ?m nx:nom ?label .
}
GROUP BY ?label
ORDER BY DESC(?valeur) ?label
LIMIT 8
"""

PRESCRIPTIONS_PAR_STATUT = """
SELECT ?label (COUNT(?p) AS ?valeur) WHERE {
  ?p a nx:Prescription .
  OPTIONAL { ?p nx:statut ?s }
  BIND(COALESCE(STR(?s), "En attente") AS ?label)
}
GROUP BY ?label
ORDER BY ?label
"""

TRANCHES_AGE = """
SELECT ?label (COUNT(?p) AS ?valeur) WHERE {
  ?p a nx:Patient ; nx:age ?age .
  BIND(IF(?age < 18, "0-17", IF(?age < 40, "18-39", IF(?age < 65, "40-64", "65+"))) AS ?label)
}
GROUP BY ?label
ORDER BY ?label
"""


def _reference_list(cls: str | tuple[str, ...]) -> list[dict]:
    from app.core.rdf import NX, values_block

    classes = (cls,) if isinstance(cls, str) else cls
    items = []
    for row in store.select(REFERENCE_QUERY.format(values=values_block("cls", [NX[c] for c in classes]))):
        prenom = to_python(row.get("prenom"))
        item = ref(row["s"], row["nom"])
        if prenom:
            item["nom"] = f"{'Dr ' if cls == 'Medecin' else ''}{prenom} {item['nom']}"
        if row.get("extra") is not None:
            item["detail"] = to_python(row["extra"])
        items.append(item)
    return items


def _series(query: str) -> list[dict]:
    return [{"label": to_python(r["label"]), "valeur": to_python(r["valeur"])} for r in store.select(query)]


@router.get("/references")
@cached
def references():
    return {key: _reference_list(cls) for key, cls in REFERENCE_CLASSES.items()}


@router.get("/stats")
def stats():
    return _stats()


@cached
def _stats():
    from app.modules.prescriptions.repository import list_prescriptions
    from app.modules.prescriptions.risks import detect_risks_all

    counts = {to_python(r["classe"]): to_python(r["nombre"]) for r in store.select(COUNTS_QUERY)}
    prescriptions = list_prescriptions()
    risques_par_type: dict[str, int] = {}
    for risques in detect_risks_all().values():
        for r in risques:
            risques_par_type[r["type"]] = risques_par_type.get(r["type"], 0) + 1
    return {
        "classes": counts,
        "triplets": len(store.graph),
        "prescriptionsARisque": sum(1 for p in prescriptions if p["nbRisques"] > 0),
        "dernieresPrescriptions": prescriptions[:5],
        "graphiques": {
            "patientsParMaladie": _series(PATIENTS_PAR_MALADIE),
            "medicamentsParLaboratoire": _series(MEDICAMENTS_PAR_LABO),
            "prescriptionsParMois": _series(PRESCRIPTIONS_PAR_MOIS),
            "medicamentsLesPlusPrescrits": _series(MEDICAMENTS_LES_PLUS_PRESCRITS),
            "tranchesAge": _series(TRANCHES_AGE),
            "prescriptionsParStatut": _series(PRESCRIPTIONS_PAR_STATUT),
            "risquesParType": [{"label": k, "valeur": v} for k, v in sorted(risques_par_type.items())],
        },
    }

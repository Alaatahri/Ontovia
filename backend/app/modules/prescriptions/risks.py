"""Détection de risques d'une prescription par requêtes SPARQL.

Il ne s'agit PAS d'une inférence SWRL : chaque risque correspond à une correspondance trouvée
dans le graphe par une requête explicite. L'absence de correspondance ne prouve pas qu'une
prescription est médicalement sûre — seules les connaissances saisies dans l'ontologie sont vérifiées.

Deux modes partagent les mêmes motifs de requête :
- detect_risks(patient, médicaments) : une prescription (ou un brouillon), requêtes renvoyées pour affichage ;
- detect_risks_all() : toutes les prescriptions en 4 requêtes seulement (liste, tableau de bord).
"""
from __future__ import annotations

from collections import defaultdict

from rdflib import URIRef

from app.core.graph_store import cached, store
from app.core.rdf import local_id, to_python, values_block

METHODE = "Détection par requêtes SPARQL sur le graphe de l'ontologie (pas de raisonneur SWRL)."
AVERTISSEMENT = ("L'absence de risque détecté ne garantit pas que la prescription est sûre : "
                 "seules les relations présentes dans l'ontologie sont vérifiées.")

# {scope} restreint les médicaments : soit un bloc VALUES (une prescription), soit « ?p nx:prescritMedicament ?m »
# pour toutes les prescriptions. ?patient est lié par initBindings ou par la prescription.
CONTRE_INDICATION_QUERY = """
SELECT ?p ?m ?mNom ?c ?cNom ?via WHERE {{
  {scope}
  ?m nx:nom ?mNom ;
     nx:aContreIndication ?c .
  ?c nx:nom ?cNom .
  {{ ?patient nx:souffreDe ?c . BIND("maladie" AS ?via) }}
  UNION {{ ?patient nx:presenteCondition ?c . BIND("condition" AS ?via) }}
}}
"""

ALLERGIE_QUERY = """
SELECT ?p ?m ?mNom ?mol ?molNom WHERE {{
  {scope}
  ?m nx:nom ?mNom ;
     nx:contientMolecule ?mol .
  ?patient nx:estAllergiqueA ?mol .
  ?mol nx:nom ?molNom .
}}
"""

INTERACTION_QUERY = """
SELECT ?p ?m1 ?n1 ?m2 ?n2 WHERE {{
  {scope}
  ?m1 nx:interagitAvec ?m2 .
  ?m1 nx:nom ?n1 .
  ?m2 nx:nom ?n2 .
}}
"""

REDONDANCE_QUERY = """
SELECT ?p ?m1 ?n1 ?m2 ?n2 ?mol ?molNom WHERE {{
  {scope}
  ?m1 nx:contientMolecule ?mol ; nx:nom ?n1 .
  ?m2 nx:contientMolecule ?mol ; nx:nom ?n2 .
  ?mol nx:nom ?molNom .
  FILTER(STR(?m1) < STR(?m2))
}}
"""

ALL_SINGLE = "?p a nx:Prescription ; nx:concernePatient ?patient ; nx:prescritMedicament ?m ."
ALL_PAIR = "?p a nx:Prescription ; nx:prescritMedicament ?m1, ?m2 ."


def _ci(r) -> dict:
    nature = "la maladie" if to_python(r["via"]) == "maladie" else "la condition"
    return {
        "type": "CONTRE_INDICATION", "gravite": "elevee", "medicaments": [local_id(r["m"])],
        "explication": f"{to_python(r['mNom'])} est contre-indiqué en cas de « {to_python(r['cNom'])} », "
                       f"or le patient présente {nature} « {to_python(r['cNom'])} ».",
        "relation": "aContreIndication ∩ (souffreDe ∪ presenteCondition)",
    }


def _allergie(r) -> dict:
    return {
        "type": "ALLERGIE", "gravite": "elevee", "medicaments": [local_id(r["m"])],
        "explication": f"{to_python(r['mNom'])} contient « {to_python(r['molNom'])} », "
                       "molécule à laquelle le patient est allergique.",
        "relation": "contientMolecule ∩ estAllergiqueA",
    }


def _interaction(r) -> dict:
    return {
        "type": "INTERACTION", "gravite": "moderee", "medicaments": [local_id(r["m1"]), local_id(r["m2"])],
        "explication": f"Interaction médicamenteuse déclarée entre {to_python(r['n1'])} et {to_python(r['n2'])}.",
        "relation": "interagitAvec (symétrique)",
    }


def _redondance(r) -> dict:
    return {
        "type": "REDONDANCE", "gravite": "moderee", "medicaments": [local_id(r["m1"]), local_id(r["m2"])],
        "explication": f"{to_python(r['n1'])} et {to_python(r['n2'])} contiennent tous deux "
                       f"« {to_python(r['molNom'])} » (risque de surdosage).",
        "relation": "contientMolecule partagée",
    }


def _pair_rows(rows):
    """Une interaction déclarée dans les deux sens n'est comptée qu'une fois."""
    seen: set = set()
    for r in rows:
        key = (r.get("p"), frozenset((r["m1"], r["m2"])))
        if r["m1"] == r["m2"] or key in seen:
            continue
        seen.add(key)
        yield r


def detect_risks(patient: URIRef | None, medicaments: list[URIRef]) -> dict:
    """Risques d'une prescription (ou d'un brouillon). `patient` peut être None : seules les interactions
    et redondances sont alors vérifiées."""
    meds = values_block("m", medicaments)
    pairs = values_block("m1", medicaments) + "\n  " + values_block("m2", medicaments)
    risques: list[dict] = []
    queries: list[str] = []

    if patient is not None:
        bindings = {"patient": patient}
        ci_query = CONTRE_INDICATION_QUERY.format(scope=meds)
        allergie_query = ALLERGIE_QUERY.format(scope=meds)
        queries += [ci_query.strip(), allergie_query.strip()]
        risques += [_ci(r) for r in store.select(ci_query, bindings)]
        risques += [_allergie(r) for r in store.select(allergie_query, bindings)]

    interaction_query = INTERACTION_QUERY.format(scope=pairs)
    redondance_query = REDONDANCE_QUERY.format(scope=pairs)
    queries += [interaction_query.strip(), redondance_query.strip()]
    risques += [_interaction(r) for r in _pair_rows(store.select(interaction_query))]
    risques += [_redondance(r) for r in store.select(redondance_query)]

    return {"risques": risques, "methode": METHODE, "avertissement": AVERTISSEMENT, "requetes": queries}


@cached
def detect_risks_all() -> dict[str, list[dict]]:
    """Risques de toutes les prescriptions en 4 requêtes (au lieu de 4 par prescription). Résultat mis en cache
    jusqu'à la prochaine modification du graphe."""
    by_presc: dict[str, list[dict]] = defaultdict(list)
    for r in store.select(CONTRE_INDICATION_QUERY.format(scope=ALL_SINGLE)):
        by_presc[local_id(r["p"])].append(_ci(r))
    for r in store.select(ALLERGIE_QUERY.format(scope=ALL_SINGLE)):
        by_presc[local_id(r["p"])].append(_allergie(r))
    for r in _pair_rows(store.select(INTERACTION_QUERY.format(scope=ALL_PAIR))):
        by_presc[local_id(r["p"])].append(_interaction(r))
    for r in store.select(REDONDANCE_QUERY.format(scope=ALL_PAIR)):
        by_presc[local_id(r["p"])].append(_redondance(r))
    return dict(by_presc)

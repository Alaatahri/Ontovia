"""Exploration de l'ontologie : schéma (classes, propriétés, axiomes) et voisinage d'un individu."""
from fastapi import APIRouter

from app.core.common import subject_iri
from app.core.errors import NotFoundError
from app.core.graph_store import cached, store
from app.core.rdf import local_id, to_python

router = APIRouter(prefix="/api/ontologie", tags=["Ontologie"])

CLASSES_QUERY = """
SELECT ?c ?label ?parent (COUNT(DISTINCT ?i) AS ?individus) WHERE {
  ?c a owl:Class .
  OPTIONAL { ?c rdfs:label ?label }
  OPTIONAL { ?c rdfs:subClassOf ?parent }
  OPTIONAL { ?i a ?c }
}
GROUP BY ?c ?label ?parent
ORDER BY ?c
"""

PROPERTIES_QUERY = """
SELECT ?p ?kind ?label ?domain ?range
       (GROUP_CONCAT(DISTINCT STRAFTER(STR(?carac), "#"); separator=", ") AS ?caracteristiques)
       (COUNT(DISTINCT ?usage) AS ?utilisations) WHERE {
  VALUES ?kind { owl:ObjectProperty owl:DatatypeProperty }
  ?p a ?kind .
  OPTIONAL { ?p rdfs:label ?label }
  OPTIONAL { ?p rdfs:domain ?domain }
  OPTIONAL { ?p rdfs:range ?range }
  OPTIONAL { ?p a ?carac . FILTER(?carac IN (owl:SymmetricProperty, owl:FunctionalProperty,
                                             owl:TransitiveProperty, owl:InverseFunctionalProperty)) }
  OPTIONAL { ?usage ?p ?o }
}
GROUP BY ?p ?kind ?label ?domain ?range
ORDER BY ?kind ?p
"""

AXIOMS_QUERY = """
SELECT ?s ?axiome ?o WHERE {
  { ?s owl:disjointWith ?o . BIND("owl:disjointWith" AS ?axiome) }
  UNION { ?s owl:inverseOf ?o . BIND("owl:inverseOf" AS ?axiome) }
  UNION { ?s rdfs:subClassOf ?o . BIND("rdfs:subClassOf" AS ?axiome) }
}
ORDER BY ?axiome ?s
"""

NEIGHBOURS_QUERY = """
SELECT ?p ?o ?oNom ?oType ?direction WHERE {
  {
    ?focus ?p ?o . FILTER(isIRI(?o) && ?p != rdf:type)
    BIND("sortant" AS ?direction)
  } UNION {
    ?o ?p ?focus . FILTER(?p != rdf:type)
    BIND("entrant" AS ?direction)
  }
  OPTIONAL { ?o nx:nom ?oNom }
  OPTIONAL { ?o a ?oType . FILTER(?oType != owl:NamedIndividual) }
}
"""

FOCUS_QUERY = """
SELECT ?type ?nom ?prenom WHERE {
  ?focus a ?type . FILTER(?type != owl:NamedIndividual)
  OPTIONAL { ?focus nx:nom ?nom }
  OPTIONAL { ?focus nx:prenom ?prenom }
}
"""

INDIVIDUAL_CLASSES = ("Medicament", "Molecule", "Maladie", "ConditionPhysiologique", "Patient", "Medecin",
                      "Laboratoire", "Prescription", "Pharmacie", "Pharmacien", "Infirmier")


def _short(node) -> str | None:
    if node is None:
        return None
    text = str(node)
    for prefix, short in (("http://www.nexora.org/ontologie/pharma#", "nx:"),
                          ("http://www.w3.org/2001/XMLSchema#", "xsd:")):
        if text.startswith(prefix):
            return short + text[len(prefix):]
    return text


@router.get("/schema")
@cached
def schema():
    classes = [{
        "id": _short(r["c"]), "label": to_python(r.get("label")), "parent": _short(r.get("parent")),
        "individus": to_python(r["individus"]),
    } for r in store.select(CLASSES_QUERY)]
    proprietes = [{
        "id": _short(r["p"]),
        "type": "ObjectProperty" if str(r["kind"]).endswith("ObjectProperty") else "DatatypeProperty",
        "label": to_python(r.get("label")), "domaine": _short(r.get("domain")), "portee": _short(r.get("range")),
        "caracteristiques": to_python(r.get("caracteristiques")) or "",
        "utilisations": to_python(r["utilisations"]),
    } for r in store.select(PROPERTIES_QUERY)]
    axiomes = [{"sujet": _short(r["s"]), "axiome": to_python(r["axiome"]), "objet": _short(r["o"])}
               for r in store.select(AXIOMS_QUERY)]
    return {"classes": classes, "proprietes": proprietes, "axiomes": axiomes, "triplets": len(store.graph)}


@router.get("/graphe/{entity_id}")
def graphe(entity_id: str):
    """Voisinage (1 saut) d'un individu, pour la visualisation en graphe."""
    uri = None
    for cls in INDIVIDUAL_CLASSES:
        try:
            uri = subject_iri(entity_id, cls, "Individu")
            break
        except NotFoundError:
            continue
    if uri is None:
        raise NotFoundError(f"Individu introuvable : {entity_id}")

    focus_rows = store.select(FOCUS_QUERY, {"focus": uri})
    first = focus_rows[0]
    nom = " ".join(str(to_python(x)) for x in (first.get("prenom"), first.get("nom")) if x is not None)
    nodes = {entity_id: {"id": entity_id, "nom": nom or entity_id, "type": local_id(first["type"]), "focus": True}}
    links = []
    for r in store.select(NEIGHBOURS_QUERY, {"focus": uri}):
        target = local_id(r["o"])
        nodes.setdefault(target, {
            "id": target, "nom": to_python(r.get("oNom")) or target,
            "type": local_id(r["oType"]) if r.get("oType") is not None else "Autre", "focus": False,
        })
        source, dest = (entity_id, target) if to_python(r["direction"]) == "sortant" else (target, entity_id)
        links.append({"source": source, "target": dest, "propriete": local_id(r["p"])})
    return {"nodes": list(nodes.values()), "links": links}

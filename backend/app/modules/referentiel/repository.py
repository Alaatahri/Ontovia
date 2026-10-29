"""CRUD générique des référentiels : les requêtes SPARQL sont construites à partir des spécifications (specs.py).

Comme pour les autres modules, les valeurs saisies ne sont jamais concaténées dans les requêtes :
identifiants validés et typés dans le graphe, textes encodés en littéraux RDF, filtres passés par initBindings.
"""
from __future__ import annotations

import re
from collections import defaultdict

from rdflib import OWL, RDF, URIRef

from app.core.common import create_individual, delete_individual, replace_properties, resolve_refs
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.graph_store import cached, store
from app.core.rdf import NX, InvalidIdError, int_lit, iri, local_id, new_id, string_lit, to_python, values_block
from app.modules.referentiel.specs import SPECS, EntitySpec

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get_spec(entity_type: str) -> EntitySpec:
    if entity_type not in SPECS:
        raise NotFoundError(f"Référentiel inconnu : {entity_type}")
    return SPECS[entity_type]


def _classes_block(spec: EntitySpec, var: str = "type") -> str:
    return values_block(var, [NX[c] for c, _, _ in spec.classes])


def _base_query(spec: EntitySpec, filters: str = "") -> str:
    optional = "\n  ".join(f"OPTIONAL {{ ?s nx:{f.key} ?{f.key} }}" for f in spec.fields if f.key != "nom")
    variables = " ".join(f"?{f.key}" for f in spec.fields)
    return f"""
SELECT ?s ?type {variables} WHERE {{
  {_classes_block(spec)}
  ?s a ?type ;
     nx:nom ?nom .
  {optional}
  {filters}
}}
ORDER BY LCASE(STR(?nom))
"""


def _relations_query(spec: EntitySpec, subjects: list[URIRef]) -> str | None:
    parts = []
    for r in spec.relations:
        pattern = f"?t nx:{r.predicate} ?s ." if r.inverse else f"?s nx:{r.predicate} ?t ."
        parts.append(f'{{ {pattern} BIND("{r.key}" AS ?rel) }}')
    if not parts or not subjects:
        return None
    return f"""
SELECT ?s ?rel ?t ?tNom ?tPrenom WHERE {{
  {values_block("s", subjects)}
  {" UNION ".join(parts)}
  OPTIONAL {{ ?t nx:nom ?tNom }}
  OPTIONAL {{ ?t nx:prenom ?tPrenom }}
}}
"""


def _relations(spec: EntitySpec, subjects: list[URIRef]) -> dict[str, dict[str, list[dict]]]:
    grouped: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    query = _relations_query(spec, subjects)
    if query is None:
        return grouped
    seen = set()
    for row in store.select(query):
        key = (row["s"], to_python(row["rel"]), row["t"])
        if key in seen:
            continue
        seen.add(key)
        name = " ".join(str(to_python(x)) for x in (row.get("tPrenom"), row.get("tNom")) if x is not None)
        grouped[local_id(row["s"])][to_python(row["rel"])].append({"id": local_id(row["t"]), "nom": name or local_id(row["t"])})
    for rels in grouped.values():
        for items in rels.values():
            items.sort(key=lambda r: r["nom"].lower())
    return grouped


def _serialize(spec: EntitySpec, row: dict, relations: dict) -> dict:
    entity_id = local_id(row["s"])
    values = {f.key: to_python(row.get(f.key)) for f in spec.fields}
    rels = relations.get(entity_id, {})
    cls = local_id(row["type"])
    return {
        "id": entity_id,
        "nomComplet": " ".join(str(values[k]) for k in spec.name_fields if values.get(k)),
        "classe": cls,
        "classeLabel": next((l for c, l, _ in spec.classes if c == cls), cls),
        "champs": values,
        "relations": {r.key: rels.get(r.key, []) for r in spec.relations},
    }


@cached
def list_entities(entity_type: str, q: str | None = None, classe: str | None = None) -> list[dict]:
    spec = get_spec(entity_type)
    filters, bindings = [], {}
    if q:
        searchable = [f.key for f in spec.fields if f.kind != "textarea"]
        concat = ', " ", '.join(f'COALESCE(STR(?{k}), "")' for k in searchable)
        filters.append(f"FILTER(CONTAINS(LCASE(CONCAT({concat})), LCASE(?q)))")
        bindings["q"] = string_lit(q)
    if classe:
        if classe not in {c for c, _, _ in spec.classes}:
            raise ValidationError(f"Classe invalide pour {spec.plural} : {classe}")
        bindings["type"] = NX[classe]
    rows = store.select(_base_query(spec, "\n  ".join(filters)), bindings)
    relations = _relations(spec, [r["s"] for r in rows])
    return [_serialize(spec, r, relations) for r in rows]


def _subject(spec: EntitySpec, entity_id: str) -> URIRef:
    try:
        uri = iri(entity_id)
    except InvalidIdError:
        raise NotFoundError(f"{spec.label} introuvable : {entity_id}")
    if not store.ask(f"ASK {{ {_classes_block(spec)} ?s a ?type }}", {"s": uri}):
        raise NotFoundError(f"{spec.label} introuvable : {entity_id}")
    return uri


def get_entity(entity_type: str, entity_id: str) -> dict:
    spec = get_spec(entity_type)
    uri = _subject(spec, entity_id)
    rows = store.select(_base_query(spec), {"s": uri})
    if not rows:
        raise NotFoundError(f"{spec.label} introuvable : {entity_id} (propriété nx:nom manquante ?)")
    result = _serialize(spec, rows[0], _relations(spec, [uri]))
    result["indicateurs"] = EXTRAS[spec.type](uri) if spec.type in EXTRAS else []
    return result


def _validate(spec: EntitySpec, body: dict) -> tuple[str, dict, dict]:
    classes = {c for c, _, _ in spec.classes}
    classe = body.get("classe") or spec.classes[0][0]
    if classe not in classes:
        raise ValidationError(f"classe : valeur invalide ({classe})")
    raw = body.get("champs") or {}
    champs: dict = {}
    for f in spec.fields:
        value = raw.get(f.key)
        value = value.strip() if isinstance(value, str) else value
        if value in (None, ""):
            if f.required:
                raise ValidationError(f"{f.label} : champ obligatoire")
            continue
        if f.kind == "int":
            try:
                value = int(value)
            except (TypeError, ValueError):
                raise ValidationError(f"{f.label} : nombre entier attendu")
        else:
            value = str(value)
            if len(value) > f.max_length:
                raise ValidationError(f"{f.label} : {f.max_length} caractères maximum")
            if f.kind == "email" and not EMAIL.match(value):
                raise ValidationError(f"{f.label} : adresse e-mail invalide")
        champs[f.key] = value
    relations = {}
    for r in spec.relations:
        if r.inverse:
            continue
        ids = (body.get("relations") or {}).get(r.key) or []
        if not isinstance(ids, list):
            raise ValidationError(f"{r.label} : liste d'identifiants attendue")
        relations[r] = resolve_refs([str(i) for i in ids], r.target, r.label)
    return classe, champs, relations


def _triples(spec: EntitySpec, uri: URIRef, champs: dict, relations: dict) -> list[tuple]:
    triples = []
    for f in spec.fields:
        if f.key in champs:
            lit = int_lit(champs[f.key]) if f.kind == "int" else string_lit(champs[f.key])
            triples.append((uri, NX[f.key], lit))
    for r, targets in relations.items():
        triples.extend((uri, NX[r.predicate], t) for t in targets)
    return triples


def create_entity(entity_type: str, body: dict) -> dict:
    spec = get_spec(entity_type)
    classe, champs, relations = _validate(spec, body)
    prefix = next(p for c, _, p in spec.classes if c == classe)
    uri = iri(new_id(prefix, *(str(champs.get(k, "")) for k in spec.name_fields)))
    create_individual(uri, classe, _triples(spec, uri, champs, relations))
    return get_entity(entity_type, local_id(uri))


def update_entity(entity_type: str, entity_id: str, body: dict) -> dict:
    spec = get_spec(entity_type)
    uri = _subject(spec, entity_id)
    classe, champs, relations = _validate(spec, body)
    managed = [NX[f.key] for f in spec.fields] + [NX[r.predicate] for r in spec.relations if not r.inverse]
    triples = _triples(spec, uri, champs, relations)
    if len(spec.classes) > 1:  # changement de sous-classe possible (ex. Pharmacien → Infirmier)
        managed.append(RDF.type)
        triples += [(uri, RDF.type, OWL.NamedIndividual), (uri, RDF.type, NX[classe])]
    replace_properties(uri, managed, triples)
    return get_entity(entity_type, entity_id)


def delete_entity(entity_type: str, entity_id: str) -> None:
    """Supprime l'individu. Les relations entrantes « bloquantes » (dossiers patients, prescriptions…) empêchent
    la suppression ; les autres liens (catalogue, stock, personnel) sont retirés avec l'individu."""
    spec = get_spec(entity_type)
    uri = _subject(spec, entity_id)
    rels = _relations(spec, [uri]).get(entity_id, {})
    blocking = [(r, rels.get(r.key, [])) for r in spec.relations if r.blocks_delete and rels.get(r.key)]
    if blocking:
        details = " ; ".join(f"{r.label.lower()} : {', '.join(x['nom'] for x in items[:5])}"
                             + (" …" if len(items) > 5 else "") for r, items in blocking)
        raise ConflictError(f"Suppression impossible, cet individu est encore utilisé ({details}).",
                            {"liens": {r.key: [x["id"] for x in items] for r, items in blocking}})
    delete_individual(uri)


# ---------- Indicateurs métier affichés dans les fiches (requêtes d'agrégation) ----------

MEDECIN_STATS = """
SELECT (COUNT(DISTINCT ?p) AS ?prescriptions) (COUNT(DISTINCT ?pat) AS ?patients)
       (SUM(IF(STR(?statut) = "Délivrée", 1, 0)) AS ?delivrees) WHERE {
  ?p nx:prescritePar ?medecin ;
     nx:concernePatient ?pat .
  OPTIONAL { ?p nx:statut ?statut }
}
"""

MEDECIN_TOP = """
SELECT ?label (COUNT(DISTINCT ?p) AS ?valeur) WHERE {
  ?p nx:prescritePar ?medecin ; nx:prescritMedicament ?m .
  ?m nx:nom ?label .
}
GROUP BY ?label ORDER BY DESC(?valeur) ?label LIMIT 5
"""

PHARMACIE_COUVERTURE = """
SELECT ?p (COUNT(DISTINCT ?m) AS ?total) (COUNT(DISTINCT ?dispo) AS ?disponibles) WHERE {
  ?p a nx:Prescription ; nx:prescritMedicament ?m .
  FILTER NOT EXISTS { ?p nx:statut ?st . FILTER(STR(?st) = "Délivrée") }
  OPTIONAL { ?pharmacie nx:disposeDe ?m . BIND(?m AS ?dispo) }
}
GROUP BY ?p
"""


def _medecin_extras(uri: URIRef) -> list[dict]:
    from app.modules.prescriptions.risks import detect_risks_all

    stats = store.select(MEDECIN_STATS, {"medecin": uri})[0]
    ids = [local_id(r["p"]) for r in store.select("SELECT ?p WHERE { ?p nx:prescritePar ?medecin }", {"medecin": uri})]
    risques = detect_risks_all()
    return [
        {"titre": "Activité", "type": "stats", "items": [
            {"label": "Prescriptions", "valeur": to_python(stats["prescriptions"]) or 0},
            {"label": "Patients suivis", "valeur": to_python(stats["patients"]) or 0},
            {"label": "Prescriptions à risque", "valeur": sum(1 for i in ids if risques.get(i))},
            {"label": "Délivrées", "valeur": to_python(stats.get("delivrees")) or 0},
        ]},
        {"titre": "Médicaments les plus prescrits", "type": "classement", "items": [
            {"label": to_python(r["label"]), "valeur": to_python(r["valeur"])} for r in store.select(MEDECIN_TOP, {"medecin": uri})
        ]},
    ]


def _pharmacie_extras(uri: URIRef) -> list[dict]:
    rows = store.select(PHARMACIE_COUVERTURE, {"pharmacie": uri})
    completes = sum(1 for r in rows if to_python(r["total"]) == to_python(r["disponibles"]))
    stock = store.select("SELECT (COUNT(DISTINCT ?m) AS ?n) WHERE { ?pharmacie nx:disposeDe ?m }", {"pharmacie": uri})[0]
    delivrees = store.select("SELECT (COUNT(?p) AS ?n) WHERE { ?p nx:delivreePar ?pharmacie }", {"pharmacie": uri})[0]
    return [{"titre": "Activité", "type": "stats", "items": [
        {"label": "Médicaments en stock", "valeur": to_python(stock["n"])},
        {"label": "Prescriptions délivrées", "valeur": to_python(delivrees["n"])},
        {"label": "Prescriptions en attente servables en totalité", "valeur": f"{completes} / {len(rows)}"},
    ]}]


EXTRAS = {"medecins": _medecin_extras, "pharmacies": _pharmacie_extras}

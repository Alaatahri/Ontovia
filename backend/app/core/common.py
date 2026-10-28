"""Fonctions partagées par les repositories des modules métier."""
from __future__ import annotations

from collections import defaultdict

from rdflib import URIRef
from rdflib.term import Node

from app.core.errors import NotFoundError, ValidationError
from app.core.graph_store import store
from app.core.rdf import NX, InvalidIdError, insert_data, iri, local_id, to_python, values_block


def ref(node: Node, nom: Node | None) -> dict:
    return {"id": local_id(node), "nom": to_python(nom) or local_id(node)}


def subject_iri(entity_id: str, cls: str, label: str) -> URIRef:
    """IRI d'un individu existant de la classe `cls`, sinon 404."""
    try:
        uri = iri(entity_id)
    except InvalidIdError:
        raise NotFoundError(f"{label} introuvable : {entity_id}")
    if not store.ask(f"ASK {{ ?s a nx:{cls} }}", {"s": uri}):
        raise NotFoundError(f"{label} introuvable : {entity_id}")
    return uri


def resolve_refs(ids: list[str], cls: str | tuple[str, ...], field: str) -> list[URIRef]:
    """Valide une liste d'identifiants : chacun doit désigner un individu de la (ou d'une des) classe(s) `cls`.

    Sans raisonneur, l'appartenance à une super-classe se vérifie en listant ses sous-classes.
    """
    classes = (cls,) if isinstance(cls, str) else cls
    unique = list(dict.fromkeys(ids))
    if not unique:
        return []
    try:
        uris = [iri(i) for i in unique]
    except InvalidIdError as exc:
        raise ValidationError(f"{field} : {exc}")
    rows = store.select(
        f"SELECT ?s WHERE {{ {values_block('s', uris)} {values_block('c', [NX[c] for c in classes])} ?s a ?c . }}"
    )
    found = {row["s"] for row in rows}
    missing = [local_id(u) for u in uris if u not in found]
    if missing:
        raise ValidationError(f"{field} : individus introuvables ou d'un autre type ({'/'.join(classes)}) : {', '.join(missing)}")
    return uris


def group_refs(rows: list[dict], subject_var: str = "s", key_var: str = "rel",
               target_var: str = "t", nom_var: str = "tNom") -> dict[str, dict[str, list[dict]]]:
    """Regroupe des lignes (sujet, relation, cible, nom) en {sujet: {relation: [ref, …]}}."""
    grouped: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    seen: set[tuple] = set()
    for row in rows:
        key = to_python(row[key_var]) if row.get(key_var) is not None else key_var
        subject, target = local_id(row[subject_var]), row[target_var]
        if (subject, key, target) in seen:
            continue
        seen.add((subject, key, target))
        item = ref(target, row.get(nom_var))
        if row.get("tType") is not None:
            item["type"] = local_id(row["tType"])
        grouped[subject][key].append(item)
    for rels in grouped.values():
        for items in rels.values():
            items.sort(key=lambda r: str(r["nom"]).lower())
    return grouped


def create_individual(uri: URIRef, cls: str, triples: list[tuple]) -> None:
    from rdflib import OWL, RDF

    all_triples = [(uri, RDF.type, OWL.NamedIndividual), (uri, RDF.type, NX[cls]), *triples]
    store.update(insert_data(all_triples))


def replace_properties(uri: URIRef, predicates: list[URIRef], triples: list[tuple],
                       incoming: list[URIRef] | None = None) -> None:
    """Remplace en une seule mise à jour les valeurs des prédicats gérés par un formulaire.

    `incoming` : prédicats symétriques dont les triplets entrants (?x p <uri>) doivent aussi être retirés.
    """
    parts = [
        f"DELETE {{ {uri.n3()} ?p ?o }} WHERE {{ {uri.n3()} ?p ?o . {values_block('p', predicates)} }}"
    ]
    if incoming:
        parts.append(
            f"DELETE {{ ?x ?p {uri.n3()} }} WHERE {{ ?x ?p {uri.n3()} . {values_block('p', incoming)} }}"
        )
    if triples:
        parts.append(insert_data(triples))
    store.update(" ;\n".join(parts))


def delete_individual(uri: URIRef) -> None:
    """Supprime l'individu : ses propriétés et toutes les relations qui pointent vers lui."""
    store.update(f"DELETE WHERE {{ {uri.n3()} ?p ?o }} ;\nDELETE WHERE {{ ?x ?p {uri.n3()} }}")

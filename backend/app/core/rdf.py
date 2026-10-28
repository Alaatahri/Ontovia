"""Noms RDF de l'ontologie et helpers d'encodage des termes.

Les valeurs saisies par l'utilisateur ne sont jamais concaténées telles quelles dans une requête :
- les identifiants sont validés puis transformés en IRI ;
- les textes passent par rdflib.Literal, dont .n3() produit un littéral correctement échappé ;
- les requêtes SELECT reçoivent leurs paramètres via initBindings.
"""
from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import date

from rdflib import XSD, Literal, Namespace, URIRef
from rdflib.term import Node

NX_URI = "http://www.nexora.org/ontologie/pharma#"
NX = Namespace(NX_URI)

PREFIXES = f"""PREFIX nx: <{NX_URI}>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""

ID_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,100}$")


class InvalidIdError(ValueError):
    pass


def iri(local_id: str) -> URIRef:
    """Transforme un identifiant local (ex. « Med_Aspirine ») en IRI après validation."""
    if not isinstance(local_id, str) or not ID_PATTERN.match(local_id):
        raise InvalidIdError(f"Identifiant invalide : {local_id!r}")
    return NX[local_id]


def local_id(node: Node) -> str:
    text = str(node)
    return text[len(NX_URI):] if text.startswith(NX_URI) else text


def slugify(*parts: str) -> str:
    text = " ".join(p for p in parts if p)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    words = re.findall(r"[A-Za-z0-9]+", text)
    return "".join(w[:1].upper() + w[1:] for w in words)[:40] or "Item"


def new_id(prefix: str, *parts: str) -> str:
    return f"{prefix}_{slugify(*parts)}_{uuid.uuid4().hex[:6]}"


def string_lit(value: str) -> Literal:
    return Literal(value, datatype=XSD.string)


def int_lit(value: int) -> Literal:
    return Literal(int(value), datatype=XSD.integer)


def date_lit(value: date) -> Literal:
    return Literal(value.isoformat(), datatype=XSD.date)


def to_python(node: Node | None):
    if node is None:
        return None
    if isinstance(node, Literal):
        value = node.toPython()
        return value.isoformat() if isinstance(value, date) else value
    return local_id(node)


def insert_data(triples: list[tuple[Node, Node, Node]]) -> str:
    """Construit un bloc INSERT DATA à partir de termes rdflib (encodés avec .n3())."""
    lines = "\n".join(f"  {s.n3()} {p.n3()} {o.n3()} ." for s, p, o in triples)
    return f"INSERT DATA {{\n{lines}\n}}"


def values_block(var: str, nodes: list[Node]) -> str:
    return f"VALUES ?{var} {{ {' '.join(n.n3() for n in nodes)} }}"

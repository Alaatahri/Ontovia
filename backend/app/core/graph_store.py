"""Chargement, interrogation et sauvegarde du graphe RDF partagé."""
from __future__ import annotations

import os
import threading
from pathlib import Path

from rdflib import Graph
from rdflib.term import Node

from app.config import ONTOLOGY_PATH
from app.core.rdf import NX, PREFIXES


class GraphStore:
    def __init__(self, path: Path):
        self.path = path
        self.graph = Graph()
        self._lock = threading.RLock()

    def load(self) -> None:
        with self._lock:
            if not self.path.exists():
                from scripts.seed_ontology import build_graph

                self.graph = build_graph()
                self.save()
            else:
                graph = Graph()
                graph.parse(str(self.path), format="xml")
                self.graph = graph
            self.graph.bind("nx", NX)

    def save(self) -> None:
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".owl.tmp")
            self.graph.serialize(destination=str(tmp), format="pretty-xml")
            os.replace(tmp, self.path)

    def select(self, query: str, bindings: dict[str, Node] | None = None) -> list[dict[str, Node]]:
        with self._lock:
            result = self.graph.query(PREFIXES + query, initBindings=bindings or {})
            names = [str(v) for v in result.vars]
            return [{n: row[i] for i, n in enumerate(names)} for row in result]

    def select_raw(self, query: str):
        """Exécute une requête complète (avec ses propres PREFIX) — utilisé par la console SPARQL et le NLP."""
        with self._lock:
            return self.graph.query(query)

    def ask(self, query: str, bindings: dict[str, Node] | None = None) -> bool:
        with self._lock:
            return bool(self.graph.query(PREFIXES + query, initBindings=bindings or {}).askAnswer)

    def update(self, update: str) -> None:
        """Applique une mise à jour SPARQL puis persiste le fichier OWL."""
        with self._lock:
            self.graph.update(PREFIXES + update)
            self.save()


store = GraphStore(ONTOLOGY_PATH)

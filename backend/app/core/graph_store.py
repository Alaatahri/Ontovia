"""Chargement, interrogation et sauvegarde du graphe RDF partagé.

Le fichier OWL est partagé avec Protégé : à chaque accès, si le fichier a été modifié sur le disque
(enregistrement depuis Protégé), le graphe est rechargé automatiquement avant d'exécuter la requête.
"""
from __future__ import annotations

import functools
import os
import threading
import time
from datetime import datetime
from pathlib import Path

from rdflib import Graph
from rdflib.plugins.sparql import prepareQuery
from rdflib.term import Node

from app.config import ONTOLOGY_PATH
from app.core.errors import AppError
from app.core.rdf import NX, PREFIXES

# Formats que rdflib sait relire. Protégé enregistre par défaut en RDF/XML ; Turtle est aussi accepté.
READABLE_FORMATS = ("xml", "turtle")


class OntologyFormatError(Exception):
    pass


class OntologyLockedError(AppError):
    status_code = 503


@functools.lru_cache(maxsize=1024)
def _prepared(query: str):
    """Analyse (parsing + algèbre SPARQL) mise en cache : une requête déjà vue n'est plus réanalysée (~4× plus rapide)."""
    return prepareQuery(query)


class GraphStore:
    def __init__(self, path: Path):
        self.path = path
        self.graph = Graph()
        self._lock = threading.RLock()
        self._mtime: int | None = None
        self.format = "xml"
        self.loaded_at: datetime | None = None
        self.reloads = 0
        self.last_error: str | None = None
        # Incrémentée à chaque changement du graphe : sert de clé aux caches de résultats (voir cached()).
        self.version = 0

    def _file_mtime(self) -> int | None:
        return self.path.stat().st_mtime_ns if self.path.exists() else None

    def _parse(self) -> tuple[Graph, str]:
        errors = []
        for fmt in READABLE_FORMATS:
            graph = Graph()
            try:
                graph.parse(str(self.path), format=fmt)
                return graph, fmt
            except Exception as exc:  # format suivant
                errors.append(f"{fmt} : {exc}")
        raise OntologyFormatError(
            "Impossible de lire le fichier OWL. Dans Protégé, enregistrez-le au format « RDF/XML Syntax » "
            "(File › Save as…). Détails : " + " | ".join(errors)
        )

    def load(self) -> None:
        with self._lock:
            if not self.path.exists():
                from scripts.seed_ontology import build_graph

                self.graph = build_graph()
                self.save()
            else:
                self.graph, self.format = self._parse()
                self._mtime = self._file_mtime()
            self.graph.bind("nx", NX)
            self.version += 1
            self.loaded_at = datetime.now()
            self.last_error = None

    def sync(self) -> bool:
        """Recharge le graphe si le fichier a changé sur le disque (ex. enregistrement depuis Protégé)."""
        with self._lock:
            if self._file_mtime() == self._mtime:
                return False
            try:
                self.load()
                self.reloads += 1
                return True
            except OntologyFormatError as exc:
                # On garde le dernier graphe valide ; l'erreur est exposée par /api/ontologie/fichier.
                self.last_error = str(exc)
                self._mtime = self._file_mtime()
                return False

    def save(self) -> None:
        """Écrit le graphe dans le fichier OWL (fichier temporaire puis remplacement atomique).

        Sous Windows, le remplacement échoue si un autre programme tient le fichier ouvert à cet instant
        (antivirus qui analyse le fichier juste écrit, éditeur, Protégé) : on réessaie pendant ~2 s, puis on
        écrit directement dans le fichier en dernier recours.
        """
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".owl.tmp")
            self.graph.serialize(destination=str(tmp), format="pretty-xml")
            for attempt in range(20):
                try:
                    os.replace(tmp, self.path)
                    break
                except PermissionError:
                    time.sleep(0.1)
            else:
                try:
                    self.path.write_bytes(tmp.read_bytes())
                    tmp.unlink(missing_ok=True)
                except PermissionError as exc:
                    tmp.unlink(missing_ok=True)
                    raise OntologyLockedError(
                        "Le fichier nexora.owl est verrouillé par un autre programme (Protégé, éditeur…). "
                        "Fermez-le puis réessayez : la modification n'a pas été enregistrée."
                    ) from exc
            self._mtime = self._file_mtime()
            self.format = "xml"

    def select(self, query: str, bindings: dict[str, Node] | None = None) -> list[dict[str, Node]]:
        with self._lock:
            self.sync()
            result = self.graph.query(_prepared(PREFIXES + query), initBindings=bindings or {})
            names = [str(v) for v in result.vars]
            return [{n: row[i] for i, n in enumerate(names)} for row in result]

    def select_raw(self, query: str):
        """Exécute une requête complète (avec ses propres PREFIX) — utilisé par la console SPARQL et le NLP."""
        with self._lock:
            self.sync()
            return self.graph.query(_prepared(query))

    def ask(self, query: str, bindings: dict[str, Node] | None = None) -> bool:
        with self._lock:
            self.sync()
            return bool(self.graph.query(_prepared(PREFIXES + query), initBindings=bindings or {}).askAnswer)

    def update(self, update: str) -> None:
        """Applique une mise à jour SPARQL puis persiste le fichier OWL.

        Le graphe est d'abord resynchronisé avec le disque : une modification faite dans Protégé n'est
        jamais écrasée par une écriture de l'application basée sur une version périmée.
        """
        with self._lock:
            self.sync()
            self.graph.update(PREFIXES + update)
            self.version += 1
            try:
                self.save()
            except OntologyLockedError:
                # Annulation : le graphe en mémoire redevient identique au fichier (rien n'a été enregistré).
                self.load()
                raise


def cached(fn):
    """Mémorise le résultat d'une fonction tant que le graphe n'a pas changé (CRUD ou rechargement Protégé)."""
    memo: dict = {}

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        with store._lock:
            store.sync()
            key = (store.version, args, tuple(sorted(kwargs.items())))
            if key not in memo:
                if len(memo) > 256:
                    memo.clear()
                memo[key] = fn(*args, **kwargs)
            return memo[key]

    wrapper.cache_clear = memo.clear
    return wrapper


store = GraphStore(ONTOLOGY_PATH)

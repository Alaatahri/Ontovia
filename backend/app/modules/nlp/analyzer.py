"""Analyse linguistique de la question et reconnaissance des entités du graphe.

Bibliothèques :
- spaCy (tokenizer français : élisions l', d', qu'…, ponctuation, mots vides) ;
- snowballstemmer (racinisation française : « traitent », « traitement » → « trait ») ;
- rapidfuzz (correspondance approximative avec les noms des individus, tolère les fautes de frappe).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

import snowballstemmer
import spacy
from rapidfuzz import fuzz, process
from spacy.lang.fr.stop_words import STOP_WORDS

from app.core.graph_store import cached, store
from app.core.rdf import local_id, to_python

_nlp = spacy.blank("fr")
_stemmer = snowballstemmer.stemmer("french")


def strip_accents(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()


def normalize(text: str) -> str:
    text = text.lower().replace("’", "'").replace("-", " ")
    return re.sub(r"\s+", " ", strip_accents(text)).strip()


STOP_WORDS_NORM = {strip_accents(w) for w in STOP_WORDS}


def stem(word: str) -> str:
    return _stemmer.stemWord(normalize(word))


@dataclass
class Token:
    text: str
    norm: str
    stem: str
    stop: bool


@dataclass
class Entity:
    id: str
    nom: str
    type: str
    text: str
    score: float
    start: int
    end: int


@dataclass
class Analysis:
    question: str
    tokens: list[Token]
    entities: list[Entity] = field(default_factory=list)
    numbers: list[int] = field(default_factory=list)

    @property
    def stems(self) -> set[str]:
        return {t.stem for t in self.tokens}


def tokenize(question: str) -> list[Token]:
    tokens = []
    for tok in _nlp(question.replace("-", " ")):
        if tok.is_punct or tok.is_space:
            continue
        # « l'aspirine » → tokens « l' » + « aspirine » : on retire l'apostrophe résiduelle
        norm = normalize(tok.text).rstrip("'")
        if not norm:
            continue
        tokens.append(Token(tok.text, norm, _stemmer.stemWord(norm), norm in STOP_WORDS_NORM or len(norm) == 1))
    return tokens


# Synonymes et formulations courantes → identifiant de l'individu (utilisés seulement s'il existe)
SYNONYMS = {
    "hta": "Mal_Hypertension", "tension": "Mal_Hypertension", "hypertension": "Mal_Hypertension",
    "diabete": "Mal_Diabete2", "diabetique": "Mal_Diabete2", "diabetiques": "Mal_Diabete2",
    "cholesterol": "Mal_Hypercholesterolemie", "asthmatique": "Mal_Asthme", "asthmatiques": "Mal_Asthme",
    "ulcere": "Mal_UlcereGastrique", "reflux": "Mal_RGO", "rgo": "Mal_RGO", "angine": "Mal_Angine",
    "mal de tete": "Mal_Migraine", "maux de tete": "Mal_Migraine", "migraineux": "Mal_Migraine",
    "enceinte": "Cond_Grossesse", "enceintes": "Cond_Grossesse", "femme enceinte": "Cond_Grossesse",
    "femmes enceintes": "Cond_Grossesse", "allaitante": "Cond_Allaitement", "allaitantes": "Cond_Allaitement",
    "personnes agees": "Cond_SujetAge", "sujets ages": "Cond_SujetAge", "alcool": "Cond_Alcoolisme",
    "aspirin": "Med_Aspirine", "paracetamol": "Mol_Paracetamol", "ibuprofene": "Mol_Ibuprofene",
    "arythmie": "Mal_FibrillationAuriculaire",
}

GAZETTEER_QUERY = """
SELECT ?s ?type ?nom ?prenom WHERE {
  VALUES ?type { nx:Medicament nx:Molecule nx:Maladie nx:ConditionPhysiologique
                 nx:Patient nx:Medecin nx:Laboratoire }
  ?s a ?type ;
     nx:nom ?nom .
  OPTIONAL { ?s nx:prenom ?prenom }
}
"""


@dataclass
class GazetteerEntry:
    id: str
    nom: str
    type: str


@cached
def build_gazetteer() -> dict[str, GazetteerEntry]:
    """Construit à partir du graphe (donc à jour après chaque CRUD) la table libellé normalisé → individu."""
    labels: dict[str, GazetteerEntry] = {}
    by_id: dict[str, GazetteerEntry] = {}
    for row in store.select(GAZETTEER_QUERY):
        nom, prenom = to_python(row["nom"]), to_python(row.get("prenom"))
        type_ = local_id(row["type"])
        display = f"{prenom} {nom}" if prenom else nom
        if type_ == "Medecin":
            display = f"Dr {display}"
        entry = GazetteerEntry(local_id(row["s"]), display, type_)
        by_id[entry.id] = entry
        variants = {normalize(nom)}
        if prenom:
            variants |= {normalize(prenom), normalize(f"{prenom} {nom}")}
            if type_ == "Medecin":
                variants |= {normalize(f"dr {nom}"), normalize(f"docteur {nom}")}
        for v in variants:
            labels.setdefault(v, entry)
    for alias, target in SYNONYMS.items():
        if target in by_id:
            labels.setdefault(alias, by_id[target])
    return labels


def recognize_entities(tokens: list[Token], gazetteer: dict[str, GazetteerEntry]) -> list[Entity]:
    """Recherche les n-grammes (du plus long au plus court) correspondant à un individu du graphe."""
    entities: list[Entity] = []
    used: set[int] = set()
    keys = list(gazetteer)
    n = len(tokens)
    for size in range(min(5, n), 0, -1):
        for start in range(0, n - size + 1):
            span = range(start, start + size)
            if used.intersection(span):
                continue
            window = tokens[start:start + size]
            if window[0].stop or window[-1].stop:
                continue
            text = " ".join(t.norm for t in window)
            if text in gazetteer:
                matches = [(text, 100.0)]
            elif len(text) >= 5:
                found = process.extract(text, keys, scorer=fuzz.ratio, score_cutoff=85, limit=5)
                if not found:
                    continue
                # Faute de frappe ambiguë (« migrane » ≈ Migraine ≈ Imigrane) : on garde les candidats
                # ex æquo, l'intention choisira celui dont le type convient.
                top = found[0][1]
                matches = [(m[0], float(m[1])) for m in found if m[1] >= top - 1]
            else:
                continue
            original = " ".join(t.text for t in window)
            seen_ids: set[str] = set()
            for match, score in matches:
                entry = gazetteer[match]
                if entry.id in seen_ids:
                    continue
                seen_ids.add(entry.id)
                entities.append(Entity(entry.id, entry.nom, entry.type, original, round(score, 1),
                                       start, start + size))
            used.update(span)
    return sorted(entities, key=lambda e: e.start)


def analyze(question: str) -> Analysis:
    tokens = tokenize(question)
    analysis = Analysis(question, tokens)
    analysis.entities = recognize_entities(tokens, build_gazetteer())
    analysis.numbers = [int(t.norm) for t in tokens if t.norm.isdigit() and len(t.norm) <= 3]
    return analysis

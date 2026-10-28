"""Module 4 — Assistant NLP : question en langage naturel → SPARQL → résultats."""
from __future__ import annotations

from dataclasses import asdict

from app.core.graph_store import store
from app.core.rdf import to_python
from app.modules.nlp.analyzer import analyze
from app.modules.nlp.intents import EXAMPLES, full_query, match_intent, suggestions_for


def answer(question: str) -> dict:
    analysis = analyze(question)
    base = {
        "question": question,
        "analyse": {
            "tokens": [asdict(t) for t in analysis.tokens],
            "entites": [asdict(e) for e in analysis.entities],
            "nombres": analysis.numbers,
        },
    }
    matched = match_intent(analysis)
    if matched is None:
        return {
            **base,
            "compris": False,
            "message": "Je n'ai pas compris la question. Essayez de mentionner un médicament, une maladie, "
                       "un patient ou un médecin présent dans l'ontologie, ou l'une des suggestions.",
            "suggestions": suggestions_for(analysis),
        }

    intent, ctx, score = matched
    body, explication = intent.build(ctx)
    sparql = full_query(body)
    result = store.select_raw(sparql)
    columns = [str(v) for v in result.vars]
    rows = [{c: to_python(row[i]) for i, c in enumerate(columns)} for row in result]
    return {
        **base,
        "compris": True,
        "intention": {"id": intent.id, "label": intent.label, "score": score},
        "entite": asdict(ctx.entity) if ctx.entity else None,
        "explication": explication,
        "sparql": sparql,
        "colonnes": columns,
        "resultats": rows,
        "message": None if rows else "La requête est correcte mais ne renvoie aucun résultat dans l'ontologie.",
    }


def examples() -> list[str]:
    return EXAMPLES

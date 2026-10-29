"""Module 4 — Assistant NLP : question en langage naturel → SPARQL → résultats."""
from __future__ import annotations

from dataclasses import asdict

from app.core.graph_store import store
from app.core.rdf import to_python
from app.modules.nlp.analyzer import Analysis, Entity, analyze, build_gazetteer
from app.modules.nlp.intents import EXAMPLES, INTENTS, Context, full_query, match_intent, suggestions_for


def _context_entity(analysis: Analysis, contexte: dict | None) -> None:
    entry = next((e for e in build_gazetteer().values() if e.id == (contexte or {}).get("id")), None)
    if entry is not None:
        analysis.entities.append(Entity(entry.id, entry.nom, entry.type, "(contexte de la conversation)", 100.0, -1, -1))


def answer(question: str, contexte: dict | None = None, analysis: Analysis | None = None) -> dict:
    """`contexte` : entité du tour précédent de la conversation ({id, nom, type}). Si la nouvelle question ne
    mentionne aucune entité (« et ses interactions ? »), on la réutilise : c'est la résolution de la référence."""
    analysis = analysis or analyze(question)
    if contexte and not analysis.entities:
        _context_entity(analysis, contexte)
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

    return _execute(base, *matched)


def rerun(question: str, intent_id: str, contexte: dict | None) -> dict | None:
    """Question de suivi (« un autre ? », « tu es sûr ? ») : on réexécute l'intention du tour précédent
    sur la même entité. Renvoie None si l'intention précédente ne peut pas être rejouée."""
    intent = next((i for i in INTENTS if i.id == intent_id), None)
    if intent is None or intent.needs_class or intent.needs_number:
        return None
    analysis = analyze(question)
    ctx = Context(analysis)
    if intent.entity_types:
        _context_entity(analysis, contexte)
        if not analysis.entities or analysis.entities[-1].type not in intent.entity_types:
            return None
        ctx.entity = analysis.entities[-1]
    base = {"question": question, "analyse": {"tokens": [asdict(t) for t in analysis.tokens],
                                              "entites": [asdict(e) for e in analysis.entities], "nombres": []}}
    return _execute(base, intent, ctx, 0.0)


def _execute(base: dict, intent, ctx, score: float) -> dict:
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

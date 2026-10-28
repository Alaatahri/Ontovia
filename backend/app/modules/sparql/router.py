"""Console SPARQL en lecture seule (SELECT / ASK) pour la démonstration."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.errors import ValidationError
from app.core.graph_store import store
from app.core.rdf import PREFIXES, to_python

router = APIRouter(prefix="/api/sparql", tags=["Console SPARQL"])


class SparqlIn(BaseModel):
    query: str = Field(min_length=5, max_length=10000)


@router.get("/prefixes")
def prefixes():
    return {"prefixes": PREFIXES}


@router.post("")
def run_query(body: SparqlIn):
    # graph.query() n'accepte que les requêtes de lecture : un INSERT/DELETE échoue à l'analyse.
    try:
        result = store.select_raw(body.query)
    except Exception as exc:
        raise ValidationError(f"Requête refusée ou invalide (seules SELECT et ASK sont autorisées) : {exc}")
    if result.type == "ASK":
        return {"type": "ASK", "colonnes": ["resultat"], "resultats": [{"resultat": bool(result.askAnswer)}]}
    if result.type != "SELECT":
        raise ValidationError("Seules les requêtes SELECT et ASK sont autorisées.")
    columns = [str(v) for v in result.vars]
    rows = [{c: to_python(row[i]) for i, c in enumerate(columns)} for row in result]
    return {"type": "SELECT", "colonnes": columns, "resultats": rows}

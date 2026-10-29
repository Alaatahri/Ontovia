from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.common import subject_iri
from app.modules.chat import llm, service

router = APIRouter(prefix="/api/chat", tags=["Chat IA (NLP → SPARQL → LLM local)"])


class Tour(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    message: str = Field(min_length=2, max_length=500)
    historique: list[Tour] = Field(default_factory=list, max_length=20)
    contexte: dict | None = None


@router.get("/statut")
def statut():
    """Disponibilité du LLM local (Ollama) et modèle utilisé."""
    return llm.status()


@router.post("")
async def chat(body: ChatIn):
    """Réponse en flux NDJSON : {type: analyse | token | fin}."""
    events = service.chat(body.message.strip(), [t.model_dump() for t in body.historique], body.contexte)
    return StreamingResponse(events, media_type="application/x-ndjson")


@router.post("/synthese/patients/{patient_id}")
async def synthese_patient(patient_id: str):
    """Synthèse IA du dossier patient (données SPARQL + recommandations, rédigées par le LLM local)."""
    subject_iri(patient_id, "Patient", "Patient")
    return StreamingResponse(service.synthese_patient(patient_id), media_type="application/x-ndjson")

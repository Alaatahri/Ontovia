from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.modules.ia import recommender

router = APIRouter(prefix="/api/ia", tags=["API IA"])


class AlternativesIn(BaseModel):
    patientId: str
    medicamentIds: list[str] = Field(min_length=1, max_length=20)


class VerificateurIn(BaseModel):
    medicamentIds: list[str] = Field(min_length=1, max_length=20)
    conditionIds: list[str] = Field(default_factory=list, max_length=30)
    allergieIds: list[str] = Field(default_factory=list, max_length=30)


@router.get("/medicaments/{med_id}/similaires")
def similaires(med_id: str, limit: int = Query(default=5, ge=1, le=20)):
    return recommender.similar_medicaments(med_id, limit)


@router.get("/patients/{patient_id}/recommandations")
def recommandations(patient_id: str):
    return recommender.recommend_for_patient(patient_id)


@router.post("/alternatives")
def alternatives(body: AlternativesIn):
    return recommender.alternatives(body.patientId, body.medicamentIds)


@router.post("/verificateur")
def verificateur(body: VerificateurIn):
    return recommender.public_check(body.medicamentIds, body.conditionIds, body.allergieIds)

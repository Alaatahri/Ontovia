from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.modules.nlp import service

router = APIRouter(prefix="/api/nlp", tags=["Assistant NLP"])


class QuestionIn(BaseModel):
    question: str = Field(min_length=2, max_length=300)


@router.post("/query")
def query(body: QuestionIn):
    return service.answer(body.question.strip())


@router.get("/exemples")
def exemples():
    return service.examples()

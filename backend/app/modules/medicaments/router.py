from fastapi import APIRouter, Response

from app.modules.medicaments import repository
from app.modules.medicaments.schemas import MedicamentIn

router = APIRouter(prefix="/api/medicaments", tags=["Médicaments"])


@router.get("")
def list_medicaments(q: str | None = None, maladie: str | None = None, molecule: str | None = None,
                     laboratoire: str | None = None):
    return repository.list_medicaments(q=q, maladie=maladie, molecule=molecule, laboratoire=laboratoire)


@router.get("/{med_id}")
def get_medicament(med_id: str):
    return repository.get_medicament(med_id)


@router.post("", status_code=201)
def create_medicament(body: MedicamentIn):
    return repository.create_medicament(body)


@router.put("/{med_id}")
def update_medicament(med_id: str, body: MedicamentIn):
    return repository.update_medicament(med_id, body)


@router.delete("/{med_id}", status_code=204)
def delete_medicament(med_id: str):
    repository.delete_medicament(med_id)
    return Response(status_code=204)

from fastapi import APIRouter, Query, Response

from app.modules.patients import repository
from app.modules.patients.schemas import PatientIn

router = APIRouter(prefix="/api/patients", tags=["Patients"])


@router.get("")
def list_patients(q: str | None = None, maladie: str | None = None, condition: str | None = None,
                  ageMin: int | None = Query(default=None, ge=0, le=130),
                  ageMax: int | None = Query(default=None, ge=0, le=130)):
    return repository.list_patients(q=q, maladie=maladie, condition=condition, age_min=ageMin, age_max=ageMax)


@router.get("/{patient_id}")
def get_patient(patient_id: str):
    return repository.get_patient(patient_id)


@router.post("", status_code=201)
def create_patient(body: PatientIn):
    return repository.create_patient(body)


@router.put("/{patient_id}")
def update_patient(patient_id: str, body: PatientIn):
    return repository.update_patient(patient_id, body)


@router.delete("/{patient_id}", status_code=204)
def delete_patient(patient_id: str):
    repository.delete_patient(patient_id)
    return Response(status_code=204)

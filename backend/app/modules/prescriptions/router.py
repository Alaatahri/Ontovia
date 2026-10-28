from fastapi import APIRouter, Response

from app.modules.prescriptions import repository
from app.modules.prescriptions.schemas import PrescriptionIn, RisqueCheckIn

router = APIRouter(prefix="/api/prescriptions", tags=["Prescriptions"])


@router.get("")
def list_prescriptions(q: str | None = None, patient: str | None = None, medecin: str | None = None,
                       medicament: str | None = None, risque: bool | None = None):
    return repository.list_prescriptions(q=q, patient=patient, medecin=medecin, medicament=medicament, risque=risque)


@router.post("/verifier-risques")
def verifier_risques(body: RisqueCheckIn):
    return repository.check_risks(body)


@router.get("/{presc_id}")
def get_prescription(presc_id: str):
    return repository.get_prescription(presc_id)


@router.post("", status_code=201)
def create_prescription(body: PrescriptionIn):
    return repository.create_prescription(body)


@router.put("/{presc_id}")
def update_prescription(presc_id: str, body: PrescriptionIn):
    return repository.update_prescription(presc_id, body)


@router.delete("/{presc_id}", status_code=204)
def delete_prescription(presc_id: str):
    repository.delete_prescription(presc_id)
    return Response(status_code=204)

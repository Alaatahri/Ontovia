from datetime import date

from fastapi import APIRouter, Query, Response

from app.modules.prescriptions import repository
from app.modules.prescriptions.schemas import DelivranceIn, PrescriptionIn, RisqueCheckIn

router = APIRouter(prefix="/api/prescriptions", tags=["Prescriptions"])


@router.get("")
def list_prescriptions(q: str | None = None, patient: str | None = None, medecin: str | None = None,
                       medicament: str | None = None, risque: bool | None = None, statut: str | None = None):
    return repository.list_prescriptions(q=q, patient=patient, medecin=medecin, medicament=medicament, risque=risque,
                                         statut=statut)


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


@router.get("/{presc_id}/pharmacies")
def pharmacies(presc_id: str):
    """Pharmacies capables de délivrer l'ordonnance (stock nx:disposeDe)."""
    return repository.pharmacies_pour_prescription(presc_id)


@router.post("/{presc_id}/delivrer")
def delivrer(presc_id: str, body: DelivranceIn):
    return repository.delivrer(presc_id, body.pharmacieId, body.dateDelivrance or date.today(), body.forcer)


@router.delete("/{presc_id}/delivrance")
def annuler_delivrance(presc_id: str):
    return repository.annuler_delivrance(presc_id)


pharmacies_router = APIRouter(prefix="/api/pharmacies", tags=["Pharmacies — disponibilité"])


@pharmacies_router.get("/disponibilite")
def disponibilite(medicaments: str = Query(..., description="Identifiants séparés par des virgules")):
    """Où trouver ces médicaments ? Pharmacies triées : celles qui ont tout en premier."""
    return repository.pharmacies_disponibilite([m for m in medicaments.split(",") if m])

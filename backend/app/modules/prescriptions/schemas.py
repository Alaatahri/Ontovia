from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class PrescriptionIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    patientId: str
    medecinId: str
    medicamentIds: list[str] = Field(min_length=1, max_length=20)
    datePrescription: date
    posologie: str | None = Field(default=None, max_length=500)
    dureeJours: int | None = Field(default=None, ge=1, le=3650)


class RisqueCheckIn(BaseModel):
    patientId: str
    medicamentIds: list[str] = Field(min_length=1, max_length=20)


class DelivranceIn(BaseModel):
    pharmacieId: str
    dateDelivrance: date | None = None
    forcer: bool = False

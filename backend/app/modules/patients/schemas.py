from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PatientIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    prenom: str = Field(min_length=1, max_length=80)
    nom: str = Field(min_length=1, max_length=80)
    age: int = Field(ge=0, le=130)
    sexe: Literal["M", "F"]
    maladieIds: list[str] = Field(default_factory=list, max_length=50)
    conditionIds: list[str] = Field(default_factory=list, max_length=50)
    allergieIds: list[str] = Field(default_factory=list, max_length=50)

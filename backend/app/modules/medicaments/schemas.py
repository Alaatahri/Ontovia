from pydantic import BaseModel, ConfigDict, Field


class MedicamentIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nom: str = Field(min_length=1, max_length=120)
    dosage: str | None = Field(default=None, max_length=60)
    formeGalenique: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=1000)
    laboratoireId: str | None = None
    moleculeIds: list[str] = Field(default_factory=list, max_length=50)
    maladieIds: list[str] = Field(default_factory=list, max_length=50)
    contreIndicationIds: list[str] = Field(default_factory=list, max_length=50)
    interactionIds: list[str] = Field(default_factory=list, max_length=50)

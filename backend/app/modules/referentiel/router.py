from typing import Any

from fastapi import APIRouter, Body, Response

from app.modules.referentiel import repository
from app.modules.referentiel.specs import SPECS, spec_to_json

router = APIRouter(prefix="/api/referentiels", tags=["Référentiels (médecins, personnel, pharmacies, maladies…)"])

EXEMPLE = {"classe": "Pharmacien", "champs": {"prenom": "Lina", "nom": "Gharbi", "telephone": "98 000 000"},
           "relations": {"lieux": ["Pharm_Ennasr"]}}


@router.get("")
def specifications():
    """Description des référentiels (champs, relations) : le front-end construit ses formulaires à partir d'elle."""
    return [spec_to_json(s) for s in SPECS.values()]


@router.get("/{entity_type}")
def list_entities(entity_type: str, q: str | None = None, classe: str | None = None):
    return repository.list_entities(entity_type, q=q, classe=classe)


@router.get("/{entity_type}/{entity_id}")
def get_entity(entity_type: str, entity_id: str):
    return repository.get_entity(entity_type, entity_id)


@router.post("/{entity_type}", status_code=201)
def create_entity(entity_type: str, body: dict[str, Any] = Body(..., examples=[EXEMPLE])):
    return repository.create_entity(entity_type, body)


@router.put("/{entity_type}/{entity_id}")
def update_entity(entity_type: str, entity_id: str, body: dict[str, Any] = Body(..., examples=[EXEMPLE])):
    return repository.update_entity(entity_type, entity_id, body)


@router.delete("/{entity_type}/{entity_id}", status_code=204)
def delete_entity(entity_type: str, entity_id: str):
    repository.delete_entity(entity_type, entity_id)
    return Response(status_code=204)

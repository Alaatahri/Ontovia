"""Déclaration des référentiels gérés en CRUD générique.

Chaque spécification décrit une classe de l'ontologie : ses propriétés de données (champs du formulaire),
ses relations sortantes (modifiables) et entrantes (affichées en lecture seule ; certaines bloquent la suppression).
Les requêtes SPARQL sont générées à partir de ces déclarations dans repository.py.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Field:
    key: str            # nom JSON, identique au nom de la propriété nx:<key>
    label: str
    kind: str = "text"  # text | textarea | int | email | tel
    required: bool = False
    in_list: bool = False
    max_length: int = 200


@dataclass(frozen=True)
class Relation:
    key: str
    predicate: str               # nom local de la propriété objet
    label: str
    target: tuple[str, ...]      # classes acceptées pour la cible
    options: str                 # clé de /api/references qui fournit les choix
    inverse: bool = False        # relation entrante (?x predicate ?s) : affichage seul
    blocks_delete: bool = False  # une relation entrante présente empêche la suppression (409)
    link: str | None = None      # chemin de la fiche cible dans le back-office


@dataclass(frozen=True)
class EntitySpec:
    type: str
    classes: tuple[tuple[str, str, str], ...]  # (classe OWL, libellé, préfixe d'identifiant) — plusieurs = choix
    label: str
    plural: str
    icon: str
    member: str
    description: str
    fields: tuple[Field, ...]
    relations: tuple[Relation, ...] = ()
    name_fields: tuple[str, ...] = ("nom",)


PRESCRIPTIONS_LINK = "/admin/prescriptions"

SPECS: dict[str, EntitySpec] = {s.type: s for s in [
    EntitySpec(
        type="medecins", classes=(("Medecin", "Médecin", "Doc"),), label="Médecin", plural="Médecins",
        icon="stethoscope", member="Membre 3",
        description="Médecins prescripteurs : spécialité, coordonnées et activité.",
        name_fields=("prenom", "nom"),
        fields=(
            Field("prenom", "Prénom", required=True, max_length=80),
            Field("nom", "Nom", required=True, max_length=80),
            Field("specialite", "Spécialité", required=True, in_list=True, max_length=80),
            Field("telephone", "Téléphone", "tel", in_list=True, max_length=30),
            Field("email", "E-mail", "email", max_length=120),
            Field("ville", "Ville", in_list=True, max_length=80),
        ),
        relations=(
            Relation("prescriptions", "prescritePar", "Prescriptions rédigées", ("Prescription",), "",
                     inverse=True, blocks_delete=True, link=PRESCRIPTIONS_LINK),
        ),
    ),
    EntitySpec(
        type="personnel", classes=(("Pharmacien", "Pharmacien", "Phar"), ("Infirmier", "Infirmier", "Inf")),
        label="Membre du personnel", plural="Personnel de santé", icon="users-round", member="Membre 3",
        description="Pharmaciens et infirmiers, rattachés à une pharmacie.",
        name_fields=("prenom", "nom"),
        fields=(
            Field("prenom", "Prénom", required=True, max_length=80),
            Field("nom", "Nom", required=True, max_length=80),
            Field("telephone", "Téléphone", "tel", in_list=True, max_length=30),
            Field("email", "E-mail", "email", max_length=120),
        ),
        relations=(
            Relation("lieux", "travailleDans", "Travaille dans", ("Pharmacie",), "pharmacies", link="/admin/pharmacies"),
        ),
    ),
    EntitySpec(
        type="pharmacies", classes=(("Pharmacie", "Pharmacie", "Pharm"),), label="Pharmacie", plural="Pharmacies",
        icon="store", member="Membre 3",
        description="Coordonnées, horaires, stock de médicaments et équipe.",
        fields=(
            Field("nom", "Nom", required=True, max_length=120),
            Field("adresse", "Adresse", max_length=200),
            Field("ville", "Ville", in_list=True, max_length=80),
            Field("telephone", "Téléphone", "tel", in_list=True, max_length=30),
            Field("horaires", "Horaires", max_length=120),
        ),
        relations=(
            Relation("stock", "disposeDe", "Médicaments en stock", ("Medicament",), "medicaments",
                     link="/admin/medicaments"),
            Relation("personnel", "travailleDans", "Personnel", ("Pharmacien", "Infirmier"), "",
                     inverse=True, link="/admin/personnel"),
            Relation("delivrees", "delivreePar", "Prescriptions délivrées", ("Prescription",), "",
                     inverse=True, blocks_delete=True, link=PRESCRIPTIONS_LINK),
        ),
    ),
    EntitySpec(
        type="maladies", classes=(("Maladie", "Maladie", "Mal"),), label="Maladie", plural="Maladies",
        icon="heart-pulse", member="Membre 2",
        description="Pathologies, traitements associés et patients concernés.",
        fields=(Field("nom", "Nom", required=True, max_length=120), Field("description", "Description", "textarea", in_list=True, max_length=1000)),
        relations=(
            Relation("traitements", "traite", "Médicaments qui la traitent", ("Medicament",), "", inverse=True,
                     link="/admin/medicaments"),
            Relation("contreIndiques", "aContreIndication", "Médicaments contre-indiqués", ("Medicament",), "",
                     inverse=True, link="/admin/medicaments"),
            Relation("patients", "souffreDe", "Patients atteints", ("Patient",), "", inverse=True,
                     blocks_delete=True, link="/admin/patients"),
        ),
    ),
    EntitySpec(
        type="conditions", classes=(("ConditionPhysiologique", "Condition physiologique", "Cond"),),
        label="Condition physiologique", plural="Conditions physiologiques", icon="baby", member="Membre 2",
        description="Grossesse, allaitement, sujet âgé… et médicaments à éviter.",
        fields=(Field("nom", "Nom", required=True, max_length=120), Field("description", "Description", "textarea", in_list=True, max_length=1000)),
        relations=(
            Relation("contreIndiques", "aContreIndication", "Médicaments contre-indiqués", ("Medicament",), "",
                     inverse=True, link="/admin/medicaments"),
            Relation("patients", "presenteCondition", "Patients concernés", ("Patient",), "", inverse=True,
                     blocks_delete=True, link="/admin/patients"),
        ),
    ),
    EntitySpec(
        type="molecules", classes=(("Molecule", "Molécule", "Mol"),), label="Molécule", plural="Molécules",
        icon="flask-conical", member="Membre 1",
        description="Principes actifs contenus dans les médicaments.",
        fields=(Field("nom", "Nom", required=True, max_length=120), Field("description", "Description", "textarea", in_list=True, max_length=1000)),
        relations=(
            Relation("medicaments", "contientMolecule", "Médicaments qui la contiennent", ("Medicament",), "",
                     inverse=True, link="/admin/medicaments"),
            Relation("allergiques", "estAllergiqueA", "Patients allergiques", ("Patient",), "", inverse=True,
                     blocks_delete=True, link="/admin/patients"),
        ),
    ),
    EntitySpec(
        type="laboratoires", classes=(("Laboratoire", "Laboratoire", "Lab"),), label="Laboratoire",
        plural="Laboratoires", icon="building-2", member="Membre 1",
        description="Laboratoires pharmaceutiques et médicaments fabriqués.",
        fields=(Field("nom", "Nom", required=True, max_length=120), Field("pays", "Pays", in_list=True, max_length=80),
                Field("description", "Description", "textarea", max_length=1000)),
        relations=(
            Relation("medicaments", "fabriquePar", "Médicaments fabriqués", ("Medicament",), "", inverse=True,
                     blocks_delete=True, link="/admin/medicaments"),
        ),
    ),
]}


def spec_to_json(spec: EntitySpec) -> dict:
    return {
        "type": spec.type, "label": spec.label, "plural": spec.plural, "icon": spec.icon, "member": spec.member,
        "description": spec.description,
        "classes": [{"id": c, "label": l} for c, l, _ in spec.classes],
        "fields": [f.__dict__ for f in spec.fields],
        "relations": [{k: v for k, v in r.__dict__.items() if k != "target"} for r in spec.relations],
    }

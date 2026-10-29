"""Intentions reconnues par l'assistant et génération des requêtes SPARQL correspondantes.

Chaque intention déclare :
- des mots-clés pondérés (comparés après racinisation, donc tolérants aux variations de forme) ;
- le ou les types d'entité attendus (individus du graphe) ;
- un générateur de requête SPARQL qui n'utilise que des IRI issues du graphe ou des nombres validés.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from app.core.rdf import ID_PATTERN, PREFIXES
from app.modules.nlp.analyzer import Analysis, Entity, stem

CONDITIONS = ("Maladie", "ConditionPhysiologique")

# Noms de classes reconnus dans la question (pour « liste des … », « combien de … »)
CLASS_WORDS = {
    "Medicament": ["medicament", "medicaments", "med", "meds", "medoc", "medocs", "traitements"],
    "Patient": ["patient", "patients", "malades"],
    "Medecin": ["medecin", "medecins", "docteur", "docteurs"],
    "Molecule": ["molecule", "molecules", "principes"],
    "Maladie": ["maladie", "maladies", "pathologies"],
    "Laboratoire": ["laboratoire", "laboratoires", "labos"],
    "Prescription": ["prescription", "prescriptions", "ordonnance", "ordonnances"],
    "Pharmacie": ["pharmacie", "pharmacies", "officine", "officines"],
    "Pharmacien": ["pharmacien", "pharmaciens", "pharmacienne"],
    "Infirmier": ["infirmier", "infirmiers", "infirmiere", "infirmieres"],
}
CLASS_STEMS = {stem(w): cls for cls, words in CLASS_WORDS.items() for w in words}
CLASS_LABELS = {"Medicament": "médicaments", "Patient": "patients", "Medecin": "médecins",
                "Molecule": "molécules", "Maladie": "maladies", "Laboratoire": "laboratoires",
                "Prescription": "prescriptions", "Pharmacie": "pharmacies", "Pharmacien": "pharmaciens",
                "Infirmier": "infirmiers"}


def node(entity: Entity) -> str:
    if not ID_PATTERN.match(entity.id):
        raise ValueError(f"Identifiant d'entité invalide : {entity.id}")
    return f"nx:{entity.id}"


def detect_class(analysis: Analysis) -> str | None:
    for token in analysis.tokens:
        if token.stem in CLASS_STEMS:
            return CLASS_STEMS[token.stem]
    return None


@dataclass
class Context:
    analysis: Analysis
    entity: Entity | None = None
    cls: str | None = None
    number: int | None = None


@dataclass
class Intent:
    id: str
    label: str
    keywords: dict[str, float]
    build: Callable[[Context], tuple[str, str]]
    suggestion: str
    entity_types: tuple[str, ...] | None = None
    needs_class: bool = False
    needs_number: bool = False
    stems: dict[str, float] = field(init=False)

    def __post_init__(self):
        self.stems = {}
        for word, weight in self.keywords.items():
            key = stem(word)
            self.stems[key] = max(self.stems.get(key, 0), weight)


PATIENT_NAME = 'BIND(CONCAT(COALESCE(?prenom, ""), " ", ?nomP) AS ?patient)'


def q_traitement(c: Context):
    return f"""SELECT DISTINCT ?medicament ?dosage ?forme WHERE {{
  ?m a nx:Medicament ;
     nx:traite {node(c.entity)} ;
     nx:nom ?medicament .
  OPTIONAL {{ ?m nx:dosage ?dosage }}
  OPTIONAL {{ ?m nx:formeGalenique ?forme }}
}}
ORDER BY ?medicament""", f"Médicaments qui traitent « {c.entity.nom} » (relation nx:traite)."


def q_contre_indications(c: Context):
    return f"""SELECT DISTINCT ?contreIndication ?categorie WHERE {{
  {node(c.entity)} nx:aContreIndication ?c .
  ?c nx:nom ?contreIndication ;
     a ?classe .
  FILTER(?classe IN (nx:Maladie, nx:ConditionPhysiologique))
  BIND(IF(?classe = nx:Maladie, "Maladie", "Condition physiologique") AS ?categorie)
}}
ORDER BY ?contreIndication""", f"Contre-indications de « {c.entity.nom} » (relation nx:aContreIndication)."


def q_patients_condition(c: Context):
    return f"""SELECT DISTINCT ?patient ?age ?sexe WHERE {{
  ?p a nx:Patient ;
     nx:souffreDe|nx:presenteCondition {node(c.entity)} ;
     nx:nom ?nomP .
  OPTIONAL {{ ?p nx:prenom ?prenom }}
  OPTIONAL {{ ?p nx:age ?age }}
  OPTIONAL {{ ?p nx:sexe ?sexe }}
  {PATIENT_NAME}
}}
ORDER BY ?patient""", (f"Patients concernés par « {c.entity.nom} » "
                       "(relations nx:souffreDe ou nx:presenteCondition).")


def q_molecules(c: Context):
    return f"""SELECT ?molecule WHERE {{
  {node(c.entity)} nx:contientMolecule ?mol .
  ?mol nx:nom ?molecule .
}}
ORDER BY ?molecule""", f"Molécules contenues dans « {c.entity.nom} » (relation nx:contientMolecule)."


def q_medicaments_molecule(c: Context):
    return f"""SELECT ?medicament ?dosage WHERE {{
  ?m nx:contientMolecule {node(c.entity)} ;
     nx:nom ?medicament .
  OPTIONAL {{ ?m nx:dosage ?dosage }}
}}
ORDER BY ?medicament""", f"Médicaments contenant « {c.entity.nom} » (relation nx:contientMolecule)."


def q_interactions(c: Context):
    return f"""SELECT DISTINCT ?medicament WHERE {{
  {node(c.entity)} nx:interagitAvec|^nx:interagitAvec ?m .
  ?m nx:nom ?medicament .
}}
ORDER BY ?medicament""", (f"Médicaments en interaction avec « {c.entity.nom} » "
                          "(propriété symétrique nx:interagitAvec, parcourue dans les deux sens).")


def q_contre_indiques_condition(c: Context):
    return f"""SELECT DISTINCT ?medicament ?dosage WHERE {{
  ?m a nx:Medicament ;
     nx:aContreIndication {node(c.entity)} ;
     nx:nom ?medicament .
  OPTIONAL {{ ?m nx:dosage ?dosage }}
}}
ORDER BY ?medicament""", f"Médicaments contre-indiqués en cas de « {c.entity.nom} »."


def q_dossier_patient(c: Context):
    return f"""SELECT ?element ?categorie WHERE {{
  {{ {node(c.entity)} nx:souffreDe ?x . BIND("Maladie" AS ?categorie) }}
  UNION {{ {node(c.entity)} nx:presenteCondition ?x . BIND("Condition physiologique" AS ?categorie) }}
  UNION {{ {node(c.entity)} nx:estAllergiqueA ?x . BIND("Allergie" AS ?categorie) }}
  ?x nx:nom ?element .
}}
ORDER BY ?categorie ?element""", f"Maladies, conditions et allergies de {c.entity.nom}."


def q_allergies_patient(c: Context):
    return f"""SELECT ?molecule ?medicamentAEviter WHERE {{
  {node(c.entity)} nx:estAllergiqueA ?mol .
  ?mol nx:nom ?molecule .
  OPTIONAL {{ ?m nx:contientMolecule ?mol ; nx:nom ?medicamentAEviter }}
}}
ORDER BY ?molecule""", f"Allergies de {c.entity.nom} et médicaments qui contiennent ces molécules."


def q_patients_allergiques(c: Context):
    return f"""SELECT ?patient ?age WHERE {{
  ?p a nx:Patient ;
     nx:estAllergiqueA {node(c.entity)} ;
     nx:nom ?nomP .
  OPTIONAL {{ ?p nx:prenom ?prenom }}
  OPTIONAL {{ ?p nx:age ?age }}
  {PATIENT_NAME}
}}""", f"Patients allergiques à « {c.entity.nom} » (relation nx:estAllergiqueA)."


def q_prescriptions_patient(c: Context):
    return f"""SELECT ?prescription ?date ?medecin ?medicament WHERE {{
  ?p a nx:Prescription ;
     nx:concernePatient {node(c.entity)} ;
     nx:prescritMedicament ?m .
  ?m nx:nom ?medicament .
  OPTIONAL {{ ?p nx:datePrescription ?date }}
  OPTIONAL {{ ?p nx:prescritePar ?d . ?d nx:nom ?nomD . OPTIONAL {{ ?d nx:prenom ?prenomD }} }}
  BIND(STRAFTER(STR(?p), "#") AS ?prescription)
  BIND(CONCAT("Dr ", COALESCE(?prenomD, ""), " ", COALESCE(?nomD, "")) AS ?medecin)
}}
ORDER BY DESC(?date) ?prescription""", f"Prescriptions de {c.entity.nom}."


def q_prescriptions_medecin(c: Context):
    return f"""SELECT ?prescription ?date ?patient ?medicament WHERE {{
  ?p a nx:Prescription ;
     nx:prescritePar {node(c.entity)} ;
     nx:concernePatient ?pat ;
     nx:prescritMedicament ?m .
  ?pat nx:nom ?nomP .
  OPTIONAL {{ ?pat nx:prenom ?prenom }}
  ?m nx:nom ?medicament .
  OPTIONAL {{ ?p nx:datePrescription ?date }}
  BIND(STRAFTER(STR(?p), "#") AS ?prescription)
  {PATIENT_NAME}
}}
ORDER BY DESC(?date) ?prescription""", f"Prescriptions rédigées par {c.entity.nom}."


def q_medicaments_laboratoire(c: Context):
    return f"""SELECT ?medicament ?dosage WHERE {{
  ?m nx:fabriquePar {node(c.entity)} ;
     nx:nom ?medicament .
  OPTIONAL {{ ?m nx:dosage ?dosage }}
}}
ORDER BY ?medicament""", f"Médicaments fabriqués par {c.entity.nom}."


def q_prescriptions_risque(c: Context):
    return """SELECT DISTINCT ?prescription ?patient ?medicament ?risque WHERE {
  ?p a nx:Prescription ;
     nx:concernePatient ?pat ;
     nx:prescritMedicament ?m .
  ?pat nx:nom ?nomP .
  OPTIONAL { ?pat nx:prenom ?prenom }
  ?m nx:nom ?medicament .
  {
    ?m nx:aContreIndication ?c .
    ?pat nx:souffreDe|nx:presenteCondition ?c .
    ?c nx:nom ?cNom .
    BIND(CONCAT("Contre-indication : ", ?cNom) AS ?risque)
  } UNION {
    ?m nx:contientMolecule ?mol .
    ?pat nx:estAllergiqueA ?mol .
    ?mol nx:nom ?molNom .
    BIND(CONCAT("Allergie : ", ?molNom) AS ?risque)
  } UNION {
    ?p nx:prescritMedicament ?m2 .
    ?m nx:interagitAvec|^nx:interagitAvec ?m2 .
    ?m2 nx:nom ?m2Nom .
    BIND(CONCAT("Interaction avec ", ?m2Nom) AS ?risque)
  }
  BIND(STRAFTER(STR(?p), "#") AS ?prescription)
  BIND(CONCAT(COALESCE(?prenom, ""), " ", ?nomP) AS ?patient)
}
ORDER BY ?prescription""", ("Prescriptions présentant un risque détecté par SPARQL "
                            "(contre-indication, allergie ou interaction).")


def q_patients_age(c: Context):
    stems = c.analysis.stems
    operator = "<" if stem("moins") in stems or stem("jeunes") in stems else ">"
    return f"""SELECT ?patient ?age WHERE {{
  ?p a nx:Patient ;
     nx:age ?age ;
     nx:nom ?nomP .
  OPTIONAL {{ ?p nx:prenom ?prenom }}
  FILTER(?age {operator} {int(c.number)})
  {PATIENT_NAME}
}}
ORDER BY DESC(?age)""", f"Patients dont l'âge est {'inférieur' if operator == '<' else 'supérieur'} à {c.number} ans."


def q_liste(c: Context):
    if c.cls in ("Patient", "Medecin", "Pharmacien", "Infirmier"):
        return f"""SELECT ?nom WHERE {{
  ?x a nx:{c.cls} ;
     nx:nom ?nomP .
  OPTIONAL {{ ?x nx:prenom ?prenom }}
  BIND(CONCAT(COALESCE(?prenom, ""), " ", ?nomP) AS ?nom)
}}
ORDER BY ?nomP""", f"Liste des {CLASS_LABELS[c.cls]}."
    if c.cls == "Prescription":
        return """SELECT ?prescription ?date WHERE {
  ?x a nx:Prescription .
  OPTIONAL { ?x nx:datePrescription ?date }
  BIND(STRAFTER(STR(?x), "#") AS ?prescription)
}
ORDER BY DESC(?date)""", "Liste des prescriptions."
    return f"""SELECT ?nom WHERE {{
  ?x a nx:{c.cls} ;
     nx:nom ?nom .
}}
ORDER BY ?nom""", f"Liste des {CLASS_LABELS[c.cls]}."


def q_pharmacies_medicament(c: Context):
    return f"""SELECT ?pharmacie ?ville ?horaires WHERE {{
  ?ph a nx:Pharmacie ;
      nx:disposeDe {node(c.entity)} ;
      nx:nom ?pharmacie .
  OPTIONAL {{ ?ph nx:ville ?ville }}
  OPTIONAL {{ ?ph nx:horaires ?horaires }}
}}
ORDER BY ?ville ?pharmacie""", f"Pharmacies qui disposent de « {c.entity.nom} » (relation nx:disposeDe)."


def q_stock_pharmacie(c: Context):
    return f"""SELECT ?medicament ?dosage WHERE {{
  {node(c.entity)} nx:disposeDe ?m .
  ?m nx:nom ?medicament .
  OPTIONAL {{ ?m nx:dosage ?dosage }}
}}
ORDER BY ?medicament""", f"Médicaments en stock à « {c.entity.nom} »."


def q_personnel_pharmacie(c: Context):
    return f"""SELECT ?nom ?fonction ?telephone WHERE {{
  ?x nx:travailleDans {node(c.entity)} ;
     a ?classe ;
     nx:nom ?nomP .
  FILTER(?classe IN (nx:Pharmacien, nx:Infirmier))
  OPTIONAL {{ ?x nx:prenom ?prenom }}
  OPTIONAL {{ ?x nx:telephone ?telephone }}
  BIND(STRAFTER(STR(?classe), "#") AS ?fonction)
  BIND(CONCAT(COALESCE(?prenom, ""), " ", ?nomP) AS ?nom)
}}""", f"Personnel qui travaille à « {c.entity.nom} » (relation nx:travailleDans)."


def q_fiche(c: Context):
    """Toutes les informations connues sur un individu : type, propriétés et relations (sortantes et entrantes)."""
    return f"""SELECT ?propriete ?valeur WHERE {{
  {{
    {node(c.entity)} a ?classe .
    ?classe rdfs:label ?valeur .
    BIND("type" AS ?propriete)
  }} UNION {{
    {node(c.entity)} ?p ?o .
    ?p rdfs:label ?propriete .
    FILTER(?p != rdfs:label && ?p != nx:nom && ?p != nx:prenom)
    OPTIONAL {{ ?o nx:nom ?oNom }}
    OPTIONAL {{ ?o nx:prenom ?oPrenom }}
    BIND(IF(isIRI(?o), CONCAT(COALESCE(CONCAT(?oPrenom, " "), ""), COALESCE(?oNom, STRAFTER(STR(?o), "#"))), STR(?o)) AS ?valeur)
  }} UNION {{
    ?s ?p {node(c.entity)} .
    ?p rdfs:label ?pl .
    ?s nx:nom ?sNom .
    OPTIONAL {{ ?s nx:prenom ?sPrenom }}
    BIND(CONCAT("(relation entrante) ", ?pl) AS ?propriete)
    BIND(CONCAT(COALESCE(CONCAT(?sPrenom, " "), ""), ?sNom) AS ?valeur)
  }}
}}
ORDER BY ?propriete ?valeur""", f"Fiche de « {c.entity.nom} » : type, propriétés et relations dans l'ontologie."


def q_compter(c: Context):
    return f"""SELECT (COUNT(DISTINCT ?x) AS ?nombre) WHERE {{
  ?x a nx:{c.cls} .
}}""", f"Nombre de {CLASS_LABELS[c.cls]} dans l'ontologie."


INTENTS: list[Intent] = [
    Intent("traitement_maladie", "Rechercher les traitements d'une maladie",
           {"traite": 3, "traitent": 3, "traiter": 3, "traitement": 3, "traitements": 3, "soigne": 3,
            "soignent": 3, "soigner": 3, "soulage": 3, "soulager": 3, "guerir": 3, "remede": 3, "remedes": 3,
            "prendre": 2, "contre": 1, "medicament": 1, "medicaments": 1, "med": 1, "medoc": 1, "efficace": 1,
            "pour": 0.5},
           q_traitement, "Quels médicaments traitent {x} ?", entity_types=("Maladie",)),
    Intent("contre_indications_medicament", "Contre-indications d'un médicament",
           {"indications": 3, "indication": 3, "indique": 3, "indiquee": 3, "eviter": 2, "deconseille": 2,
            "interdit": 2, "dangereux": 2, "danger": 2, "precautions": 2, "quand": 0.5},
           q_contre_indications, "Quelles sont les contre-indications de {x} ?", entity_types=("Medicament",)),
    Intent("patients_condition", "Patients atteints d'une maladie ou condition",
           {"patient": 2, "patients": 2, "souffre": 3, "souffrent": 3, "souffrant": 3, "atteint": 3,
            "atteints": 3, "atteintes": 3, "malades": 2, "personnes": 1, "qui": 1, "ont": 1, "sont": 0.5},
           q_patients_condition, "Quels patients souffrent de {x} ?", entity_types=CONDITIONS),
    Intent("molecules_medicament", "Composition d'un médicament",
           {"molecule": 3, "molecules": 3, "composition": 3, "compose": 3, "contient": 2, "contiennent": 2,
            "principe": 3, "actif": 2, "actifs": 2, "substance": 3, "substances": 3},
           q_molecules, "Quelles molécules contient {x} ?", entity_types=("Medicament",)),
    Intent("medicaments_molecule", "Médicaments contenant une molécule",
           {"contient": 3, "contiennent": 3, "contenant": 3, "base": 2, "medicament": 1, "medicaments": 1},
           q_medicaments_molecule, "Quels médicaments contiennent {x} ?", entity_types=("Molecule",)),
    Intent("interactions_medicament", "Interactions d'un médicament",
           {"interaction": 3, "interactions": 3, "interagit": 3, "interagissent": 3, "associer": 2,
            "combiner": 2, "melanger": 2, "avec": 1},
           q_interactions, "Avec quels médicaments {x} interagit-il ?", entity_types=("Medicament",)),
    Intent("contre_indiques_condition", "Médicaments contre-indiqués pour une condition",
           {"indique": 3, "indiques": 3, "indication": 3, "indications": 3, "eviter": 3, "deconseille": 3,
            "deconseilles": 3, "interdit": 3, "interdits": 3, "dangereux": 3, "medicament": 1, "medicaments": 1},
           q_contre_indiques_condition, "Quels médicaments sont contre-indiqués en cas de {x} ?",
           entity_types=CONDITIONS),
    Intent("dossier_patient", "Maladies et conditions d'un patient",
           {"souffre": 3, "maladie": 3, "maladies": 3, "pathologie": 3, "pathologies": 3, "atteint": 3,
            "condition": 3, "conditions": 3, "dossier": 2, "quoi": 1},
           q_dossier_patient, "De quoi souffre {x} ?", entity_types=("Patient",)),
    Intent("allergies_patient", "Allergies d'un patient",
           {"allergie": 4, "allergies": 4, "allergique": 4},
           q_allergies_patient, "Quelles sont les allergies de {x} ?", entity_types=("Patient",)),
    Intent("patients_allergiques", "Patients allergiques à une molécule",
           {"allergie": 3, "allergies": 3, "allergique": 3, "allergiques": 3, "qui": 1, "patients": 1},
           q_patients_allergiques, "Quels patients sont allergiques à {x} ?", entity_types=("Molecule",)),
    Intent("prescriptions_patient", "Prescriptions d'un patient",
           {"prescription": 3, "prescriptions": 3, "ordonnance": 3, "ordonnances": 3, "prescrit": 3,
            "prend": 2, "traitement": 2, "medicaments": 1},
           q_prescriptions_patient, "Quelles sont les prescriptions de {x} ?", entity_types=("Patient",)),
    Intent("prescriptions_medecin", "Prescriptions d'un médecin",
           {"prescription": 3, "prescriptions": 3, "ordonnance": 3, "ordonnances": 3, "prescrit": 3,
            "redige": 2, "patients": 1},
           q_prescriptions_medecin, "Quelles prescriptions a rédigées {x} ?", entity_types=("Medecin",)),
    Intent("medicaments_laboratoire", "Médicaments d'un laboratoire",
           {"fabrique": 3, "fabriques": 3, "produit": 3, "produits": 3, "laboratoire": 2, "medicaments": 1},
           q_medicaments_laboratoire, "Quels médicaments sont fabriqués par {x} ?",
           entity_types=("Laboratoire",)),
    Intent("pharmacies_medicament", "Pharmacies qui disposent d'un médicament",
           {"pharmacie": 3, "pharmacies": 3, "trouver": 3, "acheter": 3, "disponible": 3, "dispo": 2, "stock": 2,
            "ou": 1, "officine": 3},
           q_pharmacies_medicament, "Où trouver {x} ?", entity_types=("Medicament",)),
    Intent("stock_pharmacie", "Stock d'une pharmacie",
           {"stock": 3, "dispose": 3, "disponibles": 3, "vend": 3, "medicaments": 1, "quels": 0.5},
           q_stock_pharmacie, "Quels médicaments sont disponibles à {x} ?", entity_types=("Pharmacie",)),
    Intent("personnel_pharmacie", "Personnel d'une pharmacie",
           {"travaille": 3, "travaillent": 3, "personnel": 3, "pharmacien": 3, "pharmaciens": 3, "infirmier": 2,
            "qui": 1, "equipe": 3},
           q_personnel_pharmacie, "Qui travaille à {x} ?", entity_types=("Pharmacie",)),
    Intent("prescriptions_risque", "Prescriptions à risque",
           {"risque": 3, "risques": 3, "risquee": 3, "risquees": 3, "dangereuse": 3, "dangereuses": 3,
            "alerte": 3, "alertes": 3, "probleme": 2, "problemes": 2},
           q_prescriptions_risque, "Quelles prescriptions présentent un risque ?"),
    Intent("fiche", "Fiche d'un élément de l'ontologie",
           {"parle": 3, "parler": 3, "definition": 3, "decris": 3, "decrire": 3, "description": 3, "explique": 3,
            "expliquer": 3, "informations": 3, "information": 3, "infos": 3, "info": 3, "details": 3, "fiche": 3,
            "presente": 3, "presenter": 3, "quoi": 2, "est": 0.5},
           q_fiche, "Parle-moi de {x}",
           entity_types=("Medicament", "Molecule", "Maladie", "ConditionPhysiologique", "Patient", "Medecin",
                         "Laboratoire", "Pharmacie", "Pharmacien", "Infirmier")),
    Intent("patients_age", "Patients selon l'âge",
           {"ans": 2, "age": 2, "ages": 2, "agee": 2, "plus": 1, "moins": 1, "jeunes": 1, "vieux": 1},
           q_patients_age, "Quels patients ont plus de 60 ans ?", needs_number=True),
    Intent("compter", "Compter les individus d'une classe",
           {"combien": 3, "nombre": 3, "total": 2},
           q_compter, "Combien de patients sont enregistrés ?", needs_class=True),
    Intent("liste", "Lister les individus d'une classe",
           {"liste": 2, "lister": 2, "tous": 1.5, "toutes": 1.5, "affiche": 1.5, "afficher": 1.5,
            "montre": 1.5, "montrer": 1.5, "quels": 0.5, "quelles": 0.5, "existe": 1},
           q_liste, "Liste des médicaments", needs_class=True),
]

ENTITY_BONUS = 2.0


def match_intent(analysis: Analysis) -> tuple[Intent, Context, float] | None:
    best: tuple[Intent, Context, float] | None = None
    stems = analysis.stems
    for intent in INTENTS:
        score = sum(w for s, w in intent.stems.items() if s in stems)
        if score <= 0:
            continue
        ctx = Context(analysis)
        if intent.entity_types:
            candidates = [e for e in analysis.entities if e.type in intent.entity_types]
            if not candidates:
                continue
            ctx.entity = max(candidates, key=lambda e: e.score)
            score += ENTITY_BONUS
        if intent.needs_class:
            ctx.cls = detect_class(analysis)
            if not ctx.cls:
                continue
        if intent.needs_number:
            if not analysis.numbers:
                continue
            ctx.number = analysis.numbers[0]
        if best is None or score > best[2]:
            best = (intent, ctx, score)
    return best


def suggestions_for(analysis: Analysis) -> list[str]:
    """Propose des questions valides à partir des entités reconnues (ou des exemples par défaut)."""
    result: list[str] = []
    for entity in analysis.entities:
        for intent in INTENTS:
            if intent.entity_types and entity.type in intent.entity_types:
                result.append(intent.suggestion.format(x=entity.nom))
    return list(dict.fromkeys(result))[:5] or EXAMPLES[:4]


EXAMPLES = [
    "Quels médicaments traitent la migraine ?",
    "Quelles sont les contre-indications de l'aspirine ?",
    "Quels patients souffrent de migraine ?",
    "Que prendre contre la fièvre ?",
    "Quelles molécules contient l'Augmentin ?",
    "Quels médicaments éviter pendant la grossesse ?",
    "Avec quoi la Coumadine interagit-elle ?",
    "De quoi souffre Youssef Hammami ?",
    "Quelles prescriptions présentent un risque ?",
    "Quels patients ont plus de 60 ans ?",
    "Qui est allergique à l'amoxicilline ?",
    "Combien de médicaments sont enregistrés ?",
    "Où trouver le Coumadine ?",
    "Qui travaille à la pharmacie Ennasr ?",
]


def full_query(body: str) -> str:
    return PREFIXES + "\n" + body

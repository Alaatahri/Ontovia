"""Services IA (sans LLM) construits sur les connaissances de l'ontologie.

1. Similarité de médicaments — recommandation par contenu :
   chaque médicament est un vecteur de caractéristiques sémantiques (molécules, maladies traitées,
   contre-indications, laboratoire) pondéré par TF-IDF ; la proximité est la similarité cosinus.
2. Recommandation de traitements pour un patient — système à base de connaissances :
   candidats = médicaments qui traitent ses maladies ; exclusion des contre-indications et allergies ;
   pénalité pour les interactions avec ses traitements en cours ; bonus si plusieurs maladies sont couvertes.
3. Alternatives thérapeutiques — pour un médicament à risque, propose des médicaments qui traitent les
   mêmes maladies, sans risque pour le patient, classés par similarité avec le médicament d'origine.
"""
from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field

from app.core.common import resolve_refs, subject_iri
from app.core.graph_store import cached, store
from app.core.rdf import local_id, to_python

FEATURES_QUERY = """
SELECT ?m ?nom ?rel ?t ?tNom WHERE {
  ?m a nx:Medicament ; nx:nom ?nom .
  OPTIONAL {
    { ?m nx:contientMolecule ?t . BIND("molecule" AS ?rel) }
    UNION { ?m nx:traite ?t . BIND("maladie" AS ?rel) }
    UNION { ?m nx:aContreIndication ?t . BIND("contreIndication" AS ?rel) }
    UNION { ?m nx:fabriquePar ?t . BIND("laboratoire" AS ?rel) }
    UNION { { ?m nx:interagitAvec ?t } UNION { ?t nx:interagitAvec ?m } BIND("interaction" AS ?rel) }
    ?t nx:nom ?tNom .
  }
}
"""

PATIENT_QUERY = """
SELECT ?rel ?t ?tNom WHERE {
  { ?patient nx:souffreDe ?t . BIND("maladie" AS ?rel) }
  UNION { ?patient nx:presenteCondition ?t . BIND("condition" AS ?rel) }
  UNION { ?patient nx:estAllergiqueA ?t . BIND("allergie" AS ?rel) }
  UNION { ?presc nx:concernePatient ?patient ; nx:prescritMedicament ?t . BIND("traitement" AS ?rel) }
  ?t nx:nom ?tNom .
}
"""

# Poids de chaque type de caractéristique dans le vecteur (avant TF-IDF)
WEIGHTS = {"molecule": 3.0, "maladie": 2.0, "contreIndication": 1.0, "laboratoire": 0.5}
LABELS = {"molecule": "molécule", "maladie": "indication", "contreIndication": "contre-indication",
          "laboratoire": "laboratoire"}


@dataclass
class Med:
    id: str
    nom: str
    features: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))
    names: dict[str, str] = field(default_factory=dict)


@cached
def load_knowledge() -> dict[str, Med]:
    meds: dict[str, Med] = {}
    for r in store.select(FEATURES_QUERY):
        mid = local_id(r["m"])
        med = meds.setdefault(mid, Med(mid, to_python(r["nom"])))
        if r.get("t") is not None:
            tid = local_id(r["t"])
            med.features[to_python(r["rel"])].add(tid)
            med.names[tid] = to_python(r["tNom"])
    return meds


@cached
def _all_vectors() -> dict[str, dict[str, float]]:
    return _vectors(load_knowledge())


def _vectors(meds: dict[str, Med]) -> dict[str, dict[str, float]]:
    """Vecteurs TF-IDF : une caractéristique rare (ex. une molécule spécifique) pèse plus qu'une fréquente."""
    df: dict[str, int] = defaultdict(int)
    raw: dict[str, dict[str, float]] = {}
    for med in meds.values():
        vec = {}
        for rel, weight in WEIGHTS.items():
            for t in med.features.get(rel, ()):
                vec[f"{rel}:{t}"] = weight
        raw[med.id] = vec
        for key in vec:
            df[key] += 1
    n = len(meds)
    return {mid: {k: w * (math.log((1 + n) / (1 + df[k])) + 1) for k, w in vec.items()} for mid, vec in raw.items()}


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    dot = sum(w * b[k] for k, w in a.items() if k in b)
    na, nb = math.sqrt(sum(w * w for w in a.values())), math.sqrt(sum(w * w for w in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def _shared(a: Med, b: Med) -> list[str]:
    shared = []
    for rel in WEIGHTS:
        for t in sorted(a.features.get(rel, set()) & b.features.get(rel, set())):
            shared.append(f"{LABELS[rel]} : {a.names[t]}")
    return shared


def similar_medicaments(med_id: str, limit: int = 5) -> dict:
    subject_iri(med_id, "Medicament", "Médicament")
    meds = load_knowledge()
    vectors = _all_vectors()
    source = meds[med_id]
    scored = []
    for other in meds.values():
        if other.id == med_id:
            continue
        score = _cosine(vectors[med_id], vectors[other.id])
        if score > 0:
            scored.append({"id": other.id, "nom": other.nom, "score": round(score, 3),
                           "pointsCommuns": _shared(source, other)})
    scored.sort(key=lambda s: -s["score"])
    return {
        "medicament": {"id": source.id, "nom": source.nom},
        "methode": "Recommandation par contenu : vecteurs TF-IDF des relations de l'ontologie "
                   "(molécules ×3, indications ×2, contre-indications ×1, laboratoire ×0,5) et similarité cosinus.",
        "similaires": scored[:limit],
    }


def _risk_reasons(med: Med, conditions: set[str], allergies: set[str], current: set[str],
                  names: dict[str, str]) -> tuple[list[str], list[str]]:
    """Retourne (raisons d'exclusion, avertissements)."""
    exclusions = [f"contre-indiqué : {names.get(c, c)}" for c in sorted(med.features.get("contreIndication", set()) & conditions)]
    exclusions += [f"allergie : {names.get(a, a)}" for a in sorted(med.features.get("molecule", set()) & allergies)]
    warnings = [f"interaction avec {names.get(t, t)}" for t in sorted(med.features.get("interaction", set()) & current)]
    return exclusions, warnings


def _patient_profile(patient_id: str) -> dict[str, dict[str, str]]:
    uri = subject_iri(patient_id, "Patient", "Patient")
    profile: dict[str, dict[str, str]] = defaultdict(dict)
    for r in store.select(PATIENT_QUERY, {"patient": uri}):
        profile[to_python(r["rel"])][local_id(r["t"])] = to_python(r["tNom"])
    return profile


def recommend_for_patient(patient_id: str) -> dict:
    profile = _patient_profile(patient_id)
    meds = load_knowledge()
    maladies = profile.get("maladie", {})
    conditions = set(maladies) | set(profile.get("condition", {}))
    allergies = set(profile.get("allergie", {}))
    current = set(profile.get("traitement", {}))
    names = {k: v for d in profile.values() for k, v in d.items()} | {m.id: m.nom for m in meds.values()}

    par_maladie = []
    for mal_id, mal_nom in sorted(maladies.items(), key=lambda x: x[1]):
        recommandes, exclus = [], []
        for med in meds.values():
            if mal_id not in med.features.get("maladie", set()):
                continue
            exclusions, warnings = _risk_reasons(med, conditions, allergies, current, med.names | names)
            if exclusions:
                exclus.append({"id": med.id, "nom": med.nom, "raisons": exclusions})
                continue
            couvre = sorted(maladies[m] for m in med.features.get("maladie", set()) & set(maladies))
            score = 1.0 + 0.5 * (len(couvre) - 1) - 0.4 * len(warnings) + (0.2 if med.id in current else 0)
            recommandes.append({"id": med.id, "nom": med.nom, "score": round(score, 2),
                                "couvre": couvre, "avertissements": warnings, "dejaPrescrit": med.id in current})
        recommandes.sort(key=lambda r: (-r["score"], r["nom"]))
        par_maladie.append({"maladie": {"id": mal_id, "nom": mal_nom}, "recommandes": recommandes, "exclus": exclus})

    return {
        "patient": patient_id,
        "profil": {k: [{"id": i, "nom": n} for i, n in v.items()] for k, v in profile.items()},
        "methode": "Système de recommandation à base de connaissances : médicaments qui traitent chaque maladie "
                   "(nx:traite), exclusion des contre-indications (nx:aContreIndication) et allergies "
                   "(nx:estAllergiqueA), pénalité pour les interactions avec les traitements en cours, "
                   "bonus si plusieurs maladies du patient sont couvertes.",
        "avertissement": "Aide à la décision basée uniquement sur l'ontologie : ne remplace pas l'avis d'un médecin.",
        "recommandations": par_maladie,
    }


def alternatives(patient_id: str, medicament_ids: list[str]) -> dict:
    """Pour chaque médicament à risque de la prescription, propose des remplaçants sûrs."""
    resolve_refs(medicament_ids, "Medicament", "medicamentIds")
    profile = _patient_profile(patient_id)
    meds = load_knowledge()
    vectors = _all_vectors()
    maladies = set(profile.get("maladie", {}))
    conditions = maladies | set(profile.get("condition", {}))
    allergies = set(profile.get("allergie", {}))
    selected = set(medicament_ids)
    names = {k: v for d in profile.values() for k, v in d.items()}

    result = []
    for mid in medicament_ids:
        med = meds[mid]
        others = selected - {mid}
        exclusions, warnings = _risk_reasons(med, conditions, allergies, others, med.names | names)
        if not exclusions and not warnings:
            continue
        cibles = (med.features.get("maladie", set()) & maladies) or med.features.get("maladie", set())
        candidats = []
        for cand in meds.values():
            if cand.id in selected or not (cand.features.get("maladie", set()) & cibles):
                continue
            ex, warn = _risk_reasons(cand, conditions, allergies, others, cand.names | names)
            if ex or warn:
                continue
            candidats.append({
                "id": cand.id, "nom": cand.nom,
                "similarite": round(_cosine(vectors[mid], vectors[cand.id]), 3),
                "traite": sorted(med.names[m] for m in cand.features.get("maladie", set()) & cibles),
            })
        candidats.sort(key=lambda c: (-len(c["traite"]), -c["similarite"], c["nom"]))
        result.append({"medicament": {"id": mid, "nom": med.nom}, "problemes": exclusions + warnings,
                       "alternatives": candidats[:4]})
    return {
        "methode": "Alternatives = médicaments traitant les mêmes maladies, sans contre-indication, allergie "
                   "ni interaction pour ce patient, classés par nombre d'indications couvertes puis par "
                   "similarité cosinus avec le médicament remplacé.",
        "remplacements": result,
    }


CI_QUERY = """
SELECT ?m ?mNom ?c ?cNom WHERE {{
  {meds}
  {conds}
  ?m nx:aContreIndication ?c ; nx:nom ?mNom .
  ?c nx:nom ?cNom .
}}
"""

ALLERGY_QUERY = """
SELECT ?m ?mNom ?mol ?molNom WHERE {{
  {meds}
  {mols}
  ?m nx:contientMolecule ?mol ; nx:nom ?mNom .
  ?mol nx:nom ?molNom .
}}
"""


def public_check(medicament_ids: list[str], condition_ids: list[str], allergie_ids: list[str]) -> dict:
    """Vérificateur public : risques d'une liste de médicaments pour un profil anonyme (aucune donnée enregistrée)."""
    from app.core.rdf import values_block
    from app.modules.prescriptions.risks import AVERTISSEMENT, detect_risks

    meds = resolve_refs(medicament_ids, "Medicament", "medicamentIds")
    conds = resolve_refs(condition_ids, ("Maladie", "ConditionPhysiologique"), "conditionIds")
    mols = resolve_refs(allergie_ids, "Molecule", "allergieIds")
    base = detect_risks(None, meds)
    risques = list(base["risques"])
    if conds:
        for r in store.select(CI_QUERY.format(meds=values_block("m", meds), conds=values_block("c", conds))):
            risques.insert(0, {
                "type": "CONTRE_INDICATION", "gravite": "elevee", "medicaments": [local_id(r["m"])],
                "explication": f"{to_python(r['mNom'])} est contre-indiqué en cas de « {to_python(r['cNom'])} ».",
                "relation": "aContreIndication",
            })
    if mols:
        for r in store.select(ALLERGY_QUERY.format(meds=values_block("m", meds), mols=values_block("mol", mols))):
            risques.insert(0, {
                "type": "ALLERGIE", "gravite": "elevee", "medicaments": [local_id(r["m"])],
                "explication": f"{to_python(r['mNom'])} contient « {to_python(r['molNom'])} » (allergie déclarée).",
                "relation": "contientMolecule",
            })
    return {"risques": risques, "methode": base["methode"], "avertissement": AVERTISSEMENT, "requetes": base["requetes"]}


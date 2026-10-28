"""Génère l'ontologie Nexora (fichier OWL au format RDF/XML) avec ses individus de démonstration.

Usage (depuis le dossier backend) :
    python -m scripts.seed_ontology            # écrit ontology/nexora.owl
    python -m scripts.seed_ontology --out x.owl

Attention : le fichier généré remplace le graphe partagé utilisé par l'API.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from rdflib import OWL, RDF, RDFS, XSD, Graph, Literal, Namespace, URIRef

NX = Namespace("http://www.nexora.org/ontologie/pharma#")
ONTOLOGY_IRI = URIRef("http://www.nexora.org/ontologie/pharma")


def build_schema(g: Graph) -> None:
    g.add((ONTOLOGY_IRI, RDF.type, OWL.Ontology))
    g.add((ONTOLOGY_IRI, RDFS.label, Literal("Nexora — Ontologie Pharmaceutique et Santé", lang="fr")))
    g.add((ONTOLOGY_IRI, RDFS.comment, Literal(
        "Ontologie de gestion des médicaments, des patients et des prescriptions.", lang="fr")))

    classes = {
        "Personne": (None, "Personne"),
        "Patient": ("Personne", "Patient"),
        "Medecin": ("Personne", "Médecin"),
        "Medicament": (None, "Médicament"),
        "Molecule": (None, "Molécule (principe actif)"),
        "Laboratoire": (None, "Laboratoire pharmaceutique"),
        "Condition": (None, "Condition médicale"),
        "Maladie": ("Condition", "Maladie"),
        "ConditionPhysiologique": ("Condition", "Condition physiologique (grossesse, allaitement…)"),
        "Prescription": (None, "Prescription"),
    }
    for name, (parent, label) in classes.items():
        g.add((NX[name], RDF.type, OWL.Class))
        g.add((NX[name], RDFS.label, Literal(label, lang="fr")))
        if parent:
            g.add((NX[name], RDFS.subClassOf, NX[parent]))

    disjoint_groups = [
        ["Personne", "Medicament", "Molecule", "Laboratoire", "Condition", "Prescription"],
        ["Patient", "Medecin"],
        ["Maladie", "ConditionPhysiologique"],
    ]
    for group in disjoint_groups:
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                g.add((NX[a], OWL.disjointWith, NX[b]))

    object_props = [
        # (nom, domaine, portée, libellé, caractéristiques)
        ("contientMolecule", "Medicament", "Molecule", "contient la molécule", []),
        ("traite", "Medicament", "Maladie", "traite", []),
        ("estTraitePar", "Maladie", "Medicament", "est traitée par", []),
        ("aContreIndication", "Medicament", "Condition", "a pour contre-indication", []),
        ("interagitAvec", "Medicament", "Medicament", "interagit avec", [OWL.SymmetricProperty]),
        ("fabriquePar", "Medicament", "Laboratoire", "est fabriqué par", [OWL.FunctionalProperty]),
        ("souffreDe", "Patient", "Maladie", "souffre de", []),
        ("presenteCondition", "Patient", "ConditionPhysiologique", "présente la condition", []),
        ("estAllergiqueA", "Patient", "Molecule", "est allergique à", []),
        ("concernePatient", "Prescription", "Patient", "concerne le patient", [OWL.FunctionalProperty]),
        ("prescritePar", "Prescription", "Medecin", "est prescrite par", [OWL.FunctionalProperty]),
        ("prescritMedicament", "Prescription", "Medicament", "prescrit le médicament", []),
    ]
    for name, domain, rng, label, extra in object_props:
        g.add((NX[name], RDF.type, OWL.ObjectProperty))
        for t in extra:
            g.add((NX[name], RDF.type, t))
        g.add((NX[name], RDFS.domain, NX[domain]))
        g.add((NX[name], RDFS.range, NX[rng]))
        g.add((NX[name], RDFS.label, Literal(label, lang="fr")))
    g.add((NX.estTraitePar, OWL.inverseOf, NX.traite))

    data_props = [
        ("nom", None, XSD.string, "nom"),
        ("prenom", "Personne", XSD.string, "prénom"),
        ("age", "Patient", XSD.integer, "âge"),
        ("sexe", "Patient", XSD.string, "sexe"),
        ("specialite", "Medecin", XSD.string, "spécialité"),
        ("dosage", "Medicament", XSD.string, "dosage"),
        ("formeGalenique", "Medicament", XSD.string, "forme galénique"),
        ("description", None, XSD.string, "description"),
        ("datePrescription", "Prescription", XSD.date, "date de prescription"),
        ("posologie", "Prescription", XSD.string, "posologie"),
        ("dureeJours", "Prescription", XSD.integer, "durée du traitement (jours)"),
    ]
    for name, domain, rng, label in data_props:
        g.add((NX[name], RDF.type, OWL.DatatypeProperty))
        if domain:
            g.add((NX[name], RDFS.domain, NX[domain]))
        g.add((NX[name], RDFS.range, rng))
        g.add((NX[name], RDFS.label, Literal(label, lang="fr")))
    for name in ("age", "sexe", "datePrescription"):
        g.add((NX[name], RDF.type, OWL.FunctionalProperty))


def individual(g: Graph, iri_name: str, cls: str, **props) -> URIRef:
    s = NX[iri_name]
    g.add((s, RDF.type, OWL.NamedIndividual))
    g.add((s, RDF.type, NX[cls]))
    for key, value in props.items():
        if value is None:
            continue
        if isinstance(value, int):
            g.add((s, NX[key], Literal(value, datatype=XSD.integer)))
        else:
            g.add((s, NX[key], Literal(value, datatype=XSD.string)))
    # rdfs:label : Protégé affiche les individus par leur nom (View › Render by label)
    label = " ".join(str(props[k]) for k in ("prenom", "nom") if props.get(k)) or iri_name
    g.add((s, RDFS.label, Literal(label, lang="fr")))
    return s


def link(g: Graph, s: str, prop: str, targets: list[str]) -> None:
    for t in targets:
        g.add((NX[s], NX[prop], NX[t]))


def build_individuals(g: Graph) -> None:
    labs = {
        "Lab_Bayer": "Bayer", "Lab_Sanofi": "Sanofi", "Lab_Pfizer": "Pfizer", "Lab_GSK": "GSK",
        "Lab_Merck": "Merck", "Lab_AstraZeneca": "AstraZeneca", "Lab_BMS": "Bristol-Myers Squibb",
        "Lab_MSD": "MSD",
    }
    for iri, nom in labs.items():
        individual(g, iri, "Laboratoire", nom=nom)

    molecules = {
        "Mol_AcideAcetylsalicylique": "Acide acétylsalicylique", "Mol_Paracetamol": "Paracétamol",
        "Mol_Ibuprofene": "Ibuprofène", "Mol_Amoxicilline": "Amoxicilline",
        "Mol_AcideClavulanique": "Acide clavulanique", "Mol_Metformine": "Metformine",
        "Mol_Salbutamol": "Salbutamol", "Mol_Lisinopril": "Lisinopril", "Mol_Warfarine": "Warfarine",
        "Mol_Sumatriptan": "Sumatriptan", "Mol_Omeprazole": "Oméprazole",
        "Mol_Propranolol": "Propranolol", "Mol_Simvastatine": "Simvastatine",
    }
    for iri, nom in molecules.items():
        individual(g, iri, "Molecule", nom=nom)

    maladies = {
        "Mal_Migraine": ("Migraine", "Céphalée primaire récurrente, souvent pulsatile."),
        "Mal_Hypertension": ("Hypertension artérielle", "Pression artérielle durablement élevée."),
        "Mal_Diabete2": ("Diabète de type 2", "Trouble chronique de la régulation de la glycémie."),
        "Mal_Asthme": ("Asthme", "Maladie inflammatoire chronique des voies respiratoires."),
        "Mal_Angine": ("Angine bactérienne", "Infection bactérienne des amygdales."),
        "Mal_Grippe": ("Grippe", "Infection virale respiratoire aiguë."),
        "Mal_Fievre": ("Fièvre", "Élévation de la température corporelle."),
        "Mal_UlcereGastrique": ("Ulcère gastrique", "Lésion de la muqueuse de l'estomac."),
        "Mal_RGO": ("Reflux gastro-œsophagien", "Remontée du contenu gastrique dans l'œsophage."),
        "Mal_InsuffisanceRenale": ("Insuffisance rénale", "Diminution de la fonction des reins."),
        "Mal_InsuffisanceHepatique": ("Insuffisance hépatique", "Diminution de la fonction du foie."),
        "Mal_Hypercholesterolemie": ("Hypercholestérolémie", "Taux de cholestérol sanguin élevé."),
        "Mal_FibrillationAuriculaire": ("Fibrillation auriculaire", "Trouble du rythme cardiaque."),
    }
    for iri, (nom, desc) in maladies.items():
        individual(g, iri, "Maladie", nom=nom, description=desc)

    conditions = {
        "Cond_Grossesse": ("Grossesse", "Patiente enceinte."),
        "Cond_Allaitement": ("Allaitement", "Patiente allaitante."),
        "Cond_SujetAge": ("Sujet âgé", "Patient de plus de 70 ans."),
        "Cond_Alcoolisme": ("Alcoolisme chronique", "Consommation chronique d'alcool."),
    }
    for iri, (nom, desc) in conditions.items():
        individual(g, iri, "ConditionPhysiologique", nom=nom, description=desc)

    # (iri, nom, dosage, forme, labo, molécules, maladies traitées, contre-indications)
    medicaments = [
        ("Med_Aspirine", "Aspirine", "500 mg", "Comprimé", "Lab_Bayer",
         ["Mol_AcideAcetylsalicylique"], ["Mal_Migraine", "Mal_Fievre"],
         ["Mal_UlcereGastrique", "Cond_Grossesse", "Mal_Asthme"]),
        ("Med_Doliprane", "Doliprane", "1000 mg", "Comprimé", "Lab_Sanofi",
         ["Mol_Paracetamol"], ["Mal_Migraine", "Mal_Fievre", "Mal_Grippe"],
         ["Mal_InsuffisanceHepatique"]),
        ("Med_Advil", "Advil", "400 mg", "Comprimé enrobé", "Lab_Pfizer",
         ["Mol_Ibuprofene"], ["Mal_Migraine", "Mal_Fievre"],
         ["Mal_UlcereGastrique", "Mal_InsuffisanceRenale", "Mal_InsuffisanceHepatique", "Cond_Grossesse"]),
        ("Med_Clamoxyl", "Clamoxyl", "1 g", "Comprimé dispersible", "Lab_GSK",
         ["Mol_Amoxicilline"], ["Mal_Angine"], []),
        ("Med_Augmentin", "Augmentin", "1 g / 125 mg", "Sachet", "Lab_GSK",
         ["Mol_Amoxicilline", "Mol_AcideClavulanique"], ["Mal_Angine"], ["Mal_InsuffisanceHepatique"]),
        ("Med_Glucophage", "Glucophage", "850 mg", "Comprimé", "Lab_Merck",
         ["Mol_Metformine"], ["Mal_Diabete2"],
         ["Mal_InsuffisanceRenale", "Mal_InsuffisanceHepatique", "Cond_Alcoolisme"]),
        ("Med_Ventoline", "Ventoline", "100 µg/dose", "Suspension pour inhalation", "Lab_GSK",
         ["Mol_Salbutamol"], ["Mal_Asthme"], []),
        ("Med_Zestril", "Zestril", "10 mg", "Comprimé", "Lab_AstraZeneca",
         ["Mol_Lisinopril"], ["Mal_Hypertension"], ["Cond_Grossesse", "Cond_Allaitement"]),
        ("Med_Coumadine", "Coumadine", "5 mg", "Comprimé sécable", "Lab_BMS",
         ["Mol_Warfarine"], ["Mal_FibrillationAuriculaire"], ["Cond_Grossesse", "Mal_UlcereGastrique"]),
        ("Med_Imigrane", "Imigrane", "50 mg", "Comprimé", "Lab_GSK",
         ["Mol_Sumatriptan"], ["Mal_Migraine"], ["Mal_Hypertension"]),
        ("Med_Mopral", "Mopral", "20 mg", "Gélule gastro-résistante", "Lab_AstraZeneca",
         ["Mol_Omeprazole"], ["Mal_UlcereGastrique", "Mal_RGO"], []),
        ("Med_Avlocardyl", "Avlocardyl", "40 mg", "Comprimé", "Lab_AstraZeneca",
         ["Mol_Propranolol"], ["Mal_Hypertension", "Mal_Migraine"], ["Mal_Asthme"]),
        ("Med_Zocor", "Zocor", "20 mg", "Comprimé", "Lab_MSD",
         ["Mol_Simvastatine"], ["Mal_Hypercholesterolemie"],
         ["Cond_Grossesse", "Cond_Allaitement", "Mal_InsuffisanceHepatique"]),
    ]
    for iri, nom, dosage, forme, labo, mols, mals, cis in medicaments:
        individual(g, iri, "Medicament", nom=nom, dosage=dosage, formeGalenique=forme)
        link(g, iri, "fabriquePar", [labo])
        link(g, iri, "contientMolecule", mols)
        link(g, iri, "traite", mals)
        link(g, iri, "aContreIndication", cis)

    interactions = [
        ("Med_Aspirine", "Med_Coumadine"), ("Med_Advil", "Med_Coumadine"),
        ("Med_Aspirine", "Med_Advil"), ("Med_Advil", "Med_Zestril"),
    ]
    for a, b in interactions:
        g.add((NX[a], NX.interagitAvec, NX[b]))

    medecins = [
        ("Doc_SamiBouazizi", "Sami", "Bouazizi", "Médecine générale"),
        ("Doc_RimKhelifi", "Rim", "Khelifi", "Neurologie"),
        ("Doc_HichemSaidi", "Hichem", "Saidi", "Cardiologie"),
        ("Doc_AmelFerchichi", "Amel", "Ferchichi", "Pneumologie"),
    ]
    for iri, prenom, nom, spec in medecins:
        individual(g, iri, "Medecin", prenom=prenom, nom=nom, specialite=spec)

    # (iri, prénom, nom, âge, sexe, maladies, conditions, allergies)
    patients = [
        ("Pat_AhmedBenAli", "Ahmed", "Ben Ali", 45, "M", ["Mal_Migraine", "Mal_Hypertension"], [], []),
        ("Pat_SalmaTrabelsi", "Salma", "Trabelsi", 29, "F", ["Mal_Migraine", "Mal_Asthme"],
         ["Cond_Grossesse"], []),
        ("Pat_MohamedGharbi", "Mohamed", "Gharbi", 67, "M",
         ["Mal_Diabete2", "Mal_InsuffisanceRenale", "Mal_Hypertension"], [], []),
        ("Pat_InesJaziri", "Ines", "Jaziri", 34, "F", ["Mal_Angine"], ["Cond_Allaitement"],
         ["Mol_Amoxicilline"]),
        ("Pat_YoussefHammami", "Youssef", "Hammami", 74, "M",
         ["Mal_FibrillationAuriculaire", "Mal_UlcereGastrique", "Mal_Hypercholesterolemie"],
         ["Cond_SujetAge"], []),
        ("Pat_LeilaMansour", "Leila", "Mansour", 52, "F",
         ["Mal_RGO", "Mal_Hypercholesterolemie", "Mal_InsuffisanceHepatique"], [], []),
        ("Pat_KarimJebali", "Karim", "Jebali", 23, "M", ["Mal_Asthme", "Mal_Grippe"], [],
         ["Mol_AcideAcetylsalicylique"]),
    ]
    for iri, prenom, nom, age, sexe, mals, conds, allergies in patients:
        individual(g, iri, "Patient", prenom=prenom, nom=nom, age=age, sexe=sexe)
        link(g, iri, "souffreDe", mals)
        link(g, iri, "presenteCondition", conds)
        link(g, iri, "estAllergiqueA", allergies)

    # (iri, patient, médecin, médicaments, date, posologie, durée)
    prescriptions = [
        ("Presc_001", "Pat_AhmedBenAli", "Doc_RimKhelifi", ["Med_Imigrane"], "2026-09-02",
         "1 comprimé dès le début de la crise, max 2 par jour", 10),
        ("Presc_002", "Pat_SalmaTrabelsi", "Doc_RimKhelifi", ["Med_Avlocardyl"], "2026-09-10",
         "1 comprimé matin et soir", 30),
        ("Presc_003", "Pat_MohamedGharbi", "Doc_SamiBouazizi", ["Med_Glucophage", "Med_Zestril"],
         "2026-09-15", "Glucophage : 1 comprimé aux repas ; Zestril : 1 comprimé le matin", 90),
        ("Presc_004", "Pat_InesJaziri", "Doc_SamiBouazizi", ["Med_Clamoxyl"], "2026-09-21",
         "1 comprimé matin et soir", 7),
        ("Presc_005", "Pat_YoussefHammami", "Doc_HichemSaidi", ["Med_Coumadine", "Med_Aspirine"],
         "2026-10-01", "Coumadine selon INR ; Aspirine 1 comprimé par jour", 30),
        ("Presc_006", "Pat_KarimJebali", "Doc_AmelFerchichi", ["Med_Ventoline", "Med_Doliprane"],
         "2026-10-05", "Ventoline : 2 bouffées si gêne ; Doliprane : 1 comprimé si fièvre", 5),
        ("Presc_007", "Pat_LeilaMansour", "Doc_SamiBouazizi", ["Med_Mopral"], "2026-10-12",
         "1 gélule le matin à jeun", 28),
    ]
    for iri, pat, doc, meds, date, poso, duree in prescriptions:
        s = individual(g, iri, "Prescription", posologie=poso, dureeJours=duree)
        g.add((s, NX.datePrescription, Literal(date, datatype=XSD.date)))
        link(g, iri, "concernePatient", [pat])
        link(g, iri, "prescritePar", [doc])
        link(g, iri, "prescritMedicament", meds)


def build_graph() -> Graph:
    g = Graph()
    g.bind("nx", NX)
    g.bind("owl", OWL)
    build_schema(g)
    build_individuals(g)
    return g


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    default_out = Path(__file__).resolve().parent.parent / "ontology" / "nexora.owl"
    parser.add_argument("--out", type=Path, default=default_out)
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    g = build_graph()
    g.serialize(destination=str(args.out), format="pretty-xml")
    print(f"Ontologie écrite dans {args.out} ({len(g)} triplets)")


if __name__ == "__main__":
    main()

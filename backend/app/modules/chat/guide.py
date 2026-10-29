"""Guide de l'application : pages et procédures, pour que l'assistant aide à naviguer.

La recherche se fait sur les racines des mots (Snowball) et par correspondance approximative (rapidfuzz),
comme le reste du module NLP. Aucune donnée de l'ontologie n'est utilisée ici.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from rapidfuzz import fuzz

from app.modules.nlp.analyzer import Analysis, normalize, stem


@dataclass(frozen=True)
class GuideEntry:
    id: str
    titre: str
    chemin: str
    mots: str
    description: str
    etapes: tuple[str, ...] = ()


ENTRIES: tuple[GuideEntry, ...] = (
    GuideEntry("accueil", "Accueil du site", "/", "accueil site public vitrine",
               "Page d'accueil publique : présentation, chiffres clés et accès aux services."),
    GuideEntry("catalogue", "Catalogue des médicaments", "/catalogue", "catalogue medicaments public chercher fiche photo",
               "Catalogue public : recherche par nom, filtres par indication et laboratoire, fiche détaillée avec graphe et médicaments similaires."),
    GuideEntry("pharmacies-public", "Trouver une pharmacie", "/pharmacies", "pharmacie trouver ordonnance stock disponible officine",
               "Choisissez les médicaments d'une ordonnance : les pharmacies qui les ont tous en stock sont listées en premier."),
    GuideEntry("verificateur", "Vérificateur d'interactions", "/verificateur", "verificateur interaction verifier combinaison risque public",
               "Vérification anonyme d'une combinaison de médicaments, avec conditions et allergies, sans rien enregistrer."),
    GuideEntry("assistant", "Assistant IA", "/admin/assistant", "assistant chat ia question langage naturel",
               "Chat en langage naturel : la question est traduite en SPARQL par le module NLP et la réponse rédigée par le LLM local."),
    GuideEntry("dashboard", "Tableau de bord", "/admin", "tableau bord dashboard statistiques graphiques indicateurs back office",
               "Indicateurs et graphiques calculés par SPARQL : prescriptions par mois, risques, patients par maladie…"),
    GuideEntry("medicaments", "Gestion des médicaments", "/admin/medicaments", "medicaments gerer liste exporter csv",
               "Liste filtrable des médicaments, export CSV, fiche détaillée et médicaments similaires.",
               ("Menu Gestion › Médicaments", "Recherchez ou filtrez par maladie, molécule ou laboratoire", "Bouton « Exporter CSV » pour l'export")),
    GuideEntry("medicament-ajout", "Ajouter un médicament", "/admin/medicaments/nouveau", "ajouter creer nouveau medicament enregistrer",
               "Formulaire de création d'un médicament.",
               ("Menu Gestion › Médicaments", "Bouton « Nouveau médicament »", "Renseignez nom, dosage, forme, laboratoire",
                "Choisissez molécules, maladies traitées, contre-indications et interactions", "Cliquez « Enregistrer »")),
    GuideEntry("patients", "Gestion des patients", "/admin/patients", "patients dossier liste gerer",
               "Liste des patients avec filtres (maladie, condition, âge) ; le dossier affiche recommandations et synthèse IA."),
    GuideEntry("patient-ajout", "Ajouter un patient", "/admin/patients/nouveau", "ajouter creer nouveau patient enregistrer",
               "Formulaire de création d'un patient.",
               ("Menu Gestion › Patients", "Bouton « Nouveau patient »", "Saisissez prénom, nom, âge et sexe",
                "Ajoutez maladies, conditions (grossesse…) et allergies", "Cliquez « Enregistrer »")),
    GuideEntry("synthese", "Synthèse IA d'un patient", "/admin/patients", "synthese resume dossier patient ia",
               "Dans le dossier d'un patient, le bouton « Générer la synthèse » fait rédiger un résumé par le LLM local.",
               ("Menu Gestion › Patients", "Ouvrez le dossier d'un patient", "Carte « Synthèse du dossier » › « Générer la synthèse »")),
    GuideEntry("prescriptions", "Gestion des prescriptions", "/admin/prescriptions", "prescriptions ordonnances liste statut risque",
               "Liste des ordonnances avec filtres (patient, médecin, risque, statut) et fiche détaillée."),
    GuideEntry("prescription-ajout", "Créer une prescription", "/admin/prescriptions/nouvelle",
               "ajouter creer nouvelle prescription ordonnance prescrire",
               "Formulaire de prescription avec détection des risques en direct et alternatives proposées par l'IA.",
               ("Menu Gestion › Prescriptions", "Bouton « Nouvelle prescription »", "Choisissez le patient, le médecin et les médicaments",
                "Le panneau « Risque détecté » se met à jour en direct ; cliquez une alternative pour remplacer un médicament",
                "Cliquez « Enregistrer »")),
    GuideEntry("delivrance", "Délivrer une ordonnance en pharmacie", "/admin/prescriptions", "delivrer delivrance pharmacie ordonnance statut",
               "Dans la fiche d'une prescription, la carte « Délivrance » classe les pharmacies selon leur stock.",
               ("Menu Gestion › Prescriptions", "Ouvrez une prescription « En attente »",
                "Carte « Délivrance en pharmacie » › « Délivrer ici » sur une pharmacie qui a tout en stock",
                "Confirmez si un risque est signalé")),
    GuideEntry("imprimer", "Imprimer une ordonnance", "/admin/prescriptions", "imprimer impression ordonnance pdf",
               "Dans la fiche d'une prescription, bouton « Imprimer l'ordonnance »."),
    GuideEntry("medecins", "Médecins", "/admin/medecins", "medecins docteurs liste ajouter specialite",
               "Référentiel des médecins : coordonnées, spécialité, indicateurs d'activité.",
               ("Menu Professionnels › Médecins", "Bouton « Ajouter » pour un nouveau médecin")),
    GuideEntry("personnel", "Personnel de santé", "/admin/personnel", "personnel pharmacien infirmier ajouter equipe",
               "Pharmaciens et infirmiers, rattachés à une pharmacie.",
               ("Menu Professionnels › Personnel de santé", "Bouton « Ajouter »", "Choisissez la fonction et la pharmacie")),
    GuideEntry("pharmacies", "Pharmacies (gestion)", "/admin/pharmacies", "pharmacies gerer stock ajouter officine",
               "Référentiel des pharmacies : coordonnées, horaires, médicaments en stock, personnel.",
               ("Menu Professionnels › Pharmacies", "Bouton « Ajouter » ou « Modifier » pour gérer le stock")),
    GuideEntry("maladies", "Maladies", "/admin/maladies", "maladies pathologies ajouter liste", "Référentiel des maladies."),
    GuideEntry("conditions", "Conditions physiologiques", "/admin/conditions", "conditions grossesse allaitement", "Grossesse, allaitement, sujet âgé…"),
    GuideEntry("molecules", "Molécules", "/admin/molecules", "molecules principe actif substance", "Principes actifs des médicaments."),
    GuideEntry("laboratoires", "Laboratoires", "/admin/laboratoires", "laboratoires fabricants", "Laboratoires pharmaceutiques."),
    GuideEntry("ontologie", "Ontologie, graphe et Protégé", "/admin/ontologie",
               "ontologie graphe protege owl hermit raisonneur classes proprietes axiomes",
               "Explorateur du graphe RDF, classes, propriétés et axiomes ; ouverture dans Protégé et raisonnement HermiT."),
    GuideEntry("sparql", "Console SPARQL", "/admin/sparql", "console sparql requete executer", "Exécuter des requêtes SPARQL en lecture seule."),
)

HELP_WORDS = {stem(w) for w in [
    "comment", "aide", "aider", "page", "menu", "ajouter", "ajoute", "creer", "cree", "modifier", "supprimer", "enregistrer",
    "imprimer", "exporter", "delivrer", "naviguer", "aller", "ouvrir", "ouvre", "va", "emmene", "montre", "affiche",
    "afficher", "acceder", "utiliser", "fonctionne", "faire", "procedure", "etape", "etapes", "bouton",
]}
NAV_WORDS = {stem(w) for w in ["ouvre", "ouvrir", "va", "aller", "emmene", "emmener", "affiche", "afficher", "montre",
                               "montrer", "accede", "acceder", "redirige", "navigue", "naviguer"]}


def search(analysis: Analysis, limit: int = 3) -> list[tuple[GuideEntry, float]]:
    stems = {t.stem for t in analysis.tokens if not t.stop}
    text = normalize(analysis.question)
    scored = []
    for e in ENTRIES:
        words = {stem(w) for w in e.mots.split()}
        overlap = len(stems & words)
        fuzzy = fuzz.token_set_ratio(text, normalize(e.titre + " " + e.mots)) / 100
        score = overlap + fuzzy
        if overlap:
            scored.append((e, round(score, 2)))
    scored.sort(key=lambda x: -x[1])
    return scored[:limit]


def classify(analysis: Analysis) -> dict:
    """Détecte une demande d'aide ou de navigation. Renvoie les pages pertinentes et, pour un ordre explicite
    (« ouvre la page des pharmacies »), la page à ouvrir automatiquement."""
    stems = {t.stem for t in analysis.tokens}
    help_asked = bool(stems & HELP_WORDS)
    results = search(analysis) if help_asked else []
    navigate = None
    if results and stems & NAV_WORDS and results[0][1] >= 1.5:
        navigate = results[0][0]
    return {
        "aide": help_asked and bool(results),
        "pages": [{**asdict(e), "etapes": list(e.etapes), "score": s} for e, s in results],
        "navigation": {"chemin": navigate.chemin, "titre": navigate.titre} if navigate else None,
    }


SITE_SUMMARY = """Nexora est une application web sémantique (ontologie OWL interrogée en SPARQL) pour la pharmacie et la santé.
Front-office public : accueil, catalogue des médicaments, recherche de pharmacies, vérificateur d'interactions, assistant IA.
Back-office (/admin) : tableau de bord, médicaments, patients, prescriptions (risques détectés, délivrance en pharmacie,
ordonnance imprimable), médecins, personnel de santé, pharmacies, maladies, conditions, molécules, laboratoires,
assistant IA, ontologie (graphe, Protégé, HermiT), console SPARQL.
L'assistant répond aux questions sur les données (traduites en SPARQL par un module NLP spaCy/Snowball/rapidfuzz),
aide à utiliser l'application, et peut répondre à des questions générales."""

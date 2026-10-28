import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Fichier OWL partagé par tous les modules (un seul graphe RDF pour toute l'application).
ONTOLOGY_PATH = Path(os.getenv("NEXORA_ONTOLOGY", BASE_DIR / "ontology" / "nexora.owl"))

CORS_ORIGINS = os.getenv("NEXORA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Fichier OWL partagé par tous les modules (un seul graphe RDF pour toute l'application).
ONTOLOGY_PATH = Path(os.getenv("NEXORA_ONTOLOGY", BASE_DIR / "ontology" / "nexora.owl"))

# Dossier d'installation de Protégé (contient run.bat / run.sh, bundles/ et plugins/).
# Si la variable n'est pas définie, on cherche « Protege-*/Protege-* » dans Téléchargements, Bureau et Program Files.
PROTEGE_HOME = os.getenv("PROTEGE_HOME")

# Programme Java de vérification (OWL API + HermiT, les bibliothèques de Protégé)
TOOLS_DIR = BASE_DIR.parent / "tools" / "protege"

# LLM local (Ollama) : rédige les réponses du chat à partir des résultats SPARQL. NEXORA_LLM=off le désactive.
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
LLM_ENABLED = os.getenv("NEXORA_LLM", "on").lower() not in ("off", "0", "false", "non")

CORS_ORIGINS = os.getenv("NEXORA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

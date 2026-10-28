"""Liaison avec Protégé : même fichier OWL, ouverture dans Protégé, raisonnement HermiT, rechargement.

Ces routes pilotent des programmes locaux (Protégé, Java) : elles sont prévues pour un poste de développement
ou de démonstration où le back-end tourne sur la même machine que Protégé. Aucune entrée utilisateur n'est
transmise aux commandes lancées.
"""
from __future__ import annotations

import glob
import os
import platform
import re
import shutil
import subprocess
import zipfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter

from app.config import PROTEGE_HOME, TOOLS_DIR
from app.core.errors import AppError
from app.core.graph_store import store

router = APIRouter(prefix="/api/ontologie", tags=["Ontologie — Protégé"])


class ProtegeUnavailable(AppError):
    status_code = 503


def find_protege() -> Path | None:
    candidates = [PROTEGE_HOME] if PROTEGE_HOME else []
    home = Path.home()
    for base in (home / "Downloads", home / "Desktop", Path("C:/Program Files"), Path("/Applications"), Path("/opt")):
        candidates += sorted(glob.glob(str(base / "Protege*" / "Protege*")), reverse=True)
        candidates += sorted(glob.glob(str(base / "Protege*")), reverse=True)
    for c in candidates:
        p = Path(c)
        if (p / "bundles").is_dir() and (p / "plugins").is_dir():
            return p
    return None


def _java(protege: Path) -> str | None:
    bundled = protege / "jre" / "bin" / ("java.exe" if platform.system() == "Windows" else "java")
    if shutil.which("java"):
        return shutil.which("java")  # JDK requis pour lancer un fichier .java directement
    return str(bundled) if bundled.exists() else None


def _extract_nested_libs(protege: Path) -> Path:
    """L'OWL API et HermiT embarquent leurs dépendances dans des jars imbriqués : on les extrait une fois."""
    lib = TOOLS_DIR / ".lib"
    marker = lib / ".ok"
    if marker.exists():
        return lib
    lib.mkdir(parents=True, exist_ok=True)
    sources = [protege / "bundles" / "owlapi-osgidistribution.jar", *protege.glob("plugins/org.semanticweb.hermit-*.jar")]
    for jar in sources:
        with zipfile.ZipFile(jar) as z:
            for name in z.namelist():
                if name.endswith(".jar"):
                    (lib / Path(name).name).write_bytes(z.read(name))
    marker.write_text("ok")
    return lib


@router.get("/fichier")
def fichier():
    """État du fichier OWL partagé entre l'application et Protégé."""
    store.sync()
    path = store.path
    stat = path.stat() if path.exists() else None
    protege = find_protege()
    return {
        "chemin": str(path.resolve()),
        "taille": stat.st_size if stat else 0,
        "modifieLe": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds") if stat else None,
        "chargeLe": store.loaded_at.isoformat(timespec="seconds") if store.loaded_at else None,
        "format": "RDF/XML" if store.format == "xml" else store.format,
        "triplets": len(store.graph),
        "rechargementsAuto": store.reloads,
        "erreur": store.last_error,
        "protege": str(protege) if protege else None,
    }


@router.post("/recharger")
def recharger():
    store.load()
    return fichier()


@router.post("/ouvrir-protege")
def ouvrir_protege():
    protege = find_protege()
    if protege is None:
        raise ProtegeUnavailable("Protégé est introuvable. Définissez la variable d'environnement PROTEGE_HOME.")
    target = str(store.path.resolve())
    if platform.system() == "Windows":
        launcher = protege / "run.bat"
        subprocess.Popen(["cmd", "/c", str(launcher), target], cwd=protege,
                         creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0))
    else:
        launcher = protege / "run.sh"
        subprocess.Popen(["sh", str(launcher), target], cwd=protege, start_new_session=True)
    return {"message": f"Protégé est en cours d'ouverture sur {store.path.name}.", "protege": str(protege)}


def _compiled_classes(classpath: str, java: str) -> Path | None:
    """Compile VerifierOntologie.java une seule fois (évite ~1 s de compilation à chaque raisonnement)."""
    javac = shutil.which("javac") or str(Path(java).with_name("javac.exe" if platform.system() == "Windows" else "javac"))
    source = TOOLS_DIR / "VerifierOntologie.java"
    out = TOOLS_DIR / ".lib" / "classes"
    target = out / "VerifierOntologie.class"
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return out
    if not Path(javac).exists() and not shutil.which("javac"):
        return None
    out.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run([javac, "-encoding", "UTF-8", "-cp", classpath, "-d", str(out), str(source)],
                          capture_output=True, text=True, timeout=120)
    return out if proc.returncode == 0 else None


_reasoner_cache: dict = {}
# Sortie Java en UTF-8 (sous Windows elle est sinon en cp1252 et « COHÉRENTE » ne serait pas reconnu)
UTF8 = ["-Dfile.encoding=UTF-8", "-Dsun.stdout.encoding=UTF-8", "-Dstdout.encoding=UTF-8"]


@router.post("/raisonner")
def raisonner():
    """Lance HermiT (le raisonneur de Protégé) via l'OWL API sur le fichier partagé.

    Le résultat est réutilisé tant que le fichier OWL n'a pas changé.
    """
    store.sync()
    mtime = store.path.stat().st_mtime_ns
    if mtime in _reasoner_cache:
        return {**_reasoner_cache[mtime], "depuisCache": True}
    protege = find_protege()
    if protege is None:
        raise ProtegeUnavailable("Protégé est introuvable. Définissez la variable d'environnement PROTEGE_HOME.")
    java = _java(protege)
    if java is None:
        raise ProtegeUnavailable("Java est introuvable (un JDK 11+ est nécessaire).")
    lib = _extract_nested_libs(protege)
    hermit = next(protege.glob("plugins/org.semanticweb.hermit-*.jar"))
    classpath = os.pathsep.join([str(protege / "bundles" / "*"), str(lib / "*"), str(hermit)])
    classes = _compiled_classes(classpath, java)
    if classes is not None:
        command = [java, *UTF8, "-cp", classpath + os.pathsep + str(classes), "VerifierOntologie", str(store.path.resolve())]
    else:  # pas de javac : exécution directe du fichier source (plus lente)
        command = [java, *UTF8, "-cp", classpath, str(TOOLS_DIR / "VerifierOntologie.java"), str(store.path.resolve())]
    proc = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
    # On ignore les lignes de journalisation de l'OWL API (« 23:38:56.291 [main] INFO … »)
    lines = [l for l in proc.stdout.splitlines() if l.strip() and not re.match(r"^\d{2}:\d{2}:\d{2}", l)]
    values = dict(re.match(r"^(.+?)\s*:\s(.*)$", l).groups() for l in lines if re.match(r"^(.+?)\s*:\s(.*)$", l))
    result = {
        "succes": proc.returncode == 0,
        "coherente": values.get("HermiT cohérence") == "COHÉRENTE",
        "resultats": [{"cle": k.strip(), "valeur": v.strip()} for k, v in values.items()],
        "erreur": None if proc.returncode == 0 else (proc.stderr.strip().splitlines() or ["Erreur inconnue"])[-1],
        "moteur": "OWL API + HermiT (bibliothèques de Protégé)",
    }
    if result["succes"]:
        _reasoner_cache.clear()
        _reasoner_cache[mtime] = result
    return {**result, "depuisCache": False}

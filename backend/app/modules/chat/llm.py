"""Client du LLM local (Ollama).

Le LLM ne génère JAMAIS de SPARQL et n'accède jamais à l'ontologie : la question est traduite en SPARQL par le
module NLP (spaCy, Snowball, rapidfuzz), et le LLM rédige seulement la réponse à partir des résultats obtenus.
"""
from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator

import httpx

from app.config import LLM_ENABLED, OLLAMA_MODEL, OLLAMA_URL

_status: dict = {"checked": 0.0, "value": None}


def status() -> dict:
    """Disponibilité d'Ollama et du modèle (vérifiée au plus toutes les 15 s)."""
    if not LLM_ENABLED:
        return {"disponible": False, "modele": None, "raison": "LLM désactivé (NEXORA_LLM=off)"}
    if _status["value"] is not None and time.time() - _status["checked"] < 15:
        return _status["value"]
    try:
        tags = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=2).json()
        models = [m["name"] for m in tags.get("models", [])]
        if OLLAMA_MODEL in models:
            value = {"disponible": True, "modele": OLLAMA_MODEL, "raison": None, "modeles": models}
        else:
            value = {"disponible": False, "modele": None, "modeles": models,
                     "raison": f"Modèle « {OLLAMA_MODEL} » absent d'Ollama (ollama pull {OLLAMA_MODEL})"}
    except Exception:
        value = {"disponible": False, "modele": None, "raison": f"Ollama injoignable sur {OLLAMA_URL}"}
    _status.update(checked=time.time(), value=value)
    return value


def warm_up() -> None:
    """Charge le modèle en mémoire GPU au démarrage (évite ~12 s d'attente à la première question)."""
    if status()["disponible"]:
        try:
            httpx.post(f"{OLLAMA_URL}/api/generate", json={"model": OLLAMA_MODEL, "prompt": "", "keep_alive": "30m"},
                       timeout=120)
        except Exception:
            pass


async def stream(messages: list[dict], temperature: float = 0.2) -> AsyncIterator[str]:
    """Envoie la conversation à Ollama et renvoie la réponse morceau par morceau."""
    body = {"model": OLLAMA_MODEL, "messages": messages, "stream": True, "think": False, "keep_alive": "30m",
            "options": {"temperature": temperature, "num_ctx": 4096}}
    async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=5)) as client:
        async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=body) as response:
            if response.status_code != 200:
                raise RuntimeError(f"Ollama a répondu {response.status_code}")
            async for line in response.aiter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                if chunk.get("error"):
                    raise RuntimeError(chunk["error"])
                text = chunk.get("message", {}).get("content", "")
                if text:
                    yield text
                if chunk.get("done"):
                    break

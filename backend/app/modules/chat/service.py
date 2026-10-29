"""Assistant IA hybride. La conversion question → SPARQL reste faite par le module NLP (exigence du sujet) ;
le LLM local (Ollama) ne fait que rédiger les réponses.

Chaque question est orientée vers un mode :
- « donnees »    : comprise par le NLP → requête SPARQL → réponse rédigée à partir des résultats ;
- « suivi »      : relance (« un autre ? », « tu es sûr ? ») → l'intention et l'entité du tour précédent sont rejouées ;
- « guide »      : question sur l'utilisation de l'application → pages et étapes du guide, avec liens ;
- « navigation » : ordre explicite (« ouvre la page des pharmacies ») → le front-end ouvre la page ;
- « general »    : question hors données → réponse de culture générale du LLM, signalée comme telle.
Les événements sont envoyés au fil de l'eau (NDJSON) : analyse, morceaux de texte, fin.
"""
from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator

from starlette.concurrency import run_in_threadpool

from app.modules.chat import guide, llm
from app.modules.nlp.analyzer import analyze
from app.modules.nlp.intents import EXAMPLES
from app.modules.nlp.service import answer, rerun

SYSTEM_PROMPT = f"""Tu es Nexora, l'assistant d'une application web sémantique pharmaceutique.
{guide.SITE_SUMMARY}

Règles :
1. Réponds en français, de façon naturelle, claire et brève (2 à 5 phrases ou une courte liste à puces).
2. Quand des « Données de l'ontologie » sont fournies, appuie-toi uniquement sur elles : n'invente aucun
   médicament, patient, dose, relation ni chiffre, et n'ajoute pas tes connaissances générales. Si l'information
   demandée n'y figure pas, dis qu'elle n'est pas enregistrée dans l'ontologie.
3. N'affiche jamais de requête SPARQL ni d'identifiant technique (comme Med_Aspirine) : utilise les noms.
4. Si la question porte sur le choix d'un traitement pour une personne, rappelle en une phrase de consulter un
   médecin ou un pharmacien.
5. N'écris un lien Markdown [Titre](/chemin) que s'il figure dans les « Liens disponibles » fournis ;
   n'invente jamais d'adresse de page."""

MAX_ROWS = 40


def _data_block(nlp: dict) -> str:
    rows = nlp["resultats"][:MAX_ROWS]
    lines = ["; ".join(f"{k} = {v}" for k, v in r.items() if v not in (None, "")) for r in rows]
    entite = nlp.get("entite")
    head = (f"Intention détectée : {nlp['intention']['label']}"
            + (f" — sujet : {entite['nom']}" if entite else "")
            + f"\nCe que la requête calcule : {nlp['explication']}"
            + f"\nDonnées de l'ontologie ({len(nlp['resultats'])} résultat(s)) :")
    body = "\n".join(f"- {l}" for l in lines) if lines else "(aucun résultat)"
    more = f"\n… et {len(nlp['resultats']) - MAX_ROWS} autres résultats." if len(nlp["resultats"]) > MAX_ROWS else ""
    return f"{head}\n{body}{more}"


def _guide_block(pages: list[dict]) -> str:
    parts = []
    for p in pages:
        steps = "".join(f"\n   {i}. {s}" for i, s in enumerate(p["etapes"], 1))
        parts.append(f"- {p['titre']} : {p['description']}{steps}")
    links = "\n".join(f"[{p['titre']}]({p['chemin']})" for p in pages)
    return "Pages de l'application pertinentes :\n" + "\n".join(parts) + f"\n\nLiens disponibles :\n{links}"


def _user_prompt(mode: str, message: str, nlp: dict | None, aide: dict) -> str:
    if mode == "donnees":
        return f"Question : {message}\n\n{_data_block(nlp)}"
    if mode == "suivi":
        extra = "".join(f"\n\nDonnées complémentaires sur « {c['entite']['nom']} » :\n{_data_block(c)}"
                        for c in nlp.get("complements", []))
        return (f"Question (suite de la conversation) : {message}\n\n"
                f"Il s'agit d'une relance sur le sujet de la question précédente. Données recalculées :\n"
                f"{_data_block(nlp)}{extra}\n\nRéponds à la relance (confirmer, proposer un autre élément, croiser les "
                "données…) uniquement à partir de ces données.")
    if mode == "navigation":
        page = aide["pages"][0]
        return (f"Demande : {message}\n\nLa page « {page['titre']} » vient d'être ouverte automatiquement. "
                f"Description : {page['description']}\nConfirme en une ou deux phrases ce que l'utilisateur peut y faire. "
                "N'écris pas de lien.")
    if mode == "guide":
        return (f"Question sur l'utilisation de l'application : {message}\n\n{_guide_block(aide['pages'])}\n\n"
                "Explique comment faire, étape par étape si utile, avec le lien vers la page concernée.")
    sugg = " | ".join(EXAMPLES[:4])
    return (f"Question : {message}\n\nCette question ne correspond pas aux données de l'ontologie Nexora. "
            "S'il s'agit de conversation (salutation, remerciement, question sur toi), réponds simplement en 2 ou 3 "
            "phrases et présente ce que tu sais faire. Sinon, réponds avec tes connaissances générales en 2 à 4 phrases, "
            "en précisant d'abord que l'information ne provient pas de l'ontologie de l'application. "
            f"Termine éventuellement par une question que l'application sait traiter, par exemple : {sugg}")


def fallback_answer(mode: str, nlp: dict | None, aide: dict) -> str:
    """Réponse sans LLM (Ollama arrêté)."""
    if mode in ("donnees", "suivi"):
        rows = nlp["resultats"]
        if not rows:
            return f"{nlp['explication']}\nAucun résultat dans l'ontologie."
        first_col = nlp["colonnes"][-1] if nlp["intention"]["id"] == "fiche" else nlp["colonnes"][0]
        if nlp["intention"]["id"] == "fiche":
            return nlp["explication"] + "\n" + "\n".join(f"- {r['propriete']} : {r['valeur']}" for r in rows[:25])
        values = list(dict.fromkeys(str(r[first_col]) for r in rows if r.get(first_col) is not None))
        return f"{nlp['explication']}\n{len(rows)} résultat(s) : {', '.join(values[:15])}{' …' if len(values) > 15 else ''}."
    if mode in ("guide", "navigation"):
        p = aide["pages"][0]
        steps = "\n".join(f"{i}. {s}" for i, s in enumerate(p["etapes"], 1))
        return f"**{p['titre']}** — {p['description']}\n{steps}\n\n[Ouvrir : {p['titre']}]({p['chemin']})"
    return ("Je réponds aux questions sur les médicaments, patients, prescriptions et pharmacies de l'ontologie, "
            "et j'aide à utiliser l'application. Le modèle de langage local n'est pas disponible pour les questions "
            f"générales. Essayez par exemple : « {EXAMPLES[0]} »")


def _event(**data) -> str:
    return json.dumps(data, ensure_ascii=False, default=str) + "\n"


# Indices qu'une question fait suite à la précédente (pronoms, « autre », « sûr », « et »…) : seulement dans ce
# cas le sujet de la conversation est repris. Les formules de politesse ne relancent jamais la question précédente.
FOLLOW_UP = {"autre", "autres", "encore", "sur", "sure", "certain", "certaine", "vraiment", "aussi", "pourquoi",
             "lequel", "laquelle", "lesquels", "lesquelles", "celui", "celle", "ceux", "il", "elle", "ils", "elles",
             "ses", "son", "sa", "leur", "leurs", "en", "y", "la", "le", "les", "l", "lui", "et", "plus", "meme",
             "ca", "cela", "ceci", "alors", "donc"}
SOCIAL = {"bonjour", "salut", "bonsoir", "merci", "hello", "coucou", "revoir", "bye", "cava", "ok", "accord", "super",
          "parfait", "genial"}


def _route(message: str, contexte: dict | None) -> tuple[str, dict | None, dict]:
    contexte = contexte or {}
    entite = contexte.get("entite") if "entite" in contexte or "intention" in contexte else contexte  # ancien format
    analysis = analyze(message)
    words = {t.norm for t in analysis.tokens}
    social = bool(words & SOCIAL) and not analysis.entities
    follow_up = bool(words & FOLLOW_UP) and not social
    aide = guide.classify(analysis)
    mentions_entity = bool(analysis.entities)
    nlp = answer(message, entite if follow_up else None, analysis=analysis)

    if aide["navigation"] and not (nlp["compris"] and mentions_entity):
        return "navigation", None, aide
    if aide["aide"] and not (nlp["compris"] and mentions_entity):
        return "guide", None, aide
    if nlp["compris"]:
        return "donnees", nlp, aide
    if contexte.get("intention") and follow_up:
        replay = rerun(message, contexte["intention"], entite)
        if replay is not None:
            # Un élément nouveau est cité dans la relance (« … pendant la grossesse ? ») : sa fiche est jointe
            # pour que la réponse croise les deux sources de données au lieu d'improviser.
            replay["complements"] = [c for c in (rerun(message, "fiche", {"id": e.id}) for e in analysis.entities[:2])
                                     if c is not None]
            return "suivi", replay, aide
    return "general", nlp, aide


async def chat(message: str, historique: list[dict], contexte: dict | None) -> AsyncIterator[str]:
    started = time.perf_counter()
    mode, nlp, aide = await run_in_threadpool(_route, message, contexte)
    analyse = nlp if nlp is not None else {"question": message, "compris": False, "analyse": None}
    yield _event(type="analyse", mode=mode, guide=aide["pages"], navigation=aide["navigation"], **analyse)

    if mode in ("donnees", "suivi"):
        nouveau = {"entite": nlp.get("entite"), "intention": nlp["intention"]["id"]}
    else:
        nouveau = contexte  # le sujet de la conversation est conservé
    statut = await run_in_threadpool(llm.status)
    modele = None
    if statut["disponible"]:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in historique[-8:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": str(turn["content"])[:2000]})
        messages.append({"role": "user", "content": _user_prompt(mode, message, nlp, aide)})
        try:
            async for token in llm.stream(messages, temperature=0.5 if mode == "general" else 0.2):
                yield _event(type="token", text=token)
            modele = statut["modele"]
        except Exception as exc:  # Ollama s'arrête en cours de route : réponse sans LLM
            yield _event(type="token", text=fallback_answer(mode, nlp, aide))
            statut = {"disponible": False, "raison": f"Erreur Ollama : {exc}"}
    else:
        yield _event(type="token", text=fallback_answer(mode, nlp, aide))

    yield _event(type="fin", mode=mode, modele=modele, raison=statut.get("raison"), contexte=nouveau,
                 duree=round(time.perf_counter() - started, 2))


# ---------- IA : synthèse du dossier patient ----------

SYNTHESE_PROMPT = """Tu es Nexora, assistant d'aide à la lecture de dossiers patients dans une application pharmaceutique.
À partir UNIQUEMENT des données fournies (issues de l'ontologie), rédige en français une synthèse structurée avec
ces titres en gras : **Profil**, **Points de vigilance**, **Traitements en cours**, **Pistes issues de l'ontologie**.
Utilise des listes à puces courtes. N'invente rien. Termine par une phrase rappelant que cette synthèse ne remplace
pas l'avis d'un professionnel de santé."""


def _patient_data(patient_id: str) -> str:
    from app.modules.ia.recommender import recommend_for_patient
    from app.modules.patients.repository import get_patient
    from app.modules.prescriptions.repository import get_prescription

    p = get_patient(patient_id)
    lines = [f"Patient : {p['nomComplet']}, {p['age']} ans, sexe {p['sexe']}",
             f"Maladies : {', '.join(m['nom'] for m in p['maladies']) or 'aucune'}",
             f"Conditions physiologiques : {', '.join(m['nom'] for m in p['conditions']) or 'aucune'}",
             f"Allergies : {', '.join(m['nom'] for m in p['allergies']) or 'aucune'}"]
    for pr in p.get("prescriptions", []):
        d = get_prescription(pr["id"])
        risques = "; ".join(r["explication"] for r in d["analyseRisques"]["risques"]) or "aucun risque détecté"
        etat = (f"déjà délivrée en pharmacie ({d['pharmacie']['nom']})" if d["statut"] == "Délivrée" and d["pharmacie"]
                else "prescrite mais pas encore délivrée en pharmacie")
        lines.append(f"Traitement prescrit le {d['datePrescription']} par {d['medecin']['nom'] if d['medecin'] else '?'} : "
                     f"{', '.join(m['nom'] for m in d['medicaments'])} ({etat}) — risques détectés : {risques}")
    for r in recommend_for_patient(patient_id)["recommandations"]:
        ok = ", ".join(m["nom"] for m in r["recommandes"]) or "aucun"
        ko = "; ".join(f"{m['nom']} ({', '.join(m['raisons'])})" for m in r["exclus"]) or "aucun"
        lines.append(f"Pour {r['maladie']['nom']} : médicaments compatibles = {ok} ; exclus = {ko}")
    return "\n".join(lines)


async def synthese_patient(patient_id: str) -> AsyncIterator[str]:
    started = time.perf_counter()
    data = await run_in_threadpool(_patient_data, patient_id)
    yield _event(type="donnees", texte=data)
    statut = await run_in_threadpool(llm.status)
    modele = None
    if statut["disponible"]:
        try:
            async for token in llm.stream([{"role": "system", "content": SYNTHESE_PROMPT},
                                           {"role": "user", "content": f"Données du dossier :\n{data}"}], temperature=0.3):
                yield _event(type="token", text=token)
            modele = statut["modele"]
        except Exception as exc:
            yield _event(type="token", text=data)
            statut = {"raison": f"Erreur Ollama : {exc}"}
    else:
        yield _event(type="token", text=data)
    yield _event(type="fin", modele=modele, raison=statut.get("raison"), duree=round(time.perf_counter() - started, 2))

import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import CORS_ORIGINS
from app.core.errors import AppError
from app.core.graph_store import store
from app.core.rdf import InvalidIdError
from app.modules.chat.llm import warm_up as llm_warm_up
from app.modules.chat.router import router as chat_router
from app.modules.ia.router import router as ia_router
from app.modules.medicaments.router import router as medicaments_router
from app.modules.nlp.router import router as nlp_router
from app.modules.patients.router import router as patients_router
from app.modules.prescriptions.router import pharmacies_router
from app.modules.prescriptions.router import router as prescriptions_router
from app.modules.referentiel.router import router as referentiel_router
from app.modules.references.router import router as references_router
from app.modules.sparql.ontology import router as ontology_router
from app.modules.sparql.protege import router as protege_router
from app.modules.sparql.router import router as sparql_router


def warm_up() -> None:
    """Précalcule en arrière-plan les requêtes les plus utilisées (analyse SPARQL et caches de résultats)
    pour que le premier visiteur n'attende pas."""
    from app.modules.ia.recommender import _all_vectors
    from app.modules.medicaments.repository import list_medicaments
    from app.modules.nlp.service import answer
    from app.modules.patients.repository import list_patients
    from app.modules.references.router import _stats, references
    from app.modules.sparql.ontology import schema

    for task in (references, _stats, schema, _all_vectors, list_medicaments, list_patients,
                 lambda: answer("Quels médicaments traitent la migraine ?")):
        try:
            task()
        except Exception:  # le préchauffage ne doit jamais empêcher le démarrage
            pass


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.load()
    threading.Thread(target=warm_up, daemon=True).start()
    threading.Thread(target=llm_warm_up, daemon=True).start()
    yield


app = FastAPI(
    title="Nexora API — Pharmaceutique et Santé",
    description="API REST au-dessus d'une ontologie OWL interrogée en SPARQL (rdflib).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail, **exc.extra})


@app.exception_handler(InvalidIdError)
async def invalid_id_handler(_: Request, exc: InvalidIdError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


for router in (medicaments_router, patients_router, prescriptions_router, references_router, nlp_router,
               ia_router, sparql_router, ontology_router, protege_router, referentiel_router, pharmacies_router,
               chat_router):
    app.include_router(router)


@app.get("/api/health", tags=["Santé"])
def health():
    return {"status": "ok", "triplets": len(store.graph), "ontologie": store.path.name}

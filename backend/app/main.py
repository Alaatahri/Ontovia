from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import CORS_ORIGINS
from app.core.errors import AppError
from app.core.graph_store import store
from app.core.rdf import InvalidIdError
from app.modules.medicaments.router import router as medicaments_router
from app.modules.nlp.router import router as nlp_router
from app.modules.patients.router import router as patients_router
from app.modules.prescriptions.router import router as prescriptions_router
from app.modules.references.router import router as references_router
from app.modules.sparql.router import router as sparql_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.load()
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
               sparql_router):
    app.include_router(router)


@app.get("/api/health", tags=["Santé"])
def health():
    return {"status": "ok", "triplets": len(store.graph), "ontologie": store.path.name}

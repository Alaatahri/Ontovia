// Un service par module : chaque membre du groupe appelle uniquement les routes de son module.
import { api, qs } from "./client";
import type {
  Alternatives, AnalyseRisques, GraphData, Medicament, MedicamentInput, NlpResponse, OntologyFile, OntologySchema, Patient,
  PatientInput, Prescription, PrescriptionInput, ReasonerResult, Recommandations, References, Similaires, SparqlResult, Stats,
} from "./types";

const enc = encodeURIComponent;

// Membre 1 — Médicaments
export const medicamentsApi = {
  list: (f: { q?: string; maladie?: string; molecule?: string; laboratoire?: string } = {}) =>
    api<Medicament[]>(`/medicaments${qs(f)}`),
  get: (id: string) => api<Medicament>(`/medicaments/${enc(id)}`),
  create: (d: MedicamentInput) => api<Medicament>("/medicaments", { method: "POST", body: d }),
  update: (id: string, d: MedicamentInput) => api<Medicament>(`/medicaments/${enc(id)}`, { method: "PUT", body: d }),
  remove: (id: string) => api<void>(`/medicaments/${enc(id)}`, { method: "DELETE" }),
  similaires: (id: string) => api<Similaires>(`/ia/medicaments/${enc(id)}/similaires`),
};

// Membre 2 — Patients
export const patientsApi = {
  list: (f: { q?: string; maladie?: string; condition?: string; ageMin?: number; ageMax?: number } = {}) =>
    api<Patient[]>(`/patients${qs(f)}`),
  get: (id: string) => api<Patient>(`/patients/${enc(id)}`),
  create: (d: PatientInput) => api<Patient>("/patients", { method: "POST", body: d }),
  update: (id: string, d: PatientInput) => api<Patient>(`/patients/${enc(id)}`, { method: "PUT", body: d }),
  remove: (id: string) => api<void>(`/patients/${enc(id)}`, { method: "DELETE" }),
  recommandations: (id: string) => api<Recommandations>(`/ia/patients/${enc(id)}/recommandations`),
};

// Membre 3 — Prescriptions
export const prescriptionsApi = {
  list: (f: { q?: string; patient?: string; medecin?: string; risque?: string } = {}) =>
    api<Prescription[]>(`/prescriptions${qs(f)}`),
  get: (id: string) => api<Prescription>(`/prescriptions/${enc(id)}`),
  create: (d: PrescriptionInput) => api<Prescription>("/prescriptions", { method: "POST", body: d }),
  update: (id: string, d: PrescriptionInput) => api<Prescription>(`/prescriptions/${enc(id)}`, { method: "PUT", body: d }),
  remove: (id: string) => api<void>(`/prescriptions/${enc(id)}`, { method: "DELETE" }),
  checkRisks: (patientId: string, medicamentIds: string[]) =>
    api<AnalyseRisques>("/prescriptions/verifier-risques", { method: "POST", body: { patientId, medicamentIds } }),
  alternatives: (patientId: string, medicamentIds: string[]) =>
    api<Alternatives>("/ia/alternatives", { method: "POST", body: { patientId, medicamentIds } }),
};

// Membre 4 — NLP, IA, ontologie et intégration
export const nlpApi = {
  ask: (question: string) => api<NlpResponse>("/nlp/query", { method: "POST", body: { question } }),
  examples: () => api<string[]>("/nlp/exemples"),
};

export const iaApi = {
  verificateur: (medicamentIds: string[], conditionIds: string[], allergieIds: string[]) =>
    api<AnalyseRisques>("/ia/verificateur", { method: "POST", body: { medicamentIds, conditionIds, allergieIds } }),
};

export const ontologyApi = {
  schema: () => api<OntologySchema>("/ontologie/schema"),
  graphe: (id: string) => api<GraphData>(`/ontologie/graphe/${enc(id)}`),
  sparql: (query: string) => api<SparqlResult>("/sparql", { method: "POST", body: { query } }),
  // Liaison avec Protégé (même fichier nexora.owl)
  fichier: () => api<OntologyFile>("/ontologie/fichier"),
  recharger: () => api<OntologyFile>("/ontologie/recharger", { method: "POST" }),
  ouvrirProtege: () => api<{ message: string }>("/ontologie/ouvrir-protege", { method: "POST" }),
  raisonner: () => api<ReasonerResult>("/ontologie/raisonner", { method: "POST" }),
};

export const referencesApi = {
  all: () => api<References>("/references"),
  stats: () => api<Stats>("/stats"),
  health: () => api<{ status: string; triplets: number; ontologie: string }>("/health"),
};

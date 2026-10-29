// Un service par module : chaque membre du groupe appelle uniquement les routes de son module.
import { api, qs, streamNdjson } from "./client";
import type {
  Alternatives, AnalyseRisques, ChatEvent, ChatStatus, GraphData, Medicament, MedicamentInput,
  OntologyFile, OntologySchema, Patient, PatientInput, PharmacieDispo, Prescription, PrescriptionInput, ReasonerResult,
  Recommandations, RefEntity, RefInput, RefSpec, References, Similaires, SparqlResult, Stats,
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
  list: (f: { q?: string; patient?: string; medecin?: string; risque?: string; statut?: string } = {}) =>
    api<Prescription[]>(`/prescriptions${qs(f)}`),
  get: (id: string) => api<Prescription>(`/prescriptions/${enc(id)}`),
  create: (d: PrescriptionInput) => api<Prescription>("/prescriptions", { method: "POST", body: d }),
  update: (id: string, d: PrescriptionInput) => api<Prescription>(`/prescriptions/${enc(id)}`, { method: "PUT", body: d }),
  remove: (id: string) => api<void>(`/prescriptions/${enc(id)}`, { method: "DELETE" }),
  checkRisks: (patientId: string, medicamentIds: string[]) =>
    api<AnalyseRisques>("/prescriptions/verifier-risques", { method: "POST", body: { patientId, medicamentIds } }),
  alternatives: (patientId: string, medicamentIds: string[]) =>
    api<Alternatives>("/ia/alternatives", { method: "POST", body: { patientId, medicamentIds } }),
  // Métier avancé : délivrance en pharmacie
  pharmacies: (id: string) => api<PharmacieDispo[]>(`/prescriptions/${enc(id)}/pharmacies`),
  delivrer: (id: string, pharmacieId: string, forcer = false) =>
    api<Prescription>(`/prescriptions/${enc(id)}/delivrer`, { method: "POST", body: { pharmacieId, forcer } }),
  annulerDelivrance: (id: string) => api<Prescription>(`/prescriptions/${enc(id)}/delivrance`, { method: "DELETE" }),
};

// Référentiels (CRUD génériques) : médecins, personnel, pharmacies, maladies, conditions, molécules, laboratoires
export const referentielsApi = {
  specs: () => api<RefSpec[]>("/referentiels"),
  list: (type: string, f: { q?: string; classe?: string } = {}) => api<RefEntity[]>(`/referentiels/${type}${qs(f)}`),
  get: (type: string, id: string) => api<RefEntity>(`/referentiels/${type}/${enc(id)}`),
  create: (type: string, d: RefInput) => api<RefEntity>(`/referentiels/${type}`, { method: "POST", body: d }),
  update: (type: string, id: string, d: RefInput) => api<RefEntity>(`/referentiels/${type}/${enc(id)}`, { method: "PUT", body: d }),
  remove: (type: string, id: string) => api<void>(`/referentiels/${type}/${enc(id)}`, { method: "DELETE" }),
};

export const pharmaciesApi = {
  disponibilite: (medicamentIds: string[]) =>
    api<PharmacieDispo[]>(`/pharmacies/disponibilite${qs({ medicaments: medicamentIds.join(",") })}`),
};

// Membre 4 — NLP, IA, ontologie et intégration
export const nlpApi = {
  examples: () => api<string[]>("/nlp/exemples"),
};

// Chat IA : NLP → SPARQL → réponse rédigée par le LLM local (Ollama), reçue au fil de l'eau
export const chatApi = {
  statut: () => api<ChatStatus>("/chat/statut"),
  envoyer: (
    message: string,
    historique: { role: "user" | "assistant"; content: string }[],
    contexte: unknown,
    onEvent: (e: ChatEvent) => void,
    signal?: AbortSignal,
  ) => streamNdjson<ChatEvent>("/chat", { message, historique, contexte }, onEvent, signal),
  synthesePatient: (id: string, onEvent: (e: ChatEvent) => void, signal?: AbortSignal) =>
    streamNdjson<ChatEvent>(`/chat/synthese/patients/${enc(id)}`, {}, onEvent, signal),
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

// Contrat JSON partagé avec le back-end FastAPI.

export interface Ref {
  id: string;
  nom: string;
  type?: "Maladie" | "ConditionPhysiologique";
  detail?: string;
}

export interface Medicament {
  id: string;
  nom: string;
  dosage: string | null;
  formeGalenique: string | null;
  description: string | null;
  laboratoire: Ref | null;
  molecules: Ref[];
  maladies: Ref[];
  contreIndications: Ref[];
  interactions: Ref[];
  prescriptions?: { id: string; date: string | null }[];
  pharmacies?: { id: string; nom: string; ville: string | null }[];
}

export interface MedicamentInput {
  nom: string;
  dosage: string | null;
  formeGalenique: string | null;
  description: string | null;
  laboratoireId: string | null;
  moleculeIds: string[];
  maladieIds: string[];
  contreIndicationIds: string[];
  interactionIds: string[];
}

export interface Patient {
  id: string;
  prenom: string | null;
  nom: string;
  nomComplet: string;
  age: number | null;
  sexe: "M" | "F" | null;
  maladies: Ref[];
  conditions: Ref[];
  allergies: Ref[];
  prescriptions?: { id: string; date: string | null; medecin: string | null }[];
}

export interface PatientInput {
  prenom: string;
  nom: string;
  age: number;
  sexe: "M" | "F";
  maladieIds: string[];
  conditionIds: string[];
  allergieIds: string[];
}

export type RisqueType = "CONTRE_INDICATION" | "ALLERGIE" | "INTERACTION" | "REDONDANCE";

export interface Risque {
  type: RisqueType;
  gravite: "elevee" | "moderee";
  medicaments: string[];
  explication: string;
  relation: string;
}

export interface AnalyseRisques {
  risques: Risque[];
  methode: string;
  avertissement: string;
  requetes: string[];
  medicaments?: Ref[];
}

export interface Prescription {
  id: string;
  datePrescription: string | null;
  posologie: string | null;
  dureeJours: number | null;
  patient: Ref | null;
  medecin: (Ref & { specialite: string | null }) | null;
  medicaments: Ref[];
  nbRisques: number;
  statut: "En attente" | "Délivrée";
  pharmacie: Ref | null;
  dateDelivrance: string | null;
  analyseRisques?: AnalyseRisques;
}

export interface PrescriptionInput {
  patientId: string;
  medecinId: string;
  medicamentIds: string[];
  datePrescription: string;
  posologie: string | null;
  dureeJours: number | null;
}

export interface References {
  molecules: Ref[];
  maladies: Ref[];
  conditions: Ref[];
  laboratoires: Ref[];
  medecins: Ref[];
  medicaments: Ref[];
  patients: Ref[];
  pharmacies: Ref[];
  personnel: Ref[];
}

export interface Point {
  label: string;
  valeur: number;
}

export interface Stats {
  classes: Record<string, number>;
  triplets: number;
  prescriptionsARisque: number;
  dernieresPrescriptions: Prescription[];
  graphiques: {
    patientsParMaladie: Point[];
    medicamentsParLaboratoire: Point[];
    prescriptionsParMois: Point[];
    medicamentsLesPlusPrescrits: Point[];
    tranchesAge: Point[];
    risquesParType: Point[];
    prescriptionsParStatut: Point[];
  };
}

export type Cell = string | number | boolean | null;

export interface NlpEntity {
  id: string;
  nom: string;
  type: string;
  text: string;
  score: number;
}

export interface NlpResponse {
  question: string;
  compris: boolean;
  message: string | null;
  suggestions?: string[];
  intention?: { id: string; label: string; score: number };
  entite?: NlpEntity | null;
  explication?: string;
  sparql?: string;
  colonnes?: string[];
  resultats?: Record<string, Cell>[];
  analyse: {
    tokens: { text: string; norm: string; stem: string; stop: boolean }[];
    entites: NlpEntity[];
    nombres: number[];
  };
}

export interface SparqlResult {
  type: "SELECT" | "ASK";
  colonnes: string[];
  resultats: Record<string, Cell>[];
}

export interface Similaires {
  medicament: Ref;
  methode: string;
  similaires: { id: string; nom: string; score: number; pointsCommuns: string[] }[];
}

export interface Recommandations {
  patient: string;
  methode: string;
  avertissement: string;
  recommandations: {
    maladie: Ref;
    recommandes: { id: string; nom: string; score: number; couvre: string[]; avertissements: string[]; dejaPrescrit: boolean }[];
    exclus: { id: string; nom: string; raisons: string[] }[];
  }[];
}

export interface Alternatives {
  methode: string;
  remplacements: {
    medicament: Ref;
    problemes: string[];
    alternatives: { id: string; nom: string; similarite: number; traite: string[] }[];
  }[];
}

export interface OntologySchema {
  classes: { id: string; label: string | null; parent: string | null; individus: number }[];
  proprietes: {
    id: string;
    type: "ObjectProperty" | "DatatypeProperty";
    label: string | null;
    domaine: string | null;
    portee: string | null;
    caracteristiques: string;
    utilisations: number;
  }[];
  axiomes: { sujet: string; axiome: string; objet: string }[];
  triplets: number;
}

export interface OntologyFile {
  chemin: string;
  taille: number;
  modifieLe: string | null;
  chargeLe: string | null;
  format: string;
  triplets: number;
  rechargementsAuto: number;
  erreur: string | null;
  protege: string | null;
}

export interface ReasonerResult {
  succes: boolean;
  coherente: boolean;
  resultats: { cle: string; valeur: string }[];
  erreur: string | null;
  moteur: string;
}

export interface GraphData {
  nodes: { id: string; nom: string; type: string; focus: boolean }[];
  links: { source: string; target: string; propriete: string }[];
}

// ---------- Référentiels génériques (médecins, personnel, pharmacies, maladies, conditions, molécules, laboratoires)

export interface RefField {
  key: string;
  label: string;
  kind: "text" | "textarea" | "int" | "email" | "tel";
  required: boolean;
  in_list: boolean;
  max_length: number;
}

export interface RefRelation {
  key: string;
  predicate: string;
  label: string;
  options: string;
  inverse: boolean;
  blocks_delete: boolean;
  link: string | null;
}

export interface RefSpec {
  type: string;
  label: string;
  plural: string;
  icon: string;
  member: string;
  description: string;
  classes: { id: string; label: string }[];
  fields: RefField[];
  relations: RefRelation[];
}

export interface RefEntity {
  id: string;
  nomComplet: string;
  classe: string;
  classeLabel: string;
  champs: Record<string, string | number | null>;
  relations: Record<string, { id: string; nom: string }[]>;
  indicateurs?: { titre: string; type: "stats" | "classement"; items: { label: string; valeur: string | number }[] }[];
}

export interface RefInput {
  classe?: string;
  champs: Record<string, string | number | null>;
  relations: Record<string, string[]>;
}

// ---------- Pharmacies et délivrance

export interface PharmacieDispo {
  id: string;
  nom: string;
  ville: string | null;
  horaires: string | null;
  disponibles: Ref[];
  manquants: Ref[];
  complete: boolean;
}

// ---------- Chat IA

export interface ChatStatus {
  disponible: boolean;
  modele: string | null;
  raison: string | null;
}

export type ChatMode = "donnees" | "suivi" | "guide" | "navigation" | "general";

export interface GuidePage {
  id: string;
  titre: string;
  chemin: string;
  description: string;
  etapes: string[];
}

export type ChatEvent =
  | ({ type: "analyse"; mode: ChatMode; guide: GuidePage[]; navigation: { chemin: string; titre: string } | null }
      & Omit<NlpResponse, "analyse"> & { analyse: NlpResponse["analyse"] | null })
  | { type: "token"; text: string }
  | { type: "donnees"; texte: string }
  | { type: "fin"; mode?: ChatMode; modele: string | null; raison: string | null; contexte?: unknown; duree: number };

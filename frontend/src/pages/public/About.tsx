import { Bot, Database, FileText, Pill, Users } from "lucide-react";
import { PHOTOS } from "../../lib/images";
import { PublicHero } from "./Catalogue";

const MODULES = [
  { icon: Pill, title: "Médicaments", member: "Membre 1", text: "CRUD, recherche, filtres, relations molécules / maladies / contre-indications, médicaments similaires (IA)." },
  { icon: Users, title: "Patients", member: "Membre 2", text: "CRUD, maladies, conditions et allergies, filtre par âge, recommandations de traitement (IA)." },
  { icon: FileText, title: "Prescriptions", member: "Membre 3", text: "CRUD, détection des risques par SPARQL, alternatives thérapeutiques (IA), ordonnance imprimable." },
  { icon: Bot, title: "NLP & intégration", member: "Membre 4", text: "Traduction question → SPARQL (spaCy, Snowball, rapidfuzz), tableau de bord, ontologie, console SPARQL." },
];

const STACK = [
  ["Ontologie", "OWL 2 (RDF/XML) éditable dans Protégé — classes, propriétés objet et données, axiomes, individus"],
  ["Back-end", "Python · FastAPI · rdflib (SPARQL 1.1 : SELECT, INSERT DATA, DELETE/INSERT WHERE)"],
  ["NLP / TALN", "spaCy (tokenisation française) · snowballstemmer (racinisation) · rapidfuzz (entités approximatives) — sans API de LLM"],
  ["IA", "Recommandation par contenu (TF-IDF + similarité cosinus) · système de recommandation à base de connaissances"],
  ["Front-end", "React 18 · TypeScript · Vite · Tailwind CSS · Recharts · lucide-react"],
  ["Communication", "API REST JSON, proxy Vite /api → FastAPI, validation Pydantic"],
];

export function About() {
  return (
    <>
      <PublicHero eyebrow="Le projet" title="Nexora — Web sémantique appliqué à la santé" image={PHOTOS.projet}
        text="Mini-projet de validation du module Web Sémantique (ESPRIT, 2026/2027) : thématique Pharmaceutique et Santé." />
      <section className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold">Les quatre modules</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {MODULES.map(({ icon: Icon, title, member, text }) => (
              <div key={title} className="card p-6">
                <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{member}</p>
                <h3 className="mt-1 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold"><Database className="h-6 w-6 text-brand-600" /> Technologies</h2>
          <div className="card mt-6 divide-y divide-slate-100">
            {STACK.map(([k, v]) => (
              <div key={k} className="grid gap-1 px-6 py-4 sm:grid-cols-[180px_1fr]">
                <span className="text-sm font-semibold text-ink-900">{k}</span>
                <span className="text-sm text-slate-600">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

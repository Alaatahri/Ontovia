import { Cpu, ListChecks, Workflow } from "lucide-react";
import { NlpAssistant } from "../../components/NlpAssistant";
import { Card, PageHeader } from "../../components/ui";

const PIPELINE = [
  ["1. Tokenisation", "spaCy (modèle français vierge) : élisions l', d', qu', ponctuation, mots vides."],
  ["2. Racinisation", "snowballstemmer (français) : « traitent », « traitement » → « trait »."],
  ["3. Entités", "n-grammes comparés aux noms des individus lus dans le graphe ; synonymes ; rapidfuzz tolère les fautes."],
  ["4. Intention", "score par mots-clés racinisés + bonus si l'entité attendue est du bon type (17 intentions)."],
  ["5. SPARQL", "le modèle de requête de l'intention est instancié avec l'IRI de l'entité, puis exécuté par rdflib."],
];

export function AssistantAdmin() {
  return (
    <>
      <PageHeader eyebrow="Module 4 — NLP / TALN" title="Assistant NLP → SPARQL"
        subtitle="Mode expert : la requête SPARQL générée et l'analyse linguistique sont affichées pour chaque question. Aucune API de LLM n'est utilisée." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <NlpAssistant expertMode />
        <div className="space-y-6">
          <Card title="Pipeline de traitement" icon={<Workflow className="h-4 w-4" />}>
            <ol className="space-y-3">
              {PIPELINE.map(([t, d]) => (
                <li key={t}><p className="text-sm font-semibold text-ink-900">{t}</p><p className="text-xs text-slate-500">{d}</p></li>
              ))}
            </ol>
          </Card>
          <Card title="Bibliothèques" icon={<Cpu className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-1.5">
              {["spaCy 3.8", "snowballstemmer", "rapidfuzz", "rdflib 7", "FastAPI"].map((l) => <span key={l} className="chip chip-indigo">{l}</span>)}
            </div>
          </Card>
          <Card title="Exemples d'intentions" icon={<ListChecks className="h-4 w-4" />}>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li>Traitements d'une maladie — <code className="text-brand-700">nx:traite</code></li>
              <li>Contre-indications — <code className="text-brand-700">nx:aContreIndication</code></li>
              <li>Patients atteints — <code className="text-brand-700">nx:souffreDe</code></li>
              <li>Composition, interactions, allergies</li>
              <li>Prescriptions d'un patient / d'un médecin</li>
              <li>Prescriptions à risque, âge, comptage, listes</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

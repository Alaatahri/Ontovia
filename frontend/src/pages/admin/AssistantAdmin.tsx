import { Cpu, ListChecks, Workflow } from "lucide-react";
import { ChatAssistant } from "../../components/chat/ChatAssistant";
import { Card, PageHeader } from "../../components/ui";

const PIPELINE = [
  ["1. Tokenisation", "spaCy (modèle français vierge) : élisions l', d', qu', ponctuation, mots vides."],
  ["2. Racinisation", "snowballstemmer (français) : « traitent », « traitement » → « trait »."],
  ["3. Entités", "n-grammes comparés aux noms des individus lus dans le graphe ; synonymes ; rapidfuzz tolère les fautes."],
  ["4. Intention", "score par mots-clés racinisés + bonus si l'entité attendue est du bon type (21 intentions)."],
  ["5. SPARQL", "le modèle de requête de l'intention est instancié avec l'IRI de l'entité, puis exécuté par rdflib."],
  ["6. Contexte", "sans entité dans la question (« et ses interactions ? »), l'entité du tour précédent est reprise."],
  ["7. Rédaction (LLM local)", "Ollama (gemma3:4b) rédige la réponse à partir des seuls résultats SPARQL ; il ne génère jamais de SPARQL."],
];

export function AssistantAdmin() {
  return (
    <>
      <PageHeader eyebrow="Intelligence artificielle" title="Assistant IA"
        subtitle="Données, aide à l'utilisation et navigation. La question est traduite en SPARQL par le module NLP ; le modèle local rédige la réponse." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <ChatAssistant expertMode />
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
              {["spaCy 3.8", "snowballstemmer", "rapidfuzz", "rdflib 7", "FastAPI", "Ollama · gemma3:4b"].map((l) => <span key={l} className="chip chip-indigo">{l}</span>)}
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

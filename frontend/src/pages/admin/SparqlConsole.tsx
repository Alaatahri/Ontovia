import { useState } from "react";
import { Loader2, Play, TerminalSquare } from "lucide-react";
import { ontologyApi } from "../../api/services";
import type { SparqlResult } from "../../api/types";
import { ResultTable } from "../../components/Sparql";
import { Card, ErrorBox, PageHeader } from "../../components/ui";

const PREFIXES = `PREFIX nx: <http://www.nexora.org/ontologie/pharma#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
`;

const SAMPLES: Record<string, string> = {
  "Médicaments et maladies traitées": `SELECT ?medicament ?maladie WHERE {
  ?m a nx:Medicament ; nx:nom ?medicament ; nx:traite ?x .
  ?x nx:nom ?maladie .
}
ORDER BY ?medicament`,
  "Classes et sous-classes": `SELECT ?classe ?parent WHERE {
  ?classe a owl:Class .
  OPTIONAL { ?classe rdfs:subClassOf ?parent }
}
ORDER BY ?classe`,
  "Propriétés objet (domaine → portée)": `SELECT ?propriete ?domaine ?portee WHERE {
  ?propriete a owl:ObjectProperty .
  OPTIONAL { ?propriete rdfs:domain ?domaine }
  OPTIONAL { ?propriete rdfs:range ?portee }
}
ORDER BY ?propriete`,
  "Nombre de patients par maladie (GROUP BY)": `SELECT ?maladie (COUNT(?p) AS ?patients) WHERE {
  ?p nx:souffreDe ?m .
  ?m nx:nom ?maladie .
}
GROUP BY ?maladie
ORDER BY DESC(?patients)`,
  "Patients exposés à une contre-indication": `SELECT DISTINCT ?patient ?medicament ?condition WHERE {
  ?presc nx:concernePatient ?p ; nx:prescritMedicament ?m .
  ?m nx:aContreIndication ?c .
  ?p nx:souffreDe|nx:presenteCondition ?c .
  ?p nx:nom ?patient . ?m nx:nom ?medicament . ?c nx:nom ?condition .
}`,
  "Recherche textuelle (FILTER CONTAINS)": `SELECT ?medicament ?dosage WHERE {
  ?m a nx:Medicament ; nx:nom ?medicament .
  OPTIONAL { ?m nx:dosage ?dosage }
  FILTER(CONTAINS(LCASE(?medicament), "an"))
}`,
  "Patients de plus de 60 ans (FILTER numérique)": `SELECT ?prenom ?nom ?age WHERE {
  ?p a nx:Patient ; nx:prenom ?prenom ; nx:nom ?nom ; nx:age ?age .
  FILTER(?age > 60)
}
ORDER BY DESC(?age)`,
  "ASK : l'aspirine interagit-elle avec la Coumadine ?": `ASK {
  nx:Med_Aspirine nx:interagitAvec|^nx:interagitAvec nx:Med_Coumadine .
}`,
};

export function SparqlConsole() {
  const [query, setQuery] = useState(PREFIXES + "\n" + Object.values(SAMPLES)[0]);
  const [result, setResult] = useState<SparqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      setResult(await ontologyApi.sparql(query));
      setElapsed(Math.round(performance.now() - t0));
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Requêtes SPARQL" title="Console SPARQL" subtitle="Requêtes SELECT et ASK en lecture seule sur le graphe partagé (les mises à jour passent par l'API CRUD)." />
      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <Card title="Exemples" bodyClass="p-2">
          <div className="space-y-1">
            {Object.keys(SAMPLES).map((k) => (
              <button key={k} onClick={() => setQuery(PREFIXES + "\n" + SAMPLES[k])}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-brand-50 hover:text-brand-800">{k}</button>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Requête" icon={<TerminalSquare className="h-4 w-4" />}>
            <textarea className="w-full rounded-xl bg-ink-900 p-4 font-mono text-[13px] leading-relaxed text-teal-50 focus:outline-none focus:ring-4 focus:ring-brand-200"
              value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false} rows={14}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run(); }} />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">Ctrl + Entrée pour exécuter</span>
              <button className="btn-primary" onClick={run} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Exécuter
              </button>
            </div>
          </Card>
          {error && <ErrorBox message={error} />}
          {result && (
            <Card title={`Résultats (${result.resultats.length})`} bodyClass=""
              actions={elapsed !== null && <span className="text-xs text-slate-400">{result.type} · {elapsed} ms</span>}>
              {result.type === "ASK" ? (
                <p className={`p-5 text-lg font-semibold ${result.resultats[0]?.resultat ? "text-emerald-600" : "text-rose-600"}`}>
                  {result.resultats[0]?.resultat ? "true — vrai" : "false — faux"}
                </p>
              ) : <ResultTable columns={result.colonnes} rows={result.resultats} />}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

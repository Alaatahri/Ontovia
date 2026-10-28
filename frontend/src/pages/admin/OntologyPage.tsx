import { useState } from "react";
import { Boxes, GitBranch, Link2, Network, ShieldCheck } from "lucide-react";
import { ontologyApi, referencesApi } from "../../api/services";
import { GraphExplorer, NODE_COLORS } from "../../components/GraphExplorer";
import { ProtegePanel } from "../../components/ProtegePanel";
import { Card, ErrorBox, Loading, PageHeader } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";

const TABS = [
  { id: "classes", label: "Classes", icon: Boxes },
  { id: "proprietes", label: "Propriétés", icon: Link2 },
  { id: "axiomes", label: "Axiomes", icon: ShieldCheck },
] as const;

export function OntologyPage() {
  const schema = useAsync(() => ontologyApi.schema(), []);
  const refs = useAsync(() => referencesApi.all(), []);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("classes");
  const [focus, setFocus] = useState("Med_Aspirine");

  if (schema.loading) return <Loading />;
  if (schema.error || !schema.data) return <ErrorBox message={schema.error ?? "Indisponible"} onRetry={schema.reload} />;
  const s = schema.data;
  const obj = s.proprietes.filter((p) => p.type === "ObjectProperty");
  const individuals = refs.data
    ? [
        ["Médicaments", refs.data.medicaments], ["Patients", refs.data.patients], ["Médecins", refs.data.medecins],
        ["Maladies", refs.data.maladies], ["Molécules", refs.data.molecules], ["Laboratoires", refs.data.laboratoires],
      ] as const
    : [];

  return (
    <>
      <PageHeader eyebrow="Ontologie OWL" title="Ontologie & graphe de connaissances"
        subtitle={`Namespace http://www.nexora.org/ontologie/pharma# — ${s.triplets} triplets, ${s.classes.length} classes, ${obj.length} propriétés objet, ${s.proprietes.length - obj.length} propriétés de données, ${s.axiomes.length} axiomes.`} />

      <div className="mb-6">
        <ProtegePanel onReloaded={schema.reload} />
      </div>

      <Card title="Explorateur du graphe RDF" icon={<Network className="h-4 w-4" />} className="mb-6"
        actions={
          <select className="select w-auto py-2 text-sm" value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Individu">
            {individuals.map(([label, items]) => (
              <optgroup key={label} label={label}>{items.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}</optgroup>
            ))}
          </select>
        }>
        <GraphExplorer key={focus} initialId={focus} height={480} />
      </Card>

      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === id ? "bg-white text-ink-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "classes" && (
        <Card bodyClass="">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Classe</th><th>Libellé</th><th>Super-classe</th><th className="text-right">Individus</th></tr></thead>
              <tbody>
                {s.classes.map((c) => {
                  const local = c.id.replace("nx:", "");
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="flex items-center gap-2 font-mono text-[13px] font-medium text-ink-900">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: NODE_COLORS[local] ?? "#cbd5e1" }} />
                          {c.parent && <GitBranch className="h-3.5 w-3.5 text-slate-400" />}{c.id}
                        </span>
                      </td>
                      <td className="text-slate-600">{c.label}</td>
                      <td className="font-mono text-[13px] text-slate-500">{c.parent ?? "owl:Thing"}</td>
                      <td className="text-right font-semibold">{c.individus}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "proprietes" && (
        <Card bodyClass="">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Propriété</th><th>Type</th><th>Domaine → Portée</th><th>Caractéristiques</th><th className="text-right">Triplets</th></tr></thead>
              <tbody>
                {s.proprietes.map((p) => (
                  <tr key={p.id}>
                    <td><span className="font-mono text-[13px] font-medium text-ink-900">{p.id}</span><div className="text-xs text-slate-500">{p.label}</div></td>
                    <td><span className={`chip ${p.type === "ObjectProperty" ? "chip-brand" : "chip-sky"}`}>{p.type}</span></td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-600">{p.domaine ?? "—"} → {p.portee ?? "—"}</td>
                    <td>{p.caracteristiques ? p.caracteristiques.split(", ").map((c) => <span key={c} className="chip chip-amber mr-1">{c}</span>) : <span className="text-slate-300">—</span>}</td>
                    <td className="text-right font-semibold">{p.utilisations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "axiomes" && (
        <Card bodyClass="">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Sujet</th><th>Axiome</th><th>Objet</th></tr></thead>
              <tbody>
                {s.axiomes.map((a, i) => (
                  <tr key={i}>
                    <td className="font-mono text-[13px]">{a.sujet}</td>
                    <td><span className="chip chip-indigo font-mono">{a.axiome}</span></td>
                    <td className="font-mono text-[13px]">{a.objet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

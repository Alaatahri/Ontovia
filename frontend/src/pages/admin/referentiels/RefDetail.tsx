import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Network, Pencil, Trash2 } from "lucide-react";
import { referentielsApi } from "../../../api/services";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { GraphExplorer } from "../../../components/GraphExplorer";
import { Card, ErrorBox, InfoRow, Iri, Loading, PageHeader, Sem } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { CLASS_TONES, REF_ICONS, useRefSpec } from "./common";

export function RefDetail({ type }: { type: string }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { spec } = useRefSpec(type);
  const [confirm, setConfirm] = useState(false);
  const { data: e, loading, error, reload } = useAsync(() => referentielsApi.get(type, id), [type, id]);

  if (loading || !spec) return <Loading />;
  if (error || !e) return <ErrorBox message={error ?? "Introuvable"} onRetry={reload} />;
  const Icon = REF_ICONS[spec.icon];

  return (
    <>
      <PageHeader eyebrow={spec.label}
        title={<span className="flex items-center gap-3">{Icon && <Icon className="h-7 w-7 text-brand-600" />}{e.nomComplet}</span>}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Iri id={e.id} /><span className={`chip ${CLASS_TONES[e.classe] ?? "chip-slate"}`}>{e.classeLabel}</span></span>}
        actions={<>
          <Link to={`/admin/${type}`} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Retour</Link>
          <Link to={`/admin/${type}/${e.id}/modifier`} className="btn-secondary"><Pencil className="h-4 w-4" /> Modifier</Link>
          <button className="btn-danger" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> Supprimer</button>
        </>} />

      {e.indicateurs && e.indicateurs.length > 0 && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {e.indicateurs.map((ind) => (
            <Card key={ind.titre} title={ind.titre} icon={<BarChart3 className="h-4 w-4" />}>
              {ind.type === "stats" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  {ind.items.map((i) => (
                    <div key={i.label} className="rounded-xl bg-slate-50 p-3">
                      <p className="font-display text-2xl font-bold text-ink-900">{i.valeur}</p>
                      <p className="text-xs text-slate-500">{i.label}</p>
                    </div>
                  ))}
                </div>
              ) : ind.items.length ? (
                <ol className="space-y-2">
                  {ind.items.map((i, k) => {
                    const max = Math.max(...ind.items.map((x) => Number(x.valeur)));
                    return (
                      <li key={i.label} className="text-sm">
                        <div className="flex justify-between"><span>{k + 1}. {i.label}</span><span className="font-semibold">{i.valeur}</span></div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${(Number(i.valeur) / max) * 100}%` }} /></div>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className="text-sm text-slate-500">Aucune donnée.</p>}
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Informations">
          <dl className="divide-y divide-slate-100">
            {spec.fields.map((f) => (
              <InfoRow key={f.key} label={<>{f.label} <Sem>nx:{f.key}</Sem></>}>
                {f.kind === "email" && e.champs[f.key] ? <a href={`mailto:${e.champs[f.key]}`}>{e.champs[f.key]}</a> : e.champs[f.key]}
              </InfoRow>
            ))}
          </dl>
        </Card>
        <div className="space-y-6">
          {spec.relations.map((r) => {
            const items = e.relations[r.key] ?? [];
            return (
              <Card key={r.key} title={<>{r.label} <span className="badge bg-slate-100 text-slate-500">{items.length}</span></>}>
                <p className="sem mb-2 font-mono text-xs text-slate-400">{r.inverse ? `?x nx:${r.predicate} nx:${e.id}` : `nx:${e.id} nx:${r.predicate} ?x`}</p>
                {items.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((i) => r.link ? (
                      <Link key={i.id} to={`${r.link}/${i.id}`} className="chip chip-brand hover:brightness-95">{i.nom}</Link>
                    ) : <span key={i.id} className="chip chip-brand">{i.nom}</span>)}
                  </div>
                ) : <span className="text-sm text-slate-400">Aucun</span>}
              </Card>
            );
          })}
        </div>
      </div>
      <Card title="Graphe de connaissances" icon={<Network className="h-4 w-4" />} className="mt-6">
        <GraphExplorer initialId={e.id} height={420} />
      </Card>
      {confirm && (
        <ConfirmDialog title={`Supprimer ${e.nomComplet} ?`} message="L'individu et ses liens seront retirés de l'ontologie, sauf s'il est encore utilisé."
          onConfirm={async () => { await referentielsApi.remove(type, e.id); navigate(`/admin/${type}`); }}
          onClose={() => setConfirm(false)} />
      )}
    </>
  );
}

import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BrainCircuit, Building2, FlaskConical, HeartPulse, Network, Pill, ShieldAlert, Store } from "lucide-react";
import { medicamentsApi } from "../../api/services";
import { GraphExplorer } from "../../components/GraphExplorer";
import { Card, Chips, ErrorBox, Iri, Loading } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { medicamentImage } from "../../lib/images";

/** Recommandation IA : médicaments similaires (TF-IDF + cosinus). Réutilisé dans le back-office. */
export function SimilarMedicaments({ id, basePath }: { id: string; basePath: string }) {
  const { data, loading, error } = useAsync(() => medicamentsApi.similaires(id), [id]);
  if (loading) return <Loading label="Calcul des similarités…" />;
  if (error || !data) return <ErrorBox message={error ?? "Indisponible"} />;
  return (
    <div className="space-y-3">
      {data.similaires.length === 0 && <p className="text-sm text-slate-500">Aucun médicament similaire.</p>}
      {data.similaires.map((s) => (
        <Link key={s.id} to={`${basePath}/${s.id}`} className="block rounded-xl border border-slate-100 p-3.5 transition hover:border-brand-200 hover:bg-brand-50/40">
          <div className="flex items-center gap-3">
            <img src={medicamentImage({ id: s.id })} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            <span className="flex-1 font-semibold text-ink-900">{s.nom}</span>
            <span className="text-xs font-semibold text-brand-700">{Math.round(s.score * 100)} %</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sky-500" style={{ width: `${Math.round(s.score * 100)}%` }} />
          </div>
          {s.pointsCommuns.length > 0 && <p className="mt-2 text-xs text-slate-500">{s.pointsCommuns.join(" · ")}</p>}
        </Link>
      ))}
      <p className="text-xs text-slate-400">{data.methode}</p>
    </div>
  );
}

export function MedicamentPublic() {
  const { id = "" } = useParams();
  const { data: m, loading, error, reload } = useAsync(() => medicamentsApi.get(id), [id]);

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-16"><Loading /></div>;
  if (error || !m) return <div className="mx-auto max-w-7xl px-4 py-16"><ErrorBox message={error ?? "Médicament introuvable"} onRetry={reload} /></div>;

  return (
    <>
      <section className="border-b border-slate-100 bg-gradient-to-b from-brand-50/70 to-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/catalogue" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Retour au catalogue
          </Link>
          <div className="grid items-center gap-8 md:grid-cols-[1fr_420px]">
            <div>
              <span className="chip chip-brand mb-4 px-3 py-1"><Pill className="h-3.5 w-3.5" /> {m.formeGalenique ?? "Médicament"}</span>
              <h1 className="text-4xl font-extrabold sm:text-5xl">{m.nom}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-lg text-slate-600">
                {m.dosage} {m.laboratoire && <>· {m.laboratoire.nom}</>} <Iri id={m.id} />
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {m.maladies.map((x) => <span key={x.id} className="chip chip-brand px-3 py-1 text-[13px]">{x.nom}</span>)}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-3xl shadow-lift ring-1 ring-black/5">
              <img src={medicamentImage(m)} alt={`Illustration — ${m.nom}`} className="h-64 w-full object-cover md:h-72" />
              <span className="absolute bottom-3 right-3 rounded-full bg-ink-900/60 px-2.5 py-1 text-[11px] text-white backdrop-blur">Photo d'illustration</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Composition" icon={<FlaskConical className="h-4 w-4" />}><Chips items={m.molecules} tone="chip-indigo" /></Card>
            <Card title="Indications" icon={<HeartPulse className="h-4 w-4" />}><Chips items={m.maladies} /></Card>
            <Card title="Contre-indications" icon={<ShieldAlert className="h-4 w-4" />}>
              <Chips items={m.contreIndications} empty="Aucune contre-indication enregistrée" />
            </Card>
            <Card title="Interactions" icon={<AlertTriangle className="h-4 w-4" />}>
              <Chips items={m.interactions} tone="chip-amber" to={(r) => `/catalogue/${r.id}`} empty="Aucune interaction enregistrée" />
            </Card>
          </div>
          <Card title="Graphe de connaissances" icon={<Network className="h-4 w-4" />}>
            <GraphExplorer initialId={m.id} height={420} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Disponible en pharmacie" icon={<Store className="h-4 w-4" />}>
            {m.pharmacies?.length ? (
              <ul className="space-y-2 text-sm">
                {m.pharmacies.map((ph) => <li key={ph.id} className="flex items-center justify-between"><span className="font-medium">{ph.nom}</span><span className="text-slate-500">{ph.ville}</span></li>)}
              </ul>
            ) : <p className="text-sm text-slate-500">Aucune pharmacie partenaire ne l'a en stock.</p>}
            <Link to="/pharmacies" className="btn-secondary btn-sm mt-3">Chercher pour toute une ordonnance</Link>
          </Card>
          <Card title="Laboratoire" icon={<Building2 className="h-4 w-4" />}>
            <p className="font-medium">{m.laboratoire?.nom ?? "—"}</p>
            {m.description && <p className="mt-2 text-sm text-slate-600">{m.description}</p>}
          </Card>
          <Card title="Médicaments similaires (IA)" icon={<BrainCircuit className="h-4 w-4" />}>
            <SimilarMedicaments id={m.id} basePath="/catalogue" />
          </Card>
        </div>
      </section>
    </>
  );
}

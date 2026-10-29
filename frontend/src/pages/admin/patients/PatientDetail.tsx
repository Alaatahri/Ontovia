import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BrainCircuit, CheckCircle2, FilePlus, Network, Pencil, Sparkles, Trash2, XCircle } from "lucide-react";
import { patientsApi } from "../../../api/services";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { GraphExplorer } from "../../../components/GraphExplorer";
import { Avatar, Card, Chips, ErrorBox, Iri, Loading, PageHeader, formatDate } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { SynthesePatient } from "./SynthesePatient";

/** IA — recommandations de traitement personnalisées (système à base de connaissances). */
function Recommandations({ id }: { id: string }) {
  const { data, loading, error } = useAsync(() => patientsApi.recommandations(id), [id]);
  if (loading) return <Loading label="Calcul des recommandations…" />;
  if (error || !data) return <ErrorBox message={error ?? "Indisponible"} />;
  if (!data.recommandations.length) return <p className="text-sm text-slate-500">Aucune maladie renseignée pour ce patient.</p>;
  return (
    <div className="space-y-5">
      {data.recommandations.map((r) => (
        <div key={r.maladie.id}>
          <h4 className="mb-2 text-sm font-semibold text-ink-900">{r.maladie.nom}</h4>
          <div className="space-y-2">
            {r.recommandes.map((m) => (
              <div key={m.id} className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="flex-1">
                  <Link to={`/admin/medicaments/${m.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{m.nom}</Link>
                  {m.dejaPrescrit && <span className="chip chip-sky ml-2">déjà prescrit</span>}
                  {m.couvre.length > 1 && <p className="text-xs text-emerald-700">Couvre aussi : {m.couvre.filter((c) => c !== r.maladie.nom).join(", ")}</p>}
                  {m.avertissements.map((w) => <p key={w} className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="h-3 w-3" /> {w}</p>)}
                </div>
                <span className="text-xs font-semibold text-emerald-700">score {m.score}</span>
              </div>
            ))}
            {r.recommandes.length === 0 && <p className="text-xs text-slate-500">Aucun médicament sans risque trouvé dans l'ontologie.</p>}
            {r.exclus.map((m) => (
              <div key={m.id} className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span><span className="font-medium text-slate-700 line-through">{m.nom}</span> — {m.raisons.join(" ; ")}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">{data.methode} {data.avertissement}</p>
    </div>
  );
}

export function PatientDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const { data: p, loading, error, reload } = useAsync(() => patientsApi.get(id), [id]);

  if (loading) return <Loading />;
  if (error || !p) return <ErrorBox message={error ?? "Patient introuvable"} onRetry={reload} />;

  return (
    <>
      <PageHeader eyebrow="Dossier patient"
        title={<span className="flex items-center gap-3"><Avatar name={p.nomComplet} tone={p.sexe === "F" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"} />{p.nomComplet}</span>}
        subtitle={<span className="flex flex-wrap items-center gap-2">{p.age} ans · {p.sexe === "F" ? "Femme" : "Homme"} <Iri id={p.id} /></span>}
        actions={<>
          <Link to="/admin/patients" className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Retour</Link>
          <Link to={`/admin/prescriptions/nouvelle?patient=${p.id}`} className="btn-secondary"><FilePlus className="h-4 w-4" /> Prescrire</Link>
          <Link to={`/admin/patients/${p.id}/modifier`} className="btn-secondary"><Pencil className="h-4 w-4" /> Modifier</Link>
          <button className="btn-danger" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> Supprimer</button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="grid gap-6 md:grid-cols-3">
            <Card title="Maladies"><p className="sem mb-2 text-xs">nx:souffreDe</p><Chips items={p.maladies} tone="chip-rose" /></Card>
            <Card title="Conditions"><p className="sem mb-2 text-xs">nx:presenteCondition</p><Chips items={p.conditions} tone="chip-amber" /></Card>
            <Card title="Allergies"><p className="sem mb-2 text-xs">nx:estAllergiqueA</p><Chips items={p.allergies} tone="chip-indigo" /></Card>
          </div>
          <Card title="Prescriptions" bodyClass="">
            {p.prescriptions?.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Prescription</th><th>Date</th><th>Médecin</th></tr></thead>
                  <tbody>
                    {p.prescriptions.map((pr) => (
                      <tr key={pr.id}>
                        <td><Link to={`/admin/prescriptions/${pr.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{pr.id}</Link></td>
                        <td>{formatDate(pr.date)}</td>
                        <td className="text-slate-600">{pr.medecin ? `Dr ${pr.medecin}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="p-5 text-sm text-slate-500">Aucune prescription.</p>}
          </Card>
          <Card title="Graphe de connaissances" icon={<Network className="h-4 w-4" />}>
            <GraphExplorer initialId={p.id} height={400} />
          </Card>
        </div>
        <div className="space-y-6 xl:self-start">
          <Card title="Synthèse du dossier (IA générative locale)" icon={<Sparkles className="h-4 w-4" />}>
            <SynthesePatient id={p.id} />
          </Card>
          <Card title="Traitements recommandés (IA)" icon={<BrainCircuit className="h-4 w-4" />}>
            <Recommandations id={p.id} />
          </Card>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog title={`Supprimer ${p.nomComplet} ?`} message="Toutes les relations du patient seront retirées. Supprimez d'abord ses prescriptions s'il en possède."
          onConfirm={async () => { await patientsApi.remove(p.id); navigate("/admin/patients"); }}
          onClose={() => setConfirm(false)} />
      )}
    </>
  );
}

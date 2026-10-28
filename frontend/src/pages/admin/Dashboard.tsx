import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Bot, Building2, Database, FileText, FlaskConical, HeartPulse, Pill, Stethoscope, Users,
} from "lucide-react";
import { referencesApi } from "../../api/services";
import { DataTableToggle, HBarChart, TrendChart, VBarChart } from "../../components/Charts";
import { RISK_LABELS } from "../../components/RiskPanel";
import { Card, Chips, ErrorBox, Loading, RiskBadge, formatDate } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { PHOTOS } from "../../lib/images";
import type { RisqueType } from "../../api/types";

const TILES = [
  { cls: "Medicament", label: "Médicaments", icon: Pill, to: "/admin/medicaments", tone: "bg-brand-50 text-brand-700" },
  { cls: "Patient", label: "Patients", icon: Users, to: "/admin/patients", tone: "bg-sky-50 text-sky-700" },
  { cls: "Prescription", label: "Prescriptions", icon: FileText, to: "/admin/prescriptions", tone: "bg-indigo-50 text-indigo-700" },
  { cls: "Medecin", label: "Médecins", icon: Stethoscope, tone: "bg-slate-100 text-slate-700" },
  { cls: "Molecule", label: "Molécules", icon: FlaskConical, tone: "bg-violet-50 text-violet-700" },
  { cls: "Maladie", label: "Maladies", icon: HeartPulse, tone: "bg-rose-50 text-rose-700" },
  { cls: "Laboratoire", label: "Laboratoires", icon: Building2, tone: "bg-amber-50 text-amber-800" },
];

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => referencesApi.stats(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Statistiques indisponibles"} onRetry={reload} />;
  const g = data.graphiques;
  const parMois = g.prescriptionsParMois.map((p) => {
    const [y, m] = p.label.split("-");
    return { ...p, label: `${MONTHS[Number(m) - 1]} ${y.slice(2)}` };
  });
  const risques = g.risquesParType.map((r) => ({ ...r, label: RISK_LABELS[r.label as RisqueType] ?? r.label }));

  return (
    <>
      <section className="relative isolate mb-6 overflow-hidden rounded-3xl bg-ink-900 px-6 py-8 animate-fade-up sm:px-10 sm:py-10">
        <img src={PHOTOS.admin} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-900 via-ink-900/85 to-brand-900/40" />
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Tableau de bord</p>
        <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Bonjour 👋 Bienvenue dans l'espace Nexora</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Vue d'ensemble du graphe RDF partagé : toutes les valeurs ci-dessous sont calculées par des requêtes SPARQL (COUNT, GROUP BY).
          {data.prescriptionsARisque > 0 && <> <strong className="text-rose-300">{data.prescriptionsARisque} prescriptions</strong> présentent un risque détecté.</>}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/admin/assistant" className="btn-white"><Bot className="h-4 w-4" /> Poser une question</Link>
          <Link to="/admin/prescriptions/nouvelle" className="btn text-white ring-1 ring-white/25 hover:bg-white/10"><FileText className="h-4 w-4" /> Nouvelle prescription</Link>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
        {TILES.map(({ cls, label, icon: Icon, to, tone }) => {
          const body = (
            <>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
              <p className="mt-4 font-display text-2xl font-bold text-ink-900">{data.classes[cls] ?? 0}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </>
          );
          return to ? (
            <Link key={cls} to={to} className="card p-4 transition hover:-translate-y-0.5 hover:border-brand-200">{body}</Link>
          ) : (
            <div key={cls} className="card p-4">{body}</div>
          );
        })}
        <Link to="/admin/prescriptions" className="card border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 transition hover:-translate-y-0.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-rose-700"><AlertTriangle className="h-5 w-5" /></span>
          <p className="mt-4 font-display text-2xl font-bold text-rose-700">{data.prescriptionsARisque}</p>
          <p className="text-sm text-rose-700/80">À risque</p>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Prescriptions par mois" className="xl:col-span-2">
          <TrendChart data={parMois} unit="prescription(s)" />
          <DataTableToggle data={parMois} unit="" />
        </Card>
        <Card title="Risques détectés par type">
          <VBarChart data={risques.map((r) => ({ ...r, label: r.label.split(" ")[0] }))} unit="risque(s)" />
          <DataTableToggle data={risques} unit="" />
        </Card>
        <Card title="Patients par maladie">
          <HBarChart data={g.patientsParMaladie} unit="patient(s)" />
        </Card>
        <Card title="Médicaments les plus prescrits">
          <HBarChart data={g.medicamentsLesPlusPrescrits} unit="prescription(s)" />
        </Card>
        <div className="space-y-6">
          <Card title="Patients par tranche d'âge">
            <VBarChart data={g.tranchesAge} unit="patient(s)" height={190} />
          </Card>
          <Card title="Médicaments par laboratoire">
            <HBarChart data={g.medicamentsParLaboratoire} unit="médicament(s)" />
          </Card>
        </div>
      </div>

      <Card className="mt-6" title="Dernières prescriptions" bodyClass=""
        actions={<Link to="/admin/prescriptions" className="btn-ghost btn-sm">Tout voir <ArrowRight className="h-3.5 w-3.5" /></Link>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Prescription</th><th>Patient</th><th>Médecin</th><th>Médicaments</th><th>Risques</th></tr></thead>
            <tbody>
              {data.dernieresPrescriptions.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/admin/prescriptions/${p.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{p.id}</Link>
                    <div className="text-xs text-slate-500">{formatDate(p.datePrescription)}</div>
                  </td>
                  <td>{p.patient?.nom}</td>
                  <td className="text-slate-600">{p.medecin?.nom}</td>
                  <td><Chips items={p.medicaments} /></td>
                  <td><RiskBadge count={p.nbRisques} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400"><Database className="h-3.5 w-3.5" /> Graphe chargé : {data.triplets} triplets.</p>
    </>
  );
}

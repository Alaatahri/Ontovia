import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, HeartPulse, Pencil, Printer, ShieldAlert, Trash2 } from "lucide-react";
import { prescriptionsApi } from "../../../api/services";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { RiskPanel } from "../../../components/RiskPanel";
import { Card, Chips, ErrorBox, InfoRow, Iri, Loading, PageHeader, RiskBadge, formatDate } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { Alternatives } from "./Alternatives";

export function PrescriptionDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const { data: p, loading, error, reload } = useAsync(() => prescriptionsApi.get(id), [id]);

  if (loading) return <Loading />;
  if (error || !p) return <ErrorBox message={error ?? "Prescription introuvable"} onRetry={reload} />;

  return (
    <>
      <div className="no-print">
        <PageHeader eyebrow="Prescription" title={p.id} subtitle={<Iri id={p.id} />}
          actions={<>
            <Link to="/admin/prescriptions" className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Retour</Link>
            <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimer l'ordonnance</button>
            <Link to={`/admin/prescriptions/${p.id}/modifier`} className="btn-secondary"><Pencil className="h-4 w-4" /> Modifier</Link>
            <button className="btn-danger" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> Supprimer</button>
          </>} />
        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <Card title="Relations de la prescription">
            <dl className="divide-y divide-slate-100">
              <InfoRow label="Patient (nx:concernePatient)">{p.patient && <Link className="font-medium hover:text-brand-700" to={`/admin/patients/${p.patient.id}`}>{p.patient.nom}</Link>}</InfoRow>
              <InfoRow label="Médecin (nx:prescritePar)">{p.medecin && `${p.medecin.nom}${p.medecin.specialite ? ` — ${p.medecin.specialite}` : ""}`}</InfoRow>
              <InfoRow label="Médicaments (nx:prescritMedicament)"><Chips items={p.medicaments} to={(r) => `/admin/medicaments/${r.id}`} /></InfoRow>
              <InfoRow label="Date">{formatDate(p.datePrescription)}</InfoRow>
              <InfoRow label="Durée">{p.dureeJours ? `${p.dureeJours} jours` : null}</InfoRow>
              <InfoRow label="Posologie">{p.posologie}</InfoRow>
            </dl>
          </Card>
          <Card title={<>Risque détecté <RiskBadge count={p.nbRisques} /></>} icon={<ShieldAlert className="h-4 w-4" />}>
            <div className="space-y-4">
              {p.analyseRisques && <RiskPanel analyse={p.analyseRisques} />}
              {p.nbRisques > 0 && p.patient && <Alternatives patientId={p.patient.id} medicamentIds={p.medicaments.map((m) => m.id)} />}
            </div>
          </Card>
        </div>
      </div>

      {/* Ordonnance imprimable (visible uniquement à l'impression) */}
      <div className="hidden print:block">
        <div className="flex items-center justify-between border-b-2 border-brand-600 pb-4">
          <div className="flex items-center gap-3">
            <HeartPulse className="h-8 w-8 text-brand-600" />
            <div><p className="text-xl font-bold">Nexora</p><p className="text-xs text-slate-500">Pharmaceutique & Santé</p></div>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{p.medecin?.nom}</p>
            <p className="text-slate-500">{p.medecin?.specialite}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-between text-sm">
          <p>Patient : <strong>{p.patient?.nom}</strong></p>
          <p>Le {formatDate(p.datePrescription)}</p>
        </div>
        <h2 className="mt-8 text-lg font-bold">Ordonnance</h2>
        <ul className="mt-4 space-y-3">
          {p.medicaments.map((m) => <li key={m.id} className="border-b border-slate-200 pb-2 font-medium">• {m.nom}</li>)}
        </ul>
        {p.posologie && <p className="mt-6 text-sm"><strong>Posologie :</strong> {p.posologie}</p>}
        {p.dureeJours && <p className="mt-2 text-sm"><strong>Durée :</strong> {p.dureeJours} jours</p>}
        <p className="mt-16 text-right text-sm">Signature</p>
        <p className="mt-16 text-xs text-slate-400">Référence : {p.id} — document généré depuis l'ontologie Nexora.</p>
      </div>

      {confirm && (
        <ConfirmDialog title={`Supprimer ${p.id} ?`} message="La prescription sera retirée de l'ontologie. Le patient, le médecin et les médicaments sont conservés."
          onConfirm={async () => { await prescriptionsApi.remove(p.id); navigate("/admin/prescriptions"); }}
          onClose={() => setConfirm(false)} />
      )}
    </>
  );
}

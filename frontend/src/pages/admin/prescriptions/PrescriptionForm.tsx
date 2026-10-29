import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, Save, ShieldAlert } from "lucide-react";
import { prescriptionsApi, referencesApi } from "../../../api/services";
import type { AnalyseRisques, PrescriptionInput } from "../../../api/types";
import { MultiSelect } from "../../../components/MultiSelect";
import { RiskPanel } from "../../../components/RiskPanel";
import { Card, ErrorBox, Field, Loading, PageHeader , Sem } from "../../../components/ui";
import { useAsync, useDebounced } from "../../../hooks/useAsync";
import { Alternatives } from "./Alternatives";

const today = () => new Date().toISOString().slice(0, 10);

export function PrescriptionForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const refs = useAsync(() => referencesApi.all(), []);
  const [form, setForm] = useState<PrescriptionInput>({
    patientId: params.get("patient") ?? "", medecinId: "", medicamentIds: [], datePrescription: today(), posologie: "", dureeJours: 7,
  });
  const [loadingItem, setLoadingItem] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseRisques | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!id) return;
    prescriptionsApi.get(id)
      .then((p) => setForm({
        patientId: p.patient?.id ?? "", medecinId: p.medecin?.id ?? "", medicamentIds: p.medicaments.map((m) => m.id),
        datePrescription: p.datePrescription ?? today(), posologie: p.posologie ?? "", dureeJours: p.dureeJours,
      }))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingItem(false));
  }, [id]);

  // Vérification des risques en direct dès qu'un patient et au moins un médicament sont choisis.
  const draft = useDebounced(JSON.stringify([form.patientId, form.medicamentIds]), 300);
  useEffect(() => {
    const [patientId, medicamentIds] = JSON.parse(draft) as [string, string[]];
    if (!patientId || medicamentIds.length === 0) {
      setAnalyse(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    prescriptionsApi.checkRisks(patientId, medicamentIds)
      .then((a) => !cancelled && setAnalyse(a))
      .catch(() => !cancelled && setAnalyse(null))
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [draft]);

  const set = <K extends keyof PrescriptionInput>(k: K, v: PrescriptionInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const replace = (from: string, to: string) =>
    set("medicamentIds", [...new Set(form.medicamentIds.map((m) => (m === from ? to : m)))]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.medicamentIds.length === 0) {
      setError("Sélectionnez au moins un médicament.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { ...form, posologie: form.posologie || null, dureeJours: form.dureeJours || null };
    try {
      const saved = id ? await prescriptionsApi.update(id, payload) : await prescriptionsApi.create(payload);
      navigate(`/admin/prescriptions/${saved.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  if (loadingItem || refs.loading) return <Loading />;
  if (refs.error) return <ErrorBox message={refs.error} onRetry={refs.reload} />;
  const r = refs.data!;

  return (
    <>
      <PageHeader eyebrow="Ordonnances" title={id ? `Modifier ${id}` : "Nouvelle prescription"}
        subtitle="Les risques sont vérifiés en direct ; l'IA propose des alternatives." />
      <form onSubmit={submit} className="space-y-6">
        {error && <ErrorBox message={error} />}
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <Card title="Prescription">
              <div className="space-y-4">
                <Field label="Patient" required>
                  <select className="select" value={form.patientId} onChange={(e) => set("patientId", e.target.value)} required>
                    <option value="">— Choisir un patient —</option>
                    {r.patients.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </Field>
                <Field label="Médecin" required>
                  <select className="select" value={form.medecinId} onChange={(e) => set("medecinId", e.target.value)} required>
                    <option value="">— Choisir un médecin —</option>
                    {r.medecins.map((m) => <option key={m.id} value={m.id}>{m.nom}{m.detail ? ` — ${m.detail}` : ""}</option>)}
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Date" required><input className="input" type="date" value={form.datePrescription} onChange={(e) => set("datePrescription", e.target.value)} required /></Field>
                  <Field label="Durée (jours)">
                    <input className="input" type="number" min={1} max={3650} value={form.dureeJours ?? ""}
                      onChange={(e) => set("dureeJours", e.target.value ? Number(e.target.value) : null)} />
                  </Field>
                </div>
                <Field label="Posologie"><textarea className="input" rows={3} value={form.posologie ?? ""} onChange={(e) => set("posologie", e.target.value)} /></Field>
              </div>
            </Card>
            <Card title={<>Médicaments <Sem>nx:prescritMedicament</Sem></>}>
              <MultiSelect options={r.medicaments} value={form.medicamentIds} onChange={(v) => set("medicamentIds", v)} />
            </Card>
          </div>
          <Card title={<>Risque détecté {checking && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}</>} icon={<ShieldAlert className="h-4 w-4" />}
            className="xl:sticky xl:top-24 xl:self-start">
            {analyse ? (
              <div className="space-y-4">
                <RiskPanel analyse={analyse} showQueries={false} />
                {analyse.risques.length > 0 && <Alternatives patientId={form.patientId} medicamentIds={form.medicamentIds} onPick={replace} />}
              </div>
            ) : <p className="text-sm text-slate-500">Choisissez un patient et au moins un médicament pour lancer la détection.</p>}
          </Card>
        </div>
        <div className="flex justify-end gap-2">
          <Link to={id ? `/admin/prescriptions/${id}` : "/admin/prescriptions"} className="btn-ghost">Annuler</Link>
          <button className="btn-primary" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button>
        </div>
      </form>
    </>
  );
}

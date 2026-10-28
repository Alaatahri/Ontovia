import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Save } from "lucide-react";
import { patientsApi, referencesApi } from "../../../api/services";
import type { PatientInput } from "../../../api/types";
import { MultiSelect } from "../../../components/MultiSelect";
import { Card, ErrorBox, Field, Loading, PageHeader } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";

const EMPTY: PatientInput = { prenom: "", nom: "", age: 30, sexe: "F", maladieIds: [], conditionIds: [], allergieIds: [] };

export function PatientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refs = useAsync(() => referencesApi.all(), []);
  const [form, setForm] = useState<PatientInput>(EMPTY);
  const [loadingItem, setLoadingItem] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    patientsApi.get(id)
      .then((p) => setForm({
        prenom: p.prenom ?? "", nom: p.nom, age: p.age ?? 0, sexe: p.sexe ?? "F",
        maladieIds: p.maladies.map((r) => r.id), conditionIds: p.conditions.map((r) => r.id), allergieIds: p.allergies.map((r) => r.id),
      }))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingItem(false));
  }, [id]);

  const set = <K extends keyof PatientInput>(k: K, v: PatientInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = id ? await patientsApi.update(id, form) : await patientsApi.create(form);
      navigate(`/admin/patients/${saved.id}`);
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
      <PageHeader eyebrow="Module 2" title={id ? `Modifier ${form.prenom} ${form.nom}` : "Nouveau patient"} />
      <form onSubmit={submit} className="space-y-6">
        {error && <ErrorBox message={error} />}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Identité">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prénom" required><input className="input" value={form.prenom} onChange={(e) => set("prenom", e.target.value)} required maxLength={80} /></Field>
                <Field label="Nom" required><input className="input" value={form.nom} onChange={(e) => set("nom", e.target.value)} required maxLength={80} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Âge" required>
                  <input className="input" type="number" min={0} max={130} value={form.age} onChange={(e) => set("age", Number(e.target.value))} required />
                </Field>
                <Field label="Sexe" required>
                  <div className="grid grid-cols-2 gap-2">
                    {(["F", "M"] as const).map((s) => (
                      <button type="button" key={s} onClick={() => set("sexe", s)}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${form.sexe === s ? "border-brand-500 bg-brand-50 text-brand-800 ring-4 ring-brand-100" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        {s === "F" ? "Femme" : "Homme"}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </Card>
          <Card title="Maladies (nx:souffreDe)">
            <MultiSelect options={r.maladies} value={form.maladieIds} onChange={(v) => set("maladieIds", v)} />
          </Card>
          <Card title="Conditions physiologiques (nx:presenteCondition)">
            <MultiSelect options={r.conditions} value={form.conditionIds} onChange={(v) => set("conditionIds", v)} />
          </Card>
          <Card title="Allergies (nx:estAllergiqueA)">
            <MultiSelect options={r.molecules} value={form.allergieIds} onChange={(v) => set("allergieIds", v)} />
          </Card>
        </div>
        <div className="flex justify-end gap-2">
          <Link to={id ? `/admin/patients/${id}` : "/admin/patients"} className="btn-ghost">Annuler</Link>
          <button className="btn-primary" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button>
        </div>
      </form>
    </>
  );
}

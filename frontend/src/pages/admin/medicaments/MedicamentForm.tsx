import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Save } from "lucide-react";
import { medicamentsApi, referencesApi } from "../../../api/services";
import type { MedicamentInput } from "../../../api/types";
import { MultiSelect } from "../../../components/MultiSelect";
import { Card, ErrorBox, Field, Loading, PageHeader , Sem } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";

const EMPTY: MedicamentInput = {
  nom: "", dosage: "", formeGalenique: "", description: "", laboratoireId: "",
  moleculeIds: [], maladieIds: [], contreIndicationIds: [], interactionIds: [],
};
const FORMES = ["Comprimé", "Comprimé enrobé", "Gélule", "Sachet", "Sirop", "Solution injectable", "Suspension pour inhalation", "Pommade"];

export function MedicamentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refs = useAsync(() => referencesApi.all(), []);
  const [form, setForm] = useState<MedicamentInput>(EMPTY);
  const [loadingItem, setLoadingItem] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    medicamentsApi.get(id)
      .then((m) => setForm({
        nom: m.nom, dosage: m.dosage ?? "", formeGalenique: m.formeGalenique ?? "", description: m.description ?? "",
        laboratoireId: m.laboratoire?.id ?? "", moleculeIds: m.molecules.map((r) => r.id), maladieIds: m.maladies.map((r) => r.id),
        contreIndicationIds: m.contreIndications.map((r) => r.id), interactionIds: m.interactions.map((r) => r.id),
      }))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingItem(false));
  }, [id]);

  const set = <K extends keyof MedicamentInput>(k: K, v: MedicamentInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, dosage: form.dosage || null, formeGalenique: form.formeGalenique || null,
      description: form.description || null, laboratoireId: form.laboratoireId || null };
    try {
      const saved = id ? await medicamentsApi.update(id, payload) : await medicamentsApi.create(payload);
      navigate(`/admin/medicaments/${saved.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  if (loadingItem || refs.loading) return <Loading />;
  if (refs.error) return <ErrorBox message={refs.error} onRetry={refs.reload} />;
  const r = refs.data!;
  const conditions = [
    ...r.maladies.map((m) => ({ ...m, type: "Maladie" as const })),
    ...r.conditions.map((c) => ({ ...c, type: "ConditionPhysiologique" as const })),
  ];

  return (
    <>
      <PageHeader eyebrow="Catalogue" title={id ? `Modifier ${form.nom || "le médicament"}` : "Nouveau médicament"}
        subtitle={<Sem>Enregistrement : requête SPARQL INSERT DATA (création) ou DELETE/INSERT (modification).</Sem>} />
      <form onSubmit={submit} className="space-y-6">
        {error && <ErrorBox message={error} />}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Informations">
            <div className="space-y-4">
              <Field label="Nom" required><input className="input" value={form.nom} onChange={(e) => set("nom", e.target.value)} required maxLength={120} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dosage"><input className="input" value={form.dosage ?? ""} onChange={(e) => set("dosage", e.target.value)} placeholder="500 mg" /></Field>
                <Field label="Forme galénique">
                  <input className="input" list="formes" value={form.formeGalenique ?? ""} onChange={(e) => set("formeGalenique", e.target.value)} />
                  <datalist id="formes">{FORMES.map((f) => <option key={f} value={f} />)}</datalist>
                </Field>
              </div>
              <Field label="Laboratoire">
                <select className="select" value={form.laboratoireId ?? ""} onChange={(e) => set("laboratoireId", e.target.value)}>
                  <option value="">— Aucun —</option>
                  {r.laboratoires.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>
              </Field>
              <Field label="Description"><textarea className="input" rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
            </div>
          </Card>
          <Card title={<>Molécules <Sem>nx:contientMolecule</Sem></>}>
            <MultiSelect options={r.molecules} value={form.moleculeIds} onChange={(v) => set("moleculeIds", v)} />
          </Card>
          <Card title={<>Maladies traitées <Sem>nx:traite</Sem></>}>
            <MultiSelect options={r.maladies} value={form.maladieIds} onChange={(v) => set("maladieIds", v)} />
          </Card>
          <Card title={<>Contre-indications <Sem>nx:aContreIndication</Sem></>}>
            <MultiSelect options={conditions} value={form.contreIndicationIds} onChange={(v) => set("contreIndicationIds", v)}
              groupBy={(o) => (o.type === "Maladie" ? "Maladies" : "Conditions physiologiques")} />
          </Card>
          <Card title={<>Interactions <Sem>nx:interagitAvec — symétrique</Sem></>} className="lg:col-span-2">
            <MultiSelect options={r.medicaments.filter((m) => m.id !== id)} value={form.interactionIds} onChange={(v) => set("interactionIds", v)} />
          </Card>
        </div>
        <div className="flex justify-end gap-2">
          <Link to={id ? `/admin/medicaments/${id}` : "/admin/medicaments"} className="btn-ghost">Annuler</Link>
          <button className="btn-primary" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button>
        </div>
      </form>
    </>
  );
}

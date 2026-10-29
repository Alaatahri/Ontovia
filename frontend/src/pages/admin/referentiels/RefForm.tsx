import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Save } from "lucide-react";
import { referencesApi, referentielsApi } from "../../../api/services";
import type { RefInput, References } from "../../../api/types";
import { MultiSelect } from "../../../components/MultiSelect";
import { Card, ErrorBox, Field, Loading, PageHeader, Sem } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { useRefSpec } from "./common";

/** Formulaire généré à partir de la spécification : champs (propriétés de données) et relations (propriétés objet). */
export function RefForm({ type }: { type: string }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { spec } = useRefSpec(type);
  const refs = useAsync(() => referencesApi.all(), []);
  const [form, setForm] = useState<RefInput>({ champs: {}, relations: {} });
  const [loadingItem, setLoadingItem] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    referentielsApi.get(type, id)
      .then((e) => setForm({
        classe: e.classe,
        champs: e.champs,
        relations: Object.fromEntries(Object.entries(e.relations).map(([k, v]) => [k, v.map((x) => x.id)])),
      }))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingItem(false));
  }, [type, id]);

  useEffect(() => {
    if (spec && !form.classe) setForm((f) => ({ ...f, classe: spec.classes[0].id }));
  }, [spec, form.classe]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!spec) return;
    setSaving(true);
    setError(null);
    const relations = Object.fromEntries(spec.relations.filter((r) => !r.inverse).map((r) => [r.key, form.relations[r.key] ?? []]));
    try {
      const saved = id ? await referentielsApi.update(type, id, { ...form, relations }) : await referentielsApi.create(type, { ...form, relations });
      navigate(`/admin/${type}/${saved.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  if (!spec || loadingItem || refs.loading) return <Loading />;
  if (refs.error) return <ErrorBox message={refs.error} onRetry={refs.reload} />;
  const editable = spec.relations.filter((r) => !r.inverse);
  const setChamp = (key: string, value: string) => setForm((f) => ({ ...f, champs: { ...f.champs, [key]: value } }));

  return (
    <>
      <PageHeader eyebrow={spec.plural} title={id ? `Modifier « ${[form.champs.prenom, form.champs.nom].filter(Boolean).join(" ")} »` : `Ajouter : ${spec.label.toLowerCase()}`}
        subtitle={<Sem>Enregistrement : requête SPARQL INSERT DATA (ajout) ou DELETE/INSERT (modification), puis sauvegarde du fichier OWL.</Sem>} />
      <form onSubmit={submit} className="space-y-6">
        {error && <ErrorBox message={error} />}
        <div className={`grid gap-6 ${editable.length ? "lg:grid-cols-2" : "max-w-3xl"}`}>
          <Card title="Informations">
            <div className="space-y-4">
              {spec.classes.length > 1 && (
                <Field label="Fonction (classe OWL)" required>
                  <div className="grid grid-cols-2 gap-2">
                    {spec.classes.map((c) => (
                      <button type="button" key={c.id} onClick={() => setForm((f) => ({ ...f, classe: c.id }))}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${form.classe === c.id ? "border-brand-500 bg-brand-50 text-brand-800 ring-4 ring-brand-100" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {spec.fields.map((f) => (
                  <div key={f.key} className={f.kind === "textarea" || f.key === "adresse" ? "sm:col-span-2" : ""}>
                    <Field label={f.label} required={f.required}>
                      {f.kind === "textarea" ? (
                        <textarea className="input" rows={3} maxLength={f.max_length} value={String(form.champs[f.key] ?? "")}
                          onChange={(e) => setChamp(f.key, e.target.value)} required={f.required} />
                      ) : (
                        <input className="input" maxLength={f.max_length} required={f.required}
                          type={f.kind === "int" ? "number" : f.kind === "email" ? "email" : f.kind === "tel" ? "tel" : "text"}
                          value={String(form.champs[f.key] ?? "")} onChange={(e) => setChamp(f.key, e.target.value)} />
                      )}
                    </Field>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          {editable.map((r) => (
            <Card key={r.key} title={<>{r.label} <Sem>nx:{r.predicate}</Sem></>}>
              <MultiSelect options={refs.data![r.options as keyof References] ?? []} value={form.relations[r.key] ?? []}
                onChange={(v) => setForm((f) => ({ ...f, relations: { ...f.relations, [r.key]: v } }))} />
            </Card>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Link to={id ? `/admin/${type}/${id}` : `/admin/${type}`} className="btn-ghost">Annuler</Link>
          <button className="btn-primary" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button>
        </div>
      </form>
    </>
  );
}

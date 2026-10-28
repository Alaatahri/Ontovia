import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { patientsApi, referencesApi } from "../../../api/services";
import type { Patient } from "../../../api/types";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Avatar, Card, Chips, Empty, ErrorBox, Loading, PageHeader, SearchInput } from "../../../components/ui";
import { useAsync, useDebounced } from "../../../hooks/useAsync";

const AGES: Record<string, [number | undefined, number | undefined]> = {
  "": [undefined, undefined], "0-17": [0, 17], "18-39": [18, 39], "40-64": [40, 64], "65+": [65, undefined],
};

export function PatientList() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [maladie, setMaladie] = useState("");
  const [condition, setCondition] = useState("");
  const [age, setAge] = useState("");
  const [toDelete, setToDelete] = useState<Patient | null>(null);
  const search = useDebounced(q);
  const refs = useAsync(() => referencesApi.all(), []);
  const [ageMin, ageMax] = AGES[age];
  const patients = useAsync(() => patientsApi.list({ q: search, maladie, condition, ageMin, ageMax }), [search, maladie, condition, age]);

  return (
    <>
      <PageHeader eyebrow="Module 2" title="Patients" subtitle="Individus de la classe nx:Patient : maladies, conditions physiologiques et allergies."
        actions={<Link to="/admin/patients/nouveau" className="btn-primary"><Plus className="h-4 w-4" /> Nouveau patient</Link>} />
      <Card bodyClass="">
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-[1fr_200px_200px_160px]">
          <SearchInput value={q} onChange={setQ} placeholder="Rechercher par nom ou prénom…" />
          <select className="select" value={maladie} onChange={(e) => setMaladie(e.target.value)} aria-label="Maladie">
            <option value="">Toutes les maladies</option>
            {refs.data?.maladies.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <select className="select" value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Condition">
            <option value="">Toutes les conditions</option>
            {refs.data?.conditions.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select className="select" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Tranche d'âge">
            <option value="">Tous les âges</option>
            {Object.keys(AGES).filter(Boolean).map((a) => <option key={a} value={a}>{a} ans</option>)}
          </select>
        </div>
        {patients.loading && !patients.data ? <Loading /> : patients.error ? <div className="p-4"><ErrorBox message={patients.error} onRetry={patients.reload} /></div> :
          !patients.data?.length ? <Empty message="Aucun patient ne correspond à ces critères." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Patient</th><th>Âge</th><th>Maladies</th><th>Conditions</th><th>Allergies</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {patients.data.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/admin/patients/${p.id}`} className="flex items-center gap-3">
                          <Avatar name={p.nomComplet} tone={p.sexe === "F" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"} />
                          <span>
                            <span className="block font-semibold text-ink-900 hover:text-brand-700">{p.nomComplet}</span>
                            <span className="text-xs text-slate-500">{p.sexe === "F" ? "Femme" : p.sexe === "M" ? "Homme" : ""}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{p.age ?? "—"} ans</td>
                      <td><Chips items={p.maladies} tone="chip-rose" /></td>
                      <td><Chips items={p.conditions} tone="chip-amber" /></td>
                      <td><Chips items={p.allergies} tone="chip-indigo" /></td>
                      <td className="whitespace-nowrap text-right">
                        <button className="icon-btn" title="Voir" onClick={() => navigate(`/admin/patients/${p.id}`)}><Eye className="h-4 w-4" /></button>
                        <button className="icon-btn" title="Modifier" onClick={() => navigate(`/admin/patients/${p.id}/modifier`)}><Pencil className="h-4 w-4" /></button>
                        <button className="icon-btn hover:bg-rose-50 hover:text-rose-600" title="Supprimer" onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
      {toDelete && (
        <ConfirmDialog title={`Supprimer ${toDelete.nomComplet} ?`}
          message="Le patient et ses relations seront retirés de l'ontologie. Un patient qui possède des prescriptions ne peut pas être supprimé."
          onConfirm={async () => { await patientsApi.remove(toDelete.id); patients.reload(); }}
          onClose={() => setToDelete(null)} />
      )}
    </>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { prescriptionsApi, referencesApi } from "../../../api/services";
import type { Prescription } from "../../../api/types";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Card, Chips, Empty, ErrorBox, Loading, PageHeader, RiskBadge, SearchInput, formatDate } from "../../../components/ui";
import { useAsync, useDebounced } from "../../../hooks/useAsync";
import { StatutBadge } from "./Delivrance";

export function PrescriptionList() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [patient, setPatient] = useState("");
  const [medecin, setMedecin] = useState("");
  const [risque, setRisque] = useState("");
  const [statut, setStatut] = useState("");
  const [toDelete, setToDelete] = useState<Prescription | null>(null);
  const search = useDebounced(q);
  const refs = useAsync(() => referencesApi.all(), []);
  const list = useAsync(() => prescriptionsApi.list({ q: search, patient, medecin, risque, statut }), [search, patient, medecin, risque, statut]);

  return (
    <>
      <PageHeader eyebrow="Ordonnances" title="Prescriptions" subtitle="Ordonnances, risques détectés et délivrance en pharmacie."
        actions={<Link to="/admin/prescriptions/nouvelle" className="btn-primary"><Plus className="h-4 w-4" /> Nouvelle prescription</Link>} />
      <Card bodyClass="">
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-3 xl:grid-cols-[1fr_190px_190px_190px_170px]">
          <SearchInput value={q} onChange={setQ} placeholder="Patient ou médecin…" />
          <select className="select" value={patient} onChange={(e) => setPatient(e.target.value)} aria-label="Patient">
            <option value="">Tous les patients</option>
            {refs.data?.patients.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          <select className="select" value={medecin} onChange={(e) => setMedecin(e.target.value)} aria-label="Médecin">
            <option value="">Tous les médecins</option>
            {refs.data?.medecins.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <select className="select" value={risque} onChange={(e) => setRisque(e.target.value)} aria-label="Risque">
            <option value="">Avec ou sans risque</option>
            <option value="true">Risque détecté</option>
            <option value="false">Aucun risque détecté</option>
          </select>
          <select className="select" value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Statut">
            <option value="">Tous les statuts</option>
            <option value="En attente">En attente</option>
            <option value="Délivrée">Délivrée</option>
          </select>
        </div>
        {list.loading && !list.data ? <Loading /> : list.error ? <div className="p-4"><ErrorBox message={list.error} onRetry={list.reload} /></div> :
          !list.data?.length ? <Empty message="Aucune prescription ne correspond à ces critères." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Prescription</th><th>Patient</th><th>Médecin</th><th>Médicaments</th><th>Risques</th><th>Statut</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {list.data.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/admin/prescriptions/${p.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{p.id}</Link>
                        <div className="text-xs text-slate-500">{formatDate(p.datePrescription)}</div>
                      </td>
                      <td>{p.patient ? <Link to={`/admin/patients/${p.patient.id}`} className="hover:text-brand-700">{p.patient.nom}</Link> : "—"}</td>
                      <td>{p.medecin?.nom ?? "—"}<div className="text-xs text-slate-500">{p.medecin?.specialite}</div></td>
                      <td><Chips items={p.medicaments} /></td>
                      <td><RiskBadge count={p.nbRisques} /></td>
                      <td><StatutBadge statut={p.statut} />{p.pharmacie && <div className="mt-1 text-xs text-slate-500">{p.pharmacie.nom}</div>}</td>
                      <td className="whitespace-nowrap text-right">
                        <button className="icon-btn" title="Voir" onClick={() => navigate(`/admin/prescriptions/${p.id}`)}><Eye className="h-4 w-4" /></button>
                        <button className="icon-btn" title="Modifier" onClick={() => navigate(`/admin/prescriptions/${p.id}/modifier`)}><Pencil className="h-4 w-4" /></button>
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
        <ConfirmDialog title={`Supprimer ${toDelete.id} ?`}
          message="La prescription sera retirée de l'ontologie. Le patient, le médecin et les médicaments liés sont conservés."
          onConfirm={async () => { await prescriptionsApi.remove(toDelete.id); list.reload(); }}
          onClose={() => setToDelete(null)} />
      )}
    </>
  );
}

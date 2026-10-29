import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { medicamentsApi, referencesApi } from "../../../api/services";
import type { Medicament } from "../../../api/types";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Card, Chips, Empty, ErrorBox, Loading, PageHeader, SearchInput } from "../../../components/ui";
import { useAsync, useDebounced } from "../../../hooks/useAsync";
import { medicamentImage } from "../../../lib/images";

/** Export CSV de la liste filtrée (séparateur ; pour Excel). */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export function MedicamentList() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [maladie, setMaladie] = useState("");
  const [molecule, setMolecule] = useState("");
  const [laboratoire, setLaboratoire] = useState("");
  const [toDelete, setToDelete] = useState<Medicament | null>(null);
  const search = useDebounced(q);
  const refs = useAsync(() => referencesApi.all(), []);
  const meds = useAsync(() => medicamentsApi.list({ q: search, maladie, molecule, laboratoire }), [search, maladie, molecule, laboratoire]);

  const exportCsv = () =>
    meds.data && downloadCsv("medicaments.csv",
      ["Identifiant", "Nom", "Dosage", "Forme", "Laboratoire", "Molécules", "Indications", "Contre-indications", "Interactions"],
      meds.data.map((m) => [m.id, m.nom, m.dosage, m.formeGalenique, m.laboratoire?.nom ?? "",
        m.molecules.map((x) => x.nom).join(", "), m.maladies.map((x) => x.nom).join(", "),
        m.contreIndications.map((x) => x.nom).join(", "), m.interactions.map((x) => x.nom).join(", ")]));

  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Médicaments" subtitle="Composition, indications, contre-indications et interactions."
        actions={<>
          <button className="btn-secondary" onClick={exportCsv} disabled={!meds.data?.length}><Download className="h-4 w-4" /> Exporter CSV</button>
          <Link to="/admin/medicaments/nouveau" className="btn-primary"><Plus className="h-4 w-4" /> Nouveau médicament</Link>
        </>} />
      <Card bodyClass="">
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-[1fr_200px_200px_200px]">
          <SearchInput value={q} onChange={setQ} placeholder="Rechercher par nom…" />
          <select className="select" value={maladie} onChange={(e) => setMaladie(e.target.value)} aria-label="Maladie traitée">
            <option value="">Toutes les maladies traitées</option>
            {refs.data?.maladies.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <select className="select" value={molecule} onChange={(e) => setMolecule(e.target.value)} aria-label="Molécule">
            <option value="">Toutes les molécules</option>
            {refs.data?.molecules.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <select className="select" value={laboratoire} onChange={(e) => setLaboratoire(e.target.value)} aria-label="Laboratoire">
            <option value="">Tous les laboratoires</option>
            {refs.data?.laboratoires.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
          </select>
        </div>
        {meds.loading && !meds.data ? <Loading /> : meds.error ? <div className="p-4"><ErrorBox message={meds.error} onRetry={meds.reload} /></div> :
          !meds.data?.length ? <Empty message="Aucun médicament ne correspond à ces critères." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Médicament</th><th>Laboratoire</th><th>Molécules</th><th>Indications</th><th>Contre-ind.</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {meds.data.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link to={`/admin/medicaments/${m.id}`} className="flex items-center gap-3">
                          <img src={medicamentImage(m)} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
                          <span>
                            <span className="block font-semibold text-ink-900 hover:text-brand-700">{m.nom}</span>
                            <span className="text-xs text-slate-500">{[m.dosage, m.formeGalenique].filter(Boolean).join(" · ")}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="text-slate-600">{m.laboratoire?.nom ?? "—"}</td>
                      <td><Chips items={m.molecules} tone="chip-indigo" /></td>
                      <td><Chips items={m.maladies} max={3} /></td>
                      <td>
                        <span className={`badge ${m.contreIndications.length ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-500"}`}>{m.contreIndications.length}</span>
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <button className="icon-btn" title="Voir" onClick={() => navigate(`/admin/medicaments/${m.id}`)}><Eye className="h-4 w-4" /></button>
                        <button className="icon-btn" title="Modifier" onClick={() => navigate(`/admin/medicaments/${m.id}/modifier`)}><Pencil className="h-4 w-4" /></button>
                        <button className="icon-btn hover:bg-rose-50 hover:text-rose-600" title="Supprimer" onClick={() => setToDelete(m)}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
      {toDelete && (
        <ConfirmDialog title={`Supprimer ${toDelete.nom} ?`}
          message="Le médicament et ses liens (interactions, stock) seront supprimés. Un médicament présent dans une prescription ne peut pas être supprimé."
          onConfirm={async () => { await medicamentsApi.remove(toDelete.id); meds.reload(); }}
          onClose={() => setToDelete(null)} />
      )}
    </>
  );
}

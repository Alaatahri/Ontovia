import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { referentielsApi } from "../../../api/services";
import type { RefEntity } from "../../../api/types";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Avatar, Card, Empty, ErrorBox, Loading, PageHeader, SearchInput } from "../../../components/ui";
import { useAsync, useDebounced } from "../../../hooks/useAsync";
import { CLASS_TONES, REF_ICONS, useRefSpec } from "./common";

/** Liste générique d'un référentiel : recherche, filtre de sous-classe, colonnes déclarées par la spécification. */
export function RefList({ type }: { type: string }) {
  const navigate = useNavigate();
  const { spec, error: specError } = useRefSpec(type);
  const [q, setQ] = useState("");
  const [classe, setClasse] = useState("");
  const [toDelete, setToDelete] = useState<RefEntity | null>(null);
  const search = useDebounced(q);
  const list = useAsync(() => referentielsApi.list(type, { q: search, classe }), [type, search, classe]);

  if (specError) return <ErrorBox message={specError} />;
  if (!spec) return <Loading />;
  const Icon = REF_ICONS[spec.icon];
  const columns = spec.fields.filter((f) => f.in_list);
  const relationCols = spec.relations.filter((r) => !r.inverse || r.blocks_delete);
  const isPerson = spec.fields.some((f) => f.key === "prenom");

  return (
    <>
      <PageHeader eyebrow="Référentiel" title={<span className="flex items-center gap-3">{Icon && <Icon className="h-7 w-7 text-brand-600" />}{spec.plural}</span>}
        subtitle={spec.description}
        actions={<Link to={`/admin/${type}/nouveau`} className="btn-primary"><Plus className="h-4 w-4" /> Ajouter</Link>} />
      <Card bodyClass="">
        <div className={`grid gap-3 border-b border-slate-100 p-4 ${spec.classes.length > 1 ? "md:grid-cols-[1fr_220px]" : ""}`}>
          <SearchInput value={q} onChange={setQ} placeholder={`Rechercher dans les ${spec.plural.toLowerCase()}…`} />
          {spec.classes.length > 1 && (
            <select className="select" value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Fonction">
              <option value="">Toutes les fonctions</option>
              {spec.classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}
        </div>
        {list.loading && !list.data ? <Loading /> : list.error ? <div className="p-4"><ErrorBox message={list.error} onRetry={list.reload} /></div> :
          !list.data?.length ? <Empty message={`Aucun élément dans « ${spec.plural} » pour ces critères.`} /> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{spec.label}</th>
                    {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                    {relationCols.map((r) => <th key={r.key}>{r.label}</th>)}
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link to={`/admin/${type}/${e.id}`} className="flex items-center gap-3">
                          {isPerson && <Avatar name={e.nomComplet} />}
                          <span>
                            <span className="block font-semibold text-ink-900 hover:text-brand-700">{e.nomComplet}</span>
                            {spec.classes.length > 1 && <span className={`chip mt-1 ${CLASS_TONES[e.classe] ?? "chip-slate"}`}>{e.classeLabel}</span>}
                          </span>
                        </Link>
                      </td>
                      {columns.map((c) => (
                        <td key={c.key} className={c.kind === "textarea" ? "max-w-xs text-slate-500" : "text-slate-600"}>
                          {e.champs[c.key] ?? <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      {relationCols.map((r) => {
                        const items = e.relations[r.key] ?? [];
                        return (
                          <td key={r.key}>
                            {r.inverse ? (
                              <span className={`badge ${items.length ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"}`}>{items.length}</span>
                            ) : items.length ? (
                              <div className="flex flex-wrap gap-1">
                                {items.slice(0, 3).map((i) => <span key={i.id} className="chip chip-brand">{i.nom}</span>)}
                                {items.length > 3 && <span className="chip chip-slate">+{items.length - 3}</span>}
                              </div>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap text-right">
                        <button className="icon-btn" title="Voir" onClick={() => navigate(`/admin/${type}/${e.id}`)}><Eye className="h-4 w-4" /></button>
                        <button className="icon-btn" title="Modifier" onClick={() => navigate(`/admin/${type}/${e.id}/modifier`)}><Pencil className="h-4 w-4" /></button>
                        <button className="icon-btn hover:bg-rose-50 hover:text-rose-600" title="Supprimer" onClick={() => setToDelete(e)}><Trash2 className="h-4 w-4" /></button>
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
          message={`Cet élément et ses liens seront supprimés. La suppression est refusée s'il est encore utilisé : ${spec.relations.filter((r) => r.blocks_delete).map((r) => r.label.toLowerCase()).join(", ") || "—"}.`}
          onConfirm={async () => { await referentielsApi.remove(type, toDelete.id); list.reload(); }}
          onClose={() => setToDelete(null)} />
      )}
    </>
  );
}

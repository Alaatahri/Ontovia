import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BrainCircuit, Network, Pencil, Trash2 } from "lucide-react";
import { medicamentsApi } from "../../../api/services";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { GraphExplorer } from "../../../components/GraphExplorer";
import { Card, Chips, ErrorBox, InfoRow, Iri, Loading, PageHeader, formatDate , Sem } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { medicamentImage } from "../../../lib/images";
import { SimilarMedicaments } from "../../public/MedicamentPublic";

export function MedicamentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const { data: m, loading, error, reload } = useAsync(() => medicamentsApi.get(id), [id]);

  if (loading) return <Loading />;
  if (error || !m) return <ErrorBox message={error ?? "Médicament introuvable"} onRetry={reload} />;

  return (
    <>
      <PageHeader eyebrow="Médicament" title={m.nom} subtitle={<Iri id={m.id} />}
        actions={<>
          <Link to="/admin/medicaments" className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Retour</Link>
          <Link to={`/admin/medicaments/${m.id}/modifier`} className="btn-secondary"><Pencil className="h-4 w-4" /> Modifier</Link>
          <button className="btn-danger" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> Supprimer</button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Informations">
            <dl className="divide-y divide-slate-100">
              <InfoRow label={<>Dosage <Sem>nx:dosage</Sem></>}>{m.dosage}</InfoRow>
              <InfoRow label="Forme galénique">{m.formeGalenique}</InfoRow>
              <InfoRow label={<>Laboratoire <Sem>nx:fabriquePar</Sem></>}>{m.laboratoire?.nom}</InfoRow>
              <InfoRow label={<>Composition <Sem>nx:contientMolecule</Sem></>}><Chips items={m.molecules} tone="chip-indigo" /></InfoRow>
              <InfoRow label={<>Indications <Sem>nx:traite</Sem></>}><Chips items={m.maladies} /></InfoRow>
              <InfoRow label={<>Contre-indications <Sem>nx:aContreIndication</Sem></>}><Chips items={m.contreIndications} /></InfoRow>
              <InfoRow label={<>Interactions <Sem>nx:interagitAvec</Sem></>}><Chips items={m.interactions} tone="chip-amber" to={(r) => `/admin/medicaments/${r.id}`} /></InfoRow>
              <InfoRow label="Description">{m.description}</InfoRow>
              <InfoRow label={<>En stock dans <Sem>nx:disposeDe</Sem></>}>
                {m.pharmacies?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {m.pharmacies.map((ph) => <Link key={ph.id} to={`/admin/pharmacies/${ph.id}`} className="chip chip-brand">{ph.nom} · {ph.ville}</Link>)}
                  </div>
                ) : <span className="text-sm text-rose-600">Aucune pharmacie</span>}
              </InfoRow>
              <InfoRow label="Utilisé dans">
                {m.prescriptions?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {m.prescriptions.map((p) => <Link key={p.id} to={`/admin/prescriptions/${p.id}`} className="chip chip-sky">{p.id} · {formatDate(p.date)}</Link>)}
                  </div>
                ) : null}
              </InfoRow>
            </dl>
          </Card>
          <Card title="Graphe de connaissances" icon={<Network className="h-4 w-4" />}>
            <GraphExplorer initialId={m.id} />
          </Card>
        </div>
        <div className="space-y-6 xl:self-start">
          <div className="relative overflow-hidden rounded-2xl shadow-soft ring-1 ring-slate-200">
            <img src={medicamentImage(m)} alt={`Illustration — ${m.nom}`} className="h-52 w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 to-transparent" />
            <div className="absolute bottom-3 left-4 text-white">
              <p className="text-lg font-bold">{m.nom}</p>
              <p className="text-xs text-slate-200">{[m.dosage, m.formeGalenique].filter(Boolean).join(" · ")} · photo d'illustration</p>
            </div>
          </div>
          <Card title="Médicaments similaires (IA)" icon={<BrainCircuit className="h-4 w-4" />}>
            <SimilarMedicaments id={m.id} basePath="/admin/medicaments" />
          </Card>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog title={`Supprimer ${m.nom} ?`} message="Toutes les relations qui concernent ce médicament seront retirées de l'ontologie."
          onConfirm={async () => { await medicamentsApi.remove(m.id); navigate("/admin/medicaments"); }}
          onClose={() => setConfirm(false)} />
      )}
    </>
  );
}

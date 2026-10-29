import { useState } from "react";
import { CheckCircle2, Clock, MapPin, Phone, Search, Store, XCircle } from "lucide-react";
import { pharmaciesApi, referencesApi, referentielsApi } from "../../api/services";
import { MultiSelect } from "../../components/MultiSelect";
import { Card, ErrorBox, Loading } from "../../components/ui";
import { useAsync, useDebounced } from "../../hooks/useAsync";
import { PHOTOS } from "../../lib/images";
import { PublicHero } from "./Catalogue";

/** Front-office — trouver une pharmacie qui dispose de tous les médicaments d'une ordonnance. */
export function Pharmacies() {
  const refs = useAsync(() => referencesApi.all(), []);
  const pharmacies = useAsync(() => referentielsApi.list("pharmacies"), []);
  const [meds, setMeds] = useState<string[]>([]);
  const wanted = useDebounced(meds.join(","), 250);
  const dispo = useAsync(() => (wanted ? pharmaciesApi.disponibilite(wanted.split(",")) : Promise.resolve(null)), [wanted]);

  return (
    <>
      <PublicHero eyebrow="Pharmacies" title="Où trouver vos médicaments ?" image={PHOTOS.pharmacie}
        text="Sélectionnez les médicaments de votre ordonnance : les pharmacies qui les ont tous en stock apparaissent en premier." />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8">
        <Card title="Votre ordonnance" icon={<Search className="h-4 w-4" />} className="lg:sticky lg:top-24 lg:self-start">
          {refs.loading ? <Loading /> : refs.error ? <ErrorBox message={refs.error} /> :
            <MultiSelect options={refs.data!.medicaments} value={meds} onChange={setMeds} placeholder="Rechercher un médicament…" />}
        </Card>
        <div className="space-y-4">
          {!wanted ? (
            <>
              <h2 className="text-xl font-bold">Nos pharmacies partenaires</h2>
              {pharmacies.loading ? <Loading /> : pharmacies.error ? <ErrorBox message={pharmacies.error} /> : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {pharmacies.data!.map((p) => (
                    <div key={p.id} className="card p-5">
                      <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Store className="h-5 w-5" /></span>
                        <div className="min-w-0 text-sm">
                          <h3 className="text-base font-semibold">{p.nomComplet}</h3>
                          <p className="mt-1 flex items-center gap-1.5 text-slate-600"><MapPin className="h-3.5 w-3.5" />{[p.champs.adresse, p.champs.ville].filter(Boolean).join(", ")}</p>
                          {p.champs.telephone && <p className="flex items-center gap-1.5 text-slate-600"><Phone className="h-3.5 w-3.5" />{p.champs.telephone}</p>}
                          {p.champs.horaires && <p className="flex items-center gap-1.5 text-slate-600"><Clock className="h-3.5 w-3.5" />{p.champs.horaires}</p>}
                          <p className="mt-2"><span className="chip chip-brand">{p.relations.stock?.length ?? 0} médicaments en stock</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : dispo.loading ? <Loading /> : dispo.error ? <ErrorBox message={dispo.error} /> : (
            <>
              <h2 className="text-xl font-bold">
                {dispo.data!.filter((p) => p.complete).length} pharmacie(s) disposent de tout
              </h2>
              {dispo.data!.map((p) => (
                <div key={p.id} className={`card p-5 ${p.complete ? "border-emerald-200" : ""}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    {p.complete ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <XCircle className="h-6 w-6 text-slate-300" />}
                    <div className="flex-1">
                      <h3 className="font-semibold">{p.nom}</h3>
                      <p className="text-sm text-slate-500">{p.ville}{p.horaires && ` · ${p.horaires}`}</p>
                    </div>
                    <span className={`badge ${p.complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {p.disponibles.length} / {p.disponibles.length + p.manquants.length} disponibles
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.disponibles.map((m) => <span key={m.id} className="chip chip-brand">{m.nom}</span>)}
                    {p.manquants.map((m) => <span key={m.id} className="chip chip-slate line-through">{m.nom}</span>)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}

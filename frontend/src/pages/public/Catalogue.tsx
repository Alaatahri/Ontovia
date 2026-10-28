import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, FlaskConical, Pill } from "lucide-react";
import { medicamentsApi, referencesApi } from "../../api/services";
import { Empty, ErrorBox, Loading, SearchInput } from "../../components/ui";
import { useAsync, useDebounced } from "../../hooks/useAsync";
import { PHOTOS, medicamentImage } from "../../lib/images";

/** Bandeau de page du front-office : photo plein cadre assombrie, texte blanc. */
export function PublicHero({ eyebrow, title, text, image }: { eyebrow: string; title: string; text: string; image: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-ink-900">
      <img src={image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-900/95 via-ink-900/75 to-brand-900/30" />
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-300">{eyebrow}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-extrabold text-white sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-200">{text}</p>
      </div>
    </section>
  );
}

export function Catalogue() {
  const [q, setQ] = useState("");
  const [maladie, setMaladie] = useState("");
  const [laboratoire, setLaboratoire] = useState("");
  const search = useDebounced(q);
  const refs = useAsync(() => referencesApi.all(), []);
  const meds = useAsync(() => medicamentsApi.list({ q: search, maladie, laboratoire }), [search, maladie, laboratoire]);

  return (
    <>
      <PublicHero eyebrow="Catalogue" title="Médicaments de l'ontologie" image={PHOTOS.catalogue}
        text="Chaque fiche est construite à partir des relations RDF : composition, indications, contre-indications et interactions." />
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="card relative z-10 -mt-16 mb-8 grid gap-3 p-4 shadow-lift md:grid-cols-[1fr_220px_220px]">
          <SearchInput value={q} onChange={setQ} placeholder="Rechercher un médicament…" />
          <select className="select" value={maladie} onChange={(e) => setMaladie(e.target.value)} aria-label="Filtrer par maladie">
            <option value="">Toutes les indications</option>
            {refs.data?.maladies.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <select className="select" value={laboratoire} onChange={(e) => setLaboratoire(e.target.value)} aria-label="Filtrer par laboratoire">
            <option value="">Tous les laboratoires</option>
            {refs.data?.laboratoires.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
          </select>
        </div>

        {meds.loading && !meds.data ? <Loading /> : meds.error ? <ErrorBox message={meds.error} onRetry={meds.reload} /> :
          !meds.data?.length ? <Empty message="Aucun médicament ne correspond à votre recherche." /> : (
            <>
              <p className="mb-4 text-sm text-slate-500">{meds.data.length} médicament{meds.data.length > 1 ? "s" : ""}</p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {meds.data.map((m) => (
                  <Link key={m.id} to={`/catalogue/${m.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift">
                    <div className="relative h-44 overflow-hidden bg-slate-100">
                      <img src={medicamentImage(m)} alt={`Illustration — ${m.nom}`} loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/50 to-transparent" />
                      {m.formeGalenique && (
                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink-900 backdrop-blur">
                          <Pill className="mr-1 inline h-3 w-3 text-brand-600" />{m.formeGalenique}
                        </span>
                      )}
                      <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-500 transition group-hover:bg-brand-600 group-hover:text-white">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                      {m.dosage && <span className="absolute bottom-3 left-3 text-sm font-semibold text-white">{m.dosage}</span>}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg font-semibold">{m.nom}</h3>
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="flex items-center gap-2 text-slate-600"><FlaskConical className="h-4 w-4 text-indigo-500" /> {m.molecules.map((x) => x.nom).join(", ") || "—"}</p>
                      {m.laboratoire && <p className="flex items-center gap-2 text-slate-600"><Building2 className="h-4 w-4 text-slate-400" /> {m.laboratoire.nom}</p>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
                      {m.maladies.map((x) => <span key={x.id} className="chip chip-brand">{x.nom}</span>)}
                      {m.contreIndications.length > 0 && <span className="chip chip-rose">{m.contreIndications.length} contre-indication{m.contreIndications.length > 1 ? "s" : ""}</span>}
                    </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
      </section>
    </>
  );
}

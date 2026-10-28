import { Link } from "react-router-dom";
import {
  AlertOctagon, ArrowRight, Bot, BrainCircuit, CheckCircle2, Database, FileText, FlaskConical, Network, Pill,
  Search, ShieldCheck, Sparkles, Stethoscope, Users,
} from "lucide-react";
import { referencesApi } from "../../api/services";
import { useAsync } from "../../hooks/useAsync";
import { PHOTOS } from "../../lib/images";

const FEATURES = [
  { icon: Pill, title: "Catalogue sémantique", text: "Médicaments, molécules, indications et contre-indications reliés dans une ontologie OWL.", tone: "from-brand-500 to-teal-600" },
  { icon: ShieldCheck, title: "Détection des risques", text: "Contre-indications, allergies, interactions et redondances détectées par requêtes SPARQL.", tone: "from-rose-500 to-pink-600" },
  { icon: Bot, title: "Assistant en langage naturel", text: "Posez une question en français : elle est traduite en SPARQL grâce à spaCy et exécutée.", tone: "from-indigo-500 to-violet-600" },
  { icon: BrainCircuit, title: "Recommandations IA", text: "Médicaments similaires (TF-IDF + cosinus) et traitements adaptés au profil du patient.", tone: "from-sky-500 to-blue-600" },
  { icon: FileText, title: "Gestion des prescriptions", text: "Ordonnances reliant patient, médecin et médicaments, avec vérification en temps réel.", tone: "from-amber-500 to-orange-600" },
  { icon: Network, title: "Graphe de connaissances", text: "Explorez visuellement les relations RDF de chaque individu de l'ontologie.", tone: "from-emerald-500 to-green-600" },
];

const AUDIENCES = [
  { icon: Pill, title: "Pharmacies", image: PHOTOS.pharmacie, alt: "Intérieur d'une pharmacie",
    text: "Catalogue structuré, compositions et interactions vérifiées avant chaque délivrance." },
  { icon: Stethoscope, title: "Médecins", image: PHOTOS.medecin, alt: "Médecin souriante en blouse blanche",
    text: "Prescriptions contrôlées en temps réel et alternatives proposées par l'IA." },
  { icon: Users, title: "Établissements de soins", image: PHOTOS.tension, alt: "Prise de tension d'une patiente",
    text: "Dossiers patients reliés aux maladies, conditions et allergies dans un graphe unique." },
];

const STEPS = [
  { icon: Database, title: "Ontologie OWL", text: "Classes, propriétés, axiomes et individus (Protégé)." },
  { icon: Search, title: "Requêtes SPARQL", text: "SELECT, INSERT DATA, DELETE/INSERT WHERE via rdflib." },
  { icon: FlaskConical, title: "API REST FastAPI", text: "Routes CRUD, IA et NLP au format JSON." },
  { icon: Sparkles, title: "Interface React", text: "Front-office public et back-office professionnel." },
];

export function Home() {
  const { data: stats } = useAsync(() => referencesApi.stats(), []);
  const c = stats?.classes;

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_80%_10%,#c9f5ec_0%,transparent_60%),radial-gradient(50%_50%_at_0%_100%,#e0f2fe_0%,transparent_60%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pb-28 lg:pt-16">
          <div className="animate-fade-up">
            <span className="chip chip-brand mb-6 px-3 py-1 text-[13px]">
              <Sparkles className="h-3.5 w-3.5" /> Web sémantique · IA · Santé
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-[56px]">
              La connaissance pharmaceutique,{" "}
              <span className="bg-gradient-to-r from-brand-600 to-sky-600 bg-clip-text text-transparent">structurée et intelligente</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">
              Nexora relie médicaments, patients et prescriptions dans une ontologie OWL, détecte les risques par SPARQL
              et répond à vos questions en langage naturel.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/catalogue" className="btn-primary px-5 py-3 text-[15px]">
                Explorer les médicaments <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/assistant" className="btn-secondary px-5 py-3 text-[15px]">
                <Bot className="h-4 w-4" /> Poser une question
              </Link>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                ["Médicaments", c?.Medicament],
                ["Molécules", c?.Molecule],
                ["Maladies", c?.Maladie],
                ["Triplets RDF", stats?.triplets],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs font-medium text-slate-500">{label}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-ink-900">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Composition visuelle : photo de consultation + aperçu de l'assistant et d'une alerte */}
          <div className="relative mx-auto w-full max-w-lg pb-24 lg:max-w-none lg:pb-0">
            <div className="absolute -right-6 -top-6 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />
            <div className="relative overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-black/5 lg:ml-12">
              <img src={PHOTOS.hero} alt="Médecin échangeant avec une patiente en consultation" className="h-[420px] w-full object-cover sm:h-[520px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/40 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink-900 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {c?.Patient ?? "—"} patients suivis · {c?.Prescription ?? "—"} prescriptions
              </div>
            </div>
            <div className="absolute -bottom-2 left-0 right-0 space-y-3 sm:left-auto sm:right-[-12px] sm:w-[360px] lg:-bottom-10 lg:-left-8 lg:right-auto">
              <div className="card animate-float p-4 shadow-lift">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-600 text-white"><Bot className="h-5 w-5" /></span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Assistant Nexora</p>
                    <p className="text-xs text-slate-500">NLP → SPARQL</p>
                  </div>
                  <span className="ml-auto chip chip-brand">en ligne</span>
                </div>
                <div className="ml-auto w-fit rounded-2xl rounded-tr-sm bg-brand-600 px-3.5 py-2 text-[13px] text-white">Quels médicaments traitent la migraine ?</div>
                <div className="mt-2.5 rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs text-slate-500">5 résultats · relation <code className="font-mono text-brand-700">nx:traite</code></p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Aspirine", "Doliprane", "Advil", "Imigrane", "Avlocardyl"].map((m) => <span key={m} className="chip chip-brand">{m}</span>)}
                  </div>
                </div>
              </div>
              <div className="card flex items-start gap-3 border-rose-200 p-3.5 shadow-lift">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600"><AlertOctagon className="h-5 w-5" /></span>
                <div className="text-sm">
                  <p className="font-semibold text-ink-900">Contre-indication détectée</p>
                  <p className="text-slate-600">Imigrane est contre-indiqué en cas d'hypertension.</p>
                </div>
              </div>
            </div>
            <div className="card absolute -top-5 right-2 hidden items-center gap-3 p-3.5 shadow-lift sm:flex lg:-right-6">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span>
              <div className="text-sm">
                <p className="font-semibold text-ink-900">Alternative IA</p>
                <p className="text-slate-600">Doliprane, sans risque</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Fonctionnalités ---------- */}
      <section className="bg-slate-50 py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Fonctionnalités</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Tout ce qu'il faut pour une prescription plus sûre</h2>
            <p className="mt-4 text-slate-600">Une plateforme construite sur le web sémantique : chaque information est un triplet RDF interrogeable.</p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text, tone }) => (
              <div key={title} className="card group p-6 transition hover:-translate-y-1 hover:shadow-lift">
                <span className={`mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-md transition group-hover:scale-105`}>
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Pour qui ? ---------- */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Pour qui ?</p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Au service de tous les acteurs de santé</h2>
            </div>
            <Link to="/catalogue" className="btn-secondary">Parcourir le catalogue <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <article key={a.title} className="group relative h-[380px] overflow-hidden rounded-3xl">
                <img src={a.image} alt={a.alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <span className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white backdrop-blur"><a.icon className="h-5 w-5" /></span>
                  <h3 className="text-xl font-bold text-white">{a.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-200">{a.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Architecture ---------- */}
      <section className="bg-slate-50 py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Comment ça marche</p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">De l'ontologie à l'écran, en quatre couches</h2>
              <p className="mt-4 text-slate-600">
                Le front-end communique avec le back-end par une API REST ; le back-end interroge et met à jour le graphe RDF
                exclusivement par des requêtes SPARQL.
              </p>
              <Link to="/a-propos" className="btn-secondary mt-6">Découvrir le projet <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="card relative p-6">
                  <span className="absolute right-5 top-5 font-display text-4xl font-extrabold text-slate-100">0{i + 1}</span>
                  <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------- Bandeau professionnels ---------- */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-3xl bg-ink-900 px-6 py-14 sm:px-12">
          <img src={PHOTOS.laboratoire} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-900 via-ink-900/90 to-brand-900/70" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Un espace professionnel complet</h2>
              <p className="mt-4 text-slate-300">
                Gérez patients, médicaments et prescriptions, suivez les statistiques du graphe et obtenez des recommandations IA
                pour chaque patient.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/admin" className="btn-white px-5 py-3">Accéder au tableau de bord <ArrowRight className="h-4 w-4" /></Link>
                <Link to="/verificateur" className="btn px-5 py-3 text-white ring-1 ring-white/25 hover:bg-white/10">Vérifier des interactions</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Users, label: "Patients suivis", value: c?.Patient },
                { icon: Stethoscope, label: "Médecins", value: c?.Medecin },
                { icon: FileText, label: "Prescriptions", value: c?.Prescription },
                { icon: AlertOctagon, label: "Prescriptions à risque", value: stats?.prescriptionsARisque },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <Icon className="h-5 w-5 text-brand-300" />
                  <p className="mt-3 font-display text-3xl font-bold text-white">{value ?? "—"}</p>
                  <p className="text-sm text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

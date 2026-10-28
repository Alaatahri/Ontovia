import { Suspense, useEffect, useState } from "react";
import { Loading } from "../components/ui";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowRight, Github, HeartPulse, Mail, MapPin, Menu, ShieldCheck, X } from "lucide-react";

const NAV = [
  { to: "/", label: "Accueil", end: true },
  { to: "/catalogue", label: "Médicaments" },
  { to: "/verificateur", label: "Vérificateur" },
  { to: "/assistant", label: "Assistant IA" },
  { to: "/a-propos", label: "Le projet" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-700 text-white shadow-lift">
        <HeartPulse className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className={`block font-display text-lg font-extrabold ${light ? "text-white" : "text-ink-900"}`}>Nexora</span>
        <span className={`block text-[11px] font-medium ${light ? "text-slate-400" : "text-slate-500"}`}>Pharmaceutique & Santé</span>
      </span>
    </span>
  );
}

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className={`sticky top-0 z-40 transition-all ${scrolled ? "border-b border-slate-200/70 bg-white/85 shadow-sm backdrop-blur-lg" : "bg-white/0"}`}>
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Accueil Nexora"><Logo /></Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">{n.label}</NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/admin" className="btn-primary">
              Espace professionnel <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <button className="icon-btn lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 shadow-lg lg:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="nav-link block py-3">{n.label}</NavLink>
            ))}
            <Link to="/admin" className="btn-primary mt-2 w-full">Espace professionnel</Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="bg-ink-900 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="space-y-4">
            <Logo light />
            <p className="text-sm text-slate-400">
              Application web sémantique de gestion des médicaments, des patients et des prescriptions, basée sur une ontologie OWL.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">Explorer</h4>
            <ul className="space-y-2.5 text-sm">
              {NAV.slice(1).map((n) => <li key={n.to}><Link className="hover:text-white" to={n.to}>{n.label}</Link></li>)}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">Technologies</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>OWL 2 · RDF · SPARQL 1.1</li>
              <li>FastAPI · rdflib</li>
              <li>spaCy · Snowball · rapidfuzz</li>
              <li>React · TypeScript · Tailwind CSS</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">Contact</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> ESPRIT — 5TWIN</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> contact@nexora.tn</li>
              <li className="flex items-center gap-2"><Github className="h-4 w-4" /> Projet Web Sémantique 2026/2027</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-8">
            <span>© 2026 Nexora — Projet académique.</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Les informations affichées ne remplacent pas l'avis d'un professionnel de santé.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { Suspense, useEffect, useState } from "react";
import { ChatWidget } from "../components/chat/ChatWidget";
import { Loading } from "../components/ui";
import { useSemantic } from "../hooks/useSemantic";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Baby, Bot, Building2, Database, ExternalLink, FileText, FlaskConical, HeartPulse, LayoutDashboard, Menu, Network, Pill,
  Stethoscope, Store, Users, UsersRound, X,
} from "lucide-react";
import { referencesApi } from "../api/services";
import { Logo } from "./PublicLayout";

type NavItem = { to: string; label: string; icon: typeof Pill; end?: boolean };

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Pilotage",
    items: [{ to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, end: true }],
  },
  {
    title: "Gestion",
    items: [
      { to: "/admin/medicaments", label: "Médicaments", icon: Pill },
      { to: "/admin/patients", label: "Patients", icon: Users },
      { to: "/admin/prescriptions", label: "Prescriptions", icon: FileText },
    ],
  },
  {
    title: "Professionnels & officines",
    items: [
      { to: "/admin/medecins", label: "Médecins", icon: Stethoscope },
      { to: "/admin/personnel", label: "Personnel de santé", icon: UsersRound },
      { to: "/admin/pharmacies", label: "Pharmacies", icon: Store },
    ],
  },
  {
    title: "Référentiels médicaux",
    items: [
      { to: "/admin/maladies", label: "Maladies", icon: HeartPulse },
      { to: "/admin/conditions", label: "Conditions", icon: Baby },
      { to: "/admin/molecules", label: "Molécules", icon: FlaskConical },
      { to: "/admin/laboratoires", label: "Laboratoires", icon: Building2 },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { to: "/admin/assistant", label: "Assistant IA", icon: Bot },
      { to: "/admin/ontologie", label: "Ontologie & graphe", icon: Network },
      { to: "/admin/sparql", label: "Console SPARQL", icon: Database },
    ],
  },
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<{ triplets: number; ontologie: string } | null>(null);
  const [offline, setOffline] = useState(false);
  const { pathname } = useLocation();
  const [semantic, setSemantic] = useSemantic();

  useEffect(() => {
    referencesApi.health().then(setHealth).catch(() => setOffline(true));
  }, [pathname]);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-ink-900 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[72px] items-center justify-between px-5">
          <Link to="/admin"><Logo light /></Link>
          <button className="icon-btn text-slate-400 hover:bg-white/5 lg:hidden" onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.title}</p>
              <div className="space-y-0.5">
                {s.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end} className="side-link">
                    <Icon className="h-[18px] w-[18px] text-slate-400" /> {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="m-3 rounded-xl bg-white/5 px-4 py-3 text-xs text-slate-400">
          <div className="mb-1 flex items-center gap-2 font-medium text-slate-200">
            <span className={`h-2 w-2 rounded-full ${offline ? "bg-rose-400" : health ? "bg-emerald-400" : "bg-slate-500"}`} />
            {offline ? "Back-end injoignable" : health ? "Graphe RDF connecté" : "Connexion…"}
          </div>
          {health && <span>{health.ontologie} · {health.triplets} triplets</span>}
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
          <button className="icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => setSemantic(!semantic)} role="switch" aria-checked={semantic}
              title="Afficher les propriétés de l'ontologie, les IRI et les requêtes"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-medium text-slate-600 transition hover:border-brand-300">
              <span className={`relative h-5 w-9 rounded-full transition ${semantic ? "bg-brand-600" : "bg-slate-200"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${semantic ? "left-[18px]" : "left-0.5"}`} />
              </span>
              <span className="hidden sm:inline">Mode sémantique</span>
            </button>
            <Link to="/" className="btn-secondary btn-sm"><ExternalLink className="h-3.5 w-3.5" /> Voir le site</Link>
            <span className="hidden items-center gap-2.5 sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-sky-600 text-xs font-bold text-white">AD</span>
              <span className="text-sm leading-tight">
                <span className="block font-semibold text-ink-900">Administrateur</span>
                <span className="block text-xs text-slate-500">Équipe Nexora</span>
              </span>
            </span>
          </div>
        </header>
        <ChatWidget fullPage="/admin/assistant" />
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
        </main>
      </div>
    </div>
  );
}

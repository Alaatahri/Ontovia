import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Inbox, Loader2, RefreshCw, Search } from "lucide-react";
import type { Ref } from "../api/types";

export function PageHeader({ title, subtitle, actions, eyebrow }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
        <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, icon, actions, children, className = "", bodyClass = "card-body" }: {
  title?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <h2 className="card-title">
            {icon && <span className="text-brand-600">{icon}</span>}
            {title}
          </h2>
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin text-brand-600" /> {label}
    </div>
  );
}

export function Empty({ message = "Aucun résultat.", children }: { message?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-sm text-slate-500">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Inbox className="h-6 w-6" />
      </div>
      {message}
      {children}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button className="btn-sm btn-ghost text-rose-700" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Réessayer
        </button>
      )}
    </div>
  );
}

const TYPE_TONE: Record<string, string> = { Maladie: "chip-rose", ConditionPhysiologique: "chip-amber" };

/** Relations sous forme de pastilles (cliquables si `to` est fourni). */
export function Chips({ items, to, tone = "chip-brand", empty = "—", max }: {
  items: Ref[]; to?: (r: Ref) => string; tone?: string; empty?: string; max?: number;
}) {
  if (!items.length) return <span className="text-sm text-slate-400">{empty}</span>;
  const shown = max ? items.slice(0, max) : items;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((r) => {
        const cls = `chip ${r.type ? TYPE_TONE[r.type] : tone}`;
        return to ? (
          <Link key={r.id} to={to(r)} className={`${cls} hover:brightness-95`}>{r.nom}</Link>
        ) : (
          <span key={r.id} className={cls} title={r.type === "ConditionPhysiologique" ? "Condition physiologique" : r.type}>
            {r.nom}
          </span>
        );
      })}
      {max && items.length > max && <span className="chip chip-slate">+{items.length - max}</span>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-10" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

export function Iri({ id }: { id: string }) {
  return <code className="sem rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-xs text-brand-700">nx:{id}</code>;
}

/** Détail sémantique (propriété, IRI…) : affiché seulement quand le « mode sémantique » est activé. */
export function Sem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`sem font-mono text-[11px] font-normal text-brand-600 ${className}`}>{children}</span>;
}

export function RiskBadge({ count }: { count: number }) {
  return count > 0 ? (
    <span className="badge bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200">
      <AlertTriangle className="h-3 w-3" /> {count} risque{count > 1 ? "s" : ""}
    </span>
  ) : (
    <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">Aucun</span>
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function initials(name: string): string {
  return name
    .replace(/^Dr\s+/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, tone = "bg-brand-100 text-brand-800" }: { name: string; tone?: string }) {
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${tone}`}>{initials(name)}</span>
  );
}

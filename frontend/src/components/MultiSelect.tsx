import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { Ref } from "../api/types";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Sélecteur multiple avec recherche : utilisé pour toutes les relations objet (molécules, maladies…). */
export function MultiSelect({ options, value, onChange, placeholder = "Filtrer…", groupBy, height = "max-h-56" }: {
  options: Ref[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  groupBy?: (r: Ref) => string;
  height?: string;
}) {
  const [filter, setFilter] = useState("");
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const visible = options.filter((o) => normalize(o.nom).includes(normalize(filter)));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const groups = new Map<string, Ref[]>();
  visible.forEach((o) => {
    const g = groupBy ? groupBy(o) : "";
    groups.set(g, [...(groups.get(g) ?? []), o]);
  });

  return (
    <div className="space-y-2.5">
      <div className="flex min-h-[28px] flex-wrap items-center gap-1.5">
        {value.length === 0 && <span className="text-xs text-slate-400">Aucune sélection</span>}
        {value.map((id) => (
          <span key={id} className="chip chip-brand">
            {byId.get(id)?.nom ?? id}
            <button type="button" onClick={() => toggle(id)} aria-label="Retirer" className="rounded-full hover:bg-brand-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input className="input py-2 pl-9 text-[13px]" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={placeholder} />
      </div>
      <div className={`${height} overflow-y-auto rounded-xl border border-slate-200 p-1`}>
        {visible.length === 0 && <div className="p-3 text-xs text-slate-400">Aucune option</div>}
        {[...groups.entries()].map(([group, items]) => (
          <div key={group}>
            {group && <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group}</div>}
            {items.map((o) => {
              const checked = value.includes(o.id);
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => toggle(o.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${checked ? "bg-brand-50 text-brand-800" : "hover:bg-slate-50"}`}
                >
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"}`}>
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1">{o.nom}</span>
                  {o.detail && <span className="text-xs text-slate-400">{o.detail}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

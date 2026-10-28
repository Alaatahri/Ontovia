import { useMemo, useState } from "react";
import { ontologyApi } from "../api/services";
import { useAsync } from "../hooks/useAsync";
import { ErrorBox, Loading } from "./ui";

export const NODE_COLORS: Record<string, string> = {
  Medicament: "#0b8479",
  Molecule: "#6250d6",
  Maladie: "#e34948",
  ConditionPhysiologique: "#c98500",
  Patient: "#2a78d6",
  Medecin: "#0369a1",
  Laboratoire: "#52514e",
  Prescription: "#d55181",
  Autre: "#94a3b8",
};

const TYPE_LABELS: Record<string, string> = {
  Medicament: "Médicament", Molecule: "Molécule", Maladie: "Maladie", ConditionPhysiologique: "Condition",
  Patient: "Patient", Medecin: "Médecin", Laboratoire: "Laboratoire", Prescription: "Prescription", Autre: "Autre",
};

/**
 * Visualisation du voisinage RDF d'un individu (1 saut), disposé en cercle autour du nœud focal.
 * Cliquer sur un nœud recentre le graphe sur cet individu.
 */
export function GraphExplorer({ initialId, height = 460 }: { initialId: string; height?: number }) {
  const [focus, setFocus] = useState(initialId);
  const [hover, setHover] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsync(() => ontologyApi.graphe(focus), [focus]);

  const layout = useMemo(() => {
    if (!data) return null;
    const W = 760, H = height, cx = W / 2, cy = H / 2;
    const others = data.nodes.filter((n) => !n.focus).sort((a, b) => a.type.localeCompare(b.type) || a.nom.localeCompare(b.nom));
    const radius = Math.min(W, H) / 2 - 70;
    const pos = new Map<string, { x: number; y: number }>();
    const center = data.nodes.find((n) => n.focus);
    if (center) pos.set(center.id, { x: cx, y: cy });
    others.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
      pos.set(n.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    });
    return { W, H, pos, cx };
  }, [data, height]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data || !layout) return null;
  const types = [...new Set(data.nodes.map((n) => n.type))];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
        {types.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: NODE_COLORS[t] ?? NODE_COLORS.Autre }} />
            {TYPE_LABELS[t] ?? t}
          </span>
        ))}
        <span className="ml-auto text-slate-400">{data.links.length} relations · cliquez un nœud pour le centrer</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-[radial-gradient(circle_at_center,#f0fdfa,white_70%)]">
        <svg viewBox={`0 0 ${layout.W} ${layout.H}`} className="mx-auto block min-w-[620px]" role="img" aria-label="Graphe des relations RDF">
          {data.links.map((l, i) => {
            const a = layout.pos.get(l.source)!, b = layout.pos.get(l.target)!;
            const active = hover === l.source || hover === l.target;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active ? "#0b8479" : "#cbd5e1"} strokeWidth={active ? 2 : 1.25} />
                {(active || data.links.length <= 14) && (
                  <text x={mx} y={my - 4} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10, paintOrder: "stroke", stroke: "white", strokeWidth: 3 }}>
                    {l.propriete}
                  </text>
                )}
              </g>
            );
          })}
          {data.nodes.map((n) => {
            const p = layout.pos.get(n.id)!;
            const color = NODE_COLORS[n.type] ?? NODE_COLORS.Autre;
            const r = n.focus ? 30 : 15;
            const label = n.nom.length > 22 ? n.nom.slice(0, 21) + "…" : n.nom;
            const right = p.x >= layout.cx;
            return (
              <g key={n.id} className={n.focus ? "" : "cursor-pointer"} onClick={() => !n.focus && setFocus(n.id)}
                onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
                <title>{`${n.nom} (${TYPE_LABELS[n.type] ?? n.type}) — nx:${n.id}`}</title>
                <circle cx={p.x} cy={p.y} r={r + 6} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={r} fill={color} stroke="white" strokeWidth={3}
                  opacity={hover && hover !== n.id && !n.focus ? 0.55 : 1} />
                {n.focus ? (
                  <text x={p.x} y={p.y + r + 18} textAnchor="middle" className="fill-ink-900" style={{ fontSize: 13, fontWeight: 700 }}>{label}</text>
                ) : (
                  <text x={p.x + (right ? r + 6 : -(r + 6))} y={p.y + 4} textAnchor={right ? "start" : "end"} className="fill-slate-700"
                    style={{ fontSize: 11.5, fontWeight: hover === n.id ? 700 : 500, paintOrder: "stroke", stroke: "white", strokeWidth: 3 }}>
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {focus !== initialId && (
        <button className="btn-sm btn-ghost mt-2" onClick={() => setFocus(initialId)}>← Revenir à l'individu de départ</button>
      )}
    </div>
  );
}

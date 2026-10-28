import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Point } from "../api/types";
import { Empty } from "./ui";

// Une seule série par graphique : une seule teinte (slot 1 de la palette validée), pas de légende,
// le titre de la carte nomme la mesure. Axes et grille discrets, infobulle au survol.
const SERIES = "#2a78d6";
const GRID = "#e2e8f0";
const AXIS = { fontSize: 12, fill: "#64748b" };

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink-900">{payload[0].value} {unit}</div>
    </div>
  );
}

/** Barres horizontales : catégories nombreuses ou libellés longs (maladies, laboratoires, médicaments). */
export function HBarChart({ data, unit }: { data: Point[]; unit: string }) {
  if (!data.length) return <Empty message="Pas encore de données." />;
  const h = Math.max(160, data.length * 34 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 8 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={150} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "rgba(42,120,214,.06)" }} content={<ChartTooltip unit={unit} />} />
        <Bar isAnimationActive={false} dataKey="valeur" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={22}
          label={{ position: "right", fontSize: 12, fill: "#334155" }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Colonnes verticales : peu de catégories ordonnées (tranches d'âge, types de risque). */
export function VBarChart({ data, unit, height = 220 }: { data: Point[]; unit: string; height?: number }) {
  if (!data.length) return <Empty message="Pas encore de données." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -18 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "rgba(42,120,214,.06)" }} content={<ChartTooltip unit={unit} />} />
        <Bar isAnimationActive={false} dataKey="valeur" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={48}
          label={{ position: "top", fontSize: 12, fill: "#334155" }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Évolution dans le temps : aire + ligne 2px, réticule et infobulle au survol. */
export function TrendChart({ data, unit, height = 220 }: { data: Point[]; unit: string; height?: number }) {
  if (!data.length) return <Empty message="Pas encore de données." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES} stopOpacity={0.22} />
            <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} content={<ChartTooltip unit={unit} />} />
        <Area isAnimationActive={false} type="monotone" dataKey="valeur" stroke={SERIES} strokeWidth={2} fill="url(#trendFill)"
          dot={{ r: 4, fill: SERIES, stroke: "white", strokeWidth: 2 }} activeDot={{ r: 6, stroke: "white", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Vue tableau des mêmes données (accessibilité : l'information n'est jamais portée par le seul graphique). */
export function DataTableToggle({ data, unit }: { data: Point[]; unit: string }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">Voir les données</summary>
      <table className="mt-2 w-full text-xs">
        <tbody>
          {data.map((d) => (
            <tr key={d.label} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 text-slate-600">{d.label}</td>
              <td className="py-1.5 text-right font-medium text-slate-800">{d.valeur} {unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

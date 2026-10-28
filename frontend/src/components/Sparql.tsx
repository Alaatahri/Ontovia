import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Cell } from "../api/types";
import { Empty } from "./ui";

const KEYWORDS = /\b(PREFIX|SELECT|DISTINCT|WHERE|OPTIONAL|FILTER|UNION|BIND|AS|ORDER BY|GROUP BY|DESC|ASC|LIMIT|VALUES|COUNT|CONCAT|COALESCE|STRAFTER|STR|LCASE|CONTAINS|IF|IN|ASK|a)\b/g;

/** Coloration minimale de la syntaxe SPARQL (mots-clés, variables, préfixes, littéraux). */
function highlight(query: string) {
  const parts: (string | JSX.Element)[] = [];
  const tokenRe = /("[^"]*"|\?[A-Za-z_]\w*|\b(?:nx|rdf|rdfs|owl|xsd):[A-Za-z_][\w-]*|<[^>\s]+>)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  const pushText = (text: string) => {
    let l = 0;
    let k: RegExpExecArray | null;
    KEYWORDS.lastIndex = 0;
    while ((k = KEYWORDS.exec(text))) {
      if (k.index > l) parts.push(text.slice(l, k.index));
      parts.push(<span key={`k${i++}`} className="font-semibold text-sky-300">{k[0]}</span>);
      l = k.index + k[0].length;
    }
    if (l < text.length) parts.push(text.slice(l));
  };
  while ((m = tokenRe.exec(query))) {
    if (m.index > last) pushText(query.slice(last, m.index));
    const t = m[0];
    const cls = t.startsWith("?") ? "text-amber-300" : t.startsWith('"') ? "text-lime-300" : t.startsWith("<") ? "text-slate-400" : "text-teal-300";
    parts.push(<span key={`t${i++}`} className={cls}>{t}</span>);
    last = m.index + t.length;
  }
  if (last < query.length) pushText(query.slice(last));
  return parts;
}

export function SparqlBlock({ query, className = "" }: { query: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard?.writeText(query).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <div className={`group relative ${className}`}>
      <button onClick={copy} aria-label="Copier la requête"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-slate-400 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <pre className="code"><code>{highlight(query)}</code></pre>
    </div>
  );
}

/** Tableau générique de résultats SPARQL. */
export function ResultTable({ columns, rows }: { columns: string[]; rows: Record<string, Cell>[] }) {
  if (!rows.length) return <Empty message="La requête ne renvoie aucun résultat." />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c} className="font-mono normal-case">?{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c}>{row[c] === null || row[c] === undefined ? <span className="text-slate-300">—</span> : String(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

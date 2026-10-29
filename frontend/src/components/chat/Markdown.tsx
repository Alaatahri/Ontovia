import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

const ROUTES = [
  /^\/$/, /^\/(catalogue|pharmacies|verificateur|assistant|a-propos)$/, /^\/catalogue\/[\w-]+$/,
  /^\/admin(\/(assistant|ontologie|sparql))?$/,
  /^\/admin\/(medicaments|patients|prescriptions|medecins|personnel|pharmacies|maladies|conditions|molecules|laboratoires)(\/(nouveau|nouvelle|[\w-]+(\/modifier)?))?$/,
];

/** Le modèle de langage ne doit pas pouvoir créer de lien vers une page inexistante. */
export function isKnownRoute(path: string): boolean {
  return ROUTES.some((r) => r.test(path.split("?")[0]));
}

/** Rendu Markdown minimal des réponses : **gras**, [liens](/chemin) internes, listes, paragraphes. */
export function Markdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-ink-900">{part.slice(2, -2)}</strong>;
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link && link[2].startsWith("/") && !isKnownRoute(link[2])) return <Fragment key={i}>{link[1]}</Fragment>;
      if (link) {
        return link[2].startsWith("/") ? (
          <Link key={i} to={link[2]} onClick={onNavigate} className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-600">{link[1]}</Link>
        ) : <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-brand-700 underline">{link[1]}</a>;
      }
      return <Fragment key={i}>{part}</Fragment>;
    });

  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(<Tag key={blocks.length} className={`my-1.5 space-y-0.5 pl-5 ${list.ordered ? "list-decimal" : "list-disc"}`}>{list.items.map((l, i) => <li key={i}>{inline(l)}</li>)}</Tag>);
    list = null;
  };
  text.split("\n").forEach((line) => {
    const bullet = line.match(/^\s*[*-]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush();
      list = list ?? { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flush();
      if (line.trim()) blocks.push(<p key={blocks.length} className="my-1">{inline(line.replace(/^#+\s*/, ""))}</p>);
    }
  });
  flush();
  return <div className="text-sm leading-relaxed text-slate-700">{blocks}</div>;
}

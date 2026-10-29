import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, Bot, BookOpen, Compass, Cpu, Database, Globe, Link2, MessageCircle, RotateCcw, SendHorizontal, Sparkles, Square, User } from "lucide-react";
import { chatApi, nlpApi } from "../../api/services";
import type { ChatMode } from "../../api/types";
import { useAsync } from "../../hooks/useAsync";
import { ResultTable, SparqlBlock } from "../Sparql";
import { useChat, type BotTurn } from "./ChatContext";
import { Markdown } from "./Markdown";

const MODES: Record<ChatMode, { label: string; icon: typeof Database; tone: string }> = {
  donnees: { label: "Données de l'ontologie", icon: Database, tone: "bg-brand-50 text-brand-700 ring-brand-200" },
  suivi: { label: "Suite de la conversation", icon: MessageCircle, tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  guide: { label: "Guide de l'application", icon: BookOpen, tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  navigation: { label: "Navigation", icon: Compass, tone: "bg-violet-50 text-violet-700 ring-violet-200" },
  general: { label: "Culture générale (hors ontologie)", icon: Globe, tone: "bg-amber-50 text-amber-800 ring-amber-200" },
};

const ENTITY_PAGES: Record<string, string> = {
  Medicament: "medicaments", Patient: "patients", Medecin: "medecins", Pharmacie: "pharmacies", Pharmacien: "personnel",
  Infirmier: "personnel", Maladie: "maladies", ConditionPhysiologique: "conditions", Molecule: "molecules",
  Laboratoire: "laboratoires",
};

/** Lien vers la fiche de l'élément dont parle la réponse (construit par l'application, jamais par le LLM). */
function entityPage(type: string, id: string, admin: boolean): string | null {
  if (!admin && type === "Medicament") return `/catalogue/${id}`;
  if (!admin) return type === "Pharmacie" ? "/pharmacies" : null;
  return ENTITY_PAGES[type] ? `/admin/${ENTITY_PAGES[type]}/${id}` : null;
}

const STARTERS = [
  "Quels médicaments traitent la migraine ?",
  "Parle-moi de l'aspirine",
  "Où trouver le Coumadine ?",
  "Comment créer une prescription ?",
  "Ouvre la page des pharmacies",
  "Qu'est-ce qu'un antibiotique ?",
];

function BotMessage({ t, expertMode, compact, onNavigate }: { t: BotTurn; expertMode: boolean; compact: boolean; onNavigate?: () => void }) {
  const { ask } = useChat();
  const { pathname } = useLocation();
  const a = t.analyse;
  const fiche = a?.compris && a.entite ? entityPage(a.entite.type, a.entite.id, pathname.startsWith("/admin")) : null;
  const mode = t.mode ? MODES[t.mode] : null;
  return (
    <div className="flex gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-sky-600 text-white"><Bot className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1 space-y-2.5 rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-3.5 shadow-sm">
        {mode && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`badge ring-1 ring-inset ${mode.tone}`}><mode.icon className="h-3 w-3" /> {mode.label}</span>
            {a?.compris && a.entite && <span className="badge bg-slate-100 text-slate-600">{a.entite.nom}</span>}
            {a?.compris && <span className="badge bg-slate-100 text-slate-600">{a.resultats?.length ?? 0} résultat(s)</span>}
          </div>
        )}
        {t.error ? <p className="text-sm text-rose-700">{t.error}</p> : t.text ? <Markdown text={t.text} onNavigate={onNavigate} /> : (
          <span className="flex items-center gap-1 py-1">
            {[0, 1, 2].map((k) => <span key={k} className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${k * 0.15}s` }} />)}
          </span>
        )}
        {!t.done && t.text && <span className="inline-block h-4 w-1.5 animate-pulse bg-brand-500 align-middle" />}

        {t.done && a && (t.mode === "guide" || t.mode === "navigation") && a.guide?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {a.guide.slice(0, 3).map((p) => (
              <Link key={p.id} to={p.chemin} onClick={onNavigate} className="btn-secondary btn-sm"><ArrowUpRight className="h-3.5 w-3.5" /> {p.titre}</Link>
            ))}
          </div>
        )}

        {t.done && fiche && !t.error && (
          <Link to={fiche} onClick={onNavigate} className="btn-secondary btn-sm w-fit"><ArrowUpRight className="h-3.5 w-3.5" /> Voir : {a!.entite!.nom}</Link>
        )}

        {a?.compris && a.sparql && !compact && (
          <details open={expertMode} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <summary className="cursor-pointer text-xs font-medium text-brand-700">Données et requête SPARQL</summary>
            <div className="mt-3 space-y-3">
              <div className="overflow-hidden rounded-lg border border-slate-100 bg-white"><ResultTable columns={a.colonnes ?? []} rows={a.resultats ?? []} /></div>
              <SparqlBlock query={a.sparql} />
              {expertMode && a.analyse && (
                <div className="flex flex-wrap gap-1.5">
                  {a.analyse.tokens.map((tok, k) => (
                    <span key={k} title={`racine : ${tok.stem}`} className={`inline-flex flex-col items-center rounded-lg px-2 py-1 text-xs ${tok.stop ? "bg-slate-100 text-slate-400" : "bg-indigo-50 text-indigo-700"}`}>
                      {tok.text}<small className="font-mono text-[10px] opacity-70">{tok.stem}</small>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </details>
        )}
        {t.done && t.mode === "general" && a?.suggestions && a.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {a.suggestions.slice(0, 3).map((sg) => <button key={sg} onClick={() => ask(sg)} className="chip chip-indigo px-2.5 py-1 hover:bg-indigo-100">{sg}</button>)}
          </div>
        )}
        {t.done && t.duree !== undefined && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><Cpu className="h-3 w-3" /> {t.modele ? `${t.modele} · local` : "sans LLM"} · {t.duree}s</p>
        )}
      </div>
    </div>
  );
}

/**
 * Assistant IA : données de l'ontologie (NLP → SPARQL), suite de conversation, guide et navigation dans
 * l'application, culture générale. Les réponses sont rédigées au fil de l'eau par le LLM local (Ollama).
 */
export function ChatAssistant({ expertMode = false, compact = false, onNavigate }: { expertMode?: boolean; compact?: boolean; onNavigate?: () => void }) {
  const { turns, contexte, busy, ask, stop, reset } = useChat();
  const [question, setQuestion] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const examples = useAsync(() => nlpApi.examples(), []);
  const status = useAsync(() => chatApi.statut(), []);

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(question);
    setQuestion("");
  };

  const s = status.data;
  const starters = compact ? STARTERS : [...new Set([...STARTERS, ...(examples.data ?? []).slice(0, 10)])].slice(0, 14);
  return (
    <div className={`flex flex-col overflow-hidden bg-white ${compact ? "h-full" : "card"}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-brand-50/70 to-white px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-600 text-white"><Sparkles className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">Assistant Nexora</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
            <span className={`h-2 w-2 shrink-0 rounded-full ${s?.disponible ? "bg-emerald-500" : "bg-amber-500"}`} />
            {s?.disponible ? `IA locale ${s.modele}` : s ? "Mode sans LLM" : "Connexion…"}
          </p>
        </div>
        {contexte?.entite && (
          <span className="chip chip-indigo max-w-[45%] truncate" title="Les questions suivantes peuvent y faire référence">
            <Link2 className="h-3 w-3 shrink-0" /> {contexte.entite.nom}
          </span>
        )}
        {turns.length > 0 && <button className="icon-btn" onClick={reset} title="Nouvelle conversation"><RotateCcw className="h-4 w-4" /></button>}
      </div>

      <div className={`flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-slate-50/70 to-white p-4 ${compact ? "" : "min-h-[400px] max-h-[680px] sm:p-6"}`}>
        {turns.length === 0 && (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-600 text-white shadow-lift"><Sparkles className="h-6 w-6" /></div>
            <h3 className="text-base font-semibold">Comment puis-je vous aider ?</h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">Médicaments, patients, pharmacies, utilisation de l'application ou question générale.</p>
            <div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
              {starters.map((ex) => (
                <button key={ex} onClick={() => ask(ex)} className="chip chip-brand px-3 py-1.5 text-[13px] transition hover:bg-brand-100">{ex}</button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => t.role === "user" ? (
          <div key={i} className="flex justify-end gap-2.5">
            <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-brand-600 px-3.5 py-2 text-sm text-white shadow-sm">{t.text}</div>
            {!compact && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600"><User className="h-4 w-4" /></span>}
          </div>
        ) : <BotMessage key={i} t={t} expertMode={expertMode} compact={compact} onNavigate={onNavigate} />)}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-slate-100 bg-white p-3">
        <input className="input flex-1 border-transparent bg-slate-50 shadow-none" value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Posez votre question…" maxLength={500} aria-label="Posez votre question" />
        {busy ? (
          <button type="button" className="btn-secondary" onClick={stop} title="Arrêter"><Square className="h-4 w-4" /></button>
        ) : (
          <button className="btn-primary" disabled={question.trim().length < 2} title="Envoyer"><SendHorizontal className="h-4 w-4" /></button>
        )}
      </form>
    </div>
  );
}

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Maximize2, Sparkles, X } from "lucide-react";
import { ChatAssistant } from "./ChatAssistant";
import { useChat } from "./ChatContext";

/** Assistant IA flottant, disponible sur toutes les pages (la conversation est conservée d'une page à l'autre). */
export function ChatWidget({ fullPage }: { fullPage: string }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { busy } = useChat();
  if (pathname === fullPage || pathname === "/assistant" || pathname === "/admin/assistant") return null;

  return (
    <div className="no-print">
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[620px] sm:max-h-[calc(100vh-8rem)] sm:w-[410px] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl">
          <div className="absolute right-3 top-3 z-10 flex gap-1">
            <Link to={fullPage} className="icon-btn bg-white/80" title="Ouvrir en plein écran" onClick={() => setOpen(false)}><Maximize2 className="h-4 w-4" /></Link>
            <button className="icon-btn bg-white/80" onClick={() => setOpen(false)} title="Fermer"><X className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden sm:rounded-2xl">
            <ChatAssistant compact onNavigate={() => window.innerWidth < 640 && setOpen(false)} />
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-label="Assistant IA"
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-sky-600 text-white shadow-lift transition hover:scale-105">
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        {busy && !open && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 animate-ping rounded-full bg-amber-400" />}
      </button>
    </div>
  );
}

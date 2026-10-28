import { NlpAssistant } from "../../components/NlpAssistant";
import { PHOTOS } from "../../lib/images";
import { PublicHero } from "./Catalogue";

export function AssistantPublic() {
  return (
    <>
      <PublicHero eyebrow="Assistant IA" title="Interrogez l'ontologie en langage naturel" image={PHOTOS.assistant}
        text="Votre question est analysée (spaCy, racinisation Snowball, correspondance approximative rapidfuzz), son intention est identifiée, puis une requête SPARQL est générée et exécutée sur le graphe." />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <NlpAssistant />
      </section>
    </>
  );
}

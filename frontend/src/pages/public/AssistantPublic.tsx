import { ChatAssistant } from "../../components/chat/ChatAssistant";
import { PHOTOS } from "../../lib/images";
import { PublicHero } from "./Catalogue";

export function AssistantPublic() {
  return (
    <>
      <PublicHero eyebrow="Assistant IA" title="Interrogez l'ontologie en langage naturel" image={PHOTOS.assistant}
        text="Posez vos questions sur les médicaments, les pharmacies ou l'utilisation du site : l'assistant interroge l'ontologie et vous répond en langage naturel." />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <ChatAssistant />
      </section>
    </>
  );
}

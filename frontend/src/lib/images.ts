// Photos (licence Unsplash, voir public/images/CREDITS.md). Illustrations génériques : elles ne
// représentent pas les conditionnements commerciaux réels des médicaments.

const M = "/images/medicaments";

const BY_ID: Record<string, string> = {
  Med_Aspirine: `${M}/comprimes-bleu.jpg`,
  Med_Doliprane: `${M}/blisters.jpg`,
  Med_Advil: `${M}/ibuprofene.jpg`,
  Med_Clamoxyl: `${M}/gelules-blister.jpg`,
  Med_Augmentin: `${M}/gelules-blister.jpg`,
  Med_Glucophage: `${M}/pilulier.jpg`,
  Med_Ventoline: `${M}/inhalation.jpg`,
  Med_Zestril: `${M}/comprimes-couleurs.jpg`,
  Med_Coumadine: `${M}/comprimes-jaune.jpg`,
  Med_Imigrane: `${M}/pilules.jpg`,
  Med_Mopral: `${M}/gelules-orange.jpg`,
  Med_Avlocardyl: `${M}/comprimes-couleurs.jpg`,
  Med_Zocor: `${M}/pilulier.jpg`,
};

const POOL = ["comprimes-bleu", "blisters", "pilulier", "comprimes-couleurs", "comprimes-jaune", "pilules", "gelules-blister"]
  .map((f) => `${M}/${f}.jpg`);

/** Photo d'un médicament : photo dédiée, sinon selon la forme galénique, sinon choix stable selon l'identifiant. */
export function medicamentImage(m: { id: string; formeGalenique?: string | null }): string {
  if (BY_ID[m.id]) return BY_ID[m.id];
  const forme = (m.formeGalenique ?? "").toLowerCase();
  if (forme.includes("inhal")) return `${M}/inhalation.jpg`;
  if (forme.includes("gélule") || forme.includes("gelule")) return `${M}/gelules-orange.jpg`;
  if (forme.includes("sirop") || forme.includes("sachet") || forme.includes("solution")) return `${M}/comprimes-couleurs.jpg`;
  const hash = [...m.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return POOL[hash % POOL.length];
}

export const PHOTOS = {
  hero: "/images/hero-consultation.jpg",
  laboratoire: "/images/laboratoire.jpg",
  pharmacie: "/images/pharmacie.jpg",
  medecin: "/images/medecin.jpg",
  hopital: "/images/hopital.jpg",
  tension: "/images/tension.jpg",
  catalogue: "/images/banner-catalogue.jpg",
  verificateur: "/images/banner-verificateur.jpg",
  assistant: "/images/banner-assistant.jpg",
  projet: "/images/banner-projet.jpg",
  admin: "/images/admin-banner.jpg",
};

import { brand, neutral } from "@coly/ui";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coly",
    short_name: "Coly",
    description: "Tes colis, réconciliés et regroupés par lieu de retrait.",
    start_url: "/",
    display: "standalone",
    background_color: neutral.page,
    theme_color: brand.foret,
    lang: "fr",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}

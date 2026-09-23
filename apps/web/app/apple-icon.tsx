import { brand } from "@coly/ui";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icône d'écran d'accueil iOS : logo B, « le c qui attrape » un colis. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: brand.foret }}>
      <svg width="180" height="180" viewBox="0 0 120 120" aria-hidden="true">
        <path
          d="M78 42A26 26 0 1 0 78 78"
          fill="none"
          stroke={brand.citron}
          strokeWidth="15"
          strokeLinecap="round"
        />
        <rect x="76" y="52" width="17" height="16" rx="3" fill={brand.sauge} />
      </svg>
    </div>,
    size,
  );
}

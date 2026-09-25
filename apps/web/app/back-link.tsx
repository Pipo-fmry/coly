import Link from "next/link";

export function BackLink() {
  return (
    <Link href="/" className="back" aria-label="Retour">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
        <path d="M5 12l6 6" />
        <path d="M5 12l6 -6" />
      </svg>
    </Link>
  );
}

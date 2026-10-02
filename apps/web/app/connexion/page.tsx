import { redirect } from "next/navigation";
import { getSession } from "../auth";

export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Google n'a pas pu finaliser la connexion. Réessaie dans un instant.";
const ERRORS: Record<string, string> = {
  refus: "Tu as refusé l'accès : sans lecture de Gmail, Coly ne peut rien afficher.",
  etat: "La connexion a expiré ou a été interrompue. Réessaie.",
  "non-invite":
    "Cette adresse n'est pas invitée sur Coly. Aucune donnée n'a été gardée. Demande une invitation à François.",
  google: GENERIC_ERROR,
};

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; info?: string }>;
}) {
  if (await getSession()) redirect("/");
  const { erreur, info } = await searchParams;
  const error = erreur ? (ERRORS[erreur] ?? GENERIC_ERROR) : undefined;

  return (
    <main className="screen">
      <header>
        <h1 className="title">Coly</h1>
        <p className="meta">Tes colis, réconciliés et regroupés par lieu de retrait.</p>
      </header>

      {info === "efface" && (
        <section className="empty">
          <h2>Compte effacé</h2>
          <p>L'accès à Gmail est révoqué et toutes tes données ont été supprimées.</p>
        </section>
      )}

      <section className="empty">
        <h2>Ce que Coly lit</h2>
        <p>
          Uniquement tes emails de commande et de livraison, en lecture seule. Le marketing n'est
          jamais ouvert. Aucun sujet ni contenu d'email n'est conservé : seulement les numéros de
          suivi, les lieux de retrait et les dates.
        </p>
        <p>
          Tes données restent dans un espace qui n'appartient qu'à toi. Tu peux tout effacer et
          révoquer l'accès en un geste, depuis l'accueil.
        </p>
      </section>

      <a className="button-primary" href="/api/auth/google">
        Se connecter avec Google
      </a>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="meta">
        En te connectant, tu acceptes que Coly lise ces emails pour toi, sur le serveur de François,
        le temps du test. Tu peux retirer ton accord à tout moment.
      </p>
    </main>
  );
}

"use client";

/** Pied de page : qui est connecté, déconnexion, et suppression totale du compte (confirmée). */
export function AccountMenu({ email }: { email: string }) {
  return (
    <footer className="account">
      <span className="meta">Connecté avec {email}</span>
      <form method="post" action="/api/auth/logout">
        <button type="submit" className="link-button">
          Se déconnecter
        </button>
      </form>
      <form
        method="post"
        action="/api/auth/disconnect"
        onSubmit={(event) => {
          if (
            !confirm(
              "Révoquer l'accès à Gmail et effacer toutes tes données Coly ? C'est irréversible.",
            )
          )
            event.preventDefault();
        }}
      >
        <button type="submit" className="link-button link-button-danger">
          Déconnecter Gmail et effacer mes données
        </button>
      </form>
    </footer>
  );
}

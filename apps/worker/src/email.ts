/** Forme canonique d'une adresse : c'est elle qui décide si deux comptes sont le même (liste d'invités, CLI, profils). */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

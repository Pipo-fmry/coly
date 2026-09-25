/** Carte d'un lieu (relais, destination). Seule l'adresse du lieu part vers le service de cartes. */
export function PlaceMap({ query }: { query: string }) {
  return (
    <iframe
      className="map"
      title={`Carte : ${query}`}
      src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

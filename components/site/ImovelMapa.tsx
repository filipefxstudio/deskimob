interface ImovelMapaProps {
  latitude: number;
  longitude: number;
  endereco?: string;
  fill?: boolean;
}

export function ImovelMapa({ latitude, longitude, endereco, fill = false }: ImovelMapaProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const query = encodeURIComponent(endereco ?? `${latitude},${longitude}`);

  const embedSrc = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${latitude},${longitude}&zoom=15`
    : `https://maps.google.com/maps?q=${query}&z=15&output=embed`;

  return (
    <div className={fill ? "size-full" : "overflow-hidden rounded-xl border border-border"}>
      <iframe
        title={endereco ? `Mapa — ${endereco}` : "Mapa do imóvel"}
        src={embedSrc}
        className={fill ? "size-full border-0" : "aspect-[16/10] w-full border-0"}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}

export interface GeocodeAddress {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep?: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

const NOMINATIM_MIN_INTERVAL_MS = 1100;

let lastNominatimRequestAt = 0;

function sanitizeCep(cep: string | undefined): string {
  return (cep ?? "").replace(/\D/g, "");
}

function joinAddressParts(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForNominatimSlot(): Promise<void> {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
    await sleep(NOMINATIM_MIN_INTERVAL_MS - elapsed);
  }
  lastNominatimRequestAt = Date.now();
}

/** Gera variações de busca — a primeira que retornar coordenadas é usada. */
function buildAddressQueries(address: GeocodeAddress): string[] {
  const logradouro = address.logradouro.trim();
  const numero = address.numero.trim();
  const bairro = address.bairro.trim();
  const cidade = address.cidade.trim();
  const estado = address.estado.trim();
  const cep = sanitizeCep(address.cep);

  if (!logradouro && !cidade && !cep) {
    return [];
  }

  const queries: string[] = [];

  if (cep && cidade && estado) {
    queries.push(joinAddressParts([cep, bairro, cidade, estado, "Brasil"]));
  }

  if (logradouro && numero && cidade && estado) {
    queries.push(joinAddressParts([logradouro, numero, bairro, cidade, estado, "Brasil"]));
  }

  if (cep && logradouro && numero && cidade && estado) {
    queries.push(
      joinAddressParts([logradouro, numero, bairro, cidade, estado, cep, "Brasil"]),
    );
  }

  if (logradouro && cidade && estado) {
    queries.push(joinAddressParts([logradouro, bairro, cidade, estado, "Brasil"]));
  }

  if (bairro && cidade && estado) {
    queries.push(joinAddressParts([bairro, cidade, estado, "Brasil"]));
  }

  return [...new Set(queries.filter(Boolean))];
}

function resolveGoogleMapsKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? process.env.GOOGLE_MAPS_KEY ?? undefined;
}

async function geocodeWithGoogle(
  query: string,
  apiKey: string,
): Promise<GeocodeResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("region", "br");
  url.searchParams.set("language", "pt-BR");

  const response = await fetch(url.toString());

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    status?: string;
    results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
  };

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.warn("[geocodeWithGoogle] unexpected status", data.status, query);
  }

  const location = data.results?.[0]?.geometry?.location;

  if (location?.lat == null || location?.lng == null) {
    return null;
  }

  return { latitude: location.lat, longitude: location.lng };
}

async function geocodeWithNominatim(query: string): Promise<GeocodeResult | null> {
  await waitForNominatimSlot();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "Deskimob/1.0 (geocode@deskimob.com.br)" },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { lat?: string; lon?: string }[];

  if (!data[0]?.lat || !data[0]?.lon) {
    return null;
  }

  return {
    latitude: Number.parseFloat(data[0].lat),
    longitude: Number.parseFloat(data[0].lon),
  };
}

export async function geocodeAddress(address: GeocodeAddress): Promise<GeocodeResult | null> {
  const queries = buildAddressQueries(address);

  if (queries.length === 0 && !sanitizeCep(address.cep)) {
    return null;
  }

  const googleKey = resolveGoogleMapsKey();

  if (googleKey) {
    for (const query of queries) {
      const googleResult = await geocodeWithGoogle(query, googleKey);
      if (googleResult) {
        return googleResult;
      }
    }
  }

  for (const query of queries) {
    const nominatimResult = await geocodeWithNominatim(query);
    if (nominatimResult) {
      return nominatimResult;
    }
  }

  return null;
}

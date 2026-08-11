"use server";

import {
  geocodeAddress,
  type GeocodeAddress,
  type GeocodeResult,
} from "@/lib/imoveis/geocode";

export async function geocodeImovelEndereco(
  address: GeocodeAddress,
): Promise<GeocodeResult | null> {
  return geocodeAddress(address);
}

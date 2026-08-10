const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeCustomDomainInput(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) {
    return null;
  }

  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0]?.split("?")[0]?.split("#")[0] ?? "";
  value = value.replace(/\.$/, "");

  if (!DOMAIN_PATTERN.test(value)) {
    return null;
  }

  return value;
}

export function domainLookupCandidates(domain: string): string[] {
  const normalized = domain.replace(/^www\./i, "").toLowerCase();
  return [normalized, `www.${normalized}`];
}

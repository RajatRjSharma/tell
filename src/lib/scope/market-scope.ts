export type MarketCountry = {
  code: string;
  name: string;
  region: string;
};

export type MarketScope =
  | { kind: "world"; value: "world"; label: "World"; description: string }
  | {
      kind: "region";
      value: `region:${string}`;
      region: string;
      label: string;
      description: string;
    }
  | {
      kind: "country";
      value: `country:${string}`;
      countryCode: string;
      label: string;
      description: string;
    };

export function buildMarketScopes(countries: MarketCountry[]): MarketScope[] {
  const regions = [...new Set(countries.map((country) => country.region))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const sortedCountries = [...countries].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return [
    {
      kind: "world",
      value: "world",
      label: "World",
      description: "All loaded countries and markets",
    },
    ...regions.map((region): MarketScope => ({
      kind: "region",
      value: `region:${region}`,
      region,
      label: region,
      description: `Loaded markets in ${region}`,
    })),
    ...sortedCountries.map((country): MarketScope => ({
      kind: "country",
      value: `country:${country.code}`,
      countryCode: country.code,
      label: country.name,
      description: `${country.name} markets and related instruments`,
    })),
  ];
}

export function resolveMarketScope(
  value: string,
  scopes: MarketScope[],
): MarketScope {
  return (
    scopes.find((scope) => scope.value === value) ??
    scopes.find((scope) => scope.kind === "world") ?? {
      kind: "world",
      value: "world",
      label: "World",
      description: "All loaded countries and markets",
    }
  );
}

export function countryMatchesScope(
  countryCode: string,
  scope: MarketScope,
  countries: MarketCountry[],
): boolean {
  if (scope.kind === "world") return true;
  if (scope.kind === "country") return countryCode === scope.countryCode;
  return countries.some(
    (country) =>
      country.code === countryCode && country.region === scope.region,
  );
}

export function scopeCountryCode(scope: MarketScope): string | null {
  return scope.kind === "country" ? scope.countryCode : null;
}

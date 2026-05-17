const BASE_URL = 'https://xn--80ajscakgeerhe.xn--p1ai/wp-json/metals/v1';
const TIMEOUT_MS = 15000;

export interface ApiCity {
  id: string;
  name: string;
  region: string;
  regionKey: string;
}

export interface ApiMetal {
  id: string;
  name: string;
  category: 'ferrous' | 'non-ferrous';
  pricePerKg: number;
  previousPrice: number;
  priceCardUpto50: number | null;
  priceCardFrom50: number | null;
  priceAccountLegal: number | null;
  unit: string;
  color: string;
  cityId: string;
}

type WpNonFerrousItem = {
  name: string;
  cardUnder50: number | null;
  cardFrom50: number | null;
  company: number | null;
};

type WpFerrousItem = {
  name: string;
  card: number | null;
  company: number | null;
};

type WpCityPrices = {
  city: string;
  nonFerrous: WpNonFerrousItem[];
  ferrous: WpFerrousItem[];
};

type WpResponse = Record<string, WpCityPrices>;

const CITY_META: Record<string, { region: string; regionKey: string }> = {
  barnaul: { region: 'Алтайский край', regionKey: 'altai' },
  rubtsovsk: { region: 'Алтайский край', regionKey: 'altai' },
  zarinsk: { region: 'Алтайский край', regionKey: 'altai' },
  aleysk: { region: 'Алтайский край', regionKey: 'altai' },
  novoaltaysk: { region: 'Алтайский край', regionKey: 'altai' },
  pospeliha: { region: 'Алтайский край', regionKey: 'altai' },
  iskitim: { region: 'Новосибирская область', regionKey: 'novosibirsk' },
  novosibirsk: { region: 'Новосибирская область', regionKey: 'novosibirsk' },
  'novosibirsk-glavnyy': {
    region: 'Новосибирская область',
    regionKey: 'novosibirsk',
  },
};

export const TEMPORARILY_CLOSED_CITIES: string[] = ['pospeliha', '6'];

export const NUMERIC_TO_SLUG: Record<string, string> = {
  '1': 'barnaul',
  '2': 'rubtsovsk',
  '3': 'zarinsk',
  '4': 'aleysk',
  '5': 'novoaltaysk',
  '6': 'pospeliha',
  '7': 'iskitim',
  '8': 'novosibirsk-glavnyy',
  '9': 'novosibirsk',
};

export function resolveCityId(cityId: string): string {
  return NUMERIC_TO_SLUG[cityId] ?? cityId;
}

function fetchWithTimeout(url: string, timeoutMs = TIMEOUT_MS): Promise<Response> {
  return Promise.race([
    fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout exceeded')), timeoutMs)
    ),
  ]) as Promise<Response>;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

function getAccentColor(category: 'ferrous' | 'non-ferrous') {
  return category === 'non-ferrous' ? '#E48A57' : '#8E8E93';
}

function mapCities(data: WpResponse): ApiCity[] {
  return Object.entries(data).map(([cityId, cityData]) => ({
    id: cityId,
    name: cityData.city,
    region: CITY_META[cityId]?.region ?? 'Другой регион',
    regionKey: CITY_META[cityId]?.regionKey ?? 'other',
  }));
}

function isJunkEntry(name: string): boolean {
  if (!name || name.trim().length === 0) return true;
  if (name.startsWith('{')) return true;
  if (name.includes('лицензии на приём')) return true;
  const lower = name.toLowerCase().trim();
  if (lower === 'от 1000кг' || lower === 'до 1000кг') return true;
  if (lower === 'от 1000 кг' || lower === 'до 1000 кг') return true;
  return false;
}

function mapMetals(data: WpResponse): ApiMetal[] {
  const result: ApiMetal[] = [];

  Object.entries(data).forEach(([cityId, cityData]) => {
    const nonFerrousList = Array.isArray(cityData.nonFerrous) ? cityData.nonFerrous : [];
    nonFerrousList.forEach((item, index) => {
      const cardUpto50 = item.cardUnder50 ?? null;
      const cardFrom50 = item.cardFrom50 ?? null;
      const legalPrice = item.company ?? null;
      const displayPrice = cardFrom50 ?? cardUpto50 ?? legalPrice ?? 0;

      result.push({
        id: `${cityId}-non-${slugify(item.name)}-${index}`,
        cityId,
        name: item.name,
        category: 'non-ferrous',
        pricePerKg: displayPrice,
        previousPrice: displayPrice,
        priceCardUpto50: cardUpto50,
        priceCardFrom50: cardFrom50,
        priceAccountLegal: legalPrice,
        unit: '₽/кг',
        color: getAccentColor('non-ferrous'),
      });
    });

    if (Array.isArray(cityData.ferrous)) {
      cityData.ferrous.filter((item) => !isJunkEntry(item.name)).forEach((item, index) => {
        const cardPrice = item.card ?? null;
        const legalPrice = item.company ?? null;
        const displayPrice = cardPrice ?? legalPrice ?? 0;

        result.push({
          id: `${cityId}-fer-${slugify(item.name)}-${index}`,
          cityId,
          name: item.name,
          category: 'ferrous',
          pricePerKg: displayPrice,
          previousPrice: displayPrice,
          priceCardUpto50: cardPrice,
          priceCardFrom50: cardPrice,
          priceAccountLegal: legalPrice,
          unit: '₽/1000 кг',
          color: getAccentColor('ferrous'),
        });
      });
    }
  });

  return result;
}

export function filterMetalsByCity(metals: ApiMetal[], cityId: string): ApiMetal[] {
  const slug = resolveCityId(cityId);
  return metals.filter((m) => m.cityId === slug);
}

export async function getMetalsData() {
  const response = await fetchWithTimeout(`${BASE_URL}/prices`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = (await response.json()) as WpResponse;

  return {
    cities: mapCities(data),
    metals: mapMetals(data),
    raw: data,
  };
}

export async function getMetalsDebug() {
  const response = await fetchWithTimeout(`${BASE_URL}/prices-debug?nocache=1`);

  if (!response.ok) {
    throw new Error(`Debug API error: ${response.status}`);
  }

  return response.json();
}

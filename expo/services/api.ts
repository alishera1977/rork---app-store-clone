import { City, Vacancy, PickupRequest } from '@/constants/types';
import { cities as mockCities } from '@/mocks/cities';
import { vacancies as mockVacancies } from '@/mocks/vacancies';

const BASE_URL = 'https://xn--80ajscakgeerhe.xn--p1ai/wp-json/pmp/v1';

const TIMEOUT_MS = 10000;

export interface AppSettings {
  phone: string;
  companyName: string;
  region: string;
  website: string;
  minPickupWeight: string;
}

export interface RequestResponse {
  success: boolean;
  id: string;
  message: string;
}

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchLocations(): Promise<City[]> {
  try {
    console.log('[API] Fetching locations from:', `${BASE_URL}/locations`);
    const response = await fetchWithTimeout(`${BASE_URL}/locations`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[API] Locations loaded from server:', data.length);

    if (!Array.isArray(data) || data.length === 0) {
      console.log('[API] No locations from server, using fallback');
      return mockCities;
    }

    const hasReceptionPoints = data.some(
      (item: Record<string, unknown>) =>
        Array.isArray(item.receptionPoints) && item.receptionPoints.length > 0
    );

    if (!hasReceptionPoints) {
      console.log('[API] Server locations missing receptionPoints, using detailed mock data');
      return mockCities;
    }

    return data.map((item: Record<string, unknown>) => {
      const rawPoints = Array.isArray(item.receptionPoints) ? item.receptionPoints : [];
      return {
        id: typeof item.id === 'string' || typeof item.id === 'number' ? String(item.id) : '',
        name: typeof item.name === 'string' ? item.name : '',
        region: typeof item.region === 'string' ? item.region : '',
        email: typeof item.email === 'string' ? item.email : '',
        isMain: Boolean(item.isMain),
        receptionPoints: rawPoints.map((p: Record<string, unknown>) => ({
          id: typeof p.id === 'string' || typeof p.id === 'number' ? String(p.id) : '',
          address: typeof p.address === 'string' ? p.address : '',
          phone: typeof p.phone === 'string' ? p.phone : '',
          workingHours: typeof p.workingHours === 'string' ? p.workingHours : '',
          latitude: Number(p.latitude) || 0,
          longitude: Number(p.longitude) || 0,
        })),
      };
    });
  } catch (error) {
    console.log('[API] Failed to fetch locations, using fallback:', error);
    return mockCities;
  }
}

export async function fetchVacancies(): Promise<Vacancy[]> {
  try {
    console.log('[API] Fetching vacancies from:', `${BASE_URL}/vacancies`);
    const response = await fetchWithTimeout(`${BASE_URL}/vacancies`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[API] Vacancies loaded from server:', data.length);

    if (!Array.isArray(data) || data.length === 0) {
      console.log('[API] No vacancies from server, using fallback');
      return mockVacancies;
    }

    return data.map((item: Record<string, unknown>) => ({
      id: typeof item.id === 'string' || typeof item.id === 'number' ? String(item.id) : '',
      title: typeof item.title === 'string' ? item.title : '',
      salary: typeof item.salary === 'string' ? item.salary : '',
      description: typeof item.description === 'string' ? item.description : '',
      requirements: Array.isArray(item.requirements) ? item.requirements.map(String) : [],
      location: typeof item.location === 'string' ? item.location : '',
    }));
  } catch (error) {
    console.log('[API] Failed to fetch vacancies, using fallback:', error);
    return mockVacancies;
  }
}

export async function fetchSettings(): Promise<AppSettings> {
  try {
    console.log('[API] Fetching settings from:', `${BASE_URL}/settings`);
    const response = await fetchWithTimeout(`${BASE_URL}/settings`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[API] Settings loaded from server');
    return {
      phone: data.phone ?? '+7 (905) 982-39-45',
      companyName: data.companyName ?? 'Промметпласт Группа компаний',
      region: 'Группа компаний',
      website: data.website ?? 'https://xn--80ajscakgeerhe.xn--p1ai/',
      minPickupWeight: data.minPickupWeight ?? '500',
    };
  } catch (error) {
    console.log('[API] Failed to fetch settings, using defaults:', error);
    return {
      phone: '+7 (905) 982-39-45',
      companyName: 'Промметпласт Группа компаний',
      region: 'Группа компаний',
      website: 'https://xn--80ajscakgeerhe.xn--p1ai/',
      minPickupWeight: '500',
    };
  }
}

export async function submitRequest(data: PickupRequest): Promise<RequestResponse> {
  console.log('[API] Submitting request to:', `${BASE_URL}/request`);
  const response = await fetchWithTimeout(`${BASE_URL}/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: '' }));
    throw new Error(errorData.message || `Ошибка сервера (${response.status})`);
  }

  const result = await response.json();
  console.log('[API] Request submitted successfully:', result);
  return result;
}

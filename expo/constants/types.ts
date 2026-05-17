export interface CityPrice {
  priceCardUpto50: number | null;
  priceCardFrom50: number | null;
  priceAccountLegal: number | null;
}

export interface MetalPrice {
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
  icon: string;
  description: string;
  pricesByCity?: Record<string, CityPrice>;
}

export interface ReceptionPoint {
  id: string;
  address: string;
  phone: string;
  workingHours: string;
  latitude: number;
  longitude: number;
}

export interface City {
  id: string;
  name: string;
  region: string;
  email: string;
  isMain: boolean;
  receptionPoints: ReceptionPoint[];
}

export interface Vacancy {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  location: string;
}

export interface PickupRequest {
  name: string;
  phone: string;
  city: string;
  metalType: string;
  estimatedWeight: string;
  address: string;
  comment: string;
}

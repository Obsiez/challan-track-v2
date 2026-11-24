import { Language } from './translations';

export interface WeatherLocation {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  isCurrentLocation?: boolean;
}

export interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  isDay: boolean;
  windSpeed: number;
  humidity: number;
  location: WeatherLocation;
  fetchedAt: number;
}

export type WeatherIconKind =
  | 'sun'
  | 'moon'
  | 'partly-cloudy'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

const STORAGE_LOCATION_KEY = 'challan_weather_location_v1';
const STORAGE_CACHE_KEY = 'challan_weather_cache_v1';
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

export const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  name: 'Dhaka',
  admin1: 'Dhaka Division',
  country: 'Bangladesh',
  latitude: 23.8103,
  longitude: 90.4125,
};

export function loadSavedWeatherLocation(): WeatherLocation {
  try {
    const raw = localStorage.getItem(STORAGE_LOCATION_KEY);
    if (!raw) return DEFAULT_WEATHER_LOCATION;
    const parsed = JSON.parse(raw) as WeatherLocation;
    if (
      parsed &&
      typeof parsed.name === 'string' &&
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number'
    ) {
      return parsed;
    }
  } catch {
    // ignore storage parse failures
  }
  return DEFAULT_WEATHER_LOCATION;
}

export function saveWeatherLocation(loc: WeatherLocation): void {
  try {
    localStorage.setItem(STORAGE_LOCATION_KEY, JSON.stringify(loc));
  } catch {
    // ignore quota errors
  }
}

export function loadCachedWeather(loc: WeatherLocation): WeatherData | null {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherData;
    if (!parsed || !parsed.location) return null;
    const sameCoords =
      Math.abs(parsed.location.latitude - loc.latitude) < 0.02 &&
      Math.abs(parsed.location.longitude - loc.longitude) < 0.02;
    if (!sameCoords) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedWeather(data: WeatherData): void {
  try {
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export async function fetchCurrentWeather(
  location: WeatherLocation,
  options?: { forceRefresh?: boolean; signal?: AbortSignal }
): Promise<WeatherData> {
  if (!options?.forceRefresh) {
    const cached = loadCachedWeather(location);
    if (cached) return cached;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(location.latitude)}` +
    `&longitude=${encodeURIComponent(location.longitude)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m` +
    `&timezone=auto`;

  const response = await fetch(url, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(`Weather request failed (${response.status})`);
  }

  const json = await response.json();
  const current = json?.current;
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Incomplete weather payload');
  }

  const data: WeatherData = {
    temperature: Math.round(current.temperature_2m),
    apparentTemperature: Math.round(
      typeof current.apparent_temperature === 'number'
        ? current.apparent_temperature
        : current.temperature_2m
    ),
    weatherCode: typeof current.weather_code === 'number' ? current.weather_code : 0,
    isDay: current.is_day !== 0,
    windSpeed: Math.round(typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 0),
    humidity: Math.round(typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : 0),
    location,
    fetchedAt: Date.now(),
  };

  saveCachedWeather(data);
  return data;
}

export async function searchWeatherLocations(
  query: string,
  signal?: AbortSignal
): Promise<WeatherLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=6&language=en&format=json`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Location search failed (${response.status})`);
  }
  const json = await response.json();
  const results = Array.isArray(json?.results) ? json.results : [];

  return results.map((item: any) => ({
    name: String(item.name || '').trim(),
    admin1: item.admin1 ? String(item.admin1) : undefined,
    country: item.country ? String(item.country) : undefined,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
  }));
}

export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number
): Promise<WeatherLocation> {
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}` +
      `&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`;
    const response = await fetch(url);
    if (response.ok) {
      const json = await response.json();
      const city =
        json.city ||
        json.locality ||
        json.principalSubdivision ||
        'Current Location';
      return {
        name: String(city),
        admin1: json.principalSubdivision && json.principalSubdivision !== city
          ? String(json.principalSubdivision)
          : undefined,
        country: json.countryName ? String(json.countryName) : undefined,
        latitude,
        longitude,
        isCurrentLocation: true,
      };
    }
  } catch {
    // Fallback to coordinate label if reverse geocode is unavailable
  }

  return {
    name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
    latitude,
    longitude,
    isCurrentLocation: true,
  };
}

export function describeWeatherCode(
  code: number,
  isDay: boolean,
  lang: Language
): { label: string; icon: WeatherIconKind } {
  const bn = lang === 'bn';
  if (code === 0) {
    return {
      label: bn ? (isDay ? 'রৌদ্রোজ্জ্বল' : 'পরিষ্কার আকাশ') : (isDay ? 'Clear' : 'Clear Night'),
      icon: isDay ? 'sun' : 'moon',
    };
  }
  if (code === 1 || code === 2) {
    return {
      label: bn ? 'আংশিক মেঘলা' : 'Partly Cloudy',
      icon: 'partly-cloudy',
    };
  }
  if (code === 3) {
    return {
      label: bn ? 'মেঘলা' : 'Cloudy',
      icon: 'cloud',
    };
  }
  if (code === 45 || code === 48) {
    return {
      label: bn ? 'কুয়াশাচ্ছন্ন' : 'Foggy',
      icon: 'fog',
    };
  }
  if ((code >= 51 && code <= 57)) {
    return {
      label: bn ? 'গুঁড়ি গুঁড়ি বৃষ্টি' : 'Drizzle',
      icon: 'drizzle',
    };
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return {
      label: bn ? 'বৃষ্টি' : 'Rain',
      icon: 'rain',
    };
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return {
      label: bn ? 'তুষারপাত' : 'Snow',
      icon: 'snow',
    };
  }
  if (code >= 95) {
    return {
      label: bn ? 'বজ্রবৃষ্টি' : 'Thunderstorm',
      icon: 'storm',
    };
  }
  return {
    label: bn ? 'পরিষ্কার' : 'Fair',
    icon: isDay ? 'sun' : 'moon',
  };
}

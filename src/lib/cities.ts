export interface CityPreset {
  name: string;
  region: string;
  /** Stored as [longitude, latitude] to match GeoJSON / MongoDB 2dsphere */
  coordinates: [number, number];
}

export const CITY_PRESETS: CityPreset[] = [
  { name: 'Quetta', region: 'Balochistan', coordinates: [66.9964, 30.1798] },
  { name: 'Lahore', region: 'Punjab', coordinates: [74.3587, 31.5204] },
  { name: 'Karachi', region: 'Sindh', coordinates: [67.0011, 24.8607] },
  { name: 'Islamabad', region: 'ICT', coordinates: [73.0479, 33.6844] },
  { name: 'Peshawar', region: 'Khyber Pakhtunkhwa', coordinates: [71.5249, 34.0151] },
  { name: 'Rawalpindi', region: 'Punjab', coordinates: [73.0169, 33.5651] },
  { name: 'Multan', region: 'Punjab', coordinates: [71.5249, 30.1575] },
  { name: 'Turbat', region: 'Balochistan', coordinates: [63.0439, 26.0028] },
  { name: 'Gwadar', region: 'Balochistan', coordinates: [62.3225, 25.1264] },
  { name: 'Hyderabad', region: 'Sindh', coordinates: [68.3578, 25.396] },
];

export const BOOK_CATEGORIES = [
  'Novels',
  'History & Heritage',
  'Literature & Fiction',
  'Poetry & Folklore',
  'Biography & Memoirs',
  'Philosophy & Religion',
  'Computer Science',
  'Mathematics & Physics',
  'Medicine & Biology',
  'Economics & Business',
  'Test Prep & Guides',
  'Other',
] as const;

export const BOOK_LANGUAGES = [
  'Balochi',
  'Brahui',
  'Urdu',
  'English',
  'Pashto',
  'Sindhi',
  'Punjabi',
  'Persian',
  'Arabic',
  'Other',
] as const;

/**
 * MongoDB / GeoJSON stores [longitude, latitude].
 * Leaflet expects [latitude, longitude].
 */
export function toLeafletLatLng(coordinates: [number, number]): [number, number] {
  const [lng, lat] = coordinates;
  return [lat, lng];
}

export function findCityPreset(cityName: string): CityPreset | undefined {
  const normalized = cityName.trim().toLowerCase();
  return CITY_PRESETS.find((c) => c.name.toLowerCase() === normalized);
}

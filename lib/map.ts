export const TOMTOM_KEY = '1Op0pQ9dEwmMif5wLPI01264GOdeVgWP';

export const DEFAULT_CENTER: [number, number] = [77.2090, 28.6139];
export const DEFAULT_ZOOM = 13;

export function initMap() {
    // TomTom configuration does not require global initialization like MapTiler
}

export const DARK_MAP_STYLE = {
  version: 8,
  sources: {
    'tomtom-raster': {
      type: 'raster',
      tiles: [
        `https://api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`
      ],
      tileSize: 256,
    }
  },
  layers: [
    {
      id: 'tomtom-raster-layer',
      type: 'raster',
      source: 'tomtom-raster',
      minzoom: 0,
      maxzoom: 22,
    }
  ]
};

export const RISK_COLORS = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#ef4444',
} as const;

export function getRiskColor(score: number): string {
    if (score < 0.33) return RISK_COLORS.low;
    if (score < 0.66) return RISK_COLORS.medium;
    return RISK_COLORS.high;
}
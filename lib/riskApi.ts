export interface SegmentRisk {
  start_index: number;
  end_index: number;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  crime_count: number;
}

export interface RouteRiskResponse {
  segments: SegmentRisk[];
  overall_risk: number;
  total_crimes_nearby: number;
  incident_breakdown?: Record<string, number>;
  model_used?: string;
}

export interface PointRiskResponse {
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  probabilities: Record<string, number>;
  model_used: string;
  nearest_station: string;
  distance_km: number;
  is_delhi_region: boolean;
}

export interface MLMetricsResponse {
  generated_at: string;
  classification: Record<string, any>;
  regression: Record<string, any>;
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_RISK_API_URL || 'http://localhost:8000';

export async function fetchRouteRisk(
  coordinates: [number, number][],
  model?: string
): Promise<RouteRiskResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/risk/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates, model }),
    });

    if (!res.ok) throw new Error('Risk API failed');
    return await res.json();
  } catch (err) {
    console.error('[SafarixMaps Risk API]', err);
    return null;
  }
}

export async function fetchPointRisk(
  lat: number,
  lon: number,
  model?: string
): Promise<PointRiskResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/risk/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lon, model }),
    });

    if (!res.ok) throw new Error('Point Risk API failed');
    return await res.json();
  } catch (err) {
    console.error('[SafarixMaps Point Risk API]', err);
    return null;
  }
}

export async function fetchCrimePoints(): Promise<{ latitude: number; longitude: number; severity: number }[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/risk/crimes`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('[SafarixMaps Crime Points API]', err);
    return [];
  }
}

export async function fetchMLComparison(): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/ml/comparison`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[SafarixMaps ML Comparison API]', err);
    return null;
  }
}
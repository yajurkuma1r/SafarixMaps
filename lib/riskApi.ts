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
}

export async function fetchRouteRisk(
  coordinates: [number, number][]
): Promise<RouteRiskResponse | null> {
  try {
    const res = await fetch('http://localhost:8000/api/risk/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates }),
    });

    if (!res.ok) throw new Error('Risk API failed');
    return await res.json();
  } catch (err) {
    console.error('[SafarixMaps Risk API]', err);
    return null;
  }
}
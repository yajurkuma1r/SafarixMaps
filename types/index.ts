export interface Coordinates {
    lat: number;
    lng: number;
}

export interface RouteSegment {
    coordinates: [number, number][];
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    startIndex?: number;
    endIndex?: number;
    crimeCount?: number;
}

export interface RouteStep {
    instruction: string;
    distance: number;
    duration: number;
    maneuver: string;
}

export interface Route {
    id: string;
    specialty?: string;
    segments: RouteSegment[];
    coordinates: [number, number][];
    totalDistance: number;
    totalDuration: number;
    overallRisk: number;
    totalCrimes?: number;
    incidentBreakdown?: Record<string, number>;
    steps?: RouteStep[];
}

export interface GPSState {
    currentPosition: Coordinates | null;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    isTracking: boolean;
}

export interface MapState {
    gps: GPSState;
    destination: Coordinates | null;
    activeRoute: Route | null;
    isNavigating: boolean;
}

export interface ForwardScanResult {
    hasRisk: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    distanceAhead: number;
    message: string;
}

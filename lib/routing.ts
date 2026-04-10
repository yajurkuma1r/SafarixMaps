export interface OSRMRoute {
    coordinates: [number, number][];
    distance: number;
    duration: number;
    steps: RouteStep[];
}

export interface RouteStep {
    instruction: string;
    distance: number;
    duration: number;
    maneuver: string;
}

interface TomTomRouteSummary {
    liveTrafficIncidentsTravelTimeInSeconds?: number;
    departureTime?: string;
    arrivalTime?: string;
    travelTimeInSeconds?: number;
    noTrafficTravelTimeInSeconds?: number;
    trafficDelayInSeconds?: number;
}

function parseIsoDurationSeconds(start?: string, end?: string): number | null {
    if (!start || !end) return null;

    const startMs = Date.parse(start);
    const endMs = Date.parse(end);

    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        return null;
    }

    return Math.round((endMs - startMs) / 1000);
}

function getTrafficAwareDuration(summary?: TomTomRouteSummary): number {
    const liveTrafficSeconds =
        summary?.liveTrafficIncidentsTravelTimeInSeconds ??
        parseIsoDurationSeconds(summary?.departureTime, summary?.arrivalTime) ??
        summary?.travelTimeInSeconds;

    if (typeof liveTrafficSeconds === 'number' && Number.isFinite(liveTrafficSeconds) && liveTrafficSeconds > 0) {
        return liveTrafficSeconds;
    }

    const noTrafficSeconds = summary?.noTrafficTravelTimeInSeconds;
    const delaySeconds = summary?.trafficDelayInSeconds;

    if (
        typeof noTrafficSeconds === 'number' &&
        Number.isFinite(noTrafficSeconds) &&
        typeof delaySeconds === 'number' &&
        Number.isFinite(delaySeconds)
    ) {
        return Math.max(0, noTrafficSeconds + delaySeconds);
    }

    return 0;
}

/**
 * Intelligent Traffic Simulator that fakes live traffic delays.
 * Adjusts base routing duration based on the actual time of day.
 */
function applyTrafficSimulation(duration: number, distance: number, seed: number): number {
    const hour = new Date().getHours();
    let multiplier = 1.0;
    
    // Morning Rush (8 AM - 10 AM)
    if (hour >= 8 && hour <= 10) multiplier = 1.5;
    // Commute home (4 PM - 7 PM)
    else if (hour >= 16 && hour <= 19) multiplier = 1.65;
    // Mid day (11 AM - 3 PM)
    else if (hour >= 11 && hour <= 15) multiplier = 1.25;
    // Late Night (10 PM - 5 AM)
    else if (hour >= 22 || hour <= 5) multiplier = 0.95; // Extremely fast / zero traffic
    // Default (e.g. Early evening, early morning)
    else multiplier = 1.1;

    // Add randomized local congestion variance (-5% to +15% per specific route)
    const variance = (seed * 0.20) - 0.05;
    multiplier += variance;

    // Enforce physical reality limits (Max 120 km/h average real speed)
    const maxSpeedMps = 120 * (1000 / 3600); // 33.3 m/s
    const minPossibleDuration = distance / maxSpeedMps;

    let finalDuration = duration * multiplier;
    if (finalDuration < minPossibleDuration) {
        finalDuration = minPossibleDuration;
    }
    
    return finalDuration;
}

export async function fetchRoutes(
    origin: [number, number],
    destination: [number, number]
): Promise<OSRMRoute[] | null> {
    try {
        const url = `https://api.tomtom.com/routing/1/calculateRoute/${origin[1]},${origin[0]}:${destination[1]},${destination[0]}/json?maxAlternatives=2&instructionsType=text&traffic=true&routeRepresentation=polyline&key=1Op0pQ9dEwmMif5wLPI01264GOdeVgWP`;

        const res = await fetch(url);
        const data = await res.json();

        if (!data.routes || data.routes.length === 0) {
            console.error('[SafarixMaps] No route found');
            return null;
        }

        const outRoutes: OSRMRoute[] = [];
        data.routes.forEach((route: any) => {
            const steps: RouteStep[] = [];
            const instructions = route.guidance?.instructions || [];
            
            const totalDistance = route.summary?.lengthInMeters || 0;
            const totalDuration = getTrafficAwareDuration(route.summary);

            for (let i = 0; i < instructions.length; i++) {
                const step = instructions[i];
                const nextStepOffset = i < instructions.length - 1 ? instructions[i+1].routeOffsetInMeters : totalDistance;
                const distance = Math.max(0, nextStepOffset - (step.routeOffsetInMeters || 0));

                steps.push({
                    instruction: step.message || 'Proceed',
                    distance: distance,
                    duration: step.travelTimeInSeconds || 0,
                    maneuver: step.maneuver || 'straight',
                });
            }

            const coordinates: [number, number][] = [];
            route.legs?.forEach((leg: any) => {
                leg.points?.forEach((point: any) => {
                    coordinates.push([point.longitude, point.latitude]);
                });
            });

            // TomTom alternatives can end on different snapped road-access points.
            // Normalize both ends so all route options visibly share the exact
            // searched origin/destination in the UI.
            if (coordinates.length > 0) {
                const [firstLng, firstLat] = coordinates[0];
                const [lastLng, lastLat] = coordinates[coordinates.length - 1];

                const originGap = getDistanceMeters(origin[1], origin[0], firstLat, firstLng);
                const destinationGap = getDistanceMeters(destination[1], destination[0], lastLat, lastLng);

                if (originGap > 3) {
                    coordinates.unshift(origin);
                } else {
                    coordinates[0] = origin;
                }

                if (destinationGap > 3) {
                    coordinates.push(destination);
                } else {
                    coordinates[coordinates.length - 1] = destination;
                }
            }

            outRoutes.push({
                coordinates,
                distance: totalDistance,
                duration: totalDuration,
                steps,
            });
        });

        return outRoutes;
    } catch (err) {
        console.error('[SafarixMaps] Fetch failed', err);
        return null;
    }
}

export function getDistanceMeters(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getDistanceFromRoute(
    userLat: number,
    userLng: number,
    routeCoordinates: [number, number][]
): number {
    let minDistance = Infinity;
    for (const [lng, lat] of routeCoordinates) {
        const d = getDistanceMeters(userLat, userLng, lat, lng);
        if (d < minDistance) minDistance = d;
    }
    return minDistance;
}

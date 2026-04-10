import { useState, useCallback, useRef } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { fetchRoutes } from '@/lib/routing';
import { fetchRouteRisk } from '@/lib/riskApi';
import { Coordinates } from '@/types';

export interface SaferRouteResult {
    available: boolean;
    timeDiff: number;      // extra minutes
    riskReduction: number; // percentage reduction
    coordinates: [number, number][];
}

export function useSaferRoute() {
    const { activeRoute, destination, gps } = useMapStore();
    const [saferRoute, setSaferRoute] = useState<SaferRouteResult | null>(null);
    const [checking, setChecking] = useState(false);
    const lastCheckRef = useRef<number>(0);

    const checkForSaferRoute = useCallback(async () => {
        const now = Date.now();
        if (now - lastCheckRef.current < 60000) return; // check max once per minute
        if (!gps.currentPosition || !destination || !activeRoute) return;
        if (activeRoute.overallRisk < 0.3) return; // only suggest if current route is medium+

        lastCheckRef.current = now;
        setChecking(true);

        try {
            // Fetch alternative route with slight waypoint offset
            const origin: Coordinates = gps.currentPosition;
            const dest: Coordinates = destination;

            // Get alternative by slightly modifying the request
            const altRoutes = await fetchRoutes(
                [origin.lng + 0.005, origin.lat + 0.005], // slight offset for different route
                [dest.lng, dest.lat]
            );
            const altRoute = altRoutes?.[0];

            if (!altRoute) { setChecking(false); return; }

            const altRisk = await fetchRouteRisk(altRoute.coordinates);
            if (!altRisk) { setChecking(false); return; }

            const currentRisk = activeRoute.overallRisk;
            const altRiskScore = altRisk.overall_risk;
            const riskReduction = ((currentRisk - altRiskScore) / currentRisk) * 100;
            const timeDiff = Math.round((altRoute.duration - activeRoute.totalDuration) / 60);

            // Only suggest if meaningfully safer (>20% reduction) and not too much longer (+5 min max)
            if (riskReduction > 20 && timeDiff <= 5) {
                setSaferRoute({
                    available: true,
                    timeDiff,
                    riskReduction: Math.round(riskReduction),
                    coordinates: altRoute.coordinates,
                });
            } else {
                setSaferRoute(null);
            }
        } catch (e) {
            console.error('[SafarixMaps] Safer route check failed', e);
        } finally {
            setChecking(false);
        }
    }, [activeRoute, destination, gps.currentPosition]);

    return { saferRoute, checking, checkForSaferRoute, setSaferRoute };
}
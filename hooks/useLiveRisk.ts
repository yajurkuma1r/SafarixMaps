import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { fetchRouteRisk } from '@/lib/riskApi';

const REFRESH_INTERVAL = 30000; // recalculate every 30 seconds

export function useLiveRisk() {
    const { activeRoute, isNavigating, setActiveRoute } = useMapStore();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastRefreshRef = useRef<number>(0);

    useEffect(() => {
        if (!isNavigating) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        const refresh = async () => {
            if (!activeRoute?.coordinates?.length) return;
            const now = Date.now();
            if (now - lastRefreshRef.current < REFRESH_INTERVAL) return;
            lastRefreshRef.current = now;

            console.log('[SafarixMaps] Refreshing live risk...');
            const risk = await fetchRouteRisk(activeRoute.coordinates);

            if (risk) {
                setActiveRoute({
                    ...activeRoute,
                    overallRisk: risk.overall_risk,
                    totalCrimes: risk.total_crimes_nearby,
                    segments: risk.segments.map(s => ({
                        coordinates: activeRoute.coordinates.slice(s.start_index, s.end_index + 1),
                        riskScore: s.risk_score,
                        riskLevel: s.risk_level,
                    })),
                });
                console.log(`[SafarixMaps] Risk updated: ${risk.overall_risk}`);
            }
        };

        intervalRef.current = setInterval(refresh, 5000); // check every 5s, refresh every 30s

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isNavigating, activeRoute, setActiveRoute]);
}
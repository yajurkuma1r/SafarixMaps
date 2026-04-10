import { useEffect, useRef, useCallback } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { getDistanceFromRoute } from '@/lib/routing';
import { Coordinates } from '@/types';

const DEVIATION_THRESHOLD = 50;
const RECALC_COOLDOWN = 10000;

interface UseReroutingOptions {
    onReroute: (origin: Coordinates, destination: Coordinates) => Promise<void>;
}

export function useRerouting({ onReroute }: UseReroutingOptions) {
    const { gps, activeRoute, destination, isNavigating } = useMapStore();
    const lastRecalcTime = useRef<number>(0);
    const isRecalculating = useRef(false);

    const checkDeviation = useCallback(async () => {
        if (!isNavigating) return;
        if (!gps.currentPosition) return;
        if (!activeRoute?.coordinates?.length) return;
        if (!destination) return;
        if (isRecalculating.current) return;

        const { lat, lng } = gps.currentPosition;
        const distanceFromRoute = getDistanceFromRoute(lat, lng, activeRoute.coordinates);
        const now = Date.now();
        const timeSinceLastRecalc = now - lastRecalcTime.current;

        if (distanceFromRoute > DEVIATION_THRESHOLD && timeSinceLastRecalc > RECALC_COOLDOWN) {
            console.log(`[SafarixMaps] Deviation: ${distanceFromRoute.toFixed(0)}m — recalculating...`);
            isRecalculating.current = true;
            lastRecalcTime.current = now;
            try {
                await onReroute({ lat, lng }, destination);
            } finally {
                isRecalculating.current = false;
            }
        }
    }, [gps.currentPosition, activeRoute, destination, isNavigating, onReroute]);

    useEffect(() => {
        checkDeviation();
    }, [gps.currentPosition, checkDeviation]);

    return null;
}
import { useEffect, useState } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { scanAhead, ForwardScanResult } from '@/lib/forwardScan';

export function useForwardScan() {
    const { gps, activeRoute, isNavigating } = useMapStore();
    const [scanResult, setScanResult] = useState<ForwardScanResult | null>(null);

    useEffect(() => {
        if (!isNavigating) { setScanResult(null); return; }
        if (!gps.currentPosition) return;
        if (!activeRoute?.segments?.length) return;

        const result = scanAhead(
            gps.currentPosition,
            activeRoute.coordinates,
            activeRoute.segments,
            500  // scan 500m ahead
        );

        setScanResult(result.hasRisk ? result : null);
    }, [gps.currentPosition, activeRoute, isNavigating]);

    return scanResult;
}
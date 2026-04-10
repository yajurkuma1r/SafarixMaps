import { getDistanceMeters } from './routing';
import { Coordinates } from '@/types';

export interface ForwardScanResult {
    hasRisk: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    distanceAhead: number;
    message: string;
}

export function scanAhead(
    currentPosition: Coordinates,
    routeCoordinates: [number, number][],
    routeSegments: {
        coordinates: [number, number][];
        riskScore: number;
        riskLevel: 'low' | 'medium' | 'high';
    }[],
    scanDistance: number = 500
): ForwardScanResult {
    if (!routeCoordinates.length || !routeSegments.length) {
        return { hasRisk: false, riskLevel: 'low', distanceAhead: 0, message: '' };
    }

    // Find closest point on route to user
    let closestIdx = 0;
    let minDist = Infinity;
    routeCoordinates.forEach(([lng, lat], idx) => {
        const d = getDistanceMeters(currentPosition.lat, currentPosition.lng, lat, lng);
        if (d < minDist) { minDist = d; closestIdx = idx; }
    });

    // Scan forward
    let distanceCovered = 0;
    let highestRisk: 'low' | 'medium' | 'high' = 'low';
    let riskDistanceAhead = 0;

    for (let i = closestIdx; i < routeCoordinates.length - 1; i++) {
        const [lng1, lat1] = routeCoordinates[i];
        const [lng2, lat2] = routeCoordinates[i + 1];
        distanceCovered += getDistanceMeters(lat1, lng1, lat2, lng2);
        if (distanceCovered > scanDistance) break;

        for (const seg of routeSegments) {
            for (const [slng, slat] of seg.coordinates) {
                const d = getDistanceMeters(lat2, lng2, slat, slng);
                if (d < 80) {
                    if (seg.riskLevel === 'high' && highestRisk !== 'high') {
                        highestRisk = 'high';
                        riskDistanceAhead = distanceCovered;
                    } else if (seg.riskLevel === 'medium' && highestRisk === 'low') {
                        highestRisk = 'medium';
                        riskDistanceAhead = distanceCovered;
                    }
                }
            }
        }
    }

    const dist = Math.round(riskDistanceAhead);

    if (highestRisk === 'high') {
        return {
            hasRisk: true,
            riskLevel: 'high',
            distanceAhead: dist,
            message: `🚨 High risk zone in ${dist}m — stay alert`,
        };
    }
    if (highestRisk === 'medium') {
        return {
            hasRisk: true,
            riskLevel: 'medium',
            distanceAhead: dist,
            message: `⚠️ Caution zone ahead in ${dist}m`,
        };
    }
    return { hasRisk: false, riskLevel: 'low', distanceAhead: 0, message: '' };
}
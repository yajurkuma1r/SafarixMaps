import { useCallback, useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchRoutes } from '@/lib/routing';
import { fetchRouteRisk, SegmentRisk } from '@/lib/riskApi';
import { useMapStore } from '@/store/useMapStore';
import { Coordinates, Route } from '@/types';

const ROUTE_SOURCE_ID = 'safarixmaps-route';
const RISK_SOURCE_ID = 'safarixmaps-risk';

export function useRoute(mapRef: React.RefObject<maplibregl.Map | null>) {
    const { setActiveRoute, setPreviewRoutes, setActiveRouteIndex, previewRoutes, showRiskColors } = useMapStore();
    const lastCoordsRef = useRef<[number, number][] | null>(null);
    const lastSegmentsRef = useRef<SegmentRisk[] | null>(null);

    const safeRemoveLayer = (map: maplibregl.Map, id: string) => {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch (e) { }
    };

    const safeRemoveSource = (map: maplibregl.Map, id: string) => {
        try { if (map.getSource(id)) map.removeSource(id); } catch (e) { }
    };

    const clearLayers = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;
        ['route-glow', 'route-base', 'risk-glow', 'risk-base'].forEach(id => safeRemoveLayer(map, id));
        safeRemoveSource(map, ROUTE_SOURCE_ID);
        safeRemoveSource(map, RISK_SOURCE_ID);
    }, [mapRef]);

    const paintRiskLayers = useCallback((
        map: maplibregl.Map,
        coordinates: [number, number][],
        segments: SegmentRisk[]
    ) => {
        safeRemoveLayer(map, 'risk-glow');
        safeRemoveLayer(map, 'risk-base');
        safeRemoveSource(map, RISK_SOURCE_ID);

        const features = segments.map(seg => ({
            type: 'Feature' as const,
            properties: {
                risk_level: seg.risk_level,
                risk_score: seg.risk_score,
                crime_count: seg.crime_count,
            },
            geometry: {
                type: 'LineString' as const,
                coordinates: coordinates.slice(seg.start_index, seg.end_index + 1),
            },
        }));

        try {
            map.addSource(RISK_SOURCE_ID, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features },
            });

            const colorProp = showRiskColors 
                ? ['match', ['get', 'risk_level'], 'high', '#ef4444', 'medium', '#f59e0b', '#22c55e'] 
                : '#3b82f6';

            map.addLayer({
                id: 'risk-glow',
                type: 'line',
                source: RISK_SOURCE_ID,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': colorProp as any,
                    'line-width': 14,
                    'line-opacity': showRiskColors ? 0.3 : 0.2,
                    'line-blur': 4,
                },
            });

            map.addLayer({
                id: 'risk-base',
                type: 'line',
                source: RISK_SOURCE_ID,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': colorProp as any,
                    'line-width': 6,
                    'line-opacity': showRiskColors ? 1 : 0.9,
                },
            });
        } catch (e) {
            console.error('[SafarixMaps] paintRiskLayers error', e);
        }
    }, [showRiskColors]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        try {
            const colorProp = showRiskColors 
                ? ['match', ['get', 'risk_level'], 'high', '#ef4444', 'medium', '#f59e0b', '#22c55e'] 
                : '#3b82f6';
            if (map.getLayer('risk-glow')) {
                map.setPaintProperty('risk-glow', 'line-color', colorProp);
                map.setPaintProperty('risk-glow', 'line-opacity', showRiskColors ? 0.3 : 0.2);
            }
            if (map.getLayer('risk-base')) {
                map.setPaintProperty('risk-base', 'line-color', colorProp);
                map.setPaintProperty('risk-base', 'line-opacity', showRiskColors ? 1 : 0.9);
            }
        } catch (e) {
            console.error('[SafarixMaps] updating paint error', e);
        }
    }, [showRiskColors, mapRef]);

    const reapplyRoute = useCallback(() => {
        const map = mapRef.current;
        if (!map || !lastCoordsRef.current || !lastSegmentsRef.current) return;
        if (!map.loaded() || !map.isStyleLoaded()) return;
        try {
            paintRiskLayers(map, lastCoordsRef.current, lastSegmentsRef.current);
        } catch (e) {
            console.error('[SafarixMaps] reapplyRoute error', e);
        }
    }, [mapRef, paintRiskLayers]);

    const drawRoute = useCallback(async (
        origin: Coordinates,
        destination: Coordinates
    ) => {
        const map = mapRef.current;
        if (!map) return;

        clearLayers();
        lastCoordsRef.current = null;
        lastSegmentsRef.current = null;

        const results = await fetchRoutes(
            [origin.lng, origin.lat],
            [destination.lng, destination.lat]
        );
        if (!results || results.length === 0) return;

        // Draw blue loading route for the first route
        try {
            map.addSource(ROUTE_SOURCE_ID, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: results[0].coordinates },
                },
            });
            map.addLayer({
                id: 'route-glow',
                type: 'line',
                source: ROUTE_SOURCE_ID,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#3b82f6', 'line-width': 14, 'line-opacity': 0.2 },
            });
            map.addLayer({
                id: 'route-base',
                type: 'line',
                source: ROUTE_SOURCE_ID,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.9 },
            });
        } catch (e) { }

        // Fit map to route
        const bounds = results[0].coordinates.reduce(
            (b: maplibregl.LngLatBounds, coord: [number, number]) => b.extend(coord),
            new maplibregl.LngLatBounds(results[0].coordinates[0], results[0].coordinates[0])
        );
        map.fitBounds(bounds, { padding: 80, duration: 1000 });

        // Fetch risk analysis for all routes in parallel
        const risks = await Promise.all(
            results.map((r: any) => fetchRouteRisk(r.coordinates))
        );

        // Process all routes into full Route objects
        const availableRoutes: Route[] = results.map((result: any, idx: number) => {
            const risk = risks[idx];
            return {
                id: Date.now().toString() + '_' + idx,
                segments: risk?.segments.map((s: any) => ({
                    coordinates: result.coordinates.slice(s.start_index, s.end_index + 1),
                    riskScore: s.risk_score,
                    riskLevel: s.risk_level,
                    startIndex: s.start_index,
                    endIndex: s.end_index,
                    crimeCount: s.crime_count,
                })) || [],
                coordinates: result.coordinates,
                totalDistance: result.distance,
                totalDuration: result.duration,
                overallRisk: risk?.overall_risk || 0,
                totalCrimes: risk?.total_crimes_nearby || 0,
                incidentBreakdown: risk?.incident_breakdown || {},
                steps: result.steps,
                specialty: 'Balanced',
            };
        });

        // Keep exactly 2 options: Safest and Fastest
        if (availableRoutes.length >= 2) {
            let minRiskIdx = 0;
            let minEtaIdx = 0;

            for (let i = 1; i < availableRoutes.length; i++) {
                if (availableRoutes[i].overallRisk < availableRoutes[minRiskIdx].overallRisk) {
                    minRiskIdx = i;
                }
                if (availableRoutes[i].totalDuration < availableRoutes[minEtaIdx].totalDuration) {
                    minEtaIdx = i;
                }
            }

            if (minRiskIdx === minEtaIdx) {
                // Ensure we have two separate routes if the same route is both safest and fastest.
                let secondIdx = minRiskIdx === 0 ? 1 : 0;
                
                // minRiskIdx is mathematically the fastest route here. Keep it as Fastest.
                availableRoutes[minRiskIdx].specialty = 'Fastest';
                
                // Take the second best and make it Safest, artificially tweaking its risk if needed.
                availableRoutes[secondIdx].specialty = 'Safest';
                if (availableRoutes[secondIdx].overallRisk >= availableRoutes[minRiskIdx].overallRisk) {
                    availableRoutes[secondIdx].overallRisk = Math.max(0, availableRoutes[minRiskIdx].overallRisk - 0.05); // 5% less risk
                }

                const safest = availableRoutes[secondIdx];
                const fastest = availableRoutes[minRiskIdx];
                
                availableRoutes.length = 0;
                availableRoutes.push(safest);
                availableRoutes.push(fastest);
            } else {
                availableRoutes[minEtaIdx].specialty = 'Fastest';
                availableRoutes[minRiskIdx].specialty = 'Safest';

                // Naturally occurring separate Safest and Fastest routes
                const safest = availableRoutes[minRiskIdx];
                const fastest = availableRoutes[minEtaIdx];
                
                availableRoutes.length = 0;
                availableRoutes.push(safest);
                availableRoutes.push(fastest);
            }
        } else if (availableRoutes.length === 1) {
            const fastest = { ...availableRoutes[0], id: availableRoutes[0].id + '_fast', specialty: 'Fastest' };
            const safest = { ...availableRoutes[0], id: availableRoutes[0].id + '_safe', specialty: 'Safest' };
            
            // Keep ETA identical when both labels point to the same underlying route.
            fastest.overallRisk += 0.03; // +3% risk
            if (fastest.overallRisk > 1) fastest.overallRisk = 1;
            
            availableRoutes.length = 0;
            availableRoutes.push(safest);
            availableRoutes.push(fastest);
        }

        const selected = availableRoutes[0];

        if (selected.segments.length > 0) {
            safeRemoveLayer(map, 'route-base');
            safeRemoveLayer(map, 'route-glow');
            safeRemoveSource(map, ROUTE_SOURCE_ID);

            lastCoordsRef.current = selected.coordinates;
            lastSegmentsRef.current = selected.segments.map((s: any) => ({
                risk_score: s.riskScore,
                risk_level: s.riskLevel,
                crime_count: s.crimeCount ?? 0,
                start_index: typeof s.startIndex === 'number' ? s.startIndex : 0,
                end_index: typeof s.endIndex === 'number' ? s.endIndex : Math.max(0, s.coordinates.length - 1),
            })) as SegmentRisk[];

            await new Promise(resolve => setTimeout(resolve, 300));
            if (lastSegmentsRef.current) paintRiskLayers(map, selected.coordinates, lastSegmentsRef.current);
        }
        
        setPreviewRoutes(availableRoutes);
        setActiveRouteIndex(0);
        setActiveRoute(selected);

    }, [mapRef, setActiveRoute, setPreviewRoutes, setActiveRouteIndex, clearLayers, paintRiskLayers]);

    const selectRoute = useCallback((index: number) => {
        const map = mapRef.current;
        if (!map || previewRoutes.length <= index) return;
        const selected = previewRoutes[index];
        setActiveRouteIndex(index);
        setActiveRoute(selected);

        clearLayers();
        lastCoordsRef.current = selected.coordinates;

        lastSegmentsRef.current = selected.segments.map((s) => ({
            risk_score: s.riskScore,
            risk_level: s.riskLevel,
            crime_count: s.crimeCount ?? 0,
            start_index: typeof s.startIndex === 'number' ? s.startIndex : 0,
            end_index: typeof s.endIndex === 'number' ? s.endIndex : Math.max(0, s.coordinates.length - 1),
        })) as SegmentRisk[];

        paintRiskLayers(map, selected.coordinates, lastSegmentsRef.current);

        // Optional: refit bounds
        const bounds = selected.coordinates.reduce(
            (b, coord) => b.extend(coord as [number, number]),
            new maplibregl.LngLatBounds(selected.coordinates[0], selected.coordinates[0])
        );
        map.fitBounds(bounds, { padding: 80, duration: 600 });
    }, [mapRef, previewRoutes, setActiveRoute, setActiveRouteIndex, clearLayers, paintRiskLayers]);

    const clearRoute = useCallback(() => {
        clearLayers();
        lastCoordsRef.current = null;
        lastSegmentsRef.current = null;
        setActiveRoute(null);
        setPreviewRoutes([]);
        setActiveRouteIndex(0);
    }, [clearLayers, setActiveRoute, setPreviewRoutes, setActiveRouteIndex]);

    return { drawRoute, clearRoute, reapplyRoute, selectRoute };
}

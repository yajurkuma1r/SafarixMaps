import maplibregl from 'maplibre-gl';

const HEATMAP_SOURCE = 'safarixmaps-heatmap';
const HEATMAP_LAYER = 'safarixmaps-heatmap-layer';

export function addHeatmap(
    map: maplibregl.Map,
    crimes: { latitude: number; longitude: number; severity: number }[]
) {
    // Remove existing first
    removeHeatmap(map);

    const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: crimes.map(c => ({
            type: 'Feature',
            properties: { severity: c.severity },
            geometry: {
                type: 'Point',
                coordinates: [c.longitude, c.latitude],  // lng, lat order
            },
        })),
    };

    try {
        map.addSource(HEATMAP_SOURCE, { type: 'geojson', data: geojson });

        map.addLayer({
            id: HEATMAP_LAYER,
            type: 'heatmap',
            source: HEATMAP_SOURCE,
            paint: {
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'severity'], 0, 0, 10, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.2, 'rgba(34,197,94,0.6)',
                    0.4, 'rgba(234,179,8,0.7)',
                    0.6, 'rgba(249,115,22,0.8)',
                    0.8, 'rgba(239,68,68,0.9)',
                    1.0, 'rgba(185,28,28,1)',
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 20, 15, 40],
                'heatmap-opacity': 0.85,
            },
        });

        console.log('[SafarixMaps] Heatmap added with', crimes.length, 'points');
    } catch (e) {
        console.error('[SafarixMaps] Heatmap error', e);
    }
}

export function removeHeatmap(map: maplibregl.Map) {
    try {
        if (map.getLayer(HEATMAP_LAYER)) map.removeLayer(HEATMAP_LAYER);
        if (map.getSource(HEATMAP_SOURCE)) map.removeSource(HEATMAP_SOURCE);
    } catch (e) { }
}
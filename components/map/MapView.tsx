'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initMap, DEFAULT_CENTER, DEFAULT_ZOOM, DARK_MAP_STYLE } from '@/lib/map';
import { UserMarker } from './MapMarker';
import { useGPS } from '@/hooks/useGPS';
import { useRoute } from '@/hooks/useRoute';
import { useRerouting } from '@/hooks/useRerouting';
import SearchBar from '@/components/UI/SearchBar';
import NavigationHUD from '@/components/UI/NavigationHUD';
import RoutePreview from '@/components/UI/RoutePreview';
import InfoOverlay from '@/components/UI/InfoOverlay';
import { Coordinates } from '@/types';
import { useMapStore } from '@/store/useMapStore';
import { addHeatmap, removeHeatmap } from '@/lib/heatmap';

initMap();

type AppState = 'idle' | 'preview' | 'navigating';

async function fetchCrimePoints() {
    try {
        const res = await fetch('http://localhost:8000/api/risk/crimes');
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

function createLocateControl(onLocate: () => void): maplibregl.IControl {
    return {
        onAdd() {
            const container = document.createElement('div');
            container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

            const button = document.createElement('button');
            button.className = 'maplibregl-ctrl-icon';
            button.type = 'button';
            button.title = 'Center on my location';
            button.textContent = '⌖';
            button.style.fontWeight = 'bold';
            button.style.fontSize = '18px';
            button.style.color = '#333';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.onclick = onLocate;

            container.appendChild(button);
            return container;
        },
        onRemove() {},
    };
}

function createZoomControl(mapRef: React.RefObject<maplibregl.Map | null>): maplibregl.IControl {
    return {
        onAdd() {
            const container = document.createElement('div');
            container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

            const createButton = (label: string, title: string, onClick: () => void) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.title = title;
                button.textContent = label;
                button.style.fontWeight = '700';
                button.style.fontSize = '20px';
                button.style.color = '#0f172a';
                button.style.display = 'flex';
                button.style.alignItems = 'center';
                button.style.justifyContent = 'center';
                button.onclick = onClick;
                return button;
            };

            container.appendChild(createButton('+', 'Zoom in', () => {
                mapRef.current?.easeTo({
                    zoom: Math.min((mapRef.current?.getZoom() ?? DEFAULT_ZOOM) + 1, 20),
                    duration: 250,
                });
            }));

            container.appendChild(createButton('−', 'Zoom out', () => {
                mapRef.current?.easeTo({
                    zoom: Math.max((mapRef.current?.getZoom() ?? DEFAULT_ZOOM) - 1, 2),
                    duration: 250,
                });
            }));

            return container;
        },
        onRemove() {},
    };
}

export default function MapView() {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const userMarkerRef = useRef<UserMarker | null>(null);
    const mapLoadedRef = useRef(false);
    const [appState, setAppState] = useState<AppState>('idle');
    const [overlayType, setOverlayType] = useState<'about' | 'how-to' | null>(null);
    const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
    const appStateRef = useRef<AppState>('idle');
    const reapplyRef = useRef<(() => void) | null>(null);

    useEffect(() => { appStateRef.current = appState; }, [appState]);

    const {
        setIsNavigating,
        isRerouting,
        setIsRerouting,
        activeRoute,
        setActiveRoute,
        previewRoutes,
        activeRouteIndex,
        showHeatmap,
        setCurrentStepIndex,
        gps,
        showRiskColors,
        setShowRiskColors,
    } = useMapStore();

    const { drawRoute, clearRoute, reapplyRoute, selectRoute } = useRoute(mapRef);

    useEffect(() => { reapplyRef.current = reapplyRoute; }, [reapplyRoute]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const handleStyleLoad = () => {
            setTimeout(() => {
                if (lastPositionRef.current) {
                    try { userMarkerRef.current?.remove(); } catch (e) { }
                    userMarkerRef.current = new UserMarker(
                        map,
                        lastPositionRef.current.lng,
                        lastPositionRef.current.lat
                    );
                }
                reapplyRef.current?.();
            }, 400);

            // Inject 3D Buildings Layer for a true luxury feel
            try {
                const layers = map.getStyle().layers;
                let labelLayerId;
                for (let i = 0; i < layers.length; i++) {
                    if (layers[i].type === 'symbol' && (layers[i].layout as any)?.['text-field']) {
                        labelLayerId = layers[i].id;
                        break;
                    }
                }
                
                map.addLayer({
                    'id': '3d-buildings',
                    'source': 'maptiler_planet',
                    'source-layer': 'building',
                    'type': 'fill-extrusion',
                    'minzoom': 13,
                    'paint': {
                        'fill-extrusion-color': '#1e293b',
                        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['*', ['get', 'render_height'], 1.2]],
                        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'render_min_height']],
                        'fill-extrusion-opacity': 0.95,
                    }
                }, labelLayerId);
            } catch (e) {
                console.warn('[SafarixMaps] 3D buildings could not be loaded', e);
            }
        };
        map.on('style.load', handleStyleLoad);
        return () => { map.off('style.load', handleStyleLoad); };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoadedRef.current) return;
        if (showHeatmap) {
            fetchCrimePoints().then(crimes => {
                if (crimes.length > 0) addHeatmap(map, crimes);
            });
        } else {
            removeHeatmap(map);
        }
    }, [showHeatmap]);

    useEffect(() => {
        if (appStateRef.current !== 'navigating') return;
        if (!gps.currentPosition || !mapRef.current) return;
        try {
            mapRef.current.easeTo({
                center: [gps.currentPosition.lng, gps.currentPosition.lat],
                zoom: 17,
                duration: 1000,
                pitch: 60,
                bearing: gps.heading ?? 0,
            });
        } catch (e) { }
    }, [gps.currentPosition, gps.heading]);

    const handlePositionUpdate = useCallback((lat: number, lng: number) => {
        if (!mapRef.current) return;
        lastPositionRef.current = { lat, lng };
        if (!userMarkerRef.current) {
            userMarkerRef.current = new UserMarker(mapRef.current, lng, lat);
        } else {
            userMarkerRef.current.updatePosition(lng, lat, false);
        }
    }, []);

    const handleCenterOnUser = useCallback(() => {
        const position = lastPositionRef.current ?? gps.currentPosition;
        if (!position || !mapRef.current) return;

        try {
            mapRef.current.easeTo({
                center: [position.lng, position.lat],
                zoom: Math.max(mapRef.current.getZoom(), 16),
                duration: 900,
                pitch: appStateRef.current === 'navigating' ? 60 : mapRef.current.getPitch(),
                bearing: appStateRef.current === 'navigating' ? (gps.heading ?? 0) : mapRef.current.getBearing(),
            });
        } catch (e) { }
    }, [gps.currentPosition, gps.heading]);

    const { startTracking } = useGPS({ onPositionUpdate: handlePositionUpdate });

    const handleRouteRequest = useCallback(async (
        origin: Coordinates,
        destination: Coordinates
    ) => {
        if (!mapLoadedRef.current) return;
        await drawRoute(origin, destination);
        setAppState('preview');
    }, [drawRoute]);

    const handleStartNavigation = useCallback(() => {
        setIsNavigating(true);
        setCurrentStepIndex(0);
        setAppState('navigating');
        const pos = lastPositionRef.current;
        if (pos && mapRef.current) {
            try {
                mapRef.current.easeTo({
                    center: [pos.lng, pos.lat],
                    zoom: 16,
                    pitch: 60,
                    duration: 1500,
                    bearing: gps.heading ?? 0,
                });
            } catch (e) { }
        }
    }, [setIsNavigating, setCurrentStepIndex, gps.heading]);

    const handleStopNavigation = useCallback(() => {
        setIsNavigating(false);
        clearRoute();
        setActiveRoute(null);
        setCurrentStepIndex(0);
        setAppState('idle');
        try {
            mapRef.current?.easeTo({ pitch: 0, zoom: DEFAULT_ZOOM, duration: 1000 });
        } catch (e) { }
    }, [setIsNavigating, clearRoute, setActiveRoute, setCurrentStepIndex]);

    const handleClearRoute = useCallback(() => {
        clearRoute();
        setActiveRoute(null);
        setAppState('idle');
    }, [clearRoute, setActiveRoute]);

    const handleReroute = useCallback(async (
        origin: Coordinates,
        destination: Coordinates
    ) => {
        setIsRerouting(true);
        await drawRoute(origin, destination);
        setIsRerouting(false);
    }, [drawRoute, setIsRerouting]);

    // Accept safer route suggestion
    const handleAcceptSaferRoute = useCallback(async (
        coordinates: [number, number][]
    ) => {
        console.log('[SafarixMaps] Switching to safer route...');
        const pos = lastPositionRef.current;
        const dest = useMapStore.getState().destination;
        if (!pos || !dest) return;
        await drawRoute({ lat: pos.lat, lng: pos.lng }, dest);
    }, [drawRoute]);

    useRerouting({ onReroute: handleReroute });

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;
        mapRef.current = new maplibregl.Map({
            container: mapContainerRef.current,
            style: DARK_MAP_STYLE as any,
            center: DEFAULT_CENTER,
            zoom: 15.5,
            pitch: 62,
            bearing: -20,
            maxPitch: 85,
        });
        mapRef.current.on('load', () => {
            console.log('[SafarixMaps] Map loaded');
            // Native MapLibre Custom Control for 2D/3D Toggle
            class PitchToggleControl {
                _map: maplibregl.Map | undefined;
                _container: HTMLDivElement | undefined;
                _btn: HTMLButtonElement | undefined;

                onAdd(map: maplibregl.Map) {
                    this._map = map;
                    this._container = document.createElement('div');
                    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
                    
                    this._btn = document.createElement('button');
                    this._btn.className = 'maplibregl-ctrl-icon';
                    this._btn.type = 'button';
                    // The icon text shows what mode we will switch *TO*
                    this._btn.textContent = '2D';
                    this._btn.style.fontWeight = 'bold';
                    this._btn.style.fontSize = '12px';
                    this._btn.style.color = '#333';
                    this._btn.style.display = 'flex';
                    this._btn.style.alignItems = 'center';
                    this._btn.style.justifyContent = 'center';
                    
                    this._btn.onclick = () => {
                        if (!this._map) return;
                        const isCurrently2D = this._map.getPitch() === 0;
                        if (isCurrently2D) {
                            this._map.easeTo({ pitch: 62, bearing: -20, duration: 1000 });
                            this._btn!.textContent = '2D'; // Will switch to 2D
                        } else {
                            this._map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
                            this._btn!.textContent = '3D'; // Will switch to 3D
                        }
                    };
                    
                    this._container.appendChild(this._btn);
                    return this._container;
                }

                onRemove() {
                    if (this._container && this._container.parentNode) {
                        this._container.parentNode.removeChild(this._container);
                    }
                    this._map = undefined;
                }
            }

            mapRef.current!.addControl(createZoomControl(mapRef), 'bottom-right');

            mapRef.current!.addControl(createLocateControl(handleCenterOnUser), 'bottom-right');

            mapRef.current!.addControl(new PitchToggleControl() as maplibregl.IControl, 'bottom-right');

            mapLoadedRef.current = true;
            startTracking();
        });
        return () => {
            userMarkerRef.current?.remove();
            mapRef.current?.remove();
            mapRef.current = null;
            mapLoadedRef.current = false;
        };
    }, [startTracking]);

    return (
        <div className="relative w-full h-screen">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

            {appState !== 'navigating' && (
                <SearchBar onRouteRequest={handleRouteRequest} />
            )}

            {/* Risk Overview Toggle */}
            <button
                onClick={() => setShowRiskColors(!showRiskColors)}
                style={{
                    position: 'absolute',
                    top: 'max(12px, env(safe-area-inset-top))',
                    right: '12px',
                    zIndex: 99999,
                    backgroundColor: showRiskColors ? '#1d4ed8' : '#0f172a',
                    border: showRiskColors ? '1px solid #3b82f6' : '1px solid #1e293b',
                    color: 'white',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    maxWidth: 'calc(100vw - 24px)',
                }}
            >
                {showRiskColors ? '🟢 Risk View: ON' : '🔴 Risk View: OFF'}
            </button>

            {appState === 'preview' && activeRoute && (
                <RoutePreview
                    distance={activeRoute.totalDistance}
                    duration={activeRoute.totalDuration}
                    risk={activeRoute.overallRisk}
                    crimes={activeRoute.totalCrimes ?? 0}
                    incidentBreakdown={activeRoute.incidentBreakdown}
                    previewRoutes={previewRoutes}
                    activeRouteIndex={activeRouteIndex}
                    onSelectRoute={selectRoute}
                    onStart={handleStartNavigation}
                    onClear={handleClearRoute}
                />
            )}

            {appState === 'navigating' && (
                <NavigationHUD
                    onStop={handleStopNavigation}
                    onAcceptSaferRoute={handleAcceptSaferRoute}
                />
            )}

            {isRerouting && (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(10,15,30,0.97)',
                    border: '1px solid #3b82f6',
                    borderRadius: '14px',
                    padding: '16px 32px',
                    color: '#60a5fa',
                    fontSize: '14px',
                    fontWeight: 600,
                    zIndex: 9999,
                }}>
                    🔄 Recalculating safer route...
                </div>
            )}

            {/* Big Logo in Top Left Corner */}
            <img 
                src="/logo.png" 
                alt="SafarixMaps" 
                style={{
                    position: 'absolute',
                    top: 'max(8px, env(safe-area-inset-top))',
                    left: 'max(8px, env(safe-area-inset-left))',
                    width: 'clamp(160px, 28vw, 220px)',
                    height: 'auto',
                    objectFit: 'contain',
                    zIndex: 100001,
                    filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.6))',
                    pointerEvents: 'none'
                }}
            />

            {/* Info Buttons */}
            {appState !== 'navigating' && (
                <div style={{
                    position: 'absolute',
                    bottom: 'max(72px, calc(env(safe-area-inset-bottom) + 20px))',
                    left: '12px',
                    right: '12px',
                    zIndex: 9000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '12px',
                }}>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                    }}>
                        <div
                            style={{
                                width: '100%',
                                color: '#f8fafc',
                                fontSize: '13px',
                                fontWeight: 800,
                                lineHeight: 1.2,
                                textShadow: '0 0 10px rgba(15,23,42,0.95), 0 2px 8px rgba(0,0,0,0.85)',
                                marginBottom: '2px',
                            }}
                        >
                            📍 Optimized for Delhi NCR
                        </div>
                        <button
                            onClick={() => setOverlayType('about')}
                            style={{
                                backgroundColor: 'rgba(15,23,42,0.9)',
                                border: '1px solid #1e3a5f',
                                color: '#e2e8f0',
                                padding: '10px 16px',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: 600,
                                minHeight: '44px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                transition: 'all 0.2s',
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(15,23,42,0.9)'; e.currentTarget.style.color = '#e2e8f0'; }}
                        >
                            About Us
                        </button>
                        <button
                            onClick={() => setOverlayType('how-to')}
                            style={{
                                backgroundColor: 'rgba(15,23,42,0.9)',
                                border: '1px solid #1e3a5f',
                                color: '#e2e8f0',
                                padding: '10px 16px',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: 600,
                                minHeight: '44px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                transition: 'all 0.2s',
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(15,23,42,0.9)'; e.currentTarget.style.color = '#e2e8f0'; }}
                        >
                            How to Use
                        </button>
                    </div>
                </div>
            )}

            {/* Info Overlay Portal */}
            {overlayType && (
                <InfoOverlay type={overlayType} onClose={() => setOverlayType(null)} />
            )}
        </div>
    );
}

import { useEffect, useRef, useCallback } from 'react';
import { useMapStore } from '@/store/useMapStore';

interface UseGPSOptions {
    onPositionUpdate?: (lat: number, lng: number) => void;
}

export function useGPS({ onPositionUpdate }: UseGPSOptions = {}) {
    const { setGPS } = useMapStore();
    const watchIdRef = useRef<number | null>(null);

    const startTracking = useCallback(() => {
        if (!navigator.geolocation) {
            console.error('[SafarixMaps] Geolocation not supported');
            return;
        }

        setGPS({ isTracking: true });

        // First — get a quick approximate position
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy, heading, speed } = position.coords;
                setGPS({
                    currentPosition: { lat: latitude, lng: longitude },
                    accuracy,
                    heading,
                    speed,
                    isTracking: true,
                });
                onPositionUpdate?.(latitude, longitude);
            },
            (err) => console.warn('[SafarixMaps] Initial position failed:', err.message),
            {
                enableHighAccuracy: false,  // fast approximate fix first
                timeout: 10000,
                maximumAge: 60000,
            }
        );

        // Then — watch for precise updates
        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, heading, speed } = position.coords;
                setGPS({
                    currentPosition: { lat: latitude, lng: longitude },
                    accuracy,
                    heading,
                    speed,
                    isTracking: true,
                });
                onPositionUpdate?.(latitude, longitude);
            },
            (error) => {
                console.warn('[SafarixMaps GPS]', error.message);
                // Don't set isTracking false on timeout — keep trying
                if (error.code !== error.TIMEOUT) {
                    setGPS({ isTracking: false });
                }
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 30000,   // increased from 10s to 30s
            }
        );
    }, [setGPS, onPositionUpdate]);

    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setGPS({ isTracking: false });
    }, [setGPS]);

    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    return { startTracking, stopTracking };
}
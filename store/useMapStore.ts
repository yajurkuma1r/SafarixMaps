import { create } from 'zustand';
import { Coordinates, Route, GPSState } from '@/types';

interface MapStore {
    gps: GPSState;
    setGPS: (gps: Partial<GPSState>) => void;
    destination: Coordinates | null;
    setDestination: (dest: Coordinates | null) => void;
    activeRoute: Route | null;
    setActiveRoute: (route: Route | null) => void;
    previewRoutes: Route[];
    setPreviewRoutes: (routes: Route[]) => void;
    activeRouteIndex: number;
    setActiveRouteIndex: (idx: number) => void;
    isNavigating: boolean;
    setIsNavigating: (val: boolean) => void;
    originLabel: string;
    destinationLabel: string;
    setOriginLabel: (label: string) => void;
    setDestinationLabel: (label: string) => void;
    isRerouting: boolean;
    setIsRerouting: (val: boolean) => void;
    showHeatmap: boolean;
    setShowHeatmap: (val: boolean) => void;
    showRiskColors: boolean;
    setShowRiskColors: (val: boolean) => void;
    currentStepIndex: number;
    setCurrentStepIndex: (idx: number) => void;
}

const initialGPS: GPSState = {
    currentPosition: null,
    accuracy: null,
    heading: null,
    speed: null,
    isTracking: false,
};

export const useMapStore = create<MapStore>((set) => ({
    gps: initialGPS,
    setGPS: (partial) =>
        set((state) => ({ gps: { ...state.gps, ...partial } })),
    destination: null,
    setDestination: (dest) => set({ destination: dest }),
    activeRoute: null,
    setActiveRoute: (route) => set({ activeRoute: route }),
    previewRoutes: [],
    setPreviewRoutes: (routes) => set({ previewRoutes: routes }),
    activeRouteIndex: 0,
    setActiveRouteIndex: (idx) => set({ activeRouteIndex: idx }),
    isNavigating: false,
    setIsNavigating: (val) => set({ isNavigating: val }),
    originLabel: '',
    destinationLabel: '',
    setOriginLabel: (label) => set({ originLabel: label }),
    setDestinationLabel: (label) => set({ destinationLabel: label }),
    isRerouting: false,
    setIsRerouting: (val) => set({ isRerouting: val }),
    showHeatmap: false,
    setShowHeatmap: (val) => set({ showHeatmap: val }),
    showRiskColors: true,
    setShowRiskColors: (val) => set({ showRiskColors: val }),
    currentStepIndex: 0,
    setCurrentStepIndex: (idx) => set({ currentStepIndex: idx }),
}));

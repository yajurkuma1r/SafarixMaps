import maplibregl from 'maplibre-gl';

export class UserMarker {
    private marker: maplibregl.Marker;
    private map: maplibregl.Map;

    constructor(map: maplibregl.Map, initialLng: number, initialLat: number) {
        this.map = map;
        const el = this.createMarkerElement();
        this.marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([initialLng, initialLat])
            .addTo(map);
    }

    private createMarkerElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'user-marker-container';
        container.innerHTML = `
      <div class="user-marker-pulse"></div>
      <div class="user-marker-dot"></div>
    `;
        return container;
    }

    updatePosition(lng: number, lat: number, followCamera: boolean = false) {
        try {
            this.marker.setLngLat([lng, lat]);
            if (followCamera && this.map && this.map.loaded() && this.map.isStyleLoaded()) {
                this.map.easeTo({
                    center: [lng, lat],
                    duration: 800,
                    easing: (t) => t,
                });
            }
        } catch (e) {
            // map not ready
        }
    }

    addTo(map: maplibregl.Map) {
        this.marker.addTo(map);
    }

    remove() {
        try {
            this.marker.remove();
        } catch (e) { }
    }
}
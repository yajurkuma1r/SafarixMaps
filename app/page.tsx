'use client';

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-900">
      <p className="text-white text-lg">Loading SafarixMaps...</p>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="w-full h-screen bg-gray-900 relative">
      <MapView />
    </main>
  );
}
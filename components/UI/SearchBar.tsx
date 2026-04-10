'use client';

import { useState } from 'react';
import { useMapStore } from '@/store/useMapStore';

import { TOMTOM_KEY } from '@/lib/map';

async function geocode(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
    const res = await fetch(
        `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}&limit=1&lat=28.6139&lon=77.2090&radius=50000`
    );
    const data = await res.json();
    if (!data.results?.length) {
        const res2 = await fetch(
            `https://api.tomtom.com/search/2/search/${encodeURIComponent(query + ' Delhi India')}.json?key=${TOMTOM_KEY}&limit=1`
        );
        const data2 = await res2.json();
        if (!data2.results?.length) return null;
        const pos = data2.results[0].position;
        return { lat: pos.lat, lng: pos.lon, label: data2.results[0].address?.freeformAddress || data2.results[0].poi?.name || query };
    }
    const pos = data.results[0].position;
    return { lat: pos.lat, lng: pos.lon, label: data.results[0].address?.freeformAddress || data.results[0].poi?.name || query };
}

interface SearchBarProps {
    onRouteRequest: (
        origin: { lat: number; lng: number },
        destination: { lat: number; lng: number }
    ) => void;
}

export default function SearchBar({ onRouteRequest }: SearchBarProps) {
    const { gps, setDestination, setOriginLabel, setDestinationLabel, showHeatmap, setShowHeatmap } = useMapStore();
    const [expanded, setExpanded] = useState(false);
    const [destInput, setDestInput] = useState('');
    const [originInput, setOriginInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [listeningTo, setListeningTo] = useState<'origin' | 'dest' | null>(null);

    const startListening = (target: 'origin' | 'dest') => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice recognition not supported in this browser.');
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.start();
        setListeningTo(target);

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (target === 'origin') setOriginInput(transcript);
            else setDestInput(transcript);
            setListeningTo(null);
        };

        recognition.onerror = () => setListeningTo(null);
        recognition.onend = () => setListeningTo(null);
    };

    const handleGo = async () => {
        setError('');
        setLoading(true);
        try {
            let origin: { lat: number; lng: number } | null = null;
            if (!originInput.trim()) {
                if (gps.currentPosition) {
                    origin = gps.currentPosition;
                    setOriginLabel('Current Location');
                } else {
                    setError('GPS not available — enter origin manually');
                    setLoading(false);
                    return;
                }
            } else {
                const result = await geocode(originInput);
                if (!result) { setError('Origin not found'); setLoading(false); return; }
                origin = result;
                setOriginLabel(result.label);
            }

            const dest = await geocode(destInput);
            if (!dest) { setError('Destination not found'); setLoading(false); return; }

            setDestination({ lat: dest.lat, lng: dest.lng });
            setDestinationLabel(dest.label);
            onRouteRequest(origin, dest);
            setExpanded(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '12px',
            right: '12px',
            transform: 'translateY(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '10px',
            pointerEvents: 'none',
        }}>
            {/* Search button + panel */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', width: '100%', pointerEvents: 'auto' }}>
                {/* Search button */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <button
                        onClick={() => setExpanded(!expanded)}
                        title="Search"
                        style={{
                            width: '50px',
                            height: '64px',
                            border: 'none',
                            background: 'transparent',
                            color: expanded ? '#60a5fa' : '#2563eb',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s',
                            flexShrink: 0,
                            position: 'relative',
                            padding: 0,
                        }}
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                position: 'relative',
                                width: '50px',
                                height: '64px',
                                display: 'block',
                            }}
                        >
                            <span
                                style={{
                                    position: 'absolute',
                                    top: '0',
                                    left: '50%',
                                    width: '30px',
                                    height: '30px',
                                    transform: 'translateX(-50%)',
                                    borderRadius: '50%',
                                    background: '#0f172a',
                                    border: '2px solid #2563eb',
                                }}
                            />
                            <span
                                style={{
                                    position: 'absolute',
                                    top: '19px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: 0,
                                    height: 0,
                                    borderLeft: '10px solid transparent',
                                    borderRight: '10px solid transparent',
                                    borderTop: '26px solid #0f172a',
                                }}
                            />
                            <span
                                style={{
                                    position: 'absolute',
                                    top: '9px',
                                    left: '50%',
                                    width: '10px',
                                    height: '10px',
                                    transform: 'translateX(-50%)',
                                    borderRadius: '50%',
                                    backgroundColor: '#60a5fa',
                                    border: '1.5px solid #93c5fd',
                                }}
                            />
                        </span>
                    </button>
                </div>

                {/* Expanded panel */}
                {expanded && (
                    <div style={{
                        backgroundColor: 'rgba(10,15,30,0.97)',
                        border: '1px solid #1e3a5f',
                        borderRadius: '16px',
                        padding: '16px',
                        width: 'min(340px, calc(100vw - 24px))',
                        maxWidth: '100%',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
                        animation: 'slideIn 0.2s ease',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <img 
                                    src="/logo.png" 
                                    alt="SafarixMaps Logo" 
                                    style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                                <p style={{
                                    color: '#60a5fa',
                                    fontSize: '15px',
                                    fontWeight: 800,
                                    letterSpacing: '1px',
                                    margin: 0,
                                }}>
                                    SafarixMaps
                                </p>
                            </div>
                            <button
                                onClick={() => setShowHeatmap(!showHeatmap)}
                                title="Toggle Heatmap"
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: '16px', filter: showHeatmap ? 'drop-shadow(0 0 4px #ef4444)' : 'grayscale(100%)',
                                    transition: 'all 0.2s', padding: 0
                                }}
                            >
                                🔥
                            </button>
                        </div>

                        {/* Origin */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                backgroundColor: '#3b82f6', boxShadow: '0 0 6px #3b82f6', flexShrink: 0,
                            }} />
                            <div style={{ position: 'relative', width: '100%' }}>
                                <input
                                    type="text"
                                    placeholder="From: Current Location"
                                    value={originInput}
                                    onChange={(e) => setOriginInput(e.target.value)}
                                    style={{
                                        boxSizing: 'border-box',
                                        width: '100%', backgroundColor: '#0f172a', color: 'white',
                                        fontSize: '13px', borderRadius: '8px', padding: '9px 36px 9px 12px',
                                        outline: 'none', border: '1px solid #1e3a5f',
                                    }}
                                />
                                <button
                                    onClick={() => startListening('origin')}
                                    title="Voice Input"
                                    style={{
                                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px',
                                        filter: listeningTo === 'origin' ? 'drop-shadow(0 0 4px #ef4444)' : 'none',
                                    }}
                                >
                                    {listeningTo === 'origin' ? '🎙️' : '🎤'}
                                </button>
                            </div>
                        </div>

                        {/* Destination */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                backgroundColor: '#ef4444', boxShadow: '0 0 6px #ef4444', flexShrink: 0,
                            }} />
                            <div style={{ position: 'relative', width: '100%' }}>
                                <input
                                    type="text"
                                    placeholder="To: Enter destination"
                                    value={destInput}
                                    onChange={(e) => setDestInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGo()}
                                    style={{
                                        boxSizing: 'border-box',
                                        width: '100%', backgroundColor: '#0f172a', color: 'white',
                                        fontSize: '13px', borderRadius: '8px', padding: '9px 36px 9px 12px',
                                        outline: 'none', border: '1px solid #1e3a5f',
                                    }}
                                />
                                <button
                                    onClick={() => startListening('dest')}
                                    title="Voice Input"
                                    style={{
                                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px',
                                        filter: listeningTo === 'dest' ? 'drop-shadow(0 0 4px #ef4444)' : 'none',
                                    }}
                                >
                                    {listeningTo === 'dest' ? '🎙️' : '🎤'}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '10px' }}>
                                ⚠ {error}
                            </p>
                        )}

                        <button
                            onClick={handleGo}
                            disabled={loading || !destInput.trim()}
                            style={{
                                width: '100%',
                                backgroundColor: loading || !destInput.trim() ? '#0f172a' : '#1d4ed8',
                                color: loading || !destInput.trim() ? '#334155' : 'white',
                                fontSize: '13px', fontWeight: 700, padding: '11px',
                                borderRadius: '10px', border: '1px solid',
                                borderColor: loading || !destInput.trim() ? '#1e293b' : '#3b82f6',
                                cursor: loading || !destInput.trim() ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {loading ? '🔍 Analyzing safety...' : 'Get Safe Route →'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

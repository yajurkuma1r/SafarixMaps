'use client';

import { useState } from 'react';

interface RoutePreviewProps {
    distance: number;
    duration: number;
    risk: number;
    crimes: number;
    incidentBreakdown?: Record<string, number>;
    previewRoutes?: any[];
    activeRouteIndex?: number;
    onSelectRoute?: (index: number) => void;
    onStart: () => void;
    onClear: () => void;
}

function formatDistance(meters: number): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
    const mins = Math.round(seconds / 60);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins} min`;
}

export default function RoutePreview({
    distance, duration, risk, crimes, incidentBreakdown = {}, 
    previewRoutes = [], activeRouteIndex = 0, onSelectRoute,
    onStart, onClear
}: RoutePreviewProps) {
    const [showInfo, setShowInfo] = useState(false);

    const getRisk = () => {
        if (risk < 0.33) return { label: 'LOW RISK', color: '#22c55e' };
        if (risk < 0.66) return { label: 'MEDIUM RISK', color: '#f59e0b' };
        return { label: 'HIGH RISK', color: '#ef4444' };
    };

    const { label, color } = getRisk();

    return (
        <>
            <div style={{
                position: 'fixed',
                bottom: 'max(16px, env(safe-area-inset-bottom))',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9998,
                width: 'min(460px, calc(100vw - 20px))',
                maxWidth: '460px',
                backgroundColor: 'rgba(10,15,30,0.97)',
                border: '1px solid #1e3a5f',
                borderRadius: '16px',
                padding: '14px 16px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}>
                {/* Route Tabs */}
                {previewRoutes.length > 1 && (
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                        paddingBottom: '14px',
                        marginBottom: '14px',
                        borderBottom: '1px solid #1e293b',
                    }}>
                        {previewRoutes.map((rt, idx) => (
                            <button
                                key={idx}
                                onClick={() => onSelectRoute?.(idx)}
                                style={{
                                    flex: '1 1 120px',
                                    padding: '8px 12px',
                                    borderRadius: '20px',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    border: idx === activeRouteIndex ? '1px solid #3b82f6' : '1px solid #334155',
                                    backgroundColor: idx === activeRouteIndex ? '#1d4ed8' : '#0f172a',
                                    color: idx === activeRouteIndex ? 'white' : '#94a3b8',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textAlign: 'center',
                                }}
                            >
                                {rt.specialty}
                            </button>
                        ))}
                    </div>
                )}

                {/* Route stats */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginBottom: '14px',
                    paddingBottom: '14px',
                    borderBottom: '1px solid #1e293b',
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'white', fontSize: '20px', fontWeight: 800 }}>
                            {formatDuration(duration)}
                        </p>
                        <p style={{ color: '#64748b', fontSize: '11px' }}>ETA</p>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'white', fontSize: '20px', fontWeight: 800 }}>
                            {formatDistance(distance)}
                        </p>
                        <p style={{ color: '#64748b', fontSize: '11px' }}>Distance</p>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color, fontSize: '20px', fontWeight: 800 }}>
                            {Math.round(risk * 100)}%
                        </p>
                        <p style={{ color: '#64748b', fontSize: '11px' }}>Risk</p>
                    </div>
                </div>

                {/* Risk label */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '14px',
                }}>
                    <div style={{
                        width: '8px', height: '8px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        boxShadow: `0 0 6px ${color}`,
                    }} />
                    <span style={{ color, fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>
                        {label}
                    </span>
                    {crimes > 0 && (
                        <span style={{ color: '#475569', fontSize: '12px' }}>
                            · {crimes} incidents along route
                        </span>
                    )}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={onClear}
                        style={{
                            flex: '1 1 120px',
                            backgroundColor: '#0f172a',
                            color: '#94a3b8',
                            border: '1px solid #1e293b',
                            borderRadius: '10px',
                            padding: '12px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => setShowInfo(true)}
                        style={{
                            flex: '1 1 140px',
                            backgroundColor: '#1e293b',
                            color: 'white',
                            border: '1px solid #334155',
                            borderRadius: '10px',
                            padding: '12px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        ℹ️ More Info
                    </button>
                    <button
                        onClick={onStart}
                        style={{
                            flex: '2 1 180px',
                            backgroundColor: '#1d4ed8',
                            color: 'white',
                            border: '1px solid #3b82f6',
                            borderRadius: '10px',
                            padding: '12px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 0 20px #3b82f633',
                        }}
                    >
                        🚀 Start Navigation
                    </button>
                </div>
            </div>

            {/* More Info Modal */}
            {showInfo && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        width: '90%',
                        maxWidth: '400px',
                        maxHeight: 'min(80vh, 640px)',
                        overflowY: 'auto',
                        backgroundColor: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '20px',
                        padding: '24px',
                        color: 'white',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
                    }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Route Information
                            <button onClick={() => setShowInfo(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>×</button>
                        </h3>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px' }}>
                                <strong>Safety Rating:</strong> <span style={{ color }}>{label} ({Math.round(risk * 100)}%)</span>
                            </p>
                            <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px' }}>
                                <strong>Total Distance:</strong> {formatDistance(distance)}
                            </p>
                            <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px' }}>
                                <strong>Estimated Time:</strong> {formatDuration(duration)}
                            </p>
                            <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px' }}>
                                <strong>Total Incidents Nearby:</strong> {crimes}
                            </p>
                        </div>

                        {crimes > 0 && (
                            <div>
                                <h4 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incident Breakdown</h4>
                                <ul style={{ listStyle: 'none', margin: 0, backgroundColor: '#1e293b', borderRadius: '12px', padding: '12px' }}>
                                    {Object.entries(incidentBreakdown).map(([type, count]) => (
                                        <li key={type} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            padding: '8px 0',
                                            borderBottom: '1px solid #334155',
                                            fontSize: '14px',
                                        }}>
                                            <span style={{ textTransform: 'capitalize', color: '#e2e8f0' }}>
                                                {type.replace('_', ' ')}
                                            </span>
                                            <span style={{ fontWeight: 600, color: '#fbbf24' }}>{count}</span>
                                        </li>
                                    ))}
                                    {Object.keys(incidentBreakdown).length === 0 && (
                                        <li style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Details unavailable</li>
                                    )}
                                </ul>
                            </div>
                        )}
                        
                        <button
                            onClick={() => setShowInfo(false)}
                            style={{
                                width: '100%',
                                marginTop: '24px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '14px',
                                fontSize: '15px',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

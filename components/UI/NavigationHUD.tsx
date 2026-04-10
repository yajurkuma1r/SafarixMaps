'use client';

import { useEffect, useState } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useForwardScan } from '@/hooks/useForwardScan';
import { useLiveRisk } from '@/hooks/useLiveRisk';
import { useSaferRoute } from '@/hooks/useSaferRoute';
import { getDistanceMeters } from '@/lib/routing';

function formatDistance(meters: number): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
    const mins = Math.round(seconds / 60);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins} min`;
}

function getManeuverIcon(maneuver: string): string {
    switch (maneuver) {
        case 'turn-right': return '➡️';
        case 'turn-left': return '⬅️';
        case 'slight right': return '↗️';
        case 'slight left': return '↖️';
        case 'u-turn': return '🔄';
        case 'arrive': return '📍';
        case 'roundabout': return '🔁';
        default: return '⬆️';
    }
}

interface NavigationHUDProps {
    onStop: () => void;
    onAcceptSaferRoute?: (coordinates: [number, number][]) => void;
}

export default function NavigationHUD({ onStop, onAcceptSaferRoute }: NavigationHUDProps) {
    const { activeRoute, gps, currentStepIndex, setCurrentStepIndex, showHeatmap, setShowHeatmap } = useMapStore();
    const scanResult = useForwardScan();
    const { saferRoute, checkForSaferRoute, setSaferRoute } = useSaferRoute();
    const [lastSpokenIndex, setLastSpokenIndex] = useState(-1);

    // Activate live risk
    useLiveRisk();

    const speed = gps.speed ? Math.round(gps.speed * 3.6) : 0;

    // Auto advance steps
    useEffect(() => {
        if (!activeRoute?.steps?.length || !gps.currentPosition) return;
        if (currentStepIndex >= activeRoute.steps.length - 1) return;

        const stepCoordIdx = Math.min(currentStepIndex * 3, activeRoute.coordinates.length - 1);
        const [stepLng, stepLat] = activeRoute.coordinates[stepCoordIdx];
        const dist = getDistanceMeters(
            gps.currentPosition.lat, gps.currentPosition.lng, stepLat, stepLng
        );
        if (dist < 50) setCurrentStepIndex(currentStepIndex + 1);
    }, [gps.currentPosition, activeRoute, currentStepIndex, setCurrentStepIndex]);

    // Check for safer route periodically
    useEffect(() => {
        if (!activeRoute) return;
        const interval = setInterval(checkForSaferRoute, 15000);
        return () => clearInterval(interval);
    }, [activeRoute, checkForSaferRoute]);

    if (!activeRoute) return null;

    const currentStep = activeRoute.steps?.[currentStepIndex];
    const nextStep = activeRoute.steps?.[currentStepIndex + 1];
    
    // Voice Output
    useEffect(() => {
        if (!currentStep) return;
        if (currentStepIndex !== lastSpokenIndex) {
            setLastSpokenIndex(currentStepIndex);
            
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                
                // Formulate the spoken text using distance + instruction
                let textToSpeak = currentStep.instruction;
                if (currentStep.distance > 20) {
                     // Convert '1.2 km' to '1 point 2 kilometers' intuitively, formatDistance returns e.g. "500 m" or "1.2 km"
                     const distStr = formatDistance(currentStep.distance).replace('m', 'meters').replace('km', 'kilometers');
                     textToSpeak = `In ${distStr}, ${currentStep.instruction}`;
                }
                
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        }
    }, [currentStep, currentStepIndex, lastSpokenIndex]);

    // End speech when unmounting
    useEffect(() => {
        return () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const riskColor = activeRoute.overallRisk < 0.33 ? '#22c55e' :
        activeRoute.overallRisk < 0.66 ? '#f59e0b' : '#ef4444';

    return (
        <>
            {/* Top navigation card */}
            <div style={{
                position: 'fixed',
                top: 'max(12px, env(safe-area-inset-top))',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9999,
                width: 'min(460px, calc(100vw - 20px))',
                maxWidth: '460px',
                backgroundColor: 'rgba(10,15,30,0.97)',
                border: '1px solid #1e3a5f',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
            }}>
                {/* Current instruction */}
                {currentStep && (
                    <div style={{
                        backgroundColor: '#1d4ed8',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    }}>
                        <span style={{ fontSize: '28px' }}>
                            {getManeuverIcon(currentStep.maneuver)}
                        </span>
                        <div style={{ flex: 1 }}>
                            <p style={{ color: 'white', fontSize: '15px', fontWeight: 700, marginBottom: '2px' }}>
                                {currentStep.instruction}
                            </p>
                            <p style={{ color: '#93c5fd', fontSize: '12px' }}>
                                in {formatDistance(currentStep.distance)}
                            </p>
                        </div>
                    </div>
                )}

                {/* Next step */}
                {nextStep && (
                    <div style={{
                        padding: '8px 16px',
                        borderBottom: '1px solid #1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                    }}>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>Then</span>
                        <span style={{ fontSize: '16px' }}>{getManeuverIcon(nextStep.maneuver)}</span>
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{nextStep.instruction}</span>
                    </div>
                )}

                {/* ETA + risk + END */}
                <div style={{
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                }}>
                    <div>
                        <p style={{ color: 'white', fontSize: '16px', fontWeight: 800 }}>
                            {formatDuration(activeRoute.totalDuration)}
                        </p>
                        <p style={{ color: '#64748b', fontSize: '11px' }}>
                            {formatDistance(activeRoute.totalDistance)} remaining
                        </p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: riskColor, fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>
                            ROUTE RISK
                        </p>
                        <p style={{ color: riskColor, fontSize: '20px', fontWeight: 800 }}>
                            {Math.round(activeRoute.overallRisk * 100)}%
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                        <button
                            onClick={() => setShowHeatmap(!showHeatmap)}
                            title="Toggle Heatmap"
                            style={{
                                backgroundColor: showHeatmap ? '#ef4444' : 'transparent',
                                border: `1px solid ${showHeatmap ? '#ef4444' : '#1e3a5f'}`,
                                color: showHeatmap ? 'white' : '#64748b',
                                borderRadius: '10px',
                                padding: '8px 12px',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            🔥
                        </button>
                        <button onClick={onStop} style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '8px 18px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}>
                            END
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom alerts + speed */}
            <div style={{
                position: 'fixed',
                bottom: 'max(16px, env(safe-area-inset-bottom))',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9999,
                width: 'min(460px, calc(100vw - 20px))',
                maxWidth: '460px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
            }}>
                {/* Safer route suggestion */}
                {saferRoute?.available && (
                    <div style={{
                        backgroundColor: 'rgba(10,15,30,0.97)',
                        border: '1px solid #22c55e',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                        boxShadow: '0 0 20px rgba(34,197,94,0.2)',
                    }}>
                        <div>
                            <p style={{ color: '#22c55e', fontSize: '12px', fontWeight: 700 }}>
                                🛡️ Safer route available
                            </p>
                            <p style={{ color: '#64748b', fontSize: '11px' }}>
                                -{saferRoute.riskReduction}% risk
                                {saferRoute.timeDiff > 0 ? ` · +${saferRoute.timeDiff} min` : ' · same time'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                            <button
                                onClick={() => setSaferRoute(null)}
                                style={{
                                    backgroundColor: '#0f172a',
                                    color: '#64748b',
                                    border: '1px solid #1e293b',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                }}
                            >
                                Ignore
                            </button>
                            <button
                                onClick={() => {
                                    onAcceptSaferRoute?.(saferRoute.coordinates);
                                    setSaferRoute(null);
                                }}
                                style={{
                                    backgroundColor: '#166534',
                                    color: '#22c55e',
                                    border: '1px solid #22c55e',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Switch
                            </button>
                        </div>
                    </div>
                )}

                {/* Forward scan alert */}
                {scanResult?.hasRisk && (
                    <div style={{
                        backgroundColor: 'rgba(10,15,30,0.97)',
                        border: `1px solid ${scanResult.riskLevel === 'high' ? '#ef4444' : '#f59e0b'}`,
                        borderRadius: '12px',
                        padding: '10px 20px',
                        color: scanResult.riskLevel === 'high' ? '#ef4444' : '#f59e0b',
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'center',
                        boxShadow: `0 0 20px ${scanResult.riskLevel === 'high' ? '#ef444433' : '#f59e0b33'}`,
                    }}>
                        {scanResult.message}
                    </div>
                )}

                {/* Speed + risk */}
                <div style={{
                    backgroundColor: 'rgba(10,15,30,0.97)',
                    border: '1px solid #1e3a5f',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'white', fontSize: '26px', fontWeight: 800 }}>{speed}</p>
                        <p style={{ color: '#64748b', fontSize: '11px' }}>km/h</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1 1 160px' }}>
                        <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            backgroundColor: riskColor, boxShadow: `0 0 8px ${riskColor}`,
                        }} />
                        <span style={{ color: riskColor, fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>
                            {activeRoute.overallRisk < 0.33 ? 'LOW RISK' :
                                activeRoute.overallRisk < 0.66 ? 'MEDIUM RISK' : 'HIGH RISK'}
                        </span>
                        {activeRoute.totalCrimes !== undefined && activeRoute.totalCrimes > 0 && (
                            <span style={{ color: '#475569', fontSize: '11px' }}>
                                · {activeRoute.totalCrimes} incidents
                            </span>
                        )}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>
                            {formatDistance(activeRoute.totalDistance)}
                        </p>
                        <p style={{ color: '#64748b', fontSize: '11px' }}>distance</p>
                    </div>
                </div>
            </div>
        </>
    );
}

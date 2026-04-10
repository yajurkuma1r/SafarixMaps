import React from 'react';

interface InfoOverlayProps {
    type: 'about' | 'how-to';
    onClose: () => void;
}

export default function InfoOverlay({ type, onClose }: InfoOverlayProps) {
    const isAbout = type === 'about';

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 15, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.3s ease',
        }}>
            <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid #1e3a5f',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                padding: '32px',
                position: 'relative',
                animation: 'slideUp 0.4s ease',
                color: 'white',
            }}>
                <button 
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '24px',
                        right: '24px',
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#94a3b8',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                >
                    ✕
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <img 
                        src="/logo.png" 
                        alt="SafarixMaps Logo" 
                        style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                        onError={(e) => {
                            // Fallback to emoji if logo fails
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                        }}
                    />
                    <div style={{ 
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                        display: 'none', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                    }}>
                        {isAbout ? '🛡️' : '🧭'}
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '0.5px' }}>
                        {isAbout ? 'About SafarixMaps' : 'How to Use SafarixMaps'}
                    </h2>
                </div>

                <div style={{ fontSize: '15px', lineHeight: '1.7', color: '#cbd5e1' }}>
                    {isAbout ? (
                        <>
                            <p style={{ marginBottom: '16px' }}>
                                <strong>SafarixMaps</strong> is a next-generation navigation platform built with your safety as the ultimate priority. 
                            </p>
                            <p style={{ marginBottom: '16px' }}>
                                Unlike traditional GPS applications that only prioritize speed or distance, our engine actively analyzes spatial crime data, historical incidents, and real-time risks to calculate routes that physically keep you away from danger zones.
                            </p>
                            <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', borderRadius: '4px 8px 8px 4px', marginBottom: '16px', color: '#60a5fa' }}>
                                <strong>Our Mission:</strong> To empower travelers with knowledge and safety. We believe you should never have to choose between getting there quickly and getting there safely.
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <p style={{ margin: '0 0 6px 0' }}>
                                    <strong>Contact :</strong> Yajur
                                </p>
                                <p style={{ margin: 0 }}>
                                    <strong>Email:</strong> toyajurgupta@gmail.com
                                </p>
                            </div>
                            <h3 style={{ color: 'white', marginTop: '24px', marginBottom: '12px', fontSize: '18px' }}>Core Technologies</h3>
                            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <li>✨ <strong>Live Risk Scoring:</strong> Dynamic safety analysis of paths.</li>
                                <li>✨ <strong>Dual Routing:</strong> Always gives you the choice between the absolute Safest and the absolute Fastest route.</li>
                                <li>✨ <strong>Crime Heatmaps:</strong> Visual spatial awareness overlay.</li>
                            </ul>
                        </>
                    ) : (
                        <>
                            <p style={{ marginBottom: '20px' }}>
                                Navigating securely has never been simpler. Follow these standard workflows to get the most out of SafarixMaps.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px' }}>1. Finding a Safe Route</h4>
                                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Click the <strong>"S"</strong> button on the left to open the search panel. You can type your destination or use the <strong>Voice Assistant (🎙️)</strong> to speak it naturally.</p>
                                </div>

                                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px' }}>2. Comparing Options</h4>
                                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>We generate two routes unconditionally: <strong>Safest</strong> and <strong>Fastest</strong>. Click <em>"More Info"</em> on the Safest tab to see exactly why it is deemed safer and what incidents you are avoiding.</p>
                                </div>

                                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px' }}>3. The Heatmap</h4>
                                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>To visualize crime hotspots in the city, click the <strong>🔥 Fire Icon</strong> in the search panel. Red zones indicate higher historical risk areas.</p>
                                </div>

                                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px' }}>4. En Route Safety Tracking</h4>
                                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>As you navigate, your Live Risk Score is calculated. If you veer into high-danger areas, SafarixMaps will automatically attempt to reroute you to a safer alternative.</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}} />
        </div>
    );
}

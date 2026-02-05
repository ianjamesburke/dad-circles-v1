import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const CookieBanner: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookie-consent');
        if (!consent) {
            setIsVisible(true);
        }

        const checkMobile = () => setIsMobile(window.innerWidth <= 600);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleAcceptAll = () => {
        // Compact format: "a,m,t" where a=analytics, m=marketing, t=timestamp
        // Values: 1=enabled, 0=disabled
        localStorage.setItem('cookie-consent', `1,1,${Date.now()}`);
        setIsVisible(false);
        // Trigger tracking scripts to load
        window.dispatchEvent(new Event('cookie-consent-updated'));
    };

    const handleRejectNonEssential = () => {
        localStorage.setItem('cookie-consent', `0,0,${Date.now()}`);
        setIsVisible(false);
        // Trigger tracking scripts update (will check consent and potentially skip loading)
        window.dispatchEvent(new Event('cookie-consent-updated'));
    };

    if (!isVisible) return null;

    const styles = getStyles(isMobile);

    return (
        <div style={styles.bannerWrapper}>
            <div style={styles.container}>
                <div style={styles.content}>
                    <div style={styles.textGroup}>
                        <h4 style={styles.title}>Cookie Settings</h4>
                        <p style={styles.text}>
                            We use cookies to improve your experience. <Link to="/cookies" style={styles.link}>Learn more</Link>
                        </p>
                    </div>
                    <div style={styles.buttonGroup}>
                        <button onClick={handleRejectNonEssential} style={styles.secondaryButton}>Reject</button>
                        <button onClick={handleAcceptAll} style={styles.primaryButton}>Accept All</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getStyles = (isMobile: boolean) => ({
    bannerWrapper: {
        position: 'fixed' as const,
        bottom: isMobile ? '12px' : '24px',
        left: isMobile ? '12px' : '24px',
        right: isMobile ? '12px' : '24px',
        zIndex: 1000,
    },
    container: {
        maxWidth: '1200px',
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: isMobile ? '16px' : '24px',
        padding: isMobile ? '16px' : '24px 32px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
        border: '1px solid #f1f5f9',
    },
    content: {
        display: 'flex',
        flexDirection: isMobile ? 'column' as const : 'row' as const,
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? '16px' : '32px',
    },
    textGroup: {
        flex: 1,
        minWidth: isMobile ? 'auto' : '300px',
    },
    title: {
        fontSize: isMobile ? '1rem' : '1.1rem',
        fontWeight: 700,
        color: '#0f172a',
        marginBottom: '4px',
        margin: 0,
    },
    text: {
        fontSize: isMobile ? '0.85rem' : '0.95rem',
        color: '#64748b',
        lineHeight: 1.5,
        margin: 0,
    },
    link: {
        color: '#6366f1',
        textDecoration: 'none',
        fontWeight: 600,
    },
    buttonGroup: {
        display: 'flex',
        gap: '10px',
        width: isMobile ? '100%' : 'auto',
    },
    primaryButton: {
        flex: isMobile ? 1 : 'none',
        background: '#0f172a',
        color: 'white',
        padding: isMobile ? '12px 16px' : '12px 24px',
        borderRadius: '100px',
        fontSize: isMobile ? '0.9rem' : '0.95rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
    },
    secondaryButton: {
        flex: isMobile ? 1 : 'none',
        background: '#f1f5f9',
        color: '#475569',
        padding: isMobile ? '12px 16px' : '12px 24px',
        borderRadius: '100px',
        fontSize: isMobile ? '0.9rem' : '0.95rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
    },
});

export default CookieBanner;

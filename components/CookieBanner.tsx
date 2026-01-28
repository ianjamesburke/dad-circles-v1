import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const CookieBanner: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookie-consent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAcceptAll = () => {
        const settings = {
            essential: true,
            analytics: true,
            marketing: true,
            timestamp: Date.now(),
        };
        localStorage.setItem('cookie-consent', JSON.stringify(settings));
        setIsVisible(false);
    };

    const handleRejectNonEssential = () => {
        const settings = {
            essential: true,
            analytics: false,
            marketing: false,
            timestamp: Date.now(),
        };
        localStorage.setItem('cookie-consent', JSON.stringify(settings));
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div style={styles.bannerWrapper}>
            <div style={styles.container}>
                <div style={styles.content}>
                    <p style={styles.text}>
                        We use cookies. <Link to="/cookies" style={styles.link}>Learn more</Link>
                    </p>
                    <div style={styles.buttonGroup}>
                        <button onClick={handleRejectNonEssential} style={styles.secondaryButton}>Reject</button>
                        <button onClick={handleAcceptAll} style={styles.primaryButton}>Accept</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    bannerWrapper: {
        position: 'fixed' as const,
        bottom: '16px',
        right: '16px',
        zIndex: 1000,
        animation: 'slideUp 0.3s ease-out',
    },
    container: {
        background: '#ffffff',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid #e2e8f0',
        maxWidth: '280px',
    },
    content: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '10px',
    },
    text: {
        fontSize: '0.8rem',
        color: '#64748b',
        lineHeight: 1.4,
        margin: 0,
    },
    link: {
        color: '#6366f1',
        textDecoration: 'none',
        fontWeight: 600,
    },
    buttonGroup: {
        display: 'flex',
        gap: '8px',
    },
    primaryButton: {
        background: '#0f172a',
        color: 'white',
        padding: '6px 16px',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
        flex: 1,
    },
    secondaryButton: {
        background: '#f1f5f9',
        color: '#475569',
        padding: '6px 16px',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
        flex: 1,
    },
};

export default CookieBanner;

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
                    <div style={styles.textGroup}>
                        <h4 style={styles.title}>Cookie Settings</h4>
                        <p style={styles.text}>
                            We use cookies to improve your experience and analyze our traffic. By clicking "Accept All", you consent to our use of all cookies. You can manage your preferences in our <Link to="/cookies" style={styles.link}>Cookie Policy</Link>.
                        </p>
                    </div>
                    <div style={styles.buttonGroup}>
                        <button onClick={handleRejectNonEssential} style={styles.secondaryButton}>Reject Non-Essential</button>
                        <button onClick={handleAcceptAll} style={styles.primaryButton}>Accept All</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    bannerWrapper: {
        position: 'fixed' as const,
        bottom: '24px',
        left: '24px',
        right: '24px',
        zIndex: 1000,
        animation: 'slideUp 0.5s ease-out',
    },
    container: {
        maxWidth: '1200px',
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: '24px',
        padding: '24px 32px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
        border: '1px solid #f1f5f9',
    },
    content: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '32px',
        flexWrap: 'wrap' as const,
    },
    textGroup: {
        flex: 1,
        minWidth: '300px',
    },
    title: {
        fontSize: '1.1rem',
        fontWeight: 700,
        color: '#0f172a',
        marginBottom: '4px',
        margin: 0,
    },
    text: {
        fontSize: '0.95rem',
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
        gap: '12px',
    },
    primaryButton: {
        background: '#0f172a',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '100px',
        fontSize: '0.95rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
    },
    secondaryButton: {
        background: '#f1f5f9',
        color: '#475569',
        padding: '12px 24px',
        borderRadius: '100px',
        fontSize: '0.95rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
    },
};

export default CookieBanner;

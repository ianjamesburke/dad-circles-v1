import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const CookiePolicy: React.FC = () => {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(false);
    const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
    const [marketingEnabled, setMarketingEnabled] = useState(true);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);

        // Load initial settings
        const stored = localStorage.getItem('cookie-consent');
        if (stored) {
            const settings = JSON.parse(stored);
            setAnalyticsEnabled(settings.analytics);
            setMarketingEnabled(settings.marketing);
        }

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleSave = () => {
        const settings = {
            essential: true,
            analytics: analyticsEnabled,
            marketing: marketingEnabled,
            timestamp: Date.now(),
        };
        localStorage.setItem('cookie-consent', JSON.stringify(settings));
        setSaveStatus('Preferences saved successfully!');
        setTimeout(() => setSaveStatus(null), 3000);
    };

    const styles = getStyles(isMobile);

    return (
        <div style={styles.pageWrapper}>
            {/* Navigation */}
            <header style={styles.nav}>
                <div onClick={() => navigate('/')} style={{ ...styles.logo, cursor: 'pointer' }}>
                    <div style={styles.logoSquare}>DC</div>
                    <div style={styles.logoText}>DadCircles</div>
                </div>
                <div style={styles.navLinks}>
                    <Link to="/" style={styles.navLink}>Home</Link>
                </div>
            </header>

            <div style={styles.container}>
                <div style={styles.content}>
                    <h1 style={styles.h1}>Cookie Policy</h1>
                    <p style={styles.lastUpdated}>Last Updated: January 26, 2026</p>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>1. What are Cookies?</h2>
                        <p style={styles.p}>
                            Cookies are small text files that are placed on your device to help websites function better and to provide us with information about how you use our service.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>2. Manage Your Preferences</h2>
                        <p style={styles.p}>
                            We value your choice. You can toggle non-essential cookies below.
                        </p>

                        <div style={styles.controlBox}>
                            <div style={styles.cookieItem}>
                                <div style={styles.cookieInfo}>
                                    <h4 style={styles.h4}>Essential Cookies</h4>
                                    <p style={styles.pSmall}>Necessary for the website to function. These cannot be turned off.</p>
                                </div>
                                <div style={styles.badge}>Always On</div>
                            </div>

                            <div style={styles.cookieItem}>
                                <div style={styles.cookieInfo}>
                                    <h4 style={styles.h4}>Analytics Cookies</h4>
                                    <p style={styles.pSmall}>Help us understand how many people use DadCircles and how we can improve the experience.</p>
                                </div>
                                <label style={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={analyticsEnabled}
                                        onChange={() => setAnalyticsEnabled(!analyticsEnabled)}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        ...styles.slider,
                                        backgroundColor: analyticsEnabled ? '#6366f1' : '#cbd5e1'
                                    }}>
                                        <span style={{
                                            ...styles.sliderCircle,
                                            transform: analyticsEnabled ? 'translateX(20px)' : 'translateX(0)'
                                        }}></span>
                                    </span>
                                </label>
                            </div>

                            <div style={styles.cookieItem}>
                                <div style={styles.cookieInfo}>
                                    <h4 style={styles.h4}>Marketing Cookies</h4>
                                    <p style={styles.pSmall}>Used to track the effectiveness of our social sharing and invite system.</p>
                                </div>
                                <label style={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={marketingEnabled}
                                        onChange={() => setMarketingEnabled(!marketingEnabled)}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        ...styles.slider,
                                        backgroundColor: marketingEnabled ? '#6366f1' : '#cbd5e1'
                                    }}>
                                        <span style={{
                                            ...styles.sliderCircle,
                                            transform: marketingEnabled ? 'translateX(20px)' : 'translateX(0)'
                                        }}></span>
                                    </span>
                                </label>
                            </div>

                            <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <button style={styles.saveButton} onClick={handleSave}>Save Preferences</button>
                                {saveStatus && <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.9rem' }}>{saveStatus}</span>}
                            </div>
                        </div>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>3. Third Party Cookies</h2>
                        <p style={styles.p}>
                            We use trusted services like Google Analytics and Firebase which may set cookies on your browser. For more info, see our <Link to="/privacy" style={{ color: '#6366f1' }}>Privacy Policy</Link>.
                        </p>
                    </section>
                </div>
            </div>

            {/* Footer */}
            <footer style={styles.footer}>
                <div style={styles.container}>
                    <div style={styles.footerContent}>
                        <div style={styles.footerBrand}>
                            <div style={styles.footerBrandRow}>
                                <div style={styles.logoSquareSmall}>DC</div>
                                <span style={{ fontWeight: 700 }}>DadCircles</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>© 2026 DadCircles Inc.</div>
                        </div>
                        <div style={styles.footerLinks}>
                            <Link to="/terms" style={styles.iconLink}>Terms</Link>
                            <Link to="/privacy" style={styles.iconLink}>Privacy</Link>
                            <a href="https://www.linkedin.com/company/dadcircles" target="_blank" rel="noopener noreferrer" style={styles.iconLink}>LinkedIn</a>
                            <Link to="/" style={styles.iconLink}>Home</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const getStyles = (isMobile: boolean) => ({
    pageWrapper: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
        color: '#1e293b',
        background: '#ffffff',
        minHeight: '100vh',
    },
    container: {
        maxWidth: '800px',
        margin: '0 auto',
        padding: isMobile ? '0 20px' : '0 32px',
        width: '100%',
        boxSizing: 'border-box' as const,
    },
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '20px 0' : '32px 0',
        maxWidth: '1200px',
        margin: '0 auto',
        paddingLeft: isMobile ? '20px' : '32px',
        paddingRight: isMobile ? '20px' : '32px',
        borderBottom: '1px solid #f1f5f9',
    },
    logo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    logoSquare: {
        width: '36px',
        height: '36px',
        background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 800,
        fontSize: '1rem',
    },
    logoSquareSmall: {
        width: '24px',
        height: '24px',
        background: '#6366f1',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 700,
        fontSize: '0.7rem',
    },
    logoText: {
        fontSize: '1.25rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: '#0f172a',
    },
    navLinks: {
        display: 'flex',
        gap: isMobile ? '20px' : '32px',
    },
    navLink: {
        color: '#64748b',
        textDecoration: 'none',
        fontWeight: 500,
        fontSize: '0.95rem',
    },
    content: {
        padding: '80px 0',
    },
    h1: {
        fontSize: isMobile ? '2.5rem' : '3.5rem',
        fontWeight: 900,
        color: '#0f172a',
        marginBottom: '12px',
        letterSpacing: '-0.03em',
    },
    lastUpdated: {
        color: '#94a3b8',
        fontSize: '0.95rem',
        marginBottom: '48px',
    },
    section: {
        marginBottom: '40px',
    },
    h2: {
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#0f172a',
        marginBottom: '16px',
    },
    p: {
        fontSize: '1.1rem',
        lineHeight: 1.7,
        color: '#475569',
        marginBottom: '16px',
    },
    pSmall: {
        fontSize: '0.95rem',
        color: '#64748b',
        lineHeight: 1.4,
        margin: 0,
    },
    h4: {
        fontSize: '1.1rem',
        fontWeight: 700,
        color: '#0f172a',
        marginBottom: '4px',
    },
    controlBox: {
        background: '#f8fafc',
        borderRadius: '24px',
        padding: '32px',
        border: '1px solid #f1f5f9',
        marginTop: '32px',
    },
    cookieItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 0',
        borderBottom: '1px solid #e2e8f0',
    },
    cookieInfo: {
        maxWidth: '80%',
    },
    badge: {
        fontSize: '0.75rem',
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        color: '#64748b',
        background: '#e2e8f0',
        padding: '4px 10px',
        borderRadius: '100px',
    },
    switch: {
        position: 'relative' as const,
        display: 'inline-block',
        width: '44px',
        height: '24px',
    },
    slider: {
        position: 'absolute' as const,
        cursor: 'pointer',
        top: 0, left: 0, right: 0, bottom: 0,
        transition: '.3s',
        borderRadius: '34px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 3px',
    },
    sliderCircle: {
        height: '18px',
        width: '18px',
        backgroundColor: 'white',
        transition: '.3s',
        borderRadius: '50%',
        display: 'block',
    },
    saveButton: {
        background: '#0f172a',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '100px',
        fontSize: '1rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
    },
    footer: {
        padding: '60px 0',
        borderTop: '1px solid #f1f5f9',
        marginTop: 'auto',
    },
    footerContent: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: isMobile ? 'column' as const : 'row' as const,
        gap: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
    },
    footerBrand: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
        alignItems: isMobile ? 'center' : 'flex-start',
    },
    footerBrandRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    footerLinks: {
        display: 'flex',
        gap: '24px',
    },
    iconLink: {
        color: '#64748b',
        fontSize: '0.9rem',
        textDecoration: 'none',
        fontWeight: 500,
    }
});

export default CookiePolicy;

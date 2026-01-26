import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
                    <h1 style={styles.h1}>Privacy Policy</h1>
                    <p style={styles.lastUpdated}>Last Updated: January 26, 2026</p>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>1. Privacy at a Glance</h2>
                        <p style={styles.p}>
                            At DadCircles, your privacy is foundational. We don't have news feeds, we don't sell your data, and we don't keep info we don't need. Our goal is to use technology to get you *off* your phone and into a real local circle.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>2. What We Collect</h2>
                        <p style={styles.p}>
                            We only collect information necessary to match you with other dads:
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>**Contact Info:** Your email address (so we can send you match updates).</li>
                            <li style={styles.li}>**Location:** Your postcode (to ensure meetups are local and realistic).</li>
                            <li style={styles.li}>**Parenting Stage:** Whether you are expecting or have kids, and their ages (so matches are relevant).</li>
                            <li style={styles.li}>**Interests & Availability:** Shared during onboarding to help build a cohesive group.</li>
                        </ul>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>3. How We Share Data</h2>
                        <p style={styles.p}>
                            We are extremely careful with your contact details:
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>**With Other Dads:** Your email is *not* shared automatically. Once a group is formed, you are introduced via a private chat flow. Full contact details are only shared if and when the group explicitly agrees to connect outside the platform.</li>
                            <li style={styles.li}>**With AI Processors:** We use advanced AI models (like OpenAI) to assist with matching and facilitation. Data shared with these processors is limited to the context needed for the task and is not used to "train" public models.</li>
                            <li style={styles.li}>**No Third-Party Sales:** We never sell your data to advertisers or third parties.</li>
                        </ul>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>4. Your Rights (GDPR)</h2>
                        <p style={styles.p}>
                            Regardless of where you live, we honor your rights to:
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>**Access:** See what info we have about you.</li>
                            <li style={styles.li}>**Erasure:** Ask us to delete your data at any time.</li>
                            <li style={styles.li}>**Portability:** Request a copy of your data in a machine-readable format.</li>
                        </ul>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>5. Data Retention</h2>
                        <p style={styles.p}>
                            We keep your data as long as you are active on DadCircles. If you haven't interacted with us for 12 months, we will reach out and eventually purge your data if you don't respond.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>6. Security</h2>
                        <p style={styles.p}>
                            We use industry-standard encryption and security practices to protect your information. However, no method of transmission over the internet is 100% secure.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>7. Contact Us</h2>
                        <p style={styles.p}>
                            For any privacy-related questions or data deletion requests, email us at privacy@dadcircles.com.
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
                            <Link to="/cookies" style={styles.iconLink}>Cookies</Link>
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
    ul: {
        paddingLeft: '20px',
        marginBottom: '16px',
    },
    li: {
        fontSize: '1.1rem',
        lineHeight: 1.7,
        color: '#475569',
        marginBottom: '8px',
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

export default PrivacyPolicy;

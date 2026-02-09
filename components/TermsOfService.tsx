import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const TermsOfService: React.FC = () => {
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
                    <h1 style={styles.h1}>Terms of Service</h1>
                    <p style={styles.lastUpdated}>Last Updated: January 26, 2026</p>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>1. Acceptance of Terms</h2>
                        <p style={styles.p}>
                            By accessing or using DadCircles, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use our service.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>2. Eligibility</h2>
                        <p style={styles.p}>
                            You must be at least 18 years old and a father or expecting father to use DadCircles. By using the service, you represent and warrant that you meet these requirements.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>3. Description of Service</h2>
                        <p style={styles.p}>
                            DadCircles provides a platform to match fathers in similar life stages and geographic areas to facilitate local community and connection. We use technology, including AI, to assist in matching and follow-ups.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>4. User Conduct</h2>
                        <p style={styles.p}>
                            You agree to use DadCircles respectfully. Prohibited conduct includes:
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Harassing or abusing other members.</li>
                            <li style={styles.li}>Providing false or misleading information.</li>
                            <li style={styles.li}>Attempting to manipulate the matching system or our AI.</li>
                            <li style={styles.li}>Using the service for commercial solicitation without our consent.</li>
                        </ul>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>5. AI and Automation</h2>
                        <p style={styles.p}>
                            DadCircles uses AI to help facilitate connections. You acknowledge that interactions with our automated systems are for facilitation purposes. Any "agreements" made with our bot are non-binding unless confirmed in writing by our human team. We monitor automated interactions for safety and quality control.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>6. Limitation of Liability</h2>
                        <p style={styles.p}>
                            DadCircles is provided "as-is." We facilitate introductions but are not responsible for the conduct of any users or the outcomes of any meetups. We are not liable for any direct, indirect, or consequential damages arising from your use of the service.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>7. Termination</h2>
                        <p style={styles.p}>
                            We reserve the right to terminate or suspend your access to DadCircles at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users or the service.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>8. Changes to Terms</h2>
                        <p style={styles.p}>
                            We may update these terms from time to time. Your continued use of DadCircles after changes are posted constitutes your acceptance of the new terms.
                        </p>
                    </section>

                    <section style={styles.section}>
                        <h2 style={styles.h2}>9. Contact</h2>
                        <p style={styles.p}>
                            If you have any questions about these Terms, please contact us at help@dadcircles.com.
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

export default TermsOfService;

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BLOG_POSTS } from '../utils/blogData';

const BlogPage: React.FC = () => {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(false);
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
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

            {/* Hero / Header */}
            <header style={styles.heroSection}>
                <div style={styles.container}>
                    <h1 style={styles.h1}>Inside the Circle</h1>
                    <p style={styles.heroSub}>Research, stories, and practical thoughts on fatherhood and local connection.</p>
                </div>
            </header>

            {/* Blog Feed */}
            <section style={styles.section}>
                <div style={styles.container}>
                    <div style={styles.blogGrid}>
                        {BLOG_POSTS.map((post) => (
                            <Link
                                to={`/blog/${post.slug}`}
                                key={post.id}
                                style={{
                                    ...styles.blogCard,
                                    ...(hoveredCard === post.slug ? styles.blogCardHover : {})
                                }}
                                onMouseEnter={() => setHoveredCard(post.slug)}
                                onMouseLeave={() => setHoveredCard(null)}
                            >
                                <div style={styles.blogImageContainer}>
                                    <img src={post.cover_image} alt={post.title} style={styles.blogImage} />
                                    <div style={styles.blogTag}>{post.tags?.[0]}</div>
                                </div>
                                <div style={styles.blogContent}>
                                    <div style={styles.blogMeta}>
                                        <span>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                        <span>•</span>
                                        <span>{post.read_time_minutes} min read</span>
                                    </div>
                                    <h3 style={styles.blogTitle}>{post.title}</h3>
                                    <p style={styles.blogExcerpt}>{post.excerpt}</p>
                                    <div style={styles.readMore}>
                                        Read Article <i className="fas fa-arrow-right" style={{ fontSize: '0.8rem', marginLeft: '8px' }}></i>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

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
                            <Link to="/" style={styles.iconLink}>Home</Link>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                        <a
                            href="https://www.linkedin.com/company/dadcircles"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...styles.iconLink, fontSize: '1.25rem' }}
                            aria-label="LinkedIn"
                        >
                            <i className="fab fa-linkedin"></i>
                        </a>
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
        maxWidth: '1200px',
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
        transition: 'color 0.2s',
    },
    heroSection: {
        padding: isMobile ? '60px 0' : '100px 0',
        background: '#f8fafc',
        textAlign: 'center' as const,
    },
    h1: {
        fontSize: isMobile ? '2.5rem' : '3.5rem',
        fontWeight: 900,
        color: '#0f172a',
        marginBottom: '20px',
        letterSpacing: '-0.03em',
    },
    heroSub: {
        fontSize: isMobile ? '1.1rem' : '1.25rem',
        color: '#64748b',
        maxWidth: '700px',
        margin: '0 auto',
        lineHeight: 1.6,
    },
    section: {
        padding: '80px 0',
    },
    blogGrid: {
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '40px',
    },
    blogCard: {
        textDecoration: 'none',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column' as const,
        borderRadius: '24px',
        overflow: 'hidden',
        border: '1px solid #f1f5f9',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        background: '#ffffff',
    },
    blogCardHover: {
        transform: 'translateY(-8px)',
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)',
    },
    blogImageContainer: {
        position: 'relative' as const,
        height: '240px',
        overflow: 'hidden',
    },
    blogImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
    },
    blogTag: {
        position: 'absolute' as const,
        top: '20px',
        left: '20px',
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        padding: '6px 14px',
        borderRadius: '100px',
        fontSize: '0.75rem',
        fontWeight: 700,
        color: '#6366f1',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    blogContent: {
        padding: '32px',
        display: 'flex',
        flexDirection: 'column' as const,
        flex: 1,
    },
    blogMeta: {
        fontSize: '0.85rem',
        color: '#94a3b8',
        marginBottom: '16px',
        display: 'flex',
        gap: '8px',
        fontWeight: 500,
    },
    blogTitle: {
        fontSize: '1.5rem',
        fontWeight: 800,
        color: '#0f172a',
        marginBottom: '16px',
        lineHeight: 1.3,
        letterSpacing: '-0.02em',
    },
    blogExcerpt: {
        fontSize: '1.05rem',
        color: '#475569',
        lineHeight: 1.6,
        marginBottom: '24px',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden',
    },
    readMore: {
        marginTop: 'auto',
        color: '#6366f1',
        fontWeight: 700,
        fontSize: '1rem',
        display: 'flex',
        alignItems: 'center',
    },
    footer: {
        padding: '80px 0 40px',
        background: '#ffffff',
        borderTop: '1px solid #f1f5f9',
    },
    footerContent: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: isMobile ? 'column' as const : 'row' as const,
        gap: '32px',
    },
    footerBrand: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
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
        fontSize: '0.95rem',
        textDecoration: 'none',
        fontWeight: 500,
    }
});

export default BlogPage;

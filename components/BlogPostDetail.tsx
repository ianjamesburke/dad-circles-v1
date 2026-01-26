import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BLOG_POSTS } from '../utils/blogData';

const BlogPostDetail: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const post = BLOG_POSTS.find(p => p.slug === slug);

    if (!post) {
        return (
            <div style={{ padding: '100px', textAlign: 'center' }}>
                <h2>Post not found</h2>
                <Link to="/blog">Back to Blog</Link>
            </div>
        );
    }

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

            <article>
                {/* Banner */}
                <div style={styles.banner}>
                    <div style={styles.container}>
                        <div style={styles.bannerContent}>
                            <div style={styles.meta}>
                                <span>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                <span>•</span>
                                <span>{post.read_time_minutes} min read</span>
                            </div>
                            <h1 style={styles.h1}>{post.title}</h1>
                            <div style={styles.authorBox}>
                                <div style={styles.authorAvatar}>{post.author[0]}</div>
                                <div style={styles.authorInfo}>
                                    <div style={styles.authorName}>{post.author}</div>
                                    <div style={styles.authorTitle}>Founder, DadCircles</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={styles.bannerImageOverlay}>
                        <img src={post.cover_image} alt="" style={styles.bannerImage} />
                    </div>
                </div>

                {/* Content */}
                <div style={styles.contentSection}>
                    <div style={styles.contentContainer}>
                        <div style={styles.bodyContent}>
                            {post.content.split('\n\n').map((paragraph, idx) => {
                                if (paragraph.startsWith('###')) {
                                    return <h3 key={idx} style={styles.h3}>{paragraph.replace('###', '').trim()}</h3>;
                                }
                                if (paragraph.startsWith('**')) {
                                    // Simple bold block check
                                    return <p key={idx} style={{ ...styles.p, fontWeight: 700 }}>{paragraph.replace(/\*\*/g, '')}</p>;
                                }
                                if (paragraph.includes('* ')) {
                                    return (
                                        <ul key={idx} style={styles.ul}>
                                            {paragraph.split('\n').map((item, i) => (
                                                <li key={i} style={styles.li}>{item.replace('* ', '').trim()}</li>
                                            ))}
                                        </ul>
                                    );
                                }
                                return <p key={idx} style={styles.p}>{paragraph.trim()}</p>;
                            })}
                        </div>

                        <div style={styles.ctaBox}>
                            <h4 style={styles.h4}>Join the Circle</h4>
                            <p style={styles.ctaText}>Connect with local Dads who are in the same stage as you. It takes 2 minutes to join the waitlist.</p>
                            <button onClick={() => navigate('/')} style={styles.primaryButton}>Join DadCircles Today</button>
                        </div>
                    </div>
                </div>
            </article>

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
                            <Link to="/blog" style={styles.iconLink}>More Articles</Link>
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
        position: 'relative' as const,
        zIndex: 2,
    },
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 0',
        maxWidth: '1200px',
        margin: '0 auto',
        paddingLeft: isMobile ? '20px' : '32px',
        paddingRight: isMobile ? '20px' : '32px',
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    logo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    logoSquare: {
        width: '36px',
        height: '36px',
        background: 'white',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6366f1',
        fontWeight: 800,
        fontSize: '1rem',
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
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
        color: 'white',
        textShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    navLinks: {
        display: 'flex',
        gap: '24px',
    },
    navLink: {
        color: 'white',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '0.95rem',
        opacity: 0.9,
    },
    banner: {
        position: 'relative' as const,
        background: '#0f172a',
        padding: isMobile ? '120px 0 60px' : '160px 0 100px',
        color: 'white',
        overflow: 'hidden',
    },
    bannerImageOverlay: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.3,
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
    },
    bannerContent: {
        maxWidth: '800px',
    },
    meta: {
        display: 'flex',
        gap: '12px',
        fontSize: '0.9rem',
        fontWeight: 600,
        color: '#818cf8',
        marginBottom: '24px',
    },
    h1: {
        fontSize: isMobile ? '2.25rem' : '3.5rem',
        fontWeight: 900,
        lineHeight: 1.1,
        marginBottom: '40px',
        letterSpacing: '-0.03em',
    },
    authorBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    authorAvatar: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        fontWeight: 700,
        color: 'white',
    },
    authorInfo: {
        display: 'flex',
        flexDirection: 'column' as const,
    },
    authorName: {
        fontWeight: 700,
        fontSize: '1rem',
    },
    authorTitle: {
        fontSize: '0.85rem',
        opacity: 0.7,
    },
    contentSection: {
        padding: '80px 0',
    },
    contentContainer: {
        maxWidth: '740px',
        margin: '0 auto',
        padding: isMobile ? '0 20px' : '0',
    },
    bodyContent: {
        fontSize: '1.15rem',
        lineHeight: 1.8,
        color: '#334155',
    },
    p: {
        marginBottom: '24px',
    },
    h3: {
        fontSize: '1.75rem',
        fontWeight: 800,
        color: '#0f172a',
        marginTop: '48px',
        marginBottom: '24px',
        letterSpacing: '-0.02em',
    },
    ul: {
        marginBottom: '32px',
        paddingLeft: '20px',
    },
    li: {
        marginBottom: '12px',
        position: 'relative' as const,
    },
    ctaBox: {
        marginTop: '80px',
        background: '#f8fafc',
        borderRadius: '32px',
        padding: '48px',
        textAlign: 'center' as const,
        border: '1px solid #f1f5f9',
    },
    h4: {
        fontSize: '1.5rem',
        fontWeight: 800,
        color: '#0f172a',
        marginBottom: '16px',
    },
    ctaText: {
        fontSize: '1.1rem',
        color: '#64748b',
        marginBottom: '32px',
        lineHeight: 1.6,
    },
    primaryButton: {
        background: '#0f172a',
        color: 'white',
        padding: '18px 36px',
        borderRadius: '100px',
        fontSize: '1rem',
        fontWeight: 700,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
    },
    footer: {
        padding: '60px 0',
        borderTop: '1px solid #f1f5f9',
        marginTop: '40px',
    },
    footerContent: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: isMobile ? 'column' as const : 'row' as const,
        gap: '24px',
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

export default BlogPostDetail;

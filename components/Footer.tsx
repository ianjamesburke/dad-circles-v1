import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { VersionDisplay } from './VersionDisplay';
import type { CSSProperties } from 'react';

const getStyles = (isMobile: boolean) => ({
  footer: {
    padding: (isMobile ? 60 : 100) + 'px 0 40px',
    background: '#ffffff',
    borderTop: '1px solid #e2e8f0',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto' as const,
    padding: isMobile ? '0 20px' : '0 32px',
    width: '100%' as const,
    boxSizing: 'border-box' as const,
  },
  footerContent: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    flexDirection: (isMobile ? 'column' : 'row') as CSSProperties['flexDirection'],
    gap: '48px',
  },
  footerBrand: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '20px',
  },
  footerBrandRow: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '12px',
  },
  footerLinks: {
    display: 'flex' as const,
    gap: '32px',
    alignItems: 'center' as const,
    flexDirection: (isMobile ? 'column' : 'row') as CSSProperties['flexDirection'],
  },
  iconLink: {
    color: '#64748b',
    fontSize: '1.1rem',
    transition: 'color 0.2s',
    textDecoration: 'none',
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '10px',
    fontWeight: 500,
  },
  footerNote: {
    marginTop: '60px',
    paddingTop: '32px',
    borderTop: '1px solid #f1f5f9',
    textAlign: 'center' as const,
    color: '#94a3b8',
    fontSize: '0.95rem',
    fontWeight: 500,
  },
});

export const Footer: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const styles = getStyles(isMobile);

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <div style={styles.footerContent}>
          <div style={styles.footerBrand}>
            <div style={styles.footerBrandRow}>
              <div style={{
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
              }}>DC</div>
              <span style={{ fontWeight: 700 }}>DadCircles</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>Built with care.</div>
          </div>

          <div style={styles.footerLinks}>
            <Link to="/blog" style={styles.iconLink}>Blog</Link>
            <Link to="/cookies" style={styles.iconLink}>Cookies</Link>
            <Link to="/terms" style={styles.iconLink}>Terms</Link>
            <Link to="/privacy" style={styles.iconLink}>Privacy</Link>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', marginTop: '40px' }}>
          <Link
            to="/blog"
            style={{ ...styles.iconLink, fontSize: '1.25rem' }}
            aria-label="Blog"
          >
            <i className="fas fa-newspaper"></i>
          </Link>
          <a
            href="https://www.linkedin.com/company/dadcircles"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...styles.iconLink, fontSize: '1.25rem' }}
            aria-label="LinkedIn"
          >
            <i className="fab fa-linkedin"></i>
          </a>
          <a
            href="mailto:info@dadcircles.com"
            style={{ ...styles.iconLink, fontSize: '1.25rem' }}
            aria-label="Contact us via email"
          >
            <i className="fas fa-envelope"></i>
          </a>
        </div>

        <div style={styles.footerNote}>
          DadCircles is in early Alpha. First cohorts forming now.
        </div>

        <VersionDisplay style={{ marginTop: '16px' }} />
      </div>
    </footer>
  );
};

export default Footer;

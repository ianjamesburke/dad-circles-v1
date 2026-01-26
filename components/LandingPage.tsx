import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { database } from '../database';
import { BLOG_POSTS } from '../utils/blogData';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [postcode, setPostcode] = useState('');
  const [signupForOther, setSignupForOther] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [showNavShareDropdown, setShowNavShareDropdown] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const existingLead = await database.getLeadByEmail(email);

      if (existingLead && existingLead.session_id && !signupForOther) {
        setErrorMessage(
          "Looks like you've already signed up! Check your email for your personalized chat link."
        );
        setIsSubmitting(false);
        return;
      }

      let sessionId: string | undefined;

      if (!signupForOther) {
        sessionId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      }

      if (!existingLead) {
        await database.addLead({
          email,
          postcode,
          signupForOther,
          session_id: sessionId,
          source: 'landing_page'
        });
      } else if (sessionId && !existingLead.session_id) {
        await database.updateLead(existingLead.id!, { session_id: sessionId });
      }

      if (!signupForOther && sessionId) {
        await database.createProfile(sessionId, email, postcode);
      }

      if (!signupForOther && sessionId) {
        navigate(`/chat?session=${sessionId}`);
      } else {
        setShowSuccess(true);
        setEmail('');
        setPostcode('');
        setSignupForOther(false);
        setTimeout(() => setShowSuccess(false), 5000);
      }

    } catch (error) {
      console.error('Error submitting lead:', error);
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const styles = getStyles(isMobile);

  return (
    <div style={styles.pageWrapper}>
      {/* Navigation / Header */}
      <header style={styles.nav}>
        <div style={styles.logo} onClick={() => navigate('/')}>
          <div style={styles.logoSquare}>DC</div>
          <div style={styles.logoText}>DadCircles</div>
        </div>

        {isMobile && (
          <button
            onClick={() => setShowMobileNav(!showMobileNav)}
            style={styles.mobileMenuToggle}
          >
            <i className={`fas ${showMobileNav ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
        )}

        <div style={{
          ...styles.navLinks,
          display: isMobile && !showMobileNav ? 'none' : 'flex',
          width: isMobile ? '100%' : 'auto',
          boxSizing: 'border-box' as const,
          textAlign: 'center' as const
        }}>
          <a href="#founders" style={styles.navLink} onClick={() => setShowMobileNav(false)}>Our Story</a>
          <a href="#how-it-works" style={styles.navLink} onClick={() => setShowMobileNav(false)}>How it works</a>
          <a href="#why-it-matters" style={styles.navLink} onClick={() => setShowMobileNav(false)}>Why this matters</a>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNavShareDropdown(!showNavShareDropdown)}
              style={styles.navShareButton}
            >
              Share
            </button>
            {showNavShareDropdown && (
              <div style={{ ...styles.shareDropdown, top: 'calc(100% + 12px)', right: 0, left: 'auto', transform: 'none' }}>
                <a
                  onClick={() => {
                    copyToClipboard("I found something called DadCircles. It matches local Dads and makes it easy to meet up. Thought of you. Want an invite? https://dadcircles.com", "copy");
                    setShowNavShareDropdown(false);
                    if (isMobile) setShowMobileNav(false);
                  }}
                  style={styles.shareDropdownOption}
                >
                  <i className="fas fa-copy" style={{ width: '20px' }}></i> Social post
                </a>
                <a
                  onClick={() => {
                    const text = "I just joined DadCircles. It matches local Dads by stage of fatherhood and helps the group actually meet up. If you’re an expecting/new dad (or know one), sign up here and invite a friend: https://dadcircles.com";
                    copyToClipboard(text, "linkedin");
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://dadcircles.com')}`, '_blank');
                    setShowNavShareDropdown(false);
                    if (isMobile) setShowMobileNav(false);
                  }}
                  style={styles.shareDropdownOption}
                >
                  <i className="fab fa-linkedin" style={{ width: '20px' }}></i> LinkedIn
                </a>
                <a
                  onClick={() => {
                    const text = "DadCircles is building local dad groups (matched by stage + postcode) and doing the follow-up so meetups actually happen. Join + invite a friend: https://dadcircles.com";
                    copyToClipboard(text, "twitter");
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                    setShowNavShareDropdown(false);
                    if (isMobile) setShowMobileNav(false);
                  }}
                  style={styles.shareDropdownOption}
                >
                  <i className="fab fa-twitter" style={{ width: '20px' }}></i> Twitter
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="join" style={styles.heroSection}>
        <div style={styles.container}>
          <div style={styles.heroGrid}>
            <div style={styles.heroContent}>
              <h1 style={styles.h1}>Real Dads.<br /><span style={styles.highlight}> Local Circles.</span></h1>
              <p style={styles.heroSub}>
                We connect you with nearby Dads in the same season.
                We handle matching and intros so a real group actually forms.
              </p>

              <form style={styles.heroForm} onSubmit={handleSubmit}>
                <div style={styles.inputGroup}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    style={styles.input}
                  />
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="Postcode"
                    required
                    style={styles.inputSmall}
                  />
                </div>
                <button type="submit" disabled={isSubmitting} style={styles.primaryButton}>
                  {isSubmitting ? 'Joining...' : 'Join DadCircles'}
                </button>
              </form>

              <div style={styles.checkboxWrapper}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={signupForOther}
                    onChange={(e) => setSignupForOther(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span style={styles.checkboxText}>I'm signing up for someone else</span>
                </label>
              </div>

              {showSuccess && <div style={styles.successBox}>✓ You're on the list! Check your email.</div>}
              {errorMessage && <div style={styles.errorBox}>⚠ {errorMessage}</div>}
            </div>

            {!isMobile && (
              <div style={styles.heroVisual}>
                <PhoneMockup />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" style={styles.section}>
        <div style={styles.container}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.h2}>How it works</h2>
            <p style={styles.sectionSub}>For Dads who want a local crew.</p>
          </div>

          <div style={styles.stepsGrid}>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>1</div>
              <h3 style={styles.h3}>Tell us about you</h3>
              <p style={styles.p}>2-min profile: Your location, child's age, and interests.</p>
            </div>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>2</div>
              <h3 style={styles.h3}>We match you</h3>
              <p style={styles.p}>Small local cohorts based on location and interests.</p>
            </div>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>3</div>
              <h3 style={styles.h3}>We launch the group</h3>
              <p style={styles.p}>You get an intro and a simple plan to meet up. We follow up.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why It Works / Social Proof */}
      <section
        style={styles.socialProofSection}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <div style={styles.container}>
          <div style={styles.proofCard}>
            <div style={styles.vibeTag}>FIRST COHORTS FORMING NOW</div>
            <h2 style={styles.h2Dark}>Join the early circle</h2>
            <p style={styles.pDark}>Dad groups don’t happen by accident. We provide the lightweight structure to make them stick: local, practical, and consistent.</p>
            <div style={styles.proofNote}>Be an early Dad. Help shape the experience.</div>
          </div>
        </div>
      </section>

      {/* Why This Matters (Research) */}
      <section id="why-it-matters" style={styles.sectionLight}>
        <div style={styles.container}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.h2}>Why This Matters</h2>
            <p style={styles.sectionSub}>This isn’t a “nice to have.” Connection matters for Dads, Kids and families.</p>
          </div>

          <div style={styles.researchGrid}>
            <div style={styles.researchItem}>
              <div style={styles.researchIcon}>🧠</div>
              <h4 style={styles.h4}>Isolation is a risk</h4>
              <p style={styles.researchText}>
                Low social support predicts paternal depression.
                <strong> Dads need Dads.</strong>
              </p>
            </div>
            <div style={styles.researchItem}>
              <div style={styles.researchIcon}>🤝</div>
              <h4 style={styles.h4}>Connection reduces distress</h4>
              <p style={styles.researchText}>
                Peer support is protective against anxiety and depression.
              </p>
            </div>
            <div style={styles.researchItem}>
              <div style={styles.researchIcon}>👨‍👩‍👧</div>
              <h4 style={styles.h4}>Dad health = Kid health</h4>
              <p style={styles.researchText}>
                Your wellbeing is a direct investment in your child's growth.
              </p>
            </div>
            <div style={styles.researchItem}>
              <div style={styles.researchIcon}>🏗️</div>
              <h4 style={styles.h4}>Proven Infrastructure</h4>
              <p style={styles.researchText}>
                This model works for Mums. We’re adapting the proven social infrastructure for Dads.
              </p>
            </div>
            <div style={styles.citationBox}>
              <h5 style={styles.h5}>Data Sources & Research</h5>
              <div style={styles.linksGrid}>
                <span style={styles.citeLink}>BMC Public Health</span>
                <span style={styles.citeLink}>American Journal of Men’s Health</span>
                <span style={styles.citeLink}>JAMA Pediatrics</span>
                <span style={styles.citeLink}>PMC Parent Groups</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founders Story Section */}
      <section id="founders" style={styles.storySection}>
        <div style={styles.container}>
          <div style={styles.storyCard}>
            <h2 style={styles.storyTitle}>Why we built DadCircles</h2>
            <div style={styles.storyContent}>
              <p style={styles.pLarge}>
                I’m Nelson. I’m a dad of two kids under four. After I became a Dad, I realized something quietly but clearly: my life had shifted out of sync with my friendships. My circle of male friends did not have any kids and their timeline was years away.
              </p>
              <p style={styles.pLarge}>
                Like many dads, I didn’t feel unhappy, just increasingly isolated.
              </p>
              <p style={styles.pLarge}>
                I very slowly formed new connections indirectly, through my partner. Her Mum’s group was a constant for her. They shared milestones, compared notes, vented, laughed, and showed up for each other week after week, month after month, milestone after milestone. Over time, those connections turned into real, lasting friendships, the kind you build a phase of life around.
              </p>
              <p style={styles.pLarge}>
                I didn’t see anything like that for Dads.
              </p>
              <p style={styles.pLarge}>
                There was no default place to land. No local group going through the same stage. No gentle structure to turn “we should catch up sometime” into actual time together. And no space where celebrating wins, talking through challenges, or just hanging out felt routine or easy.
              </p>
              <p style={styles.pLarge}>
                That gap felt obvious and fixable.
              </p>
              <p style={styles.pLarge}>
                DadCircles exists to give Dads a small, local group of peers at similar life stages, lightly facilitated so it actually forms. Not a support group. Not a forum. Just real people, nearby, with enough structure to lower the friction to socialise.
              </p>
              <p style={styles.pLarge}>
                We’re starting locally with real dads, learning fast, and building carefully. City by city. The goal is to make fatherhood feel a little less lonely, and a lot more shared.
              </p>
              <p style={styles.pLarge}>
                For Dads. For Kids. For Families.
              </p>
              <div style={styles.signature}>
                <strong>Nelson & Ian</strong><br />
                Founders of DadCircles
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Section (Placeholder) */}
      <section style={styles.blogSection}>
        <div style={styles.container}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.h2}>Latest from the Circle</h2>
            <p style={styles.sectionSub}>Tips, stories, and research on fatherhood and connection.</p>
          </div>
          <div style={styles.blogGrid}>
            {BLOG_POSTS.slice(0, 3).map((post) => (
              <Link to={`/blog/${post.slug}`} key={post.id} style={styles.blogCard}>
                <div style={{ height: '200px', background: '#e2e8f0', overflow: 'hidden' }}>
                  <img src={post.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={styles.blogContent}>
                  <span style={styles.blogDate}>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  <h4 style={styles.blogTitle}>{post.title}</h4>
                  <p style={styles.blogExcerpt}>{post.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '56px' }}>
            <Link to="/blog" style={{ ...styles.citeLink, fontSize: '1.1rem' }}>View All Articles <i className="fas fa-arrow-right"></i></Link>
          </div>
        </div>
      </section>

      {/* Invite/Share Section */}
      <section style={styles.shareSection}>
        <div style={styles.container}>
          <div style={styles.shareContainer}>
            <h2 style={styles.h2White}>Know a dad who’d benefit?</h2>
            <p style={styles.sectionSubWhite}>Help us build the early community by inviting a friend.</p>

            <div style={{ position: 'relative', marginTop: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', flexDirection: isMobile ? 'column' : 'row' }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowShareDropdown(!showShareDropdown)}
                  style={styles.shareMainButton}
                >
                  <i className="fas fa-share-alt"></i> Share DadCircles
                </button>

                {showShareDropdown && (
                  <div style={styles.shareDropdown}>
                    <a
                      onClick={() => {
                        copyToClipboard("I found something called DadCircles. It matches local Dads and makes it easy to meet up. Thought of you. Want an invite? https://dadcircles.com", "copy");
                        setShowShareDropdown(false);
                      }}
                      style={styles.shareDropdownOption}
                    >
                      <i className="fas fa-copy" style={{ width: '20px' }}></i> Social post
                    </a>
                    <a
                      onClick={() => {
                        const text = "I just joined DadCircles. It matches local Dads by stage of fatherhood and helps the group actually meet up. If you’re an expecting/new dad (or know one), sign up here and invite a friend: https://dadcircles.com";
                        copyToClipboard(text, "linkedin");
                        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://dadcircles.com')}`, '_blank');
                        setShowShareDropdown(false);
                      }}
                      style={styles.shareDropdownOption}
                    >
                      <i className="fab fa-linkedin" style={{ width: '20px' }}></i> LinkedIn
                    </a>
                    <a
                      onClick={() => {
                        const text = "DadCircles is building local dad groups (matched by stage + postcode) and doing the follow-up so meetups actually happen. Join + invite a friend: https://dadcircles.com";
                        copyToClipboard(text, "twitter");
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                        setShowShareDropdown(false);
                      }}
                      style={styles.shareDropdownOption}
                    >
                      <i className="fab fa-twitter" style={{ width: '20px' }}></i> Twitter
                    </a>
                  </div>
                )}
              </div>

              {copiedText && (
                <div style={{ fontSize: '1rem', color: '#bbf7d0', fontWeight: 700, minWidth: '200px', textAlign: isMobile ? 'center' : 'left' }}>
                  ✓ Link copied!
                </div>
              )}
            </div>
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
              <div style={{ fontSize: '0.9rem', color: '#64748b' }}>Built with care.</div>
            </div>

            <div style={styles.footerLinks}>
              <Link to="/terms" style={styles.iconLink}>Terms</Link>
              <Link to="/privacy" style={styles.iconLink}>Privacy</Link>
              <Link to="/cookies" style={styles.iconLink}>Cookies</Link>
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
          </div>

          <div style={styles.footerNote}>
            DadCircles is in early Alpha. First cohorts forming now.
          </div>
        </div>
      </footer>
    </div >
  );
};

// Internal Phone Mockup Component with rotating images
const PhoneMockup = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = [
    '/images/chat-1.png',
    '/images/chat-2.png',
    '/images/chat-3.png',
    '/images/chat-4.png'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev: number) => (prev + 1) % images.length);
    }, 4000); // Rotate every 4 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '300px',
      height: '600px',
      background: '#1e293b',
      borderRadius: '40px',
      border: '12px solid #1e293b',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      overflow: 'hidden',
    }}>
      {/* Notch */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '120px',
        height: '30px',
        background: '#1e293b',
        borderBottomLeftRadius: '16px',
        borderBottomRightRadius: '16px',
        zIndex: 20
      }}></div>

      {/* Screen Content */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#ffffff',
        overflow: 'hidden'
      }}>
        {images.map((img, index) => (
          <img
            key={index}
            src={img}
            alt={`Inteface Preview ${index + 1}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: index === currentImageIndex ? 1 : 0,
              transition: 'opacity 0.8s ease-in-out'
            }}
          />
        ))}
      </div>
    </div>
  );
};

const getStyles = (isMobile: boolean) => ({
  pageWrapper: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    color: '#1e293b',
    background: '#ffffff',
    overflowX: 'hidden' as const,
    fontSize: isMobile ? '16px' : '18px', // Base font size increase
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
    position: 'relative' as const,
    zIndex: 1000,
    background: '#ffffff',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoSquare: {
    width: '40px',
    height: '40px',
    background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 800,
    fontSize: '1.2rem',
    boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)',
  },
  logoSquareSmall: {
    width: '28px',
    height: '28px',
    background: '#6366f1',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 700,
    fontSize: '0.8rem',
  },
  logoText: {
    fontSize: '1.5rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#0f172a',
  },
  navLinks: {
    display: 'flex',
    gap: isMobile ? '16px' : '40px',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    alignItems: 'center',
    ...(isMobile ? {
      position: 'absolute' as const,
      top: '100%',
      left: 0,
      right: 0,
      background: 'white',
      flexDirection: 'column' as const,
      padding: '24px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
      gap: '24px',
      zIndex: 100,
    } : {})
  },
  mobileMenuToggle: {
    background: 'transparent',
    border: 'none',
    fontSize: '1.5rem',
    color: '#0f172a',
    cursor: 'pointer',
    padding: '8px',
  },
  navLink: {
    color: '#64748b',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '1rem',
    transition: 'color 0.2s',
    cursor: 'pointer',
  },
  navShareButton: {
    background: '#6366f1',
    color: 'white',
    padding: '8px 20px',
    borderRadius: '100px',
    fontSize: '0.95rem',
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.1s',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
    marginLeft: '8px',
  },

  // Hero Section
  heroSection: {
    padding: isMobile ? '40px 0 60px' : '100px 0 140px',
    background: 'radial-gradient(circle at top right, #e0e7ff 0%, #ffffff 60%)',
  },
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr',
    gap: isMobile ? '48px' : '80px',
    alignItems: 'center',
  },
  heroContent: {
    textAlign: isMobile ? 'center' as const : 'left' as const,
  },
  h1: {
    fontSize: isMobile ? '2.5rem' : '4.5rem',
    fontWeight: 900,
    lineHeight: 1.1,
    color: '#0f172a',
    marginBottom: '24px',
    letterSpacing: '-0.03em',
  },
  highlight: {
    background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSub: {
    fontSize: isMobile ? '1.1rem' : '1.35rem',
    lineHeight: 1.6,
    color: '#475569',
    marginBottom: '48px',
    maxWidth: isMobile ? '100%' : '560px',
  },
  heroForm: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    maxWidth: '430px',
    margin: isMobile ? '0 auto' : '0',
  },
  inputGroup: {
    display: 'flex',
    gap: '12px',
    width: '100%',
  },
  input: {
    flex: 1,
    padding: '18px 20px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    fontSize: '1rem',
    background: 'white',
    outline: 'none',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  inputSmall: {
    width: '100px',
    padding: '18px 12px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    fontSize: '1rem',
    textAlign: 'center' as const,
    outline: 'none',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  },
  primaryButton: {
    background: '#0f172a',
    color: 'white',
    padding: '20px 32px',
    borderRadius: '16px',
    fontSize: '1.1rem',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.1s, background 0.2s, box-shadow 0.2s',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
    width: '100%',
    letterSpacing: '0.01em',
  },
  checkboxWrapper: {
    marginTop: '20px',
    display: 'flex',
    justifyContent: isMobile ? 'center' : 'flex-start',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    accentColor: '#6366f1',
  },
  checkboxText: {
    fontSize: '0.95rem',
    color: '#64748b',
  },
  successBox: {
    marginTop: '24px',
    background: '#f0fdf4',
    color: '#166534',
    padding: '16px 20px',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: 500,
    border: '1px solid #bbf7d0',
  },
  errorBox: {
    marginTop: '24px',
    background: '#fef2f2',
    color: '#991b1b',
    padding: '16px 20px',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: 500,
    border: '1px solid #fecaca',
  },
  heroVisual: {
    display: 'flex',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  imageCard: {
    // Legacy support if needed, but PhoneMockup uses inline styles
    background: 'white',
    padding: '12px',
    borderRadius: '32px',
    boxShadow: '0 50px 100px -20px rgba(0,0,0,0.15)',
  },
  heroImage: {
    width: '100%',
    borderRadius: '24px',
    display: 'block',
  },
  floatingTag: {
    // Legacy
    position: 'absolute' as const,
  },

  // Sections
  section: {
    padding: isMobile ? '80px 0' : '140px 0',
    background: '#ffffff',
  },
  sectionLight: {
    padding: isMobile ? '80px 0' : '140px 0',
    background: '#f8fafc',
  },
  sectionHeader: {
    textAlign: 'center' as const,
    marginBottom: isMobile ? '48px' : '80px',
    maxWidth: '800px',
    margin: isMobile ? '0 auto 48px' : '0 auto 80px',
  },
  h2: {
    fontSize: isMobile ? '2.25rem' : '3.5rem',
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: '20px',
    letterSpacing: '-0.02em',
  },
  h2White: {
    fontSize: isMobile ? '2.25rem' : '3.5rem',
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: '20px',
    letterSpacing: '-0.02em',
  },
  h2Dark: {
    fontSize: isMobile ? '2.25rem' : '3.5rem',
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: '20px',
    letterSpacing: '-0.02em',
  },
  sectionSub: {
    fontSize: isMobile ? '1.1rem' : '1.35rem',
    color: '#64748b',
    lineHeight: 1.6,
    maxWidth: '600px',
    margin: '0 auto',
  },
  sectionSubWhite: {
    fontSize: isMobile ? '1.1rem' : '1.35rem',
    color: '#cbd5e1',
    lineHeight: 1.6,
    maxWidth: '600px',
    margin: '0 auto',
  },

  // How it works
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
    gap: isMobile ? '32px' : '48px',
  },
  stepCard: {
    padding: '40px',
    borderRadius: '24px',
    background: '#f8fafc',
    position: 'relative' as const,
    transition: 'transform 0.2s',
  },
  stepNumber: {
    width: '48px',
    height: '48px',
    background: '#6366f1',
    color: 'white',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    marginBottom: '32px',
    fontSize: '1.25rem',
    boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.3)',
  },
  h3: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '12px',
    color: '#0f172a',
    letterSpacing: '-0.01em',
  },
  p: {
    fontSize: '1.05rem',
    lineHeight: 1.6,
    color: '#475569',
  },
  pSmall: {
    fontSize: '1rem',
    lineHeight: 1.6,
    color: '#475569',
    marginBottom: '0px',
  },

  // Social Proof
  socialProofSection: {
    padding: isMobile ? '40px 0' : '80px 0',
    cursor: 'pointer',
  },
  proofCard: {
    background: '#0f172a',
    borderRadius: '40px',
    padding: isMobile ? '60px 24px' : '100px 80px',
    textAlign: 'center' as const,
    color: '#ffffff',
    boxShadow: '0 40px 80px -20px rgba(15, 23, 42, 0.4)',
    cursor: 'pointer',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
    '&:hover': {
      transform: 'translateY(-4px)',
    }
  },
  vibeTag: {
    display: 'inline-block',
    background: 'rgba(99, 102, 241, 0.2)',
    color: '#818cf8',
    padding: '8px 20px',
    borderRadius: '100px',
    fontSize: '0.85rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    marginBottom: '32px',
  },
  pDark: {
    fontSize: isMobile ? '1.25rem' : '1.5rem',
    lineHeight: 1.6,
    color: '#94a3b8',
    marginBottom: '32px',
    maxWidth: '700px',
    margin: '0 auto 32px',
  },
  proofNote: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#6366f1',
    marginTop: '40px',
  },

  // Research
  researchGrid: {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: isMobile ? '24px' : '40px',
    marginBottom: '60px',
  },
  researchItem: {
    display: 'flex',
    gap: '24px',
    background: 'white',
    padding: isMobile ? '32px 24px' : '40px',
    borderRadius: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    alignItems: 'flex-start',
  },
  researchIcon: {
    fontSize: '2rem',
    background: '#eff6ff',
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  h4: {
    fontSize: '1.25rem',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#1e293b',
  },
  h4White: {
    fontSize: '1.25rem',
    fontWeight: 700,
    marginBottom: '12px',
    color: '#f8fafc',
  },
  researchText: {
    fontSize: '1rem',
    lineHeight: 1.6,
    color: '#64748b',
  },
  citationBox: {
    background: '#f1f5f9',
    padding: isMobile ? '32px' : '48px',
    borderRadius: '24px',
  },
  h5: {
    fontSize: '0.85rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: '#94a3b8',
    marginBottom: '24px',
  },
  linksGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '24px',
    justifyContent: 'space-between',
  },
  citeLink: {
    fontSize: '0.9rem',
    color: '#64748b',
    fontWeight: 600,
  },

  // Story
  storySection: {
    padding: isMobile ? '60px 0' : '100px 0',
    background: '#0f172a',
    color: '#ffffff',
  },
  storyCard: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  storyTitle: {
    fontSize: isMobile ? '1.75rem' : '2.5rem',
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: '12px',
    letterSpacing: '-0.02em',
  },
  storyContent: {
    marginTop: '32px',
  },
  pLarge: {
    fontSize: isMobile ? '1.1rem' : '1.2rem',
    lineHeight: 1.7,
    color: '#cbd5e1',
    marginBottom: '24px',
    fontWeight: 300,
  },
  signature: {
    marginTop: '40px',
    paddingTop: '24px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    color: '#818cf8',
    fontSize: '1.2rem',
  },

  // Share
  shareSection: {
    padding: isMobile ? '80px 0' : '120px 0',
    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
    color: 'white',
    zIndex: 10,
    position: 'relative' as const,
  },
  shareContainer: {
    maxWidth: '700px',
    margin: '0 auto',
    textAlign: 'center' as const,
  },
  shareMainButton: {
    background: '#ffffff',
    color: '#4338ca',
    padding: '20px 40px',
    borderRadius: '100px',
    fontSize: '1.25rem',
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  shareDropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 12px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#ffffff',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
    width: '240px',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '8px',
  },
  shareDropdownOption: {
    padding: '16px 20px',
    color: '#1e293b',
    textDecoration: 'none',
    fontSize: '1rem',
    fontWeight: 600,
    textAlign: 'left' as const,
    cursor: 'pointer',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'background 0.2s',
  },

  // Blog
  blogSection: {
    padding: isMobile ? '80px 0' : '140px 0',
    background: '#f8fafc',
  },
  blogGrid: {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
    gap: '32px',
    marginTop: '56px',
  },
  blogCard: {
    background: 'white',
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 4px 10px -2px rgba(0,0,0,0.05)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
    border: '1px solid #f1f5f9',
  },
  blogContent: {
    padding: '32px 24px',
  },
  blogDate: {
    fontSize: '0.85rem',
    color: '#64748b',
    marginBottom: '10px',
    display: 'block',
    fontWeight: 500,
  },
  blogTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '10px',
    lineHeight: 1.4,
    letterSpacing: '-0.01em',
  },
  blogExcerpt: {
    fontSize: '1rem',
    color: '#475569',
    lineHeight: 1.6,
  },

  // Footer
  footer: {
    padding: isMobile ? '60px 0 40px' : '100px 0 40px',
    background: '#ffffff',
    borderTop: '1px solid #e2e8f0',
  },
  footerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexDirection: isMobile ? 'column' as const : 'row' as const,
    gap: '48px',
  },
  footerBrand: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  footerBrandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  footerLinks: {
    display: 'flex',
    gap: '32px',
    alignItems: 'center',
    flexDirection: isMobile ? 'column' as const : 'row' as const,
  },
  iconLink: {
    color: '#64748b',
    fontSize: '1.1rem',
    transition: 'color 0.2s',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
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
  }
});

export default LandingPage;
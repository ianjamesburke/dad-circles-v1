import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../database';
import { getLocationFromPostcode } from '../utils/location';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [postcode, setPostcode] = useState('');
  const [signupForOther, setSignupForOther] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMobile, setIsMobile] = useState(false);

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
      // 1. Check if lead already exists
      const existingLead = await database.getLeadByEmail(email);

      // 2. Handle returning users who already have a session
      if (existingLead && existingLead.session_id && !signupForOther) {
        // User already signed up and started onboarding - don't expose their session
        setErrorMessage(
          "Looks like you've already signed up! Check your email for your personalized chat link, or contact us if you need help."
        );
        setIsSubmitting(false);
        return;
      }

      let sessionId: string | undefined;

      // 3. If user is signing up for themselves, generate a session ID
      if (!signupForOther) {
        sessionId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      }

      // 4. Handle lead creation/update
      if (!existingLead) {
        // Add new lead with session_id if available
        await database.addLead({
          email,
          postcode,
          signupForOther,
          session_id: sessionId, // Link lead to profile
          source: 'landing_page'
        });
      } else if (sessionId && !existingLead.session_id) {
        // If lead exists but no session_id (was signupForOther before), update it
        await database.updateLead(existingLead.id!, { session_id: sessionId });
      }

      // 5. If user is signing up for themselves, create a profile
      if (!signupForOther && sessionId) {
        // Create initial profile with email and postcode
        await database.createProfile(sessionId, email, postcode);

        // Fetch and store location data immediately so it's available for the onboarding agent
        // This avoids making API calls during the conversation
        try {
          const locationInfo = await getLocationFromPostcode(postcode);
          if (locationInfo) {
            await database.updateProfile(sessionId, {
              location: {
                city: locationInfo.city,
                state_code: locationInfo.stateCode
              }
            });
          }
        } catch (error) {
          console.error('Error pre-fetching location:', error);
          // Continue anyway - the agent will ask for location if missing
        }
      }

      // 6. Handle navigation or success message
      if (!signupForOther && sessionId) {
        if (import.meta.env.DEV) console.log('Navigating to chat with session:', sessionId);
        navigate(`/chat?session=${sessionId}`);
      } else {
        // Show success message and stay on landing page
        setShowSuccess(true);
        setEmail('');
        setPostcode('');
        setSignupForOther(false);

        // Hide success message after 5 seconds
        setTimeout(() => {
          setShowSuccess(false);
        }, 5000);
      }

    } catch (error) {
      console.error('Error submitting lead:', error);
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={getStyles(isMobile).body}>
      <div style={getStyles(isMobile).logo}>
        <div style={getStyles(isMobile).logoSquare}>DC</div>
        <div style={getStyles(isMobile).logoText}>DadCircles</div>
      </div>

      <div style={getStyles(isMobile).container}>
        <div style={getStyles(isMobile).content}>
          <h1 style={getStyles(isMobile).h1}>Find Your Dad Squad</h1>
          <p style={getStyles(isMobile).description}>
            Connect with new dads nearby who share your interests. Join local circles, plan activities, and build lasting friendships.
          </p>

          <form style={getStyles(isMobile).emailForm} onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              style={getStyles(isMobile).inputEmail}
            />
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="Your postcode"
              required
              style={getStyles(isMobile).inputText}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              style={getStyles(isMobile).button}
            >
              {isSubmitting ? 'Joining...' : 'Join Waitlist'}
            </button>
          </form>

          <div style={getStyles(isMobile).toggleContainer}>
            <input
              type="checkbox"
              id="signupForOther"
              checked={signupForOther}
              onChange={(e) => setSignupForOther(e.target.checked)}
              style={getStyles(isMobile).checkbox}
            />
            <label htmlFor="signupForOther" style={getStyles(isMobile).checkboxLabel}>
              I'm signing up for someone else
            </label>
          </div>

          <p style={getStyles(isMobile).privacyNote}>
            We'll contact you to find a local parent group. No spam, ever.
          </p>

          {showSuccess && (
            <div style={{ ...getStyles(isMobile).successMessage, ...getStyles(isMobile).successMessageShow }}>
              ✓ Thanks! You're on the list. Check your email for a welcome message.
            </div>
          )}

          {errorMessage && (
            <div style={getStyles(isMobile).errorMessage}>
              ⚠ {errorMessage}
            </div>
          )}
        </div>

        {!isMobile && (
          <div style={getStyles(isMobile).phoneMockup}>
            <div style={getStyles(isMobile).phoneFrame}>
              <div style={getStyles(isMobile).phoneNotch}></div>
              <div style={getStyles(isMobile).phoneScreen}>
                <img
                  src="/images/network-visualization.png"
                  alt="Dad Circles Network Visualization"
                  style={getStyles(isMobile).phoneScreenImg}
                  onError={(e) => {
                    // Fallback to placeholder if image doesn't load
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='600' viewBox='0 0 300 600'%3E%3Crect width='300' height='600' fill='%23667eea'/%3E%3Ctext x='150' y='300' text-anchor='middle' fill='white' font-size='20' font-family='Arial'%3EDad Circles%3C/text%3E%3Ctext x='150' y='330' text-anchor='middle' fill='white' font-size='14' font-family='Arial'%3ENetwork%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={getStyles(isMobile).disclaimer}>
        DadCircles is in early alpha
      </div>
    </div>
  );
};

const getStyles = (isMobile: boolean) => ({
  body: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
    background: 'white',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? '70px 16px 60px' : '20px',
    position: 'relative' as const,
    margin: 0,
    overflowX: 'hidden' as const,
  },
  logo: {
    position: 'fixed' as const,
    top: isMobile ? '16px' : '24px',
    left: isMobile ? '16px' : '24px',
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '8px' : '12px',
    zIndex: 10,
    maxWidth: isMobile ? 'calc(100vw - 32px)' : 'auto',
  },
  logoSquare: {
    width: isMobile ? '32px' : '40px',
    height: isMobile ? '32px' : '40px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: isMobile ? '6px' : '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 700,
    fontSize: isMobile ? '1rem' : '1.25rem',
    flexShrink: 0,
  },
  logoText: {
    fontSize: isMobile ? '1rem' : '1.25rem',
    fontWeight: 600,
    color: '#1a1a1a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  container: {
    maxWidth: '1200px',
    width: '100%',
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: isMobile ? '40px' : '60px',
    alignItems: 'center',
  },
  content: {
    color: '#1a1a1a',
    textAlign: isMobile ? 'center' as const : 'left' as const,
  },
  h1: {
    fontSize: isMobile ? '2rem' : '3.5rem',
    fontWeight: 700,
    marginBottom: '20px',
    lineHeight: 1.2,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  },
  description: {
    fontSize: isMobile ? '1rem' : '1.25rem',
    marginBottom: '28px',
    color: '#4a5568',
    lineHeight: 1.6,
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  },
  emailForm: {
    display: 'flex',
    flexDirection: isMobile ? 'column' as const : 'row' as const,
    gap: '12px',
    marginBottom: '16px',
  },
  inputEmail: {
    flex: 1,
    padding: '14px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s, box-shadow 0.3s',
    minWidth: 0,
    boxSizing: 'border-box' as const,
  },
  inputText: {
    flex: 1,
    padding: '14px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s, box-shadow 0.3s',
    minWidth: 0,
    boxSizing: 'border-box' as const,
  },
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: isMobile ? 'center' : 'flex-start',
    gap: '10px',
    marginBottom: '20px',
    padding: '12px',
    background: '#f7fafc',
    borderRadius: '8px',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    accentColor: '#667eea',
  },
  checkboxLabel: {
    fontSize: '0.9rem',
    color: '#4a5568',
    cursor: 'pointer',
    userSelect: 'none' as const,
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  },
  button: {
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    width: isMobile ? '100%' : 'auto',
    boxSizing: 'border-box' as const,
  },
  privacyNote: {
    fontSize: '0.875rem',
    color: '#718096',
  },
  successMessage: {
    display: 'none',
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #86efac',
    padding: '16px',
    borderRadius: '12px',
    marginTop: '16px',
  },
  successMessageShow: {
    display: 'block',
    animation: 'fadeIn 0.5s',
  },
  errorMessage: {
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    padding: '16px',
    borderRadius: '12px',
    marginTop: '16px',
  },
  disclaimer: {
    position: 'fixed' as const,
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '0.75rem',
    color: '#a0aec0',
    textAlign: 'center' as const,
  },
  phoneMockup: {
    position: 'relative' as const,
    width: '100%',
    maxWidth: '300px',
    margin: '0 auto',
  },
  phoneFrame: {
    position: 'relative' as const,
    width: '100%',
    paddingBottom: '200%',
    background: '#1a1a1a',
    borderRadius: '40px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
    border: '12px solid #1a1a1a',
  },
  phoneNotch: {
    position: 'absolute' as const,
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '120px',
    height: '30px',
    background: '#1a1a1a',
    borderRadius: '0 0 20px 20px',
    zIndex: 2,
  },
  phoneScreen: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'white',
    overflow: 'hidden',
  },
  phoneScreenImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
});

export default LandingPage;
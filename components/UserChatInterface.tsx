import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../store';
import { getAgentResponse } from '../services/callableGeminiService';
import { Role, Message, OnboardingStep } from '../types';
import { validateLLMResponse, logValidationFailure } from '../services/onboardingValidator';
import { auth } from '../firebase';
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { formatLocationDisplay } from '../utils/location';

const getInitialStep = (profile: any): OnboardingStep => {
  const hasName = Boolean(profile?.name);
  const hasStatus = Boolean(profile?.dad_status);
  const hasChildren = Array.isArray(profile?.children) && profile.children.length > 0;
  const hasInterests = profile?.interests !== undefined;
  const hasLocation = Boolean(profile?.location?.city && profile?.location?.state_code);

  if (!hasName) return OnboardingStep.NAME;
  if (!hasStatus) return OnboardingStep.STATUS;
  if (!hasChildren) return OnboardingStep.CHILD_INFO;
  if (!hasInterests) return OnboardingStep.INTERESTS;
  if (!hasLocation) return OnboardingStep.LOCATION;
  return OnboardingStep.CONFIRM;
};

const buildProfileSummary = (profile: any): string => {
  const kids = Array.isArray(profile?.children) && profile.children.length > 0
    ? profile.children
      .map((child: any) => {
        const month = child.birth_month ? `${child.birth_month}/` : '';
        return `${month}${child.birth_year}`;
      })
      .join(', ')
    : '—';

  const interests = profile?.interests
    ? profile.interests.length
      ? profile.interests.join(', ')
      : 'None'
    : '—';

  const location = formatLocationDisplay(profile?.location) || '—';

  return [
    `Name: ${profile?.name || '—'}`,
    `Dad status: ${profile?.dad_status || '—'}`,
    `Kids: ${kids}`,
    `Interests: ${interests}`,
    `Location: ${location}`,
  ].join('\n');
};

const buildInitialMessage = (profile: any, source: string | null, step: OnboardingStep): string => {
  const missionSource = source === 'mission';
  const location = formatLocationDisplay(profile?.location);
  switch (step) {
    case OnboardingStep.NAME:
      return missionSource
        ? `Thanks for trying out the Mission Generator${location ? ` for ${location}` : ''}! To finish getting you set up, we just need a bit of info. What's your name?`
        : `Hey, thanks for checking out Dad Circles. To get you set up, we just need a bit of info. What's your name?`;
    case OnboardingStep.STATUS:
      return `Great to have you here, ${profile?.name}. Are you a current dad, expecting dad, or both?`;
    case OnboardingStep.CHILD_INFO:
      return `Great. What are the birth month and year for your kid(s), or due month and year if expecting?`;
    case OnboardingStep.INTERESTS:
      return `What are some interests or hobbies for you or your kids? If none, just say none.`;
    case OnboardingStep.LOCATION:
      if (location) {
        return `I have you in ${location}. Is that correct?`;
      }
      return `What city and state are you located in?`;
    case OnboardingStep.CONFIRM:
      return `Great, here's what I have:\n${buildProfileSummary(profile)}\nDoes that look right?`;
    default:
      return "Hey, thanks for joining Dad Circles. What's your name?";
  }
};

export const UserChatInterface: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenParam = searchParams.get('token');
  const sourceParam = searchParams.get('source');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authPending, setAuthPending] = useState(false);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [sendDisabled, setSendDisabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef<Set<string>>(new Set());

  // Add chat-page class to body for overflow control
  useEffect(() => {
    document.body.classList.add('chat-page');
    return () => {
      document.body.classList.remove('chat-page');
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSessionId(user.uid);
        setSessionError(null);
        setAuthPending(false);
      } else {
        setSessionId(null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || authPending) return;
    if (!sessionId && !tokenParam) {
      navigate('/', { replace: true });
    }
  }, [authReady, authPending, sessionId, tokenParam, navigate]);

  useEffect(() => {
    if (sessionId || tokenParam) return;
    const timer = setTimeout(() => {
      if (!authPending && !sessionId) {
        navigate('/', { replace: true });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [authPending, sessionId, tokenParam, navigate]);

  useEffect(() => {
    if (!tokenParam) return;

    const redeem = async () => {
      try {
        setAuthPending(true);
        const result = await db.redeemMagicLink(tokenParam);
        if (!result?.authToken) {
          throw new Error('Missing auth token');
        }
        await signInWithCustomToken(auth, result.authToken);
        navigate('/chat', { replace: true });
      } catch (error) {
        console.error('Magic link redemption failed:', error);
        setSessionError('This magic link is invalid or expired. Please request a new one.');
        setAuthPending(false);
      }
    };

    redeem();
  }, [tokenParam, navigate]);

  const loadMessages = async (sid: string) => {
    try {
      const existingMessages = await db.getMessages(sid);
      setMessages(existingMessages);
      return existingMessages;
    } catch (error) {
      console.error('Error loading messages:', error);
      return [];
    }
  };

  const loadProfile = async (sid: string) => {
    try {
      const profile = await db.getProfile(sid);
      setCurrentProfile(profile);
      return profile;
    } catch (error) {
      console.error('Error loading profile:', error);
      return null;
    }
  };

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    // Track initialization per session ID to handle session changes
    if (initializedRef.current.has(sessionId)) {
      return;
    }
    initializedRef.current.add(sessionId);

    const initializeSession = async () => {
      const existingMessages = await loadMessages(sessionId);
      const profile = await loadProfile(sessionId);

      // Start onboarding if no messages exist yet (covers both fresh sessions
      // and mission-page redirects where the profile already has data but no
      // intro message has been written).
      if (existingMessages.length === 0) {
        await startOnboarding(sessionId, profile, sourceParam);
      }
    };

    initializeSession();
  }, [sessionId, sourceParam]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  // Auto-scroll when messages change or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Auto-focus input after agent responds (desktop only)
  useEffect(() => {
    if (!loading && inputRef.current) {
      const isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        inputRef.current.focus();
      }
    }
  }, [loading]);

  const startOnboarding = async (sid: string, profile?: any, source?: string | null) => {
    try {
      // Check if we already have a welcome message to prevent duplicates
      const existingMessages = await db.getMessages(sid);
      if (existingMessages.length > 0) {
        return; // Already has messages, don't add another welcome
      }

      const initialStep = getInitialStep(profile);
      const initialMessage = buildInitialMessage(profile, source || null, initialStep);

      await db.addMessage({
        session_id: sid,
        role: Role.AGENT,
        content: initialMessage
      });

      // Update profile step to match the first onboarding question
      await db.updateProfile(sid, {
        onboarding_step: initialStep
      });

      await loadMessages(sid);
      await loadProfile(sid);
    } catch (error) {
      console.error('Error starting onboarding:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !sessionId || sendDisabled) return;

    const userMsg = input.trim();
    setInput('');

    // Keep focus on input to prevent keyboard from closing on mobile
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Debounce: disable send button for 500ms
    setSendDisabled(true);
    setTimeout(() => setSendDisabled(false), 500);

    const t0 = Date.now();
    if (import.meta.env.DEV) console.log('🚀 [0ms] User clicked send');

    // OPTIMIZATION 1: Add user message optimistically (update UI immediately)
    const optimisticUserMessage: Message = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: Role.USER,
      content: userMsg,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, optimisticUserMessage]);
    if (import.meta.env.DEV) console.log(`✅ [${Date.now() - t0}ms] User message displayed`);

    setLoading(true);

    try {
      // OPTIMIZATION 2: Use cached profile instead of fetching
      const t1 = Date.now();
      const profile = currentProfile || await db.getProfile(sessionId);
      if (!profile) {
        throw new Error('Profile not found');
      }
      if (import.meta.env.DEV) console.log(`✅ [${Date.now() - t0}ms] Profile loaded (took ${Date.now() - t1}ms)`);

      // OPTIMIZATION 3: Use current messages + new message instead of refetching
      const history = [...messages, optimisticUserMessage];
      if (import.meta.env.DEV) console.log(`✅ [${Date.now() - t0}ms] History prepared (${history.length} messages)`);

      // OPTIMIZATION 4: Save user message in background (don't wait)
      db.addMessage({
        session_id: sessionId,
        role: Role.USER,
        content: userMsg
      }).catch(err => console.error('Background save failed:', err));

      // Call AI (this is the only thing we need to wait for)
      const t2 = Date.now();
      if (import.meta.env.DEV) console.log(`⏳ [${Date.now() - t0}ms] Calling AI...`);
      const result = await getAgentResponse(profile, history);
      if (import.meta.env.DEV) console.log(`✅ [${Date.now() - t0}ms] AI responded (took ${Date.now() - t2}ms)`);

      // SECURITY: Validate LLM response before applying state changes
      const validation = validateLLMResponse(
        profile,
        result.next_step as OnboardingStep,
        result.profile_updates
      );

      if (!validation.isValid) {
        // Log security event
        logValidationFailure(
          sessionId,
          profile.onboarding_step,
          result.next_step as OnboardingStep,
          validation.errors
        );

        // Reject the transition and keep user at current step
        console.error('🚨 [SECURITY] Invalid state transition blocked:', validation.errors);

        // Generate a contextual fallback message based on current step
        let fallbackContent = "I need to make sure I have all your information correct. ";

        switch (profile.onboarding_step) {
          case OnboardingStep.CHILD_INFO:
            fallbackContent = "I need the birth month and year for your child. For example, 'March 2023' or 'June 2024'. When was your child born?";
            break;
          case OnboardingStep.SIBLINGS:
            fallbackContent = "Do you have any other children besides the one you just told me about?";
            break;
          case OnboardingStep.INTERESTS:
            fallbackContent = "What are some of your hobbies or interests? Things like hiking, gaming, cooking, sports, etc.";
            break;
          case OnboardingStep.LOCATION:
            fallbackContent = "What city and state are you located in? For example, 'Austin, TX' or 'Portland, OR'.";
            break;
          case OnboardingStep.CONFIRM:
            fallbackContent = "Does the information I showed you look correct? Please say 'yes' to confirm or tell me what needs to be changed.";
            break;
          default:
            // TODO: This is the fallback for system errors, but it shouldn't be. We should have a technical difficulties catch-all for when everything breaks.
            fallbackContent = "I need to make sure I have all your information correct. Let me ask you a few more questions to complete your profile.";
        }

        // Show a contextual fallback message to the user
        const fallbackMessage: Message = {
          id: `temp-agent-${crypto.randomUUID()}`,

          session_id: sessionId,
          role: Role.AGENT,
          content: fallbackContent,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, fallbackMessage]);
        setLoading(false);

        // Save fallback message and keep profile at current step
        db.addMessage({
          session_id: sessionId,
          role: Role.AGENT,
          content: fallbackMessage.content
        }).catch(err => console.error('Background save failed:', err));

        return; // Stop processing this response
      }

      // OPTIMIZATION 5: Add AI message optimistically
      const optimisticAgentMessage: Message = {
        id: `temp-agent-${Date.now()}`,
        session_id: sessionId,
        role: Role.AGENT,
        content: result.message,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, optimisticAgentMessage]);
      setLoading(false);
      if (import.meta.env.DEV) {
        console.log(`✅ [${Date.now() - t0}ms] AI message displayed`);
        console.log(`🎉 TOTAL TIME: ${Date.now() - t0}ms`);
      }

      // OPTIMIZATION 6: Update profile in memory immediately (only after validation passes)
      const isOnboardingComplete = result.next_step === OnboardingStep.COMPLETE;
      const profileUpdates = {
        ...result.profile_updates,
        onboarding_step: result.next_step as OnboardingStep,
        onboarded: isOnboardingComplete,
        // Set matching_eligible to true when onboarding completes successfully
        ...(isOnboardingComplete && { matching_eligible: true })
      };
      setCurrentProfile((prev: any) => ({ ...prev, ...profileUpdates }));

      // OPTIMIZATION 7: Save everything in background (don't wait)
      Promise.all([
        db.updateProfile(sessionId, profileUpdates),
        db.addMessage({
          session_id: sessionId,
          role: Role.AGENT,
          content: result.message
        })
      ]).then(async () => {
        // Trigger completion email if applicable
        if (isOnboardingComplete && profile.email) {
          await db.sendCompletionEmail(profile.email, sessionId);
        }
      }).catch(err => console.error('Background save failed:', err));

    } catch (error) {
      console.error('Error getting response:', error);

      // Fallback response if API fails
      const fallbackMessage: Message = {
        id: `temp-error-${Date.now()}`,
        session_id: sessionId,
        role: Role.AGENT,
        content: "I'm having a little trouble processing that. Could you try again or rephrase your response?",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, fallbackMessage]);
      setLoading(false);

      // Save fallback message in background
      db.addMessage({
        session_id: sessionId,
        role: Role.AGENT,
        content: fallbackMessage.content
      }).catch(err => console.error('Background save failed:', err));
    }
  };

  const showSessionLoading =
    !authReady ||
    authPending ||
    (tokenParam && !sessionError && !sessionId);

  if (showSessionLoading) {
    return (
      <div style={styles.errorContainer}>
        <h2 style={styles.errorTitle}>Loading</h2>
        <p style={styles.errorText}>Preparing your session...</p>
      </div>
    );
  }

  if (!sessionId) {
    const errorText = sessionError || 'Please start from the landing page to begin your onboarding.';
    return (
      <div style={styles.errorContainer}>
        <h2 style={styles.errorTitle}>Session Not Found</h2>
        <p style={styles.errorText}>{errorText}</p>
      </div>
    );
  }

  return (
    <div style={styles.body}>
      {/* Header */}
      <button
        type="button"
        onClick={() => navigate('/')}
        style={styles.logoButton}
        aria-label="Dad Circles home"
      >
        <div style={styles.logoSquare}>DC</div>
        <div style={styles.logoText}>DadCircles</div>
      </button>

      {/* Chat area: flex-1 column with scrollable messages + fixed composer */}
      <div style={styles.chatContainer}>
        <div ref={scrollRef} style={styles.messagesContainer} role="log" aria-live="polite">
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.messageWrapper,
                justifyContent: msg.role === Role.USER ? 'flex-end' : 'flex-start',
                animation: 'fadeSlideIn 0.2s ease-out',
              }}
            >
              <div
                style={{
                  ...styles.messageBubble,
                  ...(msg.role === Role.USER ? styles.userBubble : styles.agentBubble)
                }}
              >
                {msg.content.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < msg.content.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ ...styles.messageWrapper, justifyContent: 'flex-start', animation: 'fadeSlideIn 0.2s ease-out' }}>
              <div style={{ ...styles.messageBubble, ...styles.agentBubble, ...styles.loadingBubble }}>
                <div style={styles.typingIndicator}>
                  <span style={styles.dot}></span>
                  <span style={{ ...styles.dot, animationDelay: '0.2s' }}></span>
                  <span style={{ ...styles.dot, animationDelay: '0.4s' }}></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Composer: fixed at bottom */}
        <div style={styles.composerWrapper}>
          <form onSubmit={handleSubmit} style={styles.inputContainer}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your response..."
              style={styles.input}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="on"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || sendDisabled}
              style={{
                ...styles.sendButton,
                ...(loading || !input.trim() || sendDisabled ? styles.sendButtonDisabled : {})
              }}
              aria-label="Send message"
            >
              ➤
            </button>
          </form>
          <p style={styles.poweredBy}>powered by Gemini 3</p>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  body: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
    background: 'white',
    // Use 90dvh as the stable minimum so the layout doesn't jump
    // when mobile browser chrome (URL bar) shows/hides
    minHeight: '90dvh',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    margin: 0,
    overflow: 'hidden',
    // Safe area insets for notched devices — use max() so there's
    // always at least some padding even on non-notched phones
    paddingTop: 'max(env(safe-area-inset-top), 0px)',
    paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
  },
  logoButton: {
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'white',
    borderBottom: '1px solid #f1f5f9',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
    flexShrink: 0,
  },
  logoSquare: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 700,
    fontSize: '1rem',
    flexShrink: 0,
  },
  logoText: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#1a1a1a',
    whiteSpace: 'nowrap',
  },
  chatContainer: {
    maxWidth: '800px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0, // critical for flex children to shrink
    paddingLeft: '16px',
    paddingRight: '16px',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  messagesContainer: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '12px',
    paddingBottom: '12px',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
  },
  messageWrapper: {
    display: 'flex',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  userBubble: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    borderBottomRightRadius: '4px',
  },
  agentBubble: {
    background: '#f1f5f9',
    color: '#1e293b',
    borderBottomLeftRadius: '4px',
  },
  loadingBubble: {
    padding: '16px',
  },
  typingIndicator: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#94a3b8',
    animation: 'bounce 1.4s infinite ease-in-out',
  },
  composerWrapper: {
    flexShrink: 0,
    background: 'white',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '8px',
    paddingBottom: '4px',
  },
  inputContainer: {
    display: 'flex',
    gap: '8px',
    padding: '4px 0',
    background: 'white',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '14px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.3s',
    minWidth: 0,
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
    touchAction: 'manipulation',
  },
  sendButton: {
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1.2rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, opacity 0.2s',
    minWidth: '56px',
    flexShrink: 0,
    WebkitAppearance: 'none',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  poweredBy: {
    textAlign: 'center',
    fontSize: '0.7rem',
    color: '#a0aec0',
    margin: '4px 0 2px 0',
    letterSpacing: '0.02em',
    fontWeight: 400,
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
  },
  errorTitle: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#1a1a1a',
    marginBottom: '16px',
  },
  errorText: {
    fontSize: '1.1rem',
    color: '#4a5568',
  },
};

export default UserChatInterface;

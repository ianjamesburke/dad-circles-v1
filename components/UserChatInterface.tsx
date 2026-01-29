import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../store';
import { getAgentResponse } from '../services/geminiService';
import { Role, Message, OnboardingStep } from '../types';
import { validateLLMResponse, logValidationFailure } from '../services/onboardingValidator';

export const UserChatInterface: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [sendDisabled, setSendDisabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef<Set<string>>(new Set());

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

      // Only start onboarding if session is completely empty AND no messages exist
      if (existingMessages.length === 0) {
        if (!profile || profile.onboarding_step === OnboardingStep.WELCOME) {
          await startOnboarding(sessionId);
        }
      }
    };

    initializeSession();
  }, [sessionId]);

  // Auto-scroll when messages change or loading state changes
  useEffect(() => {
    // Use scrollIntoView on the anchor element for reliable scrolling
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, loading]);

  // Auto-focus input after agent responds (desktop only, not mobile)
  useEffect(() => {
    if (!loading && inputRef.current) {
      // Only auto-focus on desktop (screen width > 768px) to avoid mobile keyboard issues
      const isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        inputRef.current.focus();
      }
    }
  }, [loading]);

  const handleInputFocus = () => {
    // Scroll to bottom when input is focused (keyboard opens on mobile)
    setTimeout(() => {
      if (scrollAnchorRef.current) {
        scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 300); // Delay to allow keyboard animation
  };

  const startOnboarding = async (sid: string) => {
    try {
      // Check if we already have a welcome message to prevent duplicates
      const existingMessages = await db.getMessages(sid);
      if (existingMessages.length > 0) {
        return; // Already has messages, don't add another welcome
      }

      // Add a simple welcome message without calling AI API
      await db.addMessage({
        session_id: sid,
        role: Role.AGENT,
        content: "Hey there! So glad you're here. First things first, what's your name?"
      });

      // Update profile to NAME step since we asked the question
      await db.updateProfile(sid, {
        onboarding_step: OnboardingStep.NAME
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
            fallbackContent = "I need to make sure I have all your information correct. Let me ask you a few more questions to complete your profile.";
        }
        
        // Show a contextual fallback message to the user
        const fallbackMessage: Message = {
          id: `temp-agent-${Date.now()}`,
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

  const isComplete = currentProfile?.onboarding_step === OnboardingStep.COMPLETE;

  if (!sessionId) {
    return (
      <div style={styles.errorContainer}>
        <h2 style={styles.errorTitle}>Session Not Found</h2>
        <p style={styles.errorText}>Please start from the landing page to begin your onboarding.</p>
      </div>
    );
  }

  return (
    <div style={styles.body}>
      <div style={styles.logo}>
        <div style={styles.logoSquare}>DC</div>
        <div style={styles.logoText}>DadCircles</div>
      </div>

      <div style={styles.chatContainer}>
        <div ref={scrollRef} style={styles.messagesContainer}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.messageWrapper,
                justifyContent: msg.role === Role.USER ? 'flex-end' : 'flex-start'
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
            <div style={{ ...styles.messageWrapper, justifyContent: 'flex-start' }}>
              <div style={{ ...styles.messageBubble, ...styles.agentBubble, ...styles.loadingBubble }}>
                <div style={styles.typingIndicator}>
                  <span style={styles.dot}></span>
                  <span style={{ ...styles.dot, animationDelay: '0.2s' }}></span>
                  <span style={{ ...styles.dot, animationDelay: '0.4s' }}></span>
                </div>
              </div>
            </div>
          )}
          {/* Scroll anchor - always at the bottom of messages */}
          <div ref={scrollAnchorRef} style={{ height: 1, width: '100%', flexShrink: 0 }} />
        </div>

        <form onSubmit={handleSubmit} style={styles.inputContainer}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={handleInputFocus}
            disabled={loading || sendDisabled}
            placeholder="Type your response..."
            style={styles.input}
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || sendDisabled}
            style={{
              ...styles.sendButton,
              ...(loading || !input.trim() || sendDisabled ? styles.sendButtonDisabled : {})
            }}
          >
            ➤
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  body: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
    background: 'white',
    height: '100vh', // Use fixed height instead of minHeight for proper flex child sizing
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    margin: 0,
    overflow: 'hidden', // Prevent body from scrolling, only messages should scroll
  },
  logo: {
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    zIndex: 10,
    background: 'white',
    borderBottom: '1px solid #f1f5f9',
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
    minHeight: 0, // Critical: allows flex item to shrink below content size for proper scrolling
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingBottom: '16px',
    boxSizing: 'border-box',
    overflow: 'hidden', // Prevent container from overflowing
  },
  messagesContainer: {
    flex: 1,
    minHeight: 0, // Critical: allows flex item to shrink below content size for proper scrolling
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '16px',
    paddingBottom: '16px',
    WebkitOverflowScrolling: 'touch',
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
  inputContainer: {
    display: 'flex',
    gap: '8px',
    paddingTop: '16px',
    paddingBottom: '16px',
    background: 'white',
    borderTop: '1px solid #e2e8f0',
    position: 'sticky',
    bottom: 0,
    left: 0,
    right: 0,
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
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
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

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase';
import { db } from '../store';
import {
  OnboardingStep,
  MissionBudget,
  MissionEnvironment,
  MissionLifeStage,
  WeekendMissionRequest,
  WeekendMissionResponse,
} from '../types';

const LIFE_STAGE_OPTIONS: Array<{ value: MissionLifeStage; label: string }> = [
  { value: 'expecting', label: 'Expecting' },
  { value: 'newborn', label: 'Newborn' },
  { value: 'infant', label: 'Infant' },
  { value: 'toddler', label: 'Toddler' },
];

const BUDGET_OPTIONS: Array<{ value: MissionBudget; label: string }> = [
  { value: 'free', label: 'Free only' },
  { value: 'under_20', label: 'Under $20' },
  { value: 'under_50', label: 'Under $50' },
  { value: 'flexible', label: 'Flexible' },
];

const ENVIRONMENT_OPTIONS: Array<{ value: MissionEnvironment; label: string }> = [
  { value: 'indoors', label: 'Indoors' },
  { value: 'outdoors', label: 'Outdoors' },
  { value: 'either', label: 'Either' },
];

const LOADING_STEPS = [
  'Scanning local events and neighborhood calendars',
  'Ranking options by fit, logistics, and kid-friendliness',
  'Building your mission agenda, safeguards, and handoff copy',
];

const JOB_STATUS_HINTS: Record<'queued' | 'running' | 'succeeded' | 'failed', string> = {
  queued: 'Queued in the mission pipeline',
  running: 'Actively generating your mission brief',
  succeeded: 'Mission complete',
  failed: 'Mission run failed',
};

const formatError = (error: any): string => {
  const code = error?.code;
  const message = error?.message || '';

  if (code === 'functions/resource-exhausted') {
    return message || 'Too many requests. Please wait a few minutes and try again.';
  }

  if (code === 'functions/invalid-argument') {
    return message || 'Please check your inputs and try again.';
  }

  if (code === 'functions/failed-precondition') {
    return message || 'We could not find enough event data. Try broadening your constraints.';
  }

  return 'Could not generate a mission right now. Please try again.';
};

const parseInterests = (input: string): string[] => {
  const unique = new Set<string>();
  const parsed: string[] = [];

  for (const piece of input.split(',')) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (unique.has(key)) continue;
    unique.add(key);
    parsed.push(trimmed);
    if (parsed.length >= 8) break;
  }

  return parsed;
};

const toDadStatus = (lifeStage: MissionLifeStage): 'expecting' | 'current' =>
  lifeStage === 'expecting' ? 'expecting' : 'current';

const lifeStageLabel = (lifeStage: MissionLifeStage): string =>
  LIFE_STAGE_OPTIONS.find((option) => option.value === lifeStage)?.label || lifeStage;

const WeekendMissionPage: React.FC = () => {
  const navigate = useNavigate();

  const [postcode, setPostcode] = useState('');
  const [lifeStage, setLifeStage] = useState<MissionLifeStage>('newborn');
  const [interestInput, setInterestInput] = useState('coffee, stroller walks, casual hangs');
  const [budget, setBudget] = useState<MissionBudget>('under_20');
  const [environment, setEnvironment] = useState<MissionEnvironment>('either');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<WeekendMissionResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<'queued' | 'running' | 'succeeded' | 'failed' | ''>('');
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(8);

  const [joinEmail, setJoinEmail] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [postcodeError, setPostcodeError] = useState('');

  const parsedInterests = useMemo(() => parseInterests(interestInput), [interestInput]);

  const flowStage: 'configure' | 'generating' | 'brief' = loading ? 'generating' : result ? 'brief' : 'configure';

  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0);
      setLoadingProgress(8);
      return;
    }

    const phaseTimer = window.setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 6800);

    const progressTimer = window.setInterval(() => {
      setLoadingProgress((prev) => Math.min(prev + Math.random() * 1.75 + 1, 92));
    }, 3200);

    return () => {
      window.clearInterval(phaseTimer);
      window.clearInterval(progressTimer);
    };
  }, [loading]);

  useEffect(() => {
    if (!loading) return;

    const statusFloor =
      jobStatus === 'queued'
        ? 24
        : jobStatus === 'running'
          ? 56
          : jobStatus === 'succeeded'
            ? 100
            : jobStatus === 'failed'
              ? 100
              : 12;

    setLoadingProgress((prev) => Math.max(prev, statusFloor));
  }, [jobStatus, loading]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setJoinMessage('');
    setPostcodeError('');

    if (!postcode.trim()) {
      setError('Please enter a postcode.');
      return;
    }

    if (!postcode.trim().startsWith('48')) {
      setPostcodeError('We\'re currently focusing on the Ann Arbor area (zip codes starting with 48).');
      return;
    }

    setLoading(true);
    setResult(null);
    setJobStatus('');

    try {
      const payload: WeekendMissionRequest = {
        postcode: postcode.trim(),
        life_stage: lifeStage,
        interests: parsedInterests,
        constraints: {
          budget,
          environment,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      };

      const job = await db.createWeekendMissionJob(payload);
      setJobStatus(job.status);

      const startedAt = Date.now();
      const maxWaitMs = 6 * 60 * 1000;

      while (Date.now() - startedAt < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const status = await db.getWeekendMissionJob(job.job_id);
        setJobStatus(status.status);

        if (status.status === 'succeeded' && status.result) {
          setLoadingProgress(100);
          setResult(status.result);
          return;
        }

        if (status.status === 'failed') {
          throw new Error(status.error || 'Could not generate a mission right now. Please try again.');
        }
      }

      throw new Error('Mission generation is taking longer than expected. Please try again in a moment.');
    } catch (err) {
      console.error('Mission generation failed:', err);
      setResult(null);
      if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError(formatError(err));
      }
    } finally {
      setLoading(false);
      setJobStatus('');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;

    setJoinLoading(true);
    setJoinMessage('');

    try {
      const response = await db.startSession(joinEmail, result.location.postcode, false);

      if (response?.status === 'magic_link_sent') {
        setJoinMessage("We've sent you a secure link to continue your existing session.");
        return;
      }

      if (response?.status !== 'session_created' || !response?.authToken || !response?.sessionId) {
        setJoinMessage('Could not start a chat session right now. Please try again.');
        return;
      }

      await signInWithCustomToken(auth, response.authToken);

      await db.updateProfile(response.sessionId, {
        dad_status: toDadStatus(lifeStage),
        onboarding_step: OnboardingStep.NAME,
        postcode: result.location.postcode,
        interests: parsedInterests,
        location_confirmed: true,
        location: {
          city: result.location.city,
          state_code: result.location.state_code,
          country_code: result.location.country_code,
        },
      });

      navigate('/chat?source=mission');
    } catch (err) {
      console.error('Mission handoff failed:', err);
      setJoinMessage('Could not hand off to chat right now. Please try again.');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button type="button" onClick={() => navigate('/')} style={styles.logoButton}>
          <span style={styles.logoSquare}>DC</span>
          <span style={styles.logoText}>DadCircles</span>
        </button>
      </header>

      <main style={styles.main}>
        <section style={styles.heroCard}>
          <p style={styles.kicker}>Weekend Mission Curator</p>
          <h1 style={styles.title}>Plan once, run a better weekend.</h1>
          <p style={styles.subtitle}>
            Set your constraints, generate a research-style local report, and review sectioned picks for dad meetups, with-kid plans, and no-kid options.
          </p>
        </section>



        <section style={styles.workspaceCard}>
          <form style={styles.formCard} onSubmit={handleGenerate}>
            <div style={styles.formHeader}>
              <h2 style={styles.sectionTitle}>Mission Inputs</h2>
              <p style={styles.sectionDescription}>Use concise constraints for better recommendations and faster results.</p>
            </div>

            <div style={styles.fieldBlockWide}>
              <label htmlFor="postcode" style={styles.label}>Postcode</label>
              <div style={styles.infoBox}>
                <span style={styles.infoIcon}>ℹ️</span>
                <p style={styles.infoBoxText}>We're currently focusing on the Ann Arbor area (zip codes starting with 48).</p>
              </div>
              <input
                id="postcode"
                type="text"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="48201"
                autoComplete="postal-code"
                style={{ ...styles.input, ...styles.missionInput }}
                required
              />
              {postcodeError && <p style={styles.errorText}>{postcodeError}</p>}
            </div>

            <div style={styles.fieldBlockWide}>
              <label htmlFor="interests" style={styles.label}>Interests (comma separated)</label>
              <input
                id="interests"
                type="text"
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                placeholder="coffee, parks, brewery patios"
                style={{ ...styles.input, ...styles.missionInput }}
              />
              {!!parsedInterests.length && (
                <p style={styles.helperText}>Using {parsedInterests.length} interest signal{parsedInterests.length === 1 ? '' : 's'}.</p>
              )}
            </div>

            <div style={styles.fieldBlockWide}>
              <p style={styles.label}>Life stage</p>
              <div style={styles.choiceWrap}>
                {LIFE_STAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLifeStage(option.value)}
                    aria-pressed={lifeStage === option.value}
                    style={{ ...styles.choiceChip, ...(lifeStage === option.value ? styles.choiceChipActive : {}) }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.fieldBlockWide}>
              <p style={styles.label}>Budget</p>
              <div style={styles.choiceWrap}>
                {BUDGET_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBudget(option.value)}
                    aria-pressed={budget === option.value}
                    style={{ ...styles.choiceChip, ...(budget === option.value ? styles.choiceChipActive : {}) }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.fieldBlockWide}>
              <p style={styles.label}>Environment</p>
              <div style={styles.choiceWrap}>
                {ENVIRONMENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEnvironment(option.value)}
                    aria-pressed={environment === option.value}
                    style={{ ...styles.choiceChip, ...(environment === option.value ? styles.choiceChipActive : {}) }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.fieldBlockWide}>
              <label htmlFor="notes" style={styles.label}>Extra constraints (optional)</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Stroller-friendly, near parking, avoid loud bars"
                style={styles.textarea}
              />
            </div>

            <div style={styles.actionRow}>
              <button type="submit" disabled={loading} style={{ ...styles.primaryButton, ...(loading ? styles.buttonDisabled : {}) }}>
                {loading ? 'Generating mission...' : result ? 'Regenerate Mission' : 'Generate Weekend Mission'}
              </button>
              {result && !loading && (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => {
                    setResult(null);
                    setError('');
                    setJoinMessage('');
                  }}
                >
                  Clear Current Brief
                </button>
              )}
            </div>

            {error && <p style={styles.errorText}>{error}</p>}
          </form>

          {(loading || result) && (
            <section style={styles.stageCard}>

              {loading && (
                <div style={styles.loadingPanel}>
                <p style={styles.kickerDark}>Generating Mission Brief</p>
                <h2 style={styles.sectionTitle}>Building your weekend plan...</h2>
                <p style={styles.loadingLead}>{LOADING_STEPS[loadingStepIndex]}</p>

                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${loadingProgress}%` }} />
                </div>

                <p style={styles.statusText}>
                  {jobStatus ? JOB_STATUS_HINTS[jobStatus] : 'Preparing your request'}
                </p>

                <div style={styles.loadingChecklist}>
                  {LOADING_STEPS.map((step, index) => (
                    <div key={step} style={styles.loadingChecklistItem}>
                      <span style={{ ...styles.loadingDot, ...(index <= loadingStepIndex ? styles.loadingDotActive : {}) }} />
                      <p style={styles.loadingChecklistText}>{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div style={styles.resultStack}>
                <div style={styles.resultHeader}>
                  <div>
                    <p style={styles.kickerDark}>Weekend Ideas for {result.location.city}</p>
                    <h2 style={styles.sectionTitle}>Here's what's happening this weekend</h2>
                  </div>
                </div>

                <section style={styles.categorySection}>
                  <h3 style={styles.categorySectionTitle}>🤝 Dad Groups</h3>
                  <p style={styles.categorySectionSubtitle}>Connect with other dads in your area</p>
                  <div style={styles.eventCardsRow}>
                    {result.sections.local_dad_meetups.slice(0, 3).map((event, index) => (
                      <article key={`${event.url}-${index}`} style={styles.compactEventCard}>
                        <h4 style={styles.compactEventTitle}>{event.title}</h4>
                        <p style={styles.compactEventMeta}>{event.date_time}</p>
                        <p style={styles.compactEventMeta}>{event.location_name}</p>
                        <p style={styles.compactEventPrice}>{event.price}</p>
                        <a href={event.url} target="_blank" rel="noreferrer" style={styles.compactEventLink}>
                          View details →
                        </a>
                      </article>
                    ))}
                  </div>
                </section>

                <section style={styles.categorySection}>
                  <h3 style={styles.categorySectionTitle}>👨‍👧‍👦 With Kids</h3>
                  <p style={styles.categorySectionSubtitle}>Family-friendly activities</p>
                  <div style={styles.eventCardsRow}>
                    {result.sections.things_to_do_with_kids.slice(0, 3).map((event, index) => (
                      <article key={`${event.url}-${index}`} style={styles.compactEventCard}>
                        <h4 style={styles.compactEventTitle}>{event.title}</h4>
                        <p style={styles.compactEventMeta}>{event.date_time}</p>
                        <p style={styles.compactEventMeta}>{event.location_name}</p>
                        <p style={styles.compactEventPrice}>{event.price}</p>
                        <a href={event.url} target="_blank" rel="noreferrer" style={styles.compactEventLink}>
                          View details →
                        </a>
                      </article>
                    ))}
                  </div>
                </section>

                <section style={styles.categorySection}>
                  <h3 style={styles.categorySectionTitle}>🍺 Without Kids</h3>
                  <p style={styles.categorySectionSubtitle}>Time for yourself</p>
                  <div style={styles.eventCardsRow}>
                    {result.sections.things_to_do_without_kids.slice(0, 3).map((event, index) => (
                      <article key={`${event.url}-${index}`} style={styles.compactEventCard}>
                        <h4 style={styles.compactEventTitle}>{event.title}</h4>
                        <p style={styles.compactEventMeta}>{event.date_time}</p>
                        <p style={styles.compactEventMeta}>{event.location_name}</p>
                        <p style={styles.compactEventPrice}>{event.price}</p>
                        <a href={event.url} target="_blank" rel="noreferrer" style={styles.compactEventLink}>
                          View details →
                        </a>
                      </article>
                    ))}
                  </div>
                </section>

                <section style={styles.ctaBlock}>
                  <h3 style={styles.ctaTitle}>Want to get matched with other dads at a similar stage of fatherhood?</h3>
                  <p style={styles.ctaSubtitle}>Join DadCircles or finish onboarding here.</p>
                  <form onSubmit={handleJoin} style={styles.ctaForm}>
                    <input
                      type="email"
                      value={joinEmail}
                      onChange={(e) => setJoinEmail(e.target.value)}
                      placeholder="Enter your email"
                      style={styles.ctaInput}
                      required
                    />
                    <button
                      type="submit"
                      disabled={joinLoading}
                      style={{ ...styles.ctaButton, ...(joinLoading ? styles.buttonDisabled : {}) }}
                    >
                      {joinLoading ? 'Starting...' : 'Continue to onboarding'}
                    </button>
                  </form>
                  {joinMessage && <p style={styles.infoText}>{joinMessage}</p>}
                </section>
              </div>
            )}
          </section>
          )}
        </section>
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: '#ffffff',
    color: '#1e293b',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: '#ffffff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    padding: '16px 20px',
  },
  logoButton: {
    border: 'none',
    background: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    padding: 0,
  },
  logoSquare: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    color: '#ffffff',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)',
  },
  logoText: {
    fontSize: '1.5rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#0f172a',
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '28px 20px 56px',
    display: 'grid',
    gap: '18px',
  },
  heroCard: {
    borderRadius: '24px',
    padding: '28px 24px',
    background: 'radial-gradient(circle at top right, #e0e7ff 0%, #ffffff 65%)',
    border: '1px solid #e2e8f0',
  },
  kicker: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#6366f1',
  },
  kickerDark: {
    margin: 0,
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#6366f1',
  },
  title: {
    margin: '10px 0 8px',
    fontSize: '2.2rem',
    lineHeight: 1.1,
    color: '#0f172a',
    letterSpacing: '-0.02em',
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    maxWidth: '780px',
    color: '#475569',
    lineHeight: 1.55,
    fontSize: '1.03rem',
  },
  flowRail: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  flowCard: {
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    borderRadius: '16px',
    padding: '14px',
  },
  flowCardActive: {
    border: '1px solid #818cf8',
    background: '#eef2ff',
    boxShadow: '0 8px 20px -12px rgba(99, 102, 241, 0.5)',
  },
  flowIndex: {
    margin: 0,
    fontSize: '0.74rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: 700,
  },
  flowTitle: {
    margin: '6px 0 4px',
    fontSize: '1rem',
    color: '#0f172a',
    fontWeight: 700,
  },
  flowDetail: {
    margin: 0,
    fontSize: '0.92rem',
    color: '#475569',
    lineHeight: 1.45,
  },
  workspaceCard: {
    display: 'grid',
    gap: '14px',
  },
  formCard: {
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    boxShadow: '0 10px 24px -14px rgba(15,23,42,0.25)',
    padding: '20px',
    display: 'grid',
    gap: '14px',
  },
  stageCard: {
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    boxShadow: '0 10px 24px -14px rgba(15,23,42,0.25)',
    padding: '20px',
    minHeight: '320px',
  },
  formHeader: {
    display: 'grid',
    gap: '4px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.35rem',
    color: '#0f172a',
    letterSpacing: '-0.01em',
  },
  sectionDescription: {
    margin: 0,
    color: '#64748b',
    lineHeight: 1.45,
    fontSize: '0.94rem',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
  },
  fieldBlock: {
    minWidth: 0,
    display: 'grid',
    gap: '6px',
  },
  fieldBlockWide: {
    display: 'grid',
    gap: '6px',
  },
  label: {
    fontSize: '0.86rem',
    fontWeight: 700,
    color: '#64748b',
    margin: 0,
  },
  input: {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '13px 14px',
    fontSize: '0.98rem',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#ffffff',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
  },
  missionInput: {
    height: '50px',
    padding: '0 14px',
    lineHeight: 1.2,
    appearance: 'none',
  },
  textarea: {
    width: '100%',
    minHeight: '92px',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '13px 14px',
    fontSize: '0.96rem',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#ffffff',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
  },
  helperText: {
    margin: 0,
    fontSize: '0.82rem',
    color: '#64748b',
  },
  infoBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    marginBottom: '4px',
  },
  infoIcon: {
    fontSize: '1rem',
    flexShrink: 0,
    marginTop: '1px',
  },
  infoBoxText: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#1e40af',
    lineHeight: 1.4,
  },
  choiceWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  choiceChip: {
    border: '1px solid #dbe3f0',
    borderRadius: '999px',
    padding: '8px 13px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
  },
  choiceChipActive: {
    background: '#e0e7ff',
    border: '1px solid #6366f1',
    color: '#4338ca',
  },
  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
  },
  primaryButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '14px 18px',
    background: '#0f172a',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 16px 24px -10px rgba(15,23,42,0.35)',
  },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '11px 14px',
    background: '#ffffff',
    color: '#1e293b',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  buttonDisabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
  },
  errorText: {
    margin: '2px 0 0',
    color: '#991b1b',
    fontWeight: 600,
  },
  infoText: {
    margin: '8px 0 0',
    color: '#4338ca',
    fontWeight: 600,
  },
  placeholderPanel: {
    display: 'grid',
    gap: '14px',
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '10px',
  },
  previewTile: {
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '13px',
    background: '#f8fafc',
  },
  previewLabel: {
    margin: 0,
    fontWeight: 700,
    color: '#0f172a',
  },
  previewText: {
    margin: '6px 0 0',
    color: '#475569',
    lineHeight: 1.5,
    fontSize: '0.92rem',
  },
  loadingPanel: {
    display: 'grid',
    gap: '10px',
  },
  loadingLead: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.45,
  },
  progressTrack: {
    width: '100%',
    height: '10px',
    borderRadius: '999px',
    background: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '999px',
    background: 'linear-gradient(90deg, #6366f1, #4338ca)',
    transition: 'width 0.6s ease',
  },
  statusText: {
    margin: 0,
    fontWeight: 700,
    color: '#4338ca',
    fontSize: '0.92rem',
  },
  loadingChecklist: {
    marginTop: '4px',
    display: 'grid',
    gap: '8px',
  },
  loadingChecklistItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  loadingDot: {
    marginTop: '5px',
    width: '9px',
    height: '9px',
    borderRadius: '99px',
    background: '#c7d2fe',
    flexShrink: 0,
  },
  loadingDotActive: {
    background: '#6366f1',
  },
  loadingChecklistText: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.45,
    fontSize: '0.92rem',
  },
  resultStack: {
    display: 'grid',
    gap: '18px',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },
  resultActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  snapshotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '8px',
  },
  snapshotTile: {
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '10px',
    background: '#f8fafc',
  },
  snapshotLabel: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  snapshotValue: {
    margin: '5px 0 0',
    color: '#0f172a',
    fontWeight: 700,
    fontSize: '0.95rem',
  },
  blockTitle: {
    margin: '0 0 8px',
    fontSize: '1.08rem',
    color: '#0f172a',
  },
  subBlockTitle: {
    margin: '0 0 6px',
    fontSize: '0.95rem',
    color: '#1e293b',
  },
  blockText: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.52,
  },
  eventsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '10px',
  },
  eventCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px',
    background: '#ffffff',
  },
  eventNumber: {
    margin: 0,
    fontSize: '0.74rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: 700,
  },
  eventTitle: {
    margin: '5px 0 6px',
    fontSize: '1rem',
    color: '#0f172a',
  },
  eventMeta: {
    margin: '2px 0',
    color: '#475569',
    fontSize: '0.88rem',
  },
  eventLink: {
    display: 'inline-block',
    marginTop: '6px',
    color: '#4338ca',
    fontWeight: 700,
    textDecoration: 'none',
  },
  eventActions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '6px',
  },
  eventExportButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '6px 10px',
    background: '#ffffff',
    color: '#1e293b',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
  },
  eventReason: {
    margin: '7px 0 0',
    color: '#475569',
    fontSize: '0.9rem',
    lineHeight: 1.45,
  },
  missionBlock: {
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '14px',
    background: '#f8fafc',
    display: 'grid',
    gap: '10px',
  },
  missionSummary: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.57,
  },
  missionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '9px',
  },
  missionTile: {
    border: '1px solid #e2e8f0',
    borderRadius: '11px',
    padding: '10px',
    background: '#ffffff',
    display: 'grid',
    gap: '4px',
  },
  list: {
    margin: 0,
    paddingLeft: '18px',
    color: '#475569',
    lineHeight: 1.5,
    display: 'grid',
    gap: '4px',
    fontSize: '0.9rem',
  },
  emailBlock: {
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px',
    background: '#ffffff',
  },
  emailSubject: {
    margin: '0 0 8px',
    color: '#0f172a',
  },
  emailBody: {
    width: '100%',
    minHeight: '180px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '0.9rem',
    lineHeight: 1.45,
    marginBottom: 0,
    boxSizing: 'border-box',
    background: '#f8fafc',
    fontFamily: 'inherit',
  },
  joinBlock: {
    border: '1px solid #c7d2fe',
    borderRadius: '12px',
    padding: '14px',
    background: '#eef2ff',
  },
  joinForm: {
    display: 'grid',
    gap: '8px',
    marginTop: '9px',
    maxWidth: '440px',
  },
  prefillList: {
    margin: '8px 0 0',
    paddingLeft: '18px',
    color: '#475569',
    lineHeight: 1.48,
    display: 'grid',
    gap: '3px',
  },
  // New simplified event card styles
  categorySection: {
    marginBottom: '8px',
  },
  categorySectionTitle: {
    margin: '0 0 4px',
    fontSize: '1.15rem',
    color: '#0f172a',
    fontWeight: 700,
  },
  categorySectionSubtitle: {
    margin: '0 0 12px',
    fontSize: '0.9rem',
    color: '#64748b',
  },
  eventCardsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '12px',
  },
  compactEventCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '16px',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  compactEventTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: '#0f172a',
    lineHeight: 1.3,
  },
  compactEventMeta: {
    margin: 0,
    fontSize: '0.88rem',
    color: '#475569',
    lineHeight: 1.4,
  },
  compactEventPrice: {
    margin: '4px 0 0',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#059669',
  },
  compactEventLink: {
    marginTop: '8px',
    fontSize: '0.88rem',
    fontWeight: 600,
    color: '#4338ca',
    textDecoration: 'none',
  },
  // CTA block styles
  ctaBlock: {
    marginTop: '12px',
    border: '1px solid #c7d2fe',
    borderRadius: '16px',
    padding: '24px',
    background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    textAlign: 'center' as const,
  },
  ctaTitle: {
    margin: '0 0 8px',
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: 1.3,
  },
  ctaSubtitle: {
    margin: '0 0 20px',
    fontSize: '1rem',
    color: '#475569',
  },
  ctaForm: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    maxWidth: '400px',
    margin: '0 auto',
  },
  ctaInput: {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px 16px',
    fontSize: '1rem',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    background: '#ffffff',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
  },
  ctaButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)',
  },
};

export default WeekendMissionPage;

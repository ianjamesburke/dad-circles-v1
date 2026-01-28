import React, { useState, useEffect, useRef } from 'react';
import { db } from '../store';
import { getAgentResponse } from '../services/geminiService';
import { Role, Message, OnboardingStep } from '../types';

/**
 * AdminChatInterface - Testing tool for admins/developers
 * 
 * This component provides a quick way to test the onboarding flow with
 * predefined test personas without going through the landing page.
 * 
 * Features:
 * - Switch between test personas (User A, B, C)
 * - Debug UI showing onboarding step status
 * - Protected by admin authentication
 * 
 * For production user chat, see UserChatInterface.tsx
 */

const TEST_SESSIONS = [
  { id: 'user-a-complete', label: 'User A' },
  { id: 'user-b-expecting', label: 'User B' },
  { id: 'user-c-fresh', label: 'User C' }
];

export const AdminChatInterface: React.FC = () => {
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('dad_circles_active_test_session') || TEST_SESSIONS[0].id;
  });

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    localStorage.setItem('dad_circles_active_test_session', sessionId);
    
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

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
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    
    try {
      await db.addMessage({
        session_id: sessionId,
        role: Role.USER,
        content: userMsg
      });
      await loadMessages(sessionId);

      setLoading(true);
      
      const profile = await db.getProfile(sessionId);
      if (!profile) {
        throw new Error('Profile not found');
      }
      
      const history = await db.getMessages(sessionId);
      
      const result = await getAgentResponse(profile, history);

      if (result.profile_updates) {
        await db.updateProfile(sessionId, result.profile_updates);
      }

      const nextStep = result.next_step as OnboardingStep;
      const isComplete = nextStep === OnboardingStep.COMPLETE;
      await db.updateProfile(sessionId, { 
        onboarding_step: nextStep,
        onboarded: isComplete,
        // Set matching_eligible to true when onboarding completes successfully
        ...(isComplete && { matching_eligible: true })
      });

      await db.addMessage({
        session_id: sessionId,
        role: Role.AGENT,
        content: result.message
      });

      // Send completion email if onboarding is complete and user has email
      if (isComplete && profile.email) {
        try {
          await db.sendCompletionEmail(profile.email, sessionId);
        } catch (error) {
          console.error('Error sending completion email:', error);
          // Don't block the UI if email fails
        }
      }

      await loadMessages(sessionId);
      await loadProfile(sessionId);
    } catch (error) {
      console.error('Error getting response:', error);
      // Fallback response if API fails
      await db.addMessage({
        session_id: sessionId,
        role: Role.AGENT,
        content: "I'm having a little trouble processing that. Could you try again or rephrase your response?"
      });
      await loadMessages(sessionId);
    }
    setLoading(false);
  };

  const isComplete = currentProfile?.onboarding_step === OnboardingStep.COMPLETE;

  const getStatusLabel = (step: OnboardingStep) => {
    switch (step) {
      case OnboardingStep.WELCOME: return 'Welcome';
      case OnboardingStep.NAME: return 'Name';
      case OnboardingStep.STATUS: return 'Status';
      case OnboardingStep.CHILD_INFO: return 'Child Info';
      case OnboardingStep.SIBLINGS: return 'Siblings';
      case OnboardingStep.INTERESTS: return 'Interests';
      case OnboardingStep.LOCATION: return 'Location';
      case OnboardingStep.CONFIRM: return 'Confirm';
      case OnboardingStep.COMPLETE: return 'Complete';
      default: return 'Welcome';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] gap-4">
      {/* Test User Switcher */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-bold uppercase text-slate-400 px-2 flex items-center gap-1">
          <i className="fas fa-flask"></i> Test Persona:
        </span>
        {TEST_SESSIONS.map((session) => {
          const status = currentProfile && sessionId === session.id 
            ? getStatusLabel(currentProfile.onboarding_step) 
            : 'Loading...';
          return (
            <button
              key={session.id}
              onClick={() => setSessionId(session.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex flex-col items-start ${
                sessionId === session.id 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{session.label}</span>
              <span className={`text-[10px] opacity-75 ${
                sessionId === session.id ? 'text-blue-100' : 'text-slate-400'
              }`}>
                ({status})
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Profile Status Header */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Mode: {currentProfile?.onboarding_step}
            </span>
          </div>
          {isComplete && (
            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Onboarded
            </span>
          )}
        </div>

        {/* Messages area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30"
        >
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === Role.USER 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : msg.role === Role.ADMIN
                      ? 'bg-amber-100 text-amber-900 border border-amber-200 rounded-tl-none italic'
                      : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                }`}
              >
                {msg.role === Role.ADMIN && (
                  <span className="block text-[10px] uppercase font-bold tracking-wider mb-1 opacity-70">
                    <i className="fas fa-shield-halved mr-1"></i> Admin Message
                  </span>
                )}
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce delay-75"></div>
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-100 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading || isComplete}
              placeholder={isComplete ? "Onboarding is complete for this dad!" : "Type your response..."}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={loading || !input.trim() || isComplete}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white w-12 h-12 flex items-center justify-center rounded-xl transition shadow-lg shadow-blue-500/20"
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
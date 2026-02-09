import React, { useState, useEffect } from 'react';
import { database } from '../database';
import { UserProfile, Message, Role, Lead, Group, MatchingStats } from '../types';
import { formatChildInfoWithGender } from '../utils/childDisplay';
import { formatLocationDisplay } from '../utils/location';

export const AdminDashboard: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [adminInput, setAdminInput] = useState('');
  const [activeTab, setActiveTab] = useState<'sessions' | 'leads' | 'matching'>('sessions');
  const [loading, setLoading] = useState(false);

  // Matching state
  const [matchingStats, setMatchingStats] = useState<MatchingStats | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingResult, setMatchingResult] = useState<string>('');

  const loadProfiles = async () => {
    try {
      const allProfiles = await database.getAllProfiles();
      setProfiles(allProfiles);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const loadLeads = async () => {
    try {
      const allLeads = await database.getAllLeads();
      setLeads(allLeads);
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  };

  const loadMatchingData = async () => {
    try {
      setMatchingLoading(true);

      // Load stats and groups in parallel using Client SDK
      try {
        const stats = await database.getMatchingStats();
        setMatchingStats(stats);
      } catch (err) {
        console.error('Error fetching stats:', err);
      }

      try {
        const allGroups = await database.getAllGroups();
        setGroups(allGroups);
        if (import.meta.env.DEV) console.log(`📊 Loaded ${allGroups.length} groups from database`);
      } catch (err) {
        console.error('Error fetching groups:', err);
        setGroups([]);
      }

    } catch (error) {
      console.error('Error loading matching data:', error);
    } finally {
      setMatchingLoading(false);
    }
  };

  const pendingGroups = groups.filter(g => g.status === 'pending');
  const activeGroups = groups.filter(g => g.status === 'active' || g.status === 'inactive');

  const handleRunMatching = async () => {
    setMatchingLoading(true);
    setMatchingResult('');

    try {
      if (import.meta.env.DEV) console.log(`🚀 Running matching algorithm...`);
      const result = await database.runMatchingAlgorithm();

      if (result.success) {
        setMatchingResult(`✅ ${result.result.summary}`);
        if (import.meta.env.DEV) console.log('✅ Matching completed successfully:', result.result);

        await Promise.all([
          loadMatchingData(),
          loadProfiles()
        ]);
      } else {
        const errorMsg = `❌ Error: ${result.error || 'Unknown error'}`;
        setMatchingResult(errorMsg);
        console.error('❌ Matching failed:', result);
      }
    } catch (error) {
      const errorMsg = `❌ Processing Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌ Error running matching:', error);
      setMatchingResult(errorMsg);
    }

    setMatchingLoading(false);
  };

  const handleApproveGroup = async (groupId: string) => {
    if (!window.confirm('Are you sure you want to approve this group and send emails to all members?')) return;

    setMatchingLoading(true);
    try {
      const result = await database.approveGroup(groupId);
      if (import.meta.env.DEV) console.log('✅ Group approved:', result);
      setMatchingResult(`✅ Group approved: ${result.message}`);
      await loadMatchingData();
    } catch (error) {
      console.error('❌ Error approving group:', error);
      setMatchingResult(`❌ Error approving group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setMatchingLoading(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm('Are you sure you want to delete this group? Members will be returned to the pool.')) return;

    setMatchingLoading(true);
    try {
      const result = await database.deleteGroup(groupId);
      if (import.meta.env.DEV) console.log('✅ Group deleted:', result);
      setMatchingResult(`✅ Group deleted: ${result.message}`);
      await Promise.all([
        loadMatchingData(),
        loadProfiles()
      ]);
    } catch (error) {
      console.error('❌ Error deleting group:', error);
      setMatchingResult(`❌ Error deleting group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setMatchingLoading(false);
  };

  const seedTestData = async () => {
    setMatchingLoading(true);
    setMatchingResult('');

    try {
      if (database.seedTestData) {
        await database.seedTestData();
        setMatchingResult('✅ Test data seeded successfully. Refreshing data...');
        setTimeout(async () => {
          await loadMatchingData();
          await loadProfiles();
        }, 1000);
      } else {
        setMatchingResult('⚠️ Seed function not available (prod mode?)');
      }
    } catch (error) {
      console.error('Error seeding test data:', error);
      setMatchingResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setMatchingLoading(false);
  };

  const cleanTestData = async () => {
    setMatchingLoading(true);
    setMatchingResult('');

    try {
      await database.cleanTestData?.();
      setMatchingResult('✅ Test data cleaned successfully');
      await loadMatchingData();
      await loadProfiles();
    } catch (error) {
      console.error('Error cleaning test data:', error);
      setMatchingResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setMatchingLoading(false);
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const sessionMessages = await database.getMessages(sessionId);
      setMessages(sessionMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  useEffect(() => {
    loadProfiles();
    loadLeads();
    if (activeTab === 'matching') {
      loadMatchingData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession);
    }
  }, [selectedSession]);

  const handleInjectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !adminInput.trim() || loading) return;

    setLoading(true);
    try {
      await database.addMessage({
        session_id: selectedSession,
        role: Role.ADMIN,
        content: adminInput.trim()
      });

      setAdminInput('');
      await loadMessages(selectedSession);
      await loadProfiles(); // Refresh profiles list
    } catch (error) {
      console.error('Error injecting message:', error);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-160px)] relative">
      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 font-semibold text-sm border-b-2 transition ${activeTab === 'sessions'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          Chat Sessions ({profiles.length})
        </button>
        <button
          onClick={() => setActiveTab('leads')}
          className={`px-4 py-2 font-semibold text-sm border-b-2 transition ${activeTab === 'leads'
            ? 'border-green-600 text-green-600'
            : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          Waitlist Leads ({leads.length})
        </button>
        <button
          onClick={() => setActiveTab('matching')}
          className={`px-4 py-2 font-semibold text-sm border-b-2 transition ${activeTab === 'matching'
            ? 'border-purple-600 text-purple-600'
            : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          Matching ({groups.length} groups)
        </button>
      </div>

      {activeTab === 'sessions' ? (
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          {/* Sidebar: Sessions List */}
          <div className={`
            ${selectedSession ? 'hidden lg:flex' : 'flex'} 
            lg:w-1/3 flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full
          `}>
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="font-semibold text-slate-700">Onboarding Sessions ({profiles.length})</span>
              <button
                onClick={loadProfiles}
                className="text-slate-400 hover:text-blue-600 transition p-1"
                title="Refresh list"
              >
                <i className="fas fa-sync-alt text-xs"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {profiles.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">No sessions yet</div>
              ) : (
                profiles.map(p => (
                  <button
                    key={p.session_id}
                    onClick={() => setSelectedSession(p.session_id)}
                    className={`w-full text-left p-4 border-b border-slate-50 transition hover:bg-slate-50 group ${selectedSession === p.session_id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-slate-800 text-sm truncate">ID: {p.session_id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight ${p.onboarded ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                        {p.onboarded ? 'Complete' : p.onboarding_step}
                      </span>
                    </div>

                    {/* User Details */}
                    <div className="space-y-1 mb-2">
                      {p.children && p.children.length > 0 && (
                        <div className="space-y-1">
                          {p.children.map((child, index) => (
                            <div key={index} className="text-xs text-slate-600 flex items-center gap-1.5">
                              <i className="fas fa-baby text-[10px] opacity-60"></i>
                              {formatChildInfoWithGender(child)}
                            </div>
                          ))}
                        </div>
                      )}

                      {p.interests && p.interests.length > 0 && (
                        <div className="text-xs text-slate-600 flex items-center gap-1.5">
                          <i className="fas fa-heart text-[10px] opacity-60"></i>
                          {p.interests.join(', ')}
                        </div>
                      )}

                      {p.siblings && p.siblings.length > 0 && (
                        <div className="text-xs text-slate-600 flex items-center gap-1.5">
                          <i className="fas fa-users text-[10px] opacity-60"></i>
                          {p.siblings.length} other child{p.siblings.length !== 1 ? 'ren' : ''}
                        </div>
                      )}

                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <i className="fas fa-map-marker-alt text-[10px] opacity-60"></i>
                        {formatLocationDisplay(p.location) || 'Location pending'}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-2 flex justify-between">
                      <span>Updated {new Date(p.last_updated?.toMillis?.() || p.last_updated || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <i className="fas fa-chevron-right opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Main: Conversation Stream */}
          <div className={`
            ${selectedSession ? 'flex' : 'hidden lg:flex'} 
            lg:w-2/3 flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full
          `}>
            {selectedSession ? (
              <>
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedSession(null)}
                      className="lg:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-600 transition"
                    >
                      <i className="fas fa-arrow-left"></i>
                    </button>
                    <div>
                      <h3 className="font-semibold text-slate-700 leading-none">Conversation</h3>
                      <span className="text-[10px] text-slate-400 font-mono">{selectedSession}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${profiles.find(p => p.session_id === selectedSession)?.onboarded ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                      {profiles.find(p => p.session_id === selectedSession)?.onboarding_step}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.role === Role.USER ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm relative group ${m.role === Role.USER
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : m.role === Role.ADMIN
                          ? 'bg-amber-100 text-amber-900 border border-amber-200 rounded-tl-none italic'
                          : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                        }`}>
                        <div className="flex gap-2 items-center mb-1 opacity-60 text-[10px] font-bold uppercase tracking-wider">
                          <span>{m.role}</span>
                          <span>&bull;</span>
                          <span className="font-normal">{new Date(m.timestamp?.toMillis?.() || m.timestamp || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleInjectMessage} className="p-4 border-t border-slate-100 bg-white">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500">
                        <i className="fas fa-shield-halved text-xs"></i>
                      </span>
                      <input
                        type="text"
                        value={adminInput}
                        onChange={(e) => setAdminInput(e.target.value)}
                        placeholder="Type an admin message to inject..."
                        className="w-full bg-amber-50/30 border border-amber-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!adminInput.trim() || loading}
                      className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-6 rounded-xl transition text-sm font-bold shadow-sm shadow-amber-500/10"
                    >
                      {loading ? 'Injecting...' : 'Inject'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/20">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                  <i className="fas fa-user-gear text-3xl text-slate-300"></i>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Select a Dad Session</h2>
                <p className="text-slate-500 max-w-xs mx-auto">
                  Choose a session from the list to view their progress and provide manual support.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'leads' ? (
        /* Leads Tab */
        <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="font-semibold text-slate-700">Waitlist Leads ({leads.length})</span>
            <button
              onClick={loadLeads}
              className="text-slate-400 hover:text-green-600 transition p-1"
              title="Refresh leads"
            >
              <i className="fas fa-sync-alt text-xs"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {leads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <i className="fas fa-envelope text-2xl text-slate-300"></i>
                </div>
                <p>No leads yet</p>
                <p className="text-sm mt-2">Leads will appear here when people sign up on the landing page</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {leads.map(lead => (
                  <div key={lead.id} className="p-4 hover:bg-slate-50 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-user text-green-600 text-sm"></i>
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{lead.email}</div>
                          <div className="text-sm text-slate-600 flex items-center gap-2">
                            <i className="fas fa-map-marker-alt text-xs"></i>
                            {lead.postcode}
                            {lead.signupForOther && (
                              <>
                                <span>&bull;</span>
                                <span className="text-amber-600 font-medium">Signing up for someone else</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">
                          {new Date(lead.timestamp?.toMillis?.() || lead.timestamp || 0).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(lead.timestamp?.toMillis?.() || lead.timestamp || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full font-medium">
                        {lead.source}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">
                        ID: {lead.id?.slice(-8)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Matching Tab */
        <div className="flex flex-col gap-6 h-full pb-8">
          {/* Status Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-users text-purple-600"></i>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {matchingStats?.total_users || 0}
                  </div>
                  <div className="text-sm text-slate-500">Total Eligible Users</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-check-circle text-green-600"></i>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {matchingStats?.matched_users || 0}
                  </div>
                  <div className="text-sm text-slate-500">Matched Users</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-clock text-amber-600"></i>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {matchingStats?.unmatched_users || 0}
                  </div>
                  <div className="text-sm text-slate-500">Unmatched Users</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Matching Actions</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <button
                onClick={handleRunMatching}
                disabled={matchingLoading}
                className="col-span-1 md:col-span-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-4 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                <i className="fas fa-bolt"></i>
                Run Matching Algorithm
              </button>

              <button
                onClick={seedTestData}
                disabled={matchingLoading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white px-4 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                <i className="fas fa-seedling"></i>
                Seed Test Data
              </button>

              <button
                onClick={cleanTestData}
                disabled={matchingLoading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-4 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                <i className="fas fa-trash"></i>
                Clear Test Data
              </button>
            </div>

            {matchingResult && (
              <div className={`border rounded-xl p-4 mb-4 ${matchingResult.includes('❌') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                <div className="text-sm font-medium">{matchingResult}</div>
              </div>
            )}

            {matchingLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                <span className="ml-2 text-slate-600">Processing...</span>
              </div>
            )}
          </div>

          {/* Pending Groups Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-amber-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-900">Pending Groups (Needs Approval)</span>
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">{pendingGroups.length}</span>
              </div>
              <button
                onClick={loadMatchingData}
                className="text-amber-400 hover:text-amber-600 transition p-1"
                title="Refresh groups"
              >
                <i className="fas fa-sync-alt text-xs"></i>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[500px]">
              {pendingGroups.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">
                  No pending groups. Run matching to create new groups.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingGroups.map(group => (
                    <div key={group.group_id} className="p-4 hover:bg-amber-50/20 transition">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                            <i className="fas fa-users-cog text-amber-600"></i>
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">{group.name}</div>
                            <div className="text-sm text-slate-600 flex items-center gap-2">
                              <i className="fas fa-map-marker-alt text-xs"></i>
                              {formatLocationDisplay(group.location) || `${group.location.city}, ${group.location.state_code}`}
                              <span>&bull;</span>
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">{group.life_stage}</span>
                              <span>&bull;</span>
                              <span>{group.member_ids.length} members</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                          <button
                            onClick={() => handleApproveGroup(group.group_id)}
                            disabled={matchingLoading}
                            className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5"
                          >
                            <i className="fas fa-check"></i>
                            Approve & Send Emails
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.group_id)}
                            disabled={matchingLoading}
                            className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5"
                          >
                            <i className="fas fa-trash"></i>
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Member Preview */}
                      <div className="mt-2 bg-slate-50 rounded-xl p-3 text-xs md:text-sm">
                        <div className="text-slate-500 mb-2 font-medium">Members ({group.member_ids.length})</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {group.member_emails.map((email, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-slate-700">
                              <i className="fas fa-user-circle text-slate-300"></i>
                              <span>{email || 'No email'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Groups Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="font-semibold text-slate-700">Active Groups ({activeGroups.length})</span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[500px]">
              {activeGroups.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <i className="fas fa-users text-2xl text-slate-300"></i>
                  </div>
                  <p>No active groups yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeGroups.map(group => (
                    <div key={group.group_id} className="p-4 hover:bg-slate-50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${group.test_mode ? 'bg-blue-100' : 'bg-purple-100'
                            }`}>
                            <i className={`fas fa-users text-sm ${group.test_mode ? 'text-blue-600' : 'text-purple-600'
                              }`}></i>
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">{group.name}</div>
                            <div className="text-sm text-slate-600 flex items-center gap-2">
                              <i className="fas fa-map-marker-alt text-xs"></i>
                              {formatLocationDisplay(group.location) || `${group.location.city}, ${group.location.state_code}`}
                              <span>&bull;</span>
                              <span>{group.life_stage}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">
                            {new Date(group.created_at?.toMillis?.() || group.created_at || 0).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs mt-2">
                        <span className={`px-2 py-1 rounded-full font-medium ${group.test_mode
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-purple-50 text-purple-700'
                          }`}>
                          {group.test_mode ? 'Test Group' : 'Production'}
                        </span>
                        <span className="px-2 py-1 rounded-full font-medium bg-green-50 text-green-700">
                          Active
                        </span>
                        <span className="text-slate-400 px-1">
                          {group.member_ids.length} members
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

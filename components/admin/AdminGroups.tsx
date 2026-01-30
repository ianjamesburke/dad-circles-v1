import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { database } from '../../database';
import { Group, UserProfile } from '../../types';
import { formatChildInfo } from '../../utils/childDisplay';

type TabType = 'pending' | 'active';

export const AdminGroups: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingResult, setMatchingResult] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsData, profilesData] = await Promise.all([
        database.getAllGroups(),
        database.getAllProfiles(),
      ]);
      setGroups(groupsData);
      setProfiles(profilesData);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingGroups = groups.filter(g => g.status === 'pending');
  const activeGroups = groups.filter(g => g.status === 'active' || g.status === 'inactive');

  const displayedGroups = activeTab === 'pending' ? pendingGroups : activeGroups;

  const getGroupMembers = (group: Group): UserProfile[] => {
    return profiles.filter(p => group.member_ids.includes(p.session_id));
  };

  const handleApprove = async (groupId: string) => {
    if (!window.confirm('Approve this group and send introduction emails to all members?')) return;

    setActionLoading(groupId);
    setActionResult('');
    try {
      const result = await database.approveGroup(groupId);
      setActionResult(`✅ ${result.message}`);
      await loadData();
    } catch (error) {
      setActionResult(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setActionLoading(null);
  };

  const handleDelete = async (groupId: string) => {
    if (!window.confirm('Delete this group? Members will be returned to the unmatched pool.')) return;

    setActionLoading(groupId);
    setActionResult('');
    try {
      const result = await database.deleteGroup(groupId);
      setActionResult(`✅ ${result.message}`);
      await loadData();
    } catch (error) {
      setActionResult(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setActionLoading(null);
  };

  const handleRunMatching = async () => {
    setMatchingLoading(true);
    setMatchingResult('');
    try {
      const result = await database.runMatchingAlgorithm();
      if (result.success) {
        setMatchingResult(`✅ ${result.result.summary}`);
        await loadData();
      } else {
        setMatchingResult(`❌ ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMatchingResult(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setMatchingLoading(false);
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRunMatching}
            disabled={matchingLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
          >
            <i className={`fas ${matchingLoading ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
            Run Matching Algorithm
          </button>
          <Link
            to="/admin/tools"
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            Generate Test Users
          </Link>
        </div>

        {matchingResult && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${matchingResult.includes('❌')
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-green-500/10 border border-green-500/20 text-green-400'
            }`}>
            {matchingResult}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2 ${activeTab === 'pending'
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
        >
          <i className="fas fa-clock"></i>
          Pending Approval
          {pendingGroups.length > 0 && (
            <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
              {pendingGroups.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2 ${activeTab === 'active'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
        >
          <i className="fas fa-check-circle"></i>
          Active Groups
          <span className="text-slate-500">({activeGroups.length})</span>
        </button>
        <div className="flex-1"></div>
        <button
          onClick={loadData}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg transition flex items-center gap-2"
        >
          <i className="fas fa-sync-alt"></i>
          Refresh
        </button>
      </div>

      {/* Action Result */}
      {actionResult && (
        <div className={`p-4 rounded-lg ${actionResult.includes('❌')
          ? 'bg-red-500/10 border border-red-500/20 text-red-400'
          : 'bg-green-500/10 border border-green-500/20 text-green-400'
          }`}>
          {actionResult}
        </div>
      )}

      {/* Groups List */}
      {displayedGroups.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className={`fas ${activeTab === 'pending' ? 'fa-clock' : 'fa-user-group'} text-slate-600 text-2xl`}></i>
          </div>
          <p className="text-slate-500">
            {activeTab === 'pending'
              ? 'No pending groups. Run matching to create new groups.'
              : 'No active groups yet.'}
          </p>
          {activeTab === 'pending' && (
            <Link
              to="/admin"
              className="text-blue-400 text-sm mt-2 inline-block hover:text-blue-300"
            >
              Go to Overview to run matching →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedGroups.map(group => {
            const members = getGroupMembers(group);
            const isExpanded = expandedGroup === group.group_id;
            const isLoading = actionLoading === group.group_id;

            return (
              <div
                key={group.group_id}
                className={`bg-slate-900 border rounded-xl overflow-hidden transition ${activeTab === 'pending' ? 'border-amber-500/30' : 'border-slate-800'
                  }`}
              >
                {/* Group Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-slate-800/50 transition"
                  onClick={() => setExpandedGroup(isExpanded ? null : group.group_id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeTab === 'pending' ? 'bg-amber-500/20' : 'bg-purple-500/20'
                      }`}>
                      <i className={`fas fa-user-group ${activeTab === 'pending' ? 'text-amber-400' : 'text-purple-400'
                        }`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium">{group.name}</h3>
                      <p className="text-slate-500 text-sm">
                        {group.location.city}, {group.location.state_code} • {group.life_stage} • {group.member_ids.length} members
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {activeTab === 'pending' ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApprove(group.group_id); }}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                          >
                            {isLoading ? (
                              <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                              <i className="fas fa-check"></i>
                            )}
                            Approve & Send
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(group.group_id); }}
                            disabled={isLoading}
                            className="bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                          >
                            <i className="fas fa-trash"></i>
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="bg-green-500/10 text-green-400 px-3 py-1.5 rounded-lg text-sm font-medium">
                          Active
                        </span>
                      )}
                      <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-slate-500`}></i>
                    </div>
                  </div>
                </div>

                {/* Expanded Members */}
                {isExpanded && (
                  <div className="border-t border-slate-800 p-4 bg-slate-800/30">
                    <h4 className="text-slate-400 text-sm font-medium mb-3">Group Members</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {members.map(member => (
                        <Link
                          key={member.session_id}
                          to={`/admin/users/${member.session_id}`}
                          className="bg-slate-800 rounded-lg p-4 hover:bg-slate-700 transition"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                              <i className="fas fa-user text-slate-500"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">
                                {member.email || 'No email'}
                              </p>
                              <p className="text-slate-500 text-xs mt-1">
                                {member.location ? `${member.location.city}, ${member.location.state_code}` : 'No location'}
                              </p>
                              {member.children && member.children.length > 0 && (
                                <p className="text-slate-500 text-xs mt-1">
                                  {formatChildInfo(member.children[0])}
                                </p>
                              )}
                            </div>
                            <i className="fas fa-arrow-right text-slate-600"></i>
                          </div>
                        </Link>
                      ))}
                    </div>

                    {/* Group Meta */}
                    <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>Created: {new Date(group.created_at?.toMillis?.() || group.created_at || 0).toLocaleString()}</span>
                      {group.introduction_email_sent_at && (
                        <span>Emails sent: {new Date(group.introduction_email_sent_at?.toMillis?.() || group.introduction_email_sent_at || 0).toLocaleString()}</span>
                      )}
                      <span className="font-mono">ID: {group.group_id}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

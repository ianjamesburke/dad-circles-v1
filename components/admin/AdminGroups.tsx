import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { database } from '../../database';
import { Group, UserProfile } from '../../types';
import { formatLocationDisplay } from '../../utils/location';
import { formatChildrenSummary } from '../../utils/childDisplay';

type TabType = 'active' | 'create';

interface EnrichedUser {
  session_id: string;
  email?: string;
  name?: string;
  location?: {
    city: string;
    state_code: string;
    country_code?: string;
  };
  children: any[];
  interests: string[];
  life_stage: string | null;
  child_age: string | null;
  child_summary?: string | null;
  child_count?: number;
  area_key?: string | null;
  area_label?: string | null;
}

interface AreaOption {
  key: string;
  label: string;
  count: number;
}

export const AdminGroups: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  
  // Active groups state
  const [groups, setGroups] = useState<Group[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  // Create group state
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [groupScore, setGroupScore] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedLifeStage, setSelectedLifeStage] = useState<string>('all');
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [matchableCounts, setMatchableCounts] = useState<{ unmatchedCount: number; filteredCount: number } | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (activeTab === 'create') {
      loadUsers();
    }
  }, [activeTab, selectedArea, selectedLifeStage]);

  const loadGroups = async () => {
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

  const loadUsers = async () => {
    setUsersLoading(true);
    setError('');
    try {
      const result = await database.getMatchableUsers({
        areaKey: selectedArea !== 'all' ? selectedArea : undefined,
        lifeStage: selectedLifeStage !== 'all' ? selectedLifeStage : undefined,
      });
      setUsers(result.users || []);
      setAreas(result.areas || []);
      setMatchableCounts({
        unmatchedCount: result.unmatchedCount || 0,
        filteredCount: result.filteredCount || 0,
      });
    } catch (error) {
      setError(`Failed to load users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setUsersLoading(false);
  };

  const activeGroups = groups.filter(g => g.status === 'active');
  const deletedGroups = groups.filter(g => g.status === 'deleted');
  const displayedGroups = showDeleted ? deletedGroups : activeGroups;

  const getGroupMembers = (group: Group): UserProfile[] => {
    return profiles.filter(p => group.member_ids.includes(p.session_id));
  };

  const handleDelete = async (groupId: string) => {
    if (!window.confirm('Delete this group? Members will be returned to the unmatched pool.')) return;

    setActionLoading(groupId);
    setActionResult('');
    try {
      const result = await database.deleteGroup(groupId);
      setActionResult(`✅ ${result.message}`);
      await loadGroups();
      // Reload users if on create tab
      if (activeTab === 'create') {
        await loadUsers();
      }
    } catch (error) {
      setActionResult(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setActionLoading(null);
  };

  // Create group functions
  const filteredUsers = users;

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      if (newSelected.size >= 6) {
        setError('Maximum 6 users per group');
        return;
      }
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
    setError('');

    if (newSelected.size >= 2) {
      calculateScore(Array.from(newSelected));
    } else {
      setGroupScore(null);
    }
  };

  const calculateScore = async (userIds: string[]) => {
    try {
      const result = await database.calculateMatchabilityScore(userIds);
      setGroupScore(result.score);
    } catch (error) {
      console.error('Error calculating score:', error);
    }
  };

  const handleCreate = async () => {
    if (selectedUserIds.size === 0) {
      setError('Select at least 1 user');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const result = await database.createManualGroup(
        Array.from(selectedUserIds),
        groupName || undefined
      );

      if (result.success) {
        setActionResult(`✅ ${result.message}`);
        setSelectedUserIds(new Set());
        setGroupName('');
        setGroupScore(null);
        await loadGroups();
        await loadUsers();
        setActiveTab('active');
      } else {
        setError(result.message || 'Failed to create group');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create group');
    }

    setCreating(false);
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-slate-500';
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading && activeTab === 'active') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'active'
                ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <i className="fas fa-users mr-2"></i>
            Active Groups ({activeGroups.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 px-6 py-4 font-medium transition ${
              activeTab === 'create'
                ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <i className="fas fa-plus-circle mr-2"></i>
            Create New Group
          </button>
        </div>

        {/* Action Result Banner */}
        {actionResult && (
          <div
            className={`px-6 py-3 border-b border-slate-800 ${
              actionResult.includes('❌')
                ? 'bg-red-500/10 text-red-400'
                : 'bg-green-500/10 text-green-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{actionResult}</span>
              <button
                onClick={() => setActionResult('')}
                className="text-slate-500 hover:text-white"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Groups Tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {/* Deleted toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleted(false)}
              className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
                !showDeleted
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Active ({activeGroups.length})
            </button>
            <button
              onClick={() => setShowDeleted(true)}
              className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
                showDeleted
                  ? 'bg-slate-700 text-slate-300 border border-slate-600'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Deleted ({deletedGroups.length})
            </button>
            <div className="flex-1"></div>
            <button
              onClick={loadGroups}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition text-sm"
            >
              <i className="fas fa-sync-alt mr-2"></i>
              Refresh
            </button>
          </div>

          {/* Groups List */}
          {displayedGroups.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className={`fas ${showDeleted ? 'fa-trash' : 'fa-user-group'} text-slate-600 text-2xl`}></i>
              </div>
              <p className="text-slate-500">
                {showDeleted ? 'No deleted groups.' : 'No active groups. Create one to get started.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedGroups.map(group => {
                const members = getGroupMembers(group);
                const isExpanded = expandedGroup === group.group_id;
                const isLoading = actionLoading === group.group_id;

                return (
                  <div
                    key={group.group_id}
                    className={`bg-slate-900 border rounded-xl overflow-hidden transition ${
                      showDeleted ? 'border-slate-700 opacity-60' : 'border-slate-800'
                    }`}
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-slate-800/50 transition"
                      onClick={() => setExpandedGroup(isExpanded ? null : group.group_id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          showDeleted ? 'bg-slate-700' : 'bg-purple-500/20'
                        }`}>
                          <i className={`fas fa-user-group ${showDeleted ? 'text-slate-500' : 'text-purple-400'}`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium">{group.name}</h3>
                          <p className="text-slate-500 text-sm">
                            {formatLocationDisplay(group.location) || `${group.location.city}, ${group.location.state_code}`} •{' '}
                            {group.life_stage} • {group.member_ids.length} members
                            {group.matchability_score && (
                              <span className={`ml-2 ${getScoreColor(group.matchability_score)}`}>
                                • Score: {group.matchability_score}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {!showDeleted && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(group.group_id);
                              }}
                              disabled={isLoading}
                              className="bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition"
                            >
                              {isLoading ? (
                                <i className="fas fa-spinner fa-spin"></i>
                              ) : (
                                <i className="fas fa-trash"></i>
                              )}
                            </button>
                          )}
                          <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-slate-500`}></i>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-800 p-4 bg-slate-800/30">
                        <h4 className="text-slate-400 text-sm font-medium mb-3">Members</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {members.map(member => (
                            <Link
                              key={member.session_id}
                              to={`/admin/users/${member.session_id}`}
                              className="bg-slate-800 rounded-lg p-3 hover:bg-slate-700 transition"
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
                                    {formatLocationDisplay(member.location) || 'No location'}
                                  </p>
                                  {member.children && member.children.length > 0 && (
                                    <p className="text-slate-500 text-xs mt-1">
                                      {formatChildrenSummary(member.children)}
                                    </p>
                                  )}
                                </div>
                                <i className="fas fa-arrow-right text-slate-600"></i>
                              </div>
                            </Link>
                          ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-4 text-xs text-slate-500">
                          <span>
                            Created: {new Date(group.created_at?.toMillis?.() || group.created_at || 0).toLocaleString()}
                          </span>
                          {group.introduction_email_sent_at && (
                            <span>
                              Emails sent:{' '}
                              {new Date(
                                group.introduction_email_sent_at?.toMillis?.() || group.introduction_email_sent_at || 0
                              ).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Group Tab */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content - User selection */}
          <div className="lg:col-span-2 space-y-4">
            {/* Area + life stage filters */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-sm mb-2 block">Area</label>
                  <select
                    value={selectedArea}
                    onChange={(e) => {
                      setSelectedArea(e.target.value);
                      setSelectedUserIds(new Set());
                      setGroupScore(null);
                    }}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none w-full"
                  >
                    <option value="all">Select an area ({areas.length} areas)</option>
                    {areas.map(area => (
                      <option key={area.key} value={area.key}>
                        {area.label} ({area.count} users)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-sm mb-2 block">Life Stage</label>
                  <select
                    value={selectedLifeStage}
                    onChange={(e) => {
                      setSelectedLifeStage(e.target.value);
                      setSelectedUserIds(new Set());
                      setGroupScore(null);
                    }}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none w-full"
                  >
                    <option value="all">All life stages</option>
                    <option value="Expecting">Expecting</option>
                    <option value="Newborn">Newborn</option>
                    <option value="Infant">Infant</option>
                    <option value="Toddler">Toddler</option>
                  </select>
                </div>
              </div>
              {matchableCounts && (
                <p className="mt-3 text-xs text-slate-500">
                  Unmatched pool: {matchableCounts.unmatchedCount}
                  {selectedArea !== 'all' && ` • Candidates shown: ${matchableCounts.filteredCount}`}
                </p>
              )}
              {error && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* User table */}
            {usersLoading ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : selectedArea === 'all' ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-map-marker-alt text-slate-600 text-2xl"></i>
                </div>
                <p className="text-slate-500 mb-2">Select an area to load candidates</p>
                <p className="text-slate-600 text-sm">
                  Areas are derived from postcode area when available, otherwise city/state
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-users text-slate-600 text-2xl"></i>
                </div>
                <p className="text-slate-500 mb-2">No candidates found for this filter</p>
                <p className="text-slate-600 text-sm">
                  Try another area or life stage, or generate test users in Admin Tools
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-800 text-slate-400 text-sm">
                    <tr>
                      <th className="text-left p-3 w-12"></th>
                      <th className="text-left p-3">Name/Email</th>
                      <th className="text-left p-3">Matching Child</th>
                      <th className="text-left p-3">Area</th>
                      <th className="text-left p-3">Interests</th>
                    </tr>
                  </thead>
                  <tbody className="text-white">
                    {filteredUsers.map(user => (
                      <tr
                        key={user.session_id}
                        className={`border-t border-slate-700 hover:bg-slate-800/50 transition cursor-pointer ${
                          selectedUserIds.has(user.session_id) ? 'bg-blue-500/10' : ''
                        }`}
                        onClick={() => toggleUser(user.session_id)}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.has(user.session_id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleUser(user.session_id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{user.name || user.email || 'No name'}</div>
                          {user.name && user.email && (
                            <div className="text-xs text-slate-500">{user.email}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 bg-slate-700 px-2.5 py-1 rounded-full text-sm">
                            {user.child_summary || user.child_age || 'No data'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-slate-400">
                          {user.area_label || (user.location ? formatLocationDisplay(user.location) : 'No location')}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {user.interests.slice(0, 3).map((interest, i) => (
                              <span
                                key={i}
                                className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs"
                              >
                                {interest}
                              </span>
                            ))}
                            {user.interests.length > 3 && (
                              <span className="text-slate-500 text-xs">
                                +{user.interests.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar - Draft group */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sticky top-6">
              <h3 className="text-white font-semibold mb-4">Draft Group</h3>

              {selectedUserIds.size === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <i className="fas fa-users text-3xl mb-3 block"></i>
                  <p className="text-sm">Select users to create a group</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="text-slate-400 text-sm mb-2 block">Group Name (optional)</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Auto-generated if empty"
                      className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>

                  <div className="bg-slate-800 rounded-lg p-4 mb-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Members</span>
                      <span className="text-white font-medium">{selectedUserIds.size}</span>
                    </div>
                    {groupScore !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Match Score</span>
                        <span className={`font-bold ${getScoreColor(groupScore)}`}>
                          {groupScore}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    {Array.from(selectedUserIds).map(userId => {
                      const user = users.find(u => u.session_id === userId);
                      if (!user) return null;
                      return (
                        <div
                          key={userId}
                          className="bg-slate-800 rounded-lg p-3 flex items-start gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {user.name || user.email}
                            </p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {(user.child_summary || user.child_age || 'No child data')} • {user.area_label || user.location?.city || 'No area'}
                            </p>
                          </div>
                          <button
                            onClick={() => toggleUser(userId)}
                            className="text-slate-500 hover:text-red-400 transition"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleCreate}
                    disabled={creating || selectedUserIds.size === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Creating...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane"></i>
                        Create & Send Emails
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

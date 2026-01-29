import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { database } from '../../database';
import { Group, UserProfile } from '../../types';
import { formatChildDate } from '../../utils/childDisplay';

export const AdminGroupDetail: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState('');

  const loadData = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const groupData = await database.getGroup(groupId);
      setGroup(groupData || null);

      if (groupData) {
        const allProfiles = await database.getAllProfiles();
        const groupMembers = allProfiles.filter(p => groupData.member_ids.includes(p.session_id));
        setMembers(groupMembers);
      }
    } catch (error) {
      console.error('Error loading group:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [groupId]);

  const handleApprove = async () => {
    if (!group || !window.confirm('Approve this group and send introduction emails?')) return;
    
    setActionLoading(true);
    setActionResult('');
    try {
      const result = await database.approveGroup(group.group_id);
      setActionResult(`✅ ${result.message}`);
      await loadData();
    } catch (error) {
      setActionResult(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!group || !window.confirm('Delete this group? Members will be returned to the unmatched pool.')) return;
    
    setActionLoading(true);
    try {
      await database.deleteGroup(group.group_id);
      navigate('/admin/groups');
    } catch (error) {
      setActionResult(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
      setActionLoading(false);
    }
  };

  const getAgeGapAnalysis = () => {
    if (members.length === 0) return null;

    const childDates = members
      .filter(m => m.children && m.children.length > 0)
      .map(m => {
        const child = m.children[0];
        const birthMonth = child.birth_month ?? 6; // Default to mid-year if month not provided
        return {
          date: new Date(child.birth_year, birthMonth - 1),
          type: child.type,
          member: m,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (childDates.length < 2) return null;

    const oldest = childDates[0];
    const youngest = childDates[childDates.length - 1];
    const gapMonths = Math.round((youngest.date.getTime() - oldest.date.getTime()) / (1000 * 60 * 60 * 24 * 30));

    return { oldest, youngest, gapMonths };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-user-group text-slate-600 text-2xl"></i>
        </div>
        <p className="text-slate-500">Group not found</p>
        <Link to="/admin/groups" className="text-blue-400 text-sm mt-2 inline-block">
          ← Back to Groups
        </Link>
      </div>
    );
  }

  const ageGap = getAgeGapAnalysis();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/groups')}
          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-white">{group.name}</h1>
          <p className="text-slate-500 text-sm">
            {group.location.city}, {group.location.state_code} • {group.life_stage}
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
          group.status === 'pending'
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            : 'bg-green-500/10 text-green-400 border border-green-500/20'
        }`}>
          {group.status === 'pending' ? 'Pending Approval' : 'Active'}
        </span>
      </div>

      {/* Action Result */}
      {actionResult && (
        <div className={`p-4 rounded-lg ${
          actionResult.includes('❌')
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-green-500/10 border border-green-500/20 text-green-400'
        }`}>
          {actionResult}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Group Info */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-medium mb-4">Group Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Location</p>
                <p className="text-white">{group.location.city}, {group.location.state_code}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Life Stage</p>
                <p className="text-white">{group.life_stage}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Members</p>
                <p className="text-white">{group.member_ids.length}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Created</p>
                <p className="text-white">{new Date(group.created_at?.toMillis?.() || group.created_at || 0).toLocaleString()}</p>
              </div>
              {group.introduction_email_sent_at && (
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Emails Sent</p>
                  <p className="text-white">{new Date(group.introduction_email_sent_at?.toMillis?.() || group.introduction_email_sent_at || 0).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Age Gap Analysis */}
          {ageGap && (
            <div className={`border rounded-xl p-5 ${
              ageGap.gapMonths > 6 
                ? 'bg-amber-500/10 border-amber-500/20' 
                : 'bg-green-500/10 border-green-500/20'
            }`}>
              <h3 className={`font-medium mb-4 ${
                ageGap.gapMonths > 6 ? 'text-amber-400' : 'text-green-400'
              }`}>
                Age Gap Analysis
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-400">Oldest child</p>
                  <p className="text-white">
                    {ageGap.oldest.type === 'expecting' ? 'Due' : 'Born'}{' '}
                    {ageGap.oldest.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Youngest child</p>
                  <p className="text-white">
                    {ageGap.youngest.type === 'expecting' ? 'Due' : 'Born'}{' '}
                    {ageGap.youngest.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className={`pt-2 border-t ${
                  ageGap.gapMonths > 6 ? 'border-amber-500/30' : 'border-green-500/30'
                }`}>
                  <p className="text-slate-400">Gap</p>
                  <p className={`text-lg font-semibold ${
                    ageGap.gapMonths > 6 ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {ageGap.gapMonths} months
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {group.status === 'pending' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-white font-medium mb-4">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fas fa-check"></i>
                  )}
                  Approve & Send Emails
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="w-full bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  <i className="fas fa-trash"></i>
                  Delete Group
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Members */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-white font-medium">Group Members ({members.length})</h3>
            </div>
            <div className="divide-y divide-slate-800">
              {members.map(member => (
                <Link
                  key={member.session_id}
                  to={`/admin/users/${member.session_id}`}
                  className="p-4 flex items-start gap-4 hover:bg-slate-800/50 transition"
                >
                  <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-user text-slate-500"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">
                      {member.email || 'No email'}
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                      {member.location ? `${member.location.city}, ${member.location.state_code}` : 'No location'}
                    </p>
                    {member.children && member.children.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {member.children.map((child, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs"
                          >
                            {child.type === 'expecting' ? '🤰' : '👶'}{' '}
                            {child.type === 'expecting' ? 'Due' : 'Born'} {formatChildDate(child)}
                          </span>
                        ))}
                      </div>
                    )}
                    {member.interests && member.interests.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {member.interests.slice(0, 3).map((interest, idx) => (
                          <span
                            key={idx}
                            className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs"
                          >
                            {interest}
                          </span>
                        ))}
                        {member.interests.length > 3 && (
                          <span className="text-slate-500 text-xs">
                            +{member.interests.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <i className="fas fa-arrow-right text-slate-600 mt-4"></i>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

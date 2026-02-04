import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { database } from '../../database';
import { UserProfile, Message, Role, Group } from '../../types';
import { formatLocationDisplay } from '../../utils/location';
import { formatChildDate, isExpecting } from '../../utils/childDisplay';

export const AdminUserDetail: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminInput, setAdminInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingAbandonmentEmail, setSendingAbandonmentEmail] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [abandonmentEmailStatus, setAbandonmentEmailStatus] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [profileData, messagesData] = await Promise.all([
        database.getProfile(userId),
        database.getMessages(userId),
      ]);
      setProfile(profileData || null);
      setMessages(messagesData);

      // Load group if user is matched
      if (profileData?.group_id) {
        const groupData = await database.getGroup(profileData.group_id);
        setGroup(groupData || null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !adminInput.trim() || sending) return;

    setSending(true);
    try {
      await database.addMessage({
        session_id: userId,
        role: Role.ADMIN,
        content: adminInput.trim(),
      });
      setAdminInput('');
      await loadData();
    } catch (error) {
      console.error('Error sending message:', error);
    }
    setSending(false);
  };

  const handleSendAbandonmentEmail = async () => {
    if (!userId || sendingAbandonmentEmail) return;

    setSendingAbandonmentEmail(true);
    setAbandonmentEmailStatus(null);
    try {
      const result = await database.sendManualAbandonmentEmail(userId);
      if (result.success) {
        setAbandonmentEmailStatus({ message: result.message || 'Email sent successfully!', type: 'success' });
        // Re-load data to show updated profile (e.g., abandonment_sent flag)
        await loadData();
      } else {
        setAbandonmentEmailStatus({ message: result.message || 'Failed to send email.', type: 'error' });
      }
    } catch (error: any) {
      console.error('Error sending abandonment email:', error);
      setAbandonmentEmailStatus({ message: error.message || 'An unknown error occurred.', type: 'error' });
    }
    setSendingAbandonmentEmail(false);
  };

  const handleDeleteUser = async () => {
    if (!userId || deletingUser) return;
    const label = profile?.email || userId;
    const confirmed = window.confirm(`Delete user ${label}? This will delete all information associated with this user (profile, messages, and leads).`);
    if (!confirmed) return;

    setDeletingUser(true);
    try {
      await database.deleteUserData(userId);
      setToast({ message: 'User deleted.', type: 'success' });
      navigate('/admin/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      setToast({ message: 'Failed to delete user.', type: 'error' });
    }
    setDeletingUser(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-user-slash text-slate-600 text-2xl"></i>
        </div>
        <p className="text-slate-500">User not found</p>
        <Link to="/admin/users" className="text-blue-400 text-sm mt-2 inline-block">
          ← Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`p-3 rounded-lg text-sm ${toast.type === 'success'
          ? 'bg-green-500/10 border border-green-500/20 text-green-400'
          : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/users')}
          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-white">
            {profile.email || `User ${profile.session_id.slice(0, 8)}...`}
          </h1>
          <p className="text-slate-500 text-sm font-mono">{profile.session_id}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
          profile.onboarded 
            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        }`}>
          {profile.onboarded ? 'Onboarded' : profile.onboarding_step}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Basic Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-medium mb-4">Profile Information</h3>
            <div className="space-y-4">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Email</p>
                <p className="text-white">{profile.email || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Location</p>
                <p className="text-white">
                  {formatLocationDisplay(profile.location) || '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Postcode</p>
                <p className="text-white">{profile.postcode || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Matching Eligible</p>
                <p className={profile.matching_eligible ? 'text-green-400' : 'text-slate-500'}>
                  {profile.matching_eligible ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Last Updated</p>
                <p className="text-white">{new Date(profile.last_updated?.toMillis?.() || profile.last_updated || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Admin Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-medium mb-4">Admin Actions</h3>
            <div className="space-y-4">
              <button
                onClick={handleSendAbandonmentEmail}
                disabled={profile.onboarded || sendingAbandonmentEmail}
                className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <i className="fas fa-envelope"></i>
                {sendingAbandonmentEmail ? 'Sending...' : 'Send Abandonment Email'}
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <i className="fas fa-trash"></i>
                {deletingUser ? 'Deleting...' : 'Delete User'}
              </button>
              {abandonmentEmailStatus && (
                <div className={`text-sm text-center p-2 rounded-lg ${
                  abandonmentEmailStatus.type === 'success' 
                    ? 'bg-green-500/10 text-green-400' 
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {abandonmentEmailStatus.message}
                </div>
              )}
              {profile.onboarded && (
                <p className="text-xs text-slate-500 text-center">User has completed onboarding.</p>
              )}
            </div>
          </div>

          {/* Children */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-medium mb-4">Children</h3>
            {profile.children && profile.children.length > 0 ? (
              <div className="space-y-3">
                {profile.children.map((child, idx) => (
                  <div key={idx} className="bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <i className={`fas ${isExpecting(child) ? 'fa-baby-carriage' : 'fa-baby'} text-blue-400`}></i>
                      <span className="text-white font-medium">
                        {isExpecting(child) ? 'Expecting' : 'Child'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">
                      {isExpecting(child) ? 'Due' : 'Born'}: {formatChildDate(child)}
                    </p>
                    {child.gender && (
                      <p className="text-slate-400 text-sm">Gender: {child.gender}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No children info</p>
            )}

            {profile.siblings && profile.siblings.length > 0 && (
              <>
                <h4 className="text-slate-400 text-sm font-medium mt-4 mb-2">Other Children</h4>
                <div className="space-y-2">
                  {profile.siblings.map((sibling, idx) => (
                    <div key={idx} className="bg-slate-800/50 rounded-lg p-2 text-sm">
                      <p className="text-slate-400">
                        Born {formatChildDate(sibling)}
                        {sibling.gender && ` • ${sibling.gender}`}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Interests */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-medium mb-4">Interests</h3>
            {profile.interests && profile.interests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, idx) => (
                  <span key={idx} className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-sm">
                    {interest}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No interests specified</p>
            )}
          </div>

          {/* Group Info */}
          {group && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-5">
              <h3 className="text-purple-400 font-medium mb-4">Matched Group</h3>
              <div className="space-y-2">
                <p className="text-white font-medium">{group.name}</p>
                <p className="text-slate-400 text-sm">
                  {formatLocationDisplay(group.location) || `${group.location.city}, ${group.location.state_code}`}
                </p>
                <p className="text-slate-400 text-sm">{group.life_stage}</p>
                <p className="text-slate-400 text-sm">{group.member_ids.length} members</p>
                <Link
                  to={`/admin/groups/${group.group_id}`}
                  className="text-purple-400 text-sm hover:text-purple-300 inline-block mt-2"
                >
                  View Group →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Conversation */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-[600px] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-white font-medium">Conversation History</h3>
              <span className="text-slate-500 text-sm">{messages.length} messages</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No messages yet
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.role === Role.USER
                        ? 'bg-blue-600 text-white'
                        : msg.role === Role.ADMIN
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-1 text-xs opacity-70">
                        <span className="uppercase font-medium">{msg.role}</span>
                        <span>•</span>
                        <span>{new Date(msg.timestamp?.toMillis?.() || msg.timestamp || 0).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Admin Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <i className="fas fa-shield-halved absolute left-3 top-1/2 -translate-y-1/2 text-amber-500"></i>
                  <input
                    type="text"
                    value={adminInput}
                    onChange={(e) => setAdminInput(e.target.value)}
                    placeholder="Inject admin message..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!adminInput.trim() || sending}
                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 rounded-lg font-medium transition"
                >
                  {sending ? 'Sending...' : 'Inject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

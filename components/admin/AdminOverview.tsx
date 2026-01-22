import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { database } from '../../database';
import { UserProfile, Group, Lead, MatchingStats } from '../../types';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  color: 'blue' | 'green' | 'amber' | 'purple' | 'red';
  subtitle?: string;
  link?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subtitle, link }) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const iconColorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    amber: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400',
    red: 'bg-red-500/20 text-red-400',
  };

  const content = (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${link ? 'hover:border-slate-700 transition cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColorClasses[color]}`}>
          <i className={`fas ${icon}`}></i>
        </div>
      </div>
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
};

export const AdminOverview: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<MatchingStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesData, groupsData, leadsData, statsData] = await Promise.all([
        database.getAllProfiles(),
        database.getAllGroups(),
        database.getAllLeads(),
        database.getMatchingStats(),
      ]);
      setProfiles(profilesData);
      setGroups(groupsData);
      setLeads(leadsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingGroups = groups.filter(g => g.status === 'pending');
  const activeGroups = groups.filter(g => g.status === 'active');
  const onboardedUsers = profiles.filter(p => p.onboarded);
  const eligibleUsers = profiles.filter(p => p.matching_eligible);



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <button
          onClick={loadData}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
        >
          <i className="fas fa-sync-alt"></i>
          Refresh Data
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={profiles.length}
          icon="fa-users"
          color="blue"
          subtitle={`${onboardedUsers.length} onboarded`}
          link="/admin/users"
        />
        <StatCard
          title="Eligible for Matching"
          value={eligibleUsers.length}
          icon="fa-user-check"
          color="green"
          subtitle={`${stats?.matched_users || 0} matched`}
        />
        <StatCard
          title="Pending Groups"
          value={pendingGroups.length}
          icon="fa-clock"
          color="amber"
          subtitle="Awaiting approval"
          link="/admin/groups"
        />
        <StatCard
          title="Waitlist Leads"
          value={leads.length}
          icon="fa-envelope"
          color="purple"
          subtitle={`${leads.filter(l => !profiles.find(p => p.session_id === l.session_id)?.onboarded).length} awaiting onboarding`}
          link="/admin/leads"
        />
      </div>

      {/* Pending Groups Alert */}
      {pendingGroups.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-amber-400"></i>
            </div>
            <div className="flex-1">
              <h3 className="text-amber-400 font-medium">
                {pendingGroups.length} group{pendingGroups.length !== 1 ? 's' : ''} pending approval
              </h3>
              <p className="text-amber-400/70 text-sm">
                Review and approve groups to send introduction emails
              </p>
            </div>
            <Link
              to="/admin/groups"
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              Review Groups
            </Link>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-white">Recent Users</h3>
            <Link to="/admin/users" className="text-blue-400 text-sm hover:text-blue-300">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {profiles.slice(0, 5).map(profile => (
              <Link
                key={profile.session_id}
                to={`/admin/users/${profile.session_id}`}
                className="p-4 flex items-center gap-3 hover:bg-slate-800/50 transition"
              >
                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                  <i className="fas fa-user text-slate-500"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {profile.email || `Session ${profile.session_id.slice(0, 8)}...`}
                  </p>
                  <p className="text-slate-500 text-xs">
                    {profile.location ? `${profile.location.city}, ${profile.location.state_code}` : 'No location'}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${profile.onboarded
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-amber-500/10 text-amber-400'
                  }`}>
                  {profile.onboarded ? 'Complete' : profile.onboarding_step}
                </span>
              </Link>
            ))}
            {profiles.length === 0 && (
              <div className="p-8 text-center text-slate-500">No users yet</div>
            )}
          </div>
        </div>

        {/* Active Groups */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-white">Active Groups</h3>
            <Link to="/admin/groups" className="text-blue-400 text-sm hover:text-blue-300">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {activeGroups.slice(0, 5).map(group => (
              <Link
                key={group.group_id}
                to={`/admin/groups/${group.group_id}`}
                className="p-4 flex items-center gap-3 hover:bg-slate-800/50 transition"
              >
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <i className="fas fa-user-group text-purple-400"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{group.name}</p>
                  <p className="text-slate-500 text-xs">
                    {group.location.city}, {group.location.state_code} • {group.life_stage}
                  </p>
                </div>
                <span className="text-slate-500 text-sm">
                  {group.member_ids.length} members
                </span>
              </Link>
            ))}
            {activeGroups.length === 0 && (
              <div className="p-8 text-center text-slate-500">No active groups yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

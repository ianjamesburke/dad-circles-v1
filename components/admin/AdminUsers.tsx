import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { database } from '../../database';
import { UserProfile, OnboardingStep } from '../../types';

type FilterStatus = 'all' | 'onboarded' | 'in_progress' | 'matched' | 'unmatched';

export const AdminUsers: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterLocation, setFilterLocation] = useState('all');

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await database.getAllProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  // Get unique locations for filter
  const locations = [...new Set(profiles
    .filter(p => p.location)
    .map(p => `${p.location!.city}, ${p.location!.state_code}`)
  )].sort();

  // Filter profiles
  const filteredProfiles = profiles.filter(profile => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        profile.session_id.toLowerCase().includes(query) ||
        profile.email?.toLowerCase().includes(query) ||
        profile.location?.city.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filterStatus === 'onboarded' && !profile.onboarded) return false;
    if (filterStatus === 'in_progress' && profile.onboarded) return false;
    if (filterStatus === 'matched' && !profile.group_id) return false;
    if (filterStatus === 'unmatched' && profile.group_id) return false;

    // Location filter
    if (filterLocation !== 'all') {
      const profileLocation = profile.location ? `${profile.location.city}, ${profile.location.state_code}` : '';
      if (profileLocation !== filterLocation) return false;
    }

    return true;
  });

  const getStatusBadge = (profile: UserProfile) => {
    if (profile.group_id) {
      return <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/10 text-purple-400">Matched</span>;
    }
    if (profile.onboarded) {
      return <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400">Complete</span>;
    }
    return <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-400">{profile.onboarding_step}</span>;
  };

  const getChildInfo = (profile: UserProfile) => {
    if (!profile.children || profile.children.length === 0) return 'No children info';
    const child = profile.children[0];
    if (child.type === 'expecting') {
      return `Expecting ${child.birth_month}/${child.birth_year}`;
    }
    return `Child born ${child.birth_month}/${child.birth_year}`;
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
      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
              <input
                type="text"
                placeholder="Search by email, session ID, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition"
          >
            <option value="all">All Status</option>
            <option value="onboarded">Onboarded</option>
            <option value="in_progress">In Progress</option>
            <option value="matched">Matched</option>
            <option value="unmatched">Unmatched</option>
          </select>

          {/* Location Filter */}
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition"
          >
            <option value="all">All Locations</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={loadProfiles}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg transition flex items-center gap-2"
          >
            <i className="fas fa-sync-alt"></i>
            <span className="hidden md:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex justify-between items-center">
        <p className="text-slate-500 text-sm">
          Showing {filteredProfiles.length} of {profiles.length} users
        </p>
        <Link
          to="/admin/tools"
          className="text-blue-400 text-sm hover:text-blue-300 flex items-center gap-1"
        >
          <i className="fas fa-plus"></i>
          Generate Test Users
        </Link>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Location</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Child Info</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Last Updated</th>
                <th className="text-right px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredProfiles.map(profile => (
                <tr key={profile.session_id} className="hover:bg-slate-800/50 transition">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-user text-slate-500"></i>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {profile.email || 'No email'}
                        </p>
                        <p className="text-slate-500 text-xs font-mono truncate">
                          {profile.session_id.slice(0, 12)}...
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-slate-300 text-sm">
                      {profile.location ? `${profile.location.city}, ${profile.location.state_code}` : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-slate-300 text-sm">{getChildInfo(profile)}</p>
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(profile)}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-slate-500 text-sm">
                      {new Date(profile.last_updated).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      to={`/admin/users/${profile.session_id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProfiles.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-users text-slate-600 text-2xl"></i>
            </div>
            <p className="text-slate-500">No users found</p>
            <p className="text-slate-600 text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

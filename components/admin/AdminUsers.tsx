import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { database } from '../../database';
import { UserProfile } from '../../types';
import { formatChildInfo } from '../../utils/childDisplay';

type FilterStatus = 'all' | 'onboarded' | 'in_progress' | 'matched' | 'unmatched';

export const AdminUsers: React.FC = () => {
  const PAGE_SIZE = 100;
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();

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
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterLocation]);

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

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pagedProfiles = filteredProfiles.slice(pageStart, pageEnd);

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

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
    return formatChildInfo(profile.children[0]);
  };

  const handleDeleteUser = async (profile: UserProfile, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (deletingUserId) return;
    const label = profile.email || profile.session_id;
    const confirmed = window.confirm(`Delete user ${label}? This will delete all information associated with this user (profile, messages, and leads).`);
    if (!confirmed) return;

    setDeletingUserId(profile.session_id);
    try {
      await database.deleteUserData(profile.session_id);
      await loadProfiles();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(profile.session_id);
        return next;
      });
      setToast({ message: 'User deleted.', type: 'success' });
    } catch (error) {
      console.error('Error deleting user:', error);
      setToast({ message: 'Failed to delete user.', type: 'error' });
    }
    setDeletingUserId(null);
  };

  const handleBulkDelete = async () => {
    if (deletingUserId || selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.size} users? This will delete all information associated with these users (profiles, messages, and leads).`
    );
    if (!confirmed) return;

    setDeletingUserId('bulk');
    try {
      for (const id of selectedIds) {
        await database.deleteUserData(id);
      }
      setSelectedIds(new Set());
      await loadProfiles();
      setToast({ message: 'Users deleted.', type: 'success' });
    } catch (error) {
      console.error('Error deleting users:', error);
      setToast({ message: 'Failed to delete selected users.', type: 'error' });
    }
    setDeletingUserId(null);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const profile of pagedProfiles) {
          next.add(profile.session_id);
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const profile of pagedProfiles) {
          next.delete(profile.session_id);
        }
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
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
        <div className="flex items-center gap-4">
          <p className="text-slate-500 text-sm">
            Showing {filteredProfiles.length === 0 ? 0 : pageStart + 1}-{Math.min(pageEnd, filteredProfiles.length)} of {filteredProfiles.length} filtered users
          </p>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deletingUserId !== null}
              className="text-rose-400 hover:text-rose-300 text-sm font-medium disabled:opacity-50"
            >
              {deletingUserId === 'bulk' ? 'Deleting...' : `Delete ${selectedIds.size} Selected`}
            </button>
          )}
        </div>
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
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500"
                    checked={pagedProfiles.length > 0 && pagedProfiles.every((profile) => selectedIds.has(profile.session_id))}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Select all users"
                  />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Location</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Child Info</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Last Updated</th>
                <th className="text-right px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {pagedProfiles.map(profile => (
                <tr
                  key={profile.session_id}
                  className="hover:bg-slate-800/50 transition cursor-pointer"
                  onClick={() => navigate(`/admin/users/${profile.session_id}`)}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500"
                      checked={selectedIds.has(profile.session_id)}
                      onChange={(e) => toggleSelectOne(profile.session_id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${profile.email || profile.session_id}`}
                    />
                  </td>
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
                      {new Date(profile.last_updated?.toMillis?.() || profile.last_updated || 0).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        to={`/admin/users/${profile.session_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                      >
                        View
                      </Link>
                      <button
                        onClick={(e) => handleDeleteUser(profile, e)}
                        className="text-rose-400 hover:text-rose-300 text-sm font-medium disabled:opacity-50"
                        disabled={deletingUserId === profile.session_id}
                      >
                        {deletingUserId === profile.session_id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
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

        {filteredProfiles.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-sm text-slate-400">
            <span>Page {safePage} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage === 1}
                className="px-3 py-1 rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1 rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

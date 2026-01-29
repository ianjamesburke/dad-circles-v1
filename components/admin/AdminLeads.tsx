import React, { useState, useEffect } from 'react';
import { database } from '../../database';
import { Lead, UserProfile } from '../../types';

// Extended lead with linked profile info for display
interface LeadWithProfile extends Lead {
  profile?: UserProfile;
}

export const AdminLeads: React.FC = () => {
  const [leads, setLeads] = useState<LeadWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadLeads = async () => {
    setLoading(true);
    try {
      const [leadsData, profilesData] = await Promise.all([
        database.getAllLeads(),
        database.getAllProfiles()
      ]);
      
      // Create a map of session_id -> profile for quick lookup
      const profileMap = new Map(profilesData.map(p => [p.session_id, p]));
      
      // Enrich leads with their linked profile data
      const enrichedLeads: LeadWithProfile[] = leadsData.map(lead => ({
        ...lead,
        profile: lead.session_id ? profileMap.get(lead.session_id) : undefined
      }));
      
      setLeads(enrichedLeads);
    } catch (error) {
      console.error('Error loading leads:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.email.toLowerCase().includes(query) ||
      lead.postcode.toLowerCase().includes(query)
    );
  });

  const getEmailStatus = (lead: LeadWithProfile) => {
    if (lead.welcomeEmailFailed) {
      return { label: 'Failed', color: 'red' };
    }
    if (lead.welcomeEmailSent) {
      return { label: 'Sent', color: 'green' };
    }
    return { label: 'Pending', color: 'amber' };
  };

  const getOnboardingStatus = (lead: LeadWithProfile) => {
    if (lead.signupForOther) {
      return { label: 'Referral', color: 'slate', icon: 'fa-user-friends' };
    }
    if (!lead.profile) {
      return { label: 'No Profile', color: 'slate', icon: 'fa-question' };
    }
    if (lead.profile.group_id) {
      return { label: 'Matched', color: 'green', icon: 'fa-users' };
    }
    if (lead.profile.onboarded) {
      return { label: 'Onboarded', color: 'blue', icon: 'fa-check' };
    }
    return { label: lead.profile.onboarding_step, color: 'amber', icon: 'fa-spinner' };
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
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <i className="fas fa-envelope text-purple-400"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{leads.length}</p>
              <p className="text-slate-500 text-sm">Total Leads</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <i className="fas fa-check text-blue-400"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {leads.filter(l => l.profile?.onboarded).length}
              </p>
              <p className="text-slate-500 text-sm">Onboarded</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <i className="fas fa-users text-green-400"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {leads.filter(l => l.profile?.group_id).length}
              </p>
              <p className="text-slate-500 text-sm">Matched to Groups</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <i className="fas fa-user-plus text-amber-400"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {leads.filter(l => l.signupForOther).length}
              </p>
              <p className="text-slate-500 text-sm">Referrals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
            <input
              type="text"
              placeholder="Search by email or postcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <button
            onClick={loadLeads}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg transition flex items-center gap-2"
          >
            <i className="fas fa-sync-alt"></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Postcode</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Progress</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Location</th>
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Signed Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLeads.map(lead => {
                const onboardingStatus = getOnboardingStatus(lead);
                return (
                  <tr key={lead.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-envelope text-slate-500"></i>
                        </div>
                        <span className="text-white">{lead.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-300">{lead.postcode}</span>
                    </td>
                    <td className="px-4 py-4">
                      {lead.signupForOther ? (
                        <span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-xs font-medium">
                          Referral
                        </span>
                      ) : (
                        <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-medium">
                          Self
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1.5 ${
                        onboardingStatus.color === 'green' 
                          ? 'bg-green-500/10 text-green-400'
                          : onboardingStatus.color === 'blue'
                          ? 'bg-blue-500/10 text-blue-400'
                          : onboardingStatus.color === 'amber'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        <i className={`fas ${onboardingStatus.icon} text-[10px]`}></i>
                        {onboardingStatus.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {lead.profile?.location ? (
                        <span className="text-slate-300 text-sm">
                          {lead.profile.location.city}, {lead.profile.location.state_code}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-500 text-sm">
                        {new Date(lead.timestamp?.toMillis?.() || lead.timestamp || 0).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLeads.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-envelope text-slate-600 text-2xl"></i>
            </div>
            <p className="text-slate-500">No leads found</p>
            <p className="text-slate-600 text-sm mt-1">
              {searchQuery ? 'Try adjusting your search' : 'Leads will appear when people sign up'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

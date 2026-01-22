import React, { useState } from 'react';
import { database } from '../../database';
import { OnboardingStep, LifeStage } from '../../types';

interface TestUserPreset {
  name: string;
  description: string;
  config: TestUserConfig;
}

interface TestUserConfig {
  email: string;
  city: string;
  stateCode: string;
  childType: 'expecting' | 'existing';
  birthMonth: number;
  birthYear: number;
  interests: string[];
}

const CITIES = [
  { city: 'San Francisco', stateCode: 'CA' },
  { city: 'Austin', stateCode: 'TX' },
  { city: 'New York', stateCode: 'NY' },
  { city: 'Seattle', stateCode: 'WA' },
  { city: 'Denver', stateCode: 'CO' },
  { city: 'Chicago', stateCode: 'IL' },
  { city: 'Los Angeles', stateCode: 'CA' },
  { city: 'Portland', stateCode: 'OR' },
];

const INTERESTS = [
  'Hiking', 'Sports', 'Gaming', 'Reading', 'Cooking', 'Music', 
  'Photography', 'Travel', 'Fitness', 'Movies', 'Tech', 'Outdoors'
];

const PRESETS: TestUserPreset[] = [
  {
    name: 'Expecting Dad - SF',
    description: 'Dad expecting first child in San Francisco',
    config: {
      email: '',
      city: 'San Francisco',
      stateCode: 'CA',
      childType: 'expecting',
      birthMonth: new Date().getMonth() + 4 > 12 ? (new Date().getMonth() + 4) - 12 : new Date().getMonth() + 4,
      birthYear: new Date().getMonth() + 4 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
      interests: ['Hiking', 'Tech'],
    },
  },
  {
    name: 'New Dad - Austin',
    description: 'Dad with newborn (0-6 months) in Austin',
    config: {
      email: '',
      city: 'Austin',
      stateCode: 'TX',
      childType: 'existing',
      birthMonth: new Date().getMonth() - 2 <= 0 ? 12 + (new Date().getMonth() - 2) : new Date().getMonth() - 2,
      birthYear: new Date().getMonth() - 2 <= 0 ? new Date().getFullYear() - 1 : new Date().getFullYear(),
      interests: ['Sports', 'Gaming'],
    },
  },
  {
    name: 'Infant Dad - NYC',
    description: 'Dad with infant (6-18 months) in New York',
    config: {
      email: '',
      city: 'New York',
      stateCode: 'NY',
      childType: 'existing',
      birthMonth: new Date().getMonth() - 10 <= 0 ? 12 + (new Date().getMonth() - 10) : new Date().getMonth() - 10,
      birthYear: new Date().getMonth() - 10 <= 0 ? new Date().getFullYear() - 1 : new Date().getFullYear(),
      interests: ['Reading', 'Music'],
    },
  },
  {
    name: 'Toddler Dad - Seattle',
    description: 'Dad with toddler (18-36 months) in Seattle',
    config: {
      email: '',
      city: 'Seattle',
      stateCode: 'WA',
      childType: 'existing',
      birthMonth: new Date().getMonth(),
      birthYear: new Date().getFullYear() - 2,
      interests: ['Outdoors', 'Photography'],
    },
  },
];

export const AdminTools: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  
  // Single user form
  const [formData, setFormData] = useState<TestUserConfig>({
    email: '',
    city: 'San Francisco',
    stateCode: 'CA',
    childType: 'expecting',
    birthMonth: new Date().getMonth() + 3,
    birthYear: new Date().getFullYear(),
    interests: [],
  });

  // Batch generation
  const [batchCity, setBatchCity] = useState('San Francisco');
  const [batchStateCode, setBatchStateCode] = useState('CA');
  const [batchCount, setBatchCount] = useState(5);

  const generateSessionId = () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const generateEmail = (prefix?: string) => {
    const id = Math.random().toString(36).substr(2, 6);
    return `${prefix || 'testdad'}${id}@test.com`;
  };

  const createTestUser = async (config: TestUserConfig) => {
    const sessionId = generateSessionId();
    const email = config.email || generateEmail();

    // Create profile
    await database.createProfile(sessionId, email);

    // Update with full data
    await database.updateProfile(sessionId, {
      onboarded: true,
      onboarding_step: OnboardingStep.COMPLETE,
      location: {
        city: config.city,
        state_code: config.stateCode,
      },
      children: [{
        type: config.childType,
        birth_month: config.birthMonth,
        birth_year: config.birthYear,
      }],
      interests: config.interests,
      matching_eligible: true,
    });

    return { sessionId, email };
  };

  const handleCreateSingle = async () => {
    setLoading(true);
    setResult('');
    try {
      const user = await createTestUser(formData);
      setResult(`✅ Created user: ${user.email} (${user.sessionId})`);
      setFormData(prev => ({ ...prev, email: '' }));
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setLoading(false);
  };

  const handlePreset = async (preset: TestUserPreset) => {
    setLoading(true);
    setResult('');
    try {
      const config = { ...preset.config, email: generateEmail() };
      const user = await createTestUser(config);
      setResult(`✅ Created ${preset.name}: ${user.email}`);
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setLoading(false);
  };

  const handleBatchCreate = async () => {
    setLoading(true);
    setResult('');
    try {
      const created: string[] = [];
      const lifeStages = ['expecting', 'newborn', 'infant', 'toddler'];
      
      for (let i = 0; i < batchCount; i++) {
        const lifeStage = lifeStages[i % lifeStages.length];
        let birthMonth: number;
        let birthYear: number;
        let childType: 'expecting' | 'existing';

        const now = new Date();
        
        if (lifeStage === 'expecting') {
          childType = 'expecting';
          const monthsAhead = 2 + Math.floor(Math.random() * 6);
          const futureDate = new Date(now.getFullYear(), now.getMonth() + monthsAhead);
          birthMonth = futureDate.getMonth() + 1;
          birthYear = futureDate.getFullYear();
        } else if (lifeStage === 'newborn') {
          childType = 'existing';
          const monthsAgo = 1 + Math.floor(Math.random() * 5);
          const pastDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo);
          birthMonth = pastDate.getMonth() + 1;
          birthYear = pastDate.getFullYear();
        } else if (lifeStage === 'infant') {
          childType = 'existing';
          const monthsAgo = 7 + Math.floor(Math.random() * 11);
          const pastDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo);
          birthMonth = pastDate.getMonth() + 1;
          birthYear = pastDate.getFullYear();
        } else {
          childType = 'existing';
          const monthsAgo = 19 + Math.floor(Math.random() * 17);
          const pastDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo);
          birthMonth = pastDate.getMonth() + 1;
          birthYear = pastDate.getFullYear();
        }

        // Random interests
        const shuffled = [...INTERESTS].sort(() => 0.5 - Math.random());
        const interests = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));

        const user = await createTestUser({
          email: generateEmail(`batch${i + 1}_`),
          city: batchCity,
          stateCode: batchStateCode,
          childType,
          birthMonth,
          birthYear,
          interests,
        });
        created.push(user.email);
      }
      
      setResult(`✅ Created ${created.length} test users in ${batchCity}, ${batchStateCode}`);
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setLoading(false);
  };

  const handleSeedData = async () => {
    setLoading(true);
    setResult('');
    try {
      if (database.seedTestData) {
        await database.seedTestData();
        setResult('✅ Test data seeded via Cloud Function');
      } else {
        setResult('⚠️ Seed function not available');
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setLoading(false);
  };

  const handleClearData = async () => {
    if (!window.confirm('Clear all test data? This will delete all test users and groups.')) return;
    
    setLoading(true);
    setResult('');
    try {
      if (database.cleanTestData) {
        await database.cleanTestData();
        setResult('✅ Test data cleared');
      } else {
        setResult('⚠️ Clean function not available');
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setLoading(false);
  };

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Result Banner */}
      {result && (
        <div className={`p-4 rounded-lg ${
          result.includes('❌')
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : result.includes('⚠️')
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
            : 'bg-green-500/10 border border-green-500/20 text-green-400'
        }`}>
          {result}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Presets */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Quick Presets</h3>
          <p className="text-slate-500 text-sm mb-4">One-click test user creation with predefined profiles</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => handlePreset(preset)}
                disabled={loading}
                className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:opacity-50 p-4 rounded-lg text-left transition"
              >
                <p className="text-white font-medium text-sm">{preset.name}</p>
                <p className="text-slate-500 text-xs mt-1">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Batch Generation */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Batch Generation</h3>
          <p className="text-slate-500 text-sm mb-4">Create multiple test users at once</p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">City</label>
                <select
                  value={`${batchCity}|${batchStateCode}`}
                  onChange={(e) => {
                    const [city, state] = e.target.value.split('|');
                    setBatchCity(city);
                    setBatchStateCode(state);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {CITIES.map(loc => (
                    <option key={`${loc.city}|${loc.stateCode}`} value={`${loc.city}|${loc.stateCode}`}>
                      {loc.city}, {loc.stateCode}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Count</label>
                <select
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {[3, 5, 8, 10, 15, 20].map(n => (
                    <option key={n} value={n}>{n} users</option>
                  ))}
                </select>
              </div>
            </div>
            
            <button
              onClick={handleBatchCreate}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-users"></i>
              )}
              Generate {batchCount} Users
            </button>
          </div>
        </div>
      </div>

      {/* Custom User Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-medium mb-4">Create Custom Test User</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Email (optional)</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Auto-generated if empty"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Location</label>
            <select
              value={`${formData.city}|${formData.stateCode}`}
              onChange={(e) => {
                const [city, state] = e.target.value.split('|');
                setFormData(prev => ({ ...prev, city, stateCode: state }));
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              {CITIES.map(loc => (
                <option key={`${loc.city}|${loc.stateCode}`} value={`${loc.city}|${loc.stateCode}`}>
                  {loc.city}, {loc.stateCode}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Child Status</label>
            <select
              value={formData.childType}
              onChange={(e) => setFormData(prev => ({ ...prev, childType: e.target.value as 'expecting' | 'existing' }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="expecting">Expecting</option>
              <option value="existing">Already Born</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Month</label>
              <select
                value={formData.birthMonth}
                onChange={(e) => setFormData(prev => ({ ...prev, birthMonth: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Year</label>
              <select
                value={formData.birthYear}
                onChange={(e) => setFormData(prev => ({ ...prev, birthYear: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-slate-400 text-xs uppercase tracking-wider block mb-2">Interests</label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(interest => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  formData.interests.includes(interest)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreateSingle}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white px-6 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
        >
          {loading ? (
            <i className="fas fa-spinner fa-spin"></i>
          ) : (
            <i className="fas fa-plus"></i>
          )}
          Create User
        </button>
      </div>

      {/* Database Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-medium mb-4">Database Actions</h3>
        <p className="text-slate-500 text-sm mb-4">Manage test data in the database</p>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSeedData}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
          >
            <i className="fas fa-seedling"></i>
            Seed Test Data (Cloud Function)
          </button>
          
          <button
            onClick={handleClearData}
            disabled={loading}
            className="bg-slate-800 hover:bg-red-600 disabled:bg-slate-800 disabled:opacity-50 text-slate-400 hover:text-white px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
          >
            <i className="fas fa-trash"></i>
            Clear All Test Data
          </button>
        </div>
      </div>
    </div>
  );
};

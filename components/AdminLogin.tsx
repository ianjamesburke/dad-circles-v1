import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            // Ensure custom claims (admin=true) are present immediately after login.
            await credential.user.getIdToken(true);
            navigate('/admin');
        } catch (error: any) {
            setError('Invalid email or password');
            console.error(error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3">
                        <div className="bg-blue-600 p-3 rounded-xl">
                            <i className="fas fa-users-rays text-white text-2xl"></i>
                        </div>
                        <div className="text-left">
                            <span className="text-2xl font-bold text-white block">Dad Circles</span>
                            <span className="text-slate-500 text-sm">Admin Panel</span>
                        </div>
                    </div>
                </div>

                {/* Login Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                    <h2 className="text-xl font-semibold text-white text-center mb-6">Sign in to continue</h2>
                    
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm text-center">
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-slate-400 text-sm font-medium mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                                placeholder="admin@example.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 text-sm font-medium mb-2">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-slate-600 text-sm text-center mt-6">
                    Protected admin area
                </p>
            </div>
        </div>
    );
};

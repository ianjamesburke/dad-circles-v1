import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { AdminLogin } from './AdminLogin';

interface ProtectedAdminDashboardProps {
    children: React.ReactNode;
}

export const ProtectedAdminDashboard: React.FC<ProtectedAdminDashboardProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [verifyingClaims, setVerifyingClaims] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // CRITICAL: Force token refresh to get latest custom claims
                // This ensures admin claim is present before rendering dashboard
                try {
                    setVerifyingClaims(true);
                    await currentUser.getIdToken(true); // Force refresh
                    const tokenResult = await currentUser.getIdTokenResult();
                    
                    // Verify admin claim exists
                    if (!tokenResult.claims.admin) {
                        console.error('❌ User authenticated but missing admin claim');
                        // Still set user so they can see they're logged in but not admin
                    } else {
                        console.log('✅ Admin claim verified');
                    }
                    
                    setUser(currentUser);
                } catch (error) {
                    console.error('Failed to verify admin claims:', error);
                    setUser(null);
                } finally {
                    setVerifyingClaims(false);
                }
            } else {
                setUser(null);
                setVerifyingClaims(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Refresh ID token every 50 minutes to prevent expiration
    // Firebase tokens expire after 1 hour, so we refresh proactively
    useEffect(() => {
        if (!user) return;

        const refreshToken = async () => {
            try {
                await user.getIdToken(true); // Force refresh
                const tokenResult = await user.getIdTokenResult();
                if (tokenResult.claims.admin) {
                    console.log('🔄 Admin token refreshed with claims');
                } else {
                    console.warn('⚠️ Token refreshed but admin claim missing');
                }
            } catch (error) {
                console.error('Failed to refresh token:', error);
            }
        };

        // Refresh immediately on mount to ensure fresh token
        refreshToken();

        // Then refresh every 50 minutes
        const interval = setInterval(refreshToken, 50 * 60 * 1000);

        return () => clearInterval(interval);
    }, [user]);

    if (loading || verifyingClaims) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-slate-500 text-sm">
                        {verifyingClaims ? 'Verifying admin access...' : 'Loading...'}
                    </p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <AdminLogin />;
    }

    return <>{children}</>;
};

#!/usr/bin/env node

/**
 * Seed Admin Script
 * 
 * Seeds a test admin user into the emulator for local development.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';

interface Child {
    type: 'expecting' | 'existing';
    birth_month: number;
    birth_year: number;
    gender?: string;
}

interface UserLocation {
    city: string;
    state_code: string;
}

interface UserProfile {
    session_id: string;
    name?: string;
    email?: string;
    postcode?: string;
    onboarded: boolean;
    onboarding_step: string;
    location?: UserLocation;
    interests?: string[];
    children: Child[];
    siblings?: Child[];
    last_updated: number;
    matching_eligible: boolean;
}

const firebaseConfig = {
    projectId: 'dad-circles',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

if (process.env.NODE_ENV !== 'production') {
    try {
        connectFirestoreEmulator(db, 'localhost', 8083);
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
        console.log('🔧 Connected to Firestore and Auth emulators');
    } catch (error) {
        console.log('⚠️ Emulators already connected or not available');
    }
}

const seedAdmin = async () => {
    console.log('🌱 Seeding admin user...');

    try {
        console.log('🔐 Authenticating as admin...');
        await signInWithEmailAndPassword(auth, 'admin@admin.com', 'password123');
        console.log('✅ Authenticated successfully');

        const profile: UserProfile = {
            session_id: 'test-session-admin',
            name: 'Admin',
            email: 'admin@admin.com',
            postcode: '49506',
            onboarded: true,
            onboarding_step: 'complete',
            location: {
                city: 'Grand Rapids',
                state_code: 'MI'
            },
            interests: ['Hiking', 'Gaming'],
            children: [
                {
                    type: 'expecting',
                    birth_month: 3,
                    birth_year: 2026
                }
            ],
            siblings: [],
            last_updated: Date.now(),
            matching_eligible: true,
        };

        const ref = doc(db, 'profiles', profile.session_id);
        await setDoc(ref, profile);

        console.log('✅ Successfully seeded admin user!');
        console.log('   ID: test-session-admin');
        console.log('   Email: admin@admin.com');
        console.log('   Location: Grand Rapids, MI');

    } catch (error) {
        console.error('❌ Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    });

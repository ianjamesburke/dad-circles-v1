#!/usr/bin/env node

/**
 * Seed Ian Script
 * 
 * Seeds the specific user "Ian" as requested.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore';

// Define types locally
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

// Firebase config for emulator
const firebaseConfig = {
    projectId: 'dad-circles',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connect to emulator
if (process.env.NODE_ENV !== 'production') {
    try {
        connectFirestoreEmulator(db, 'localhost', 8083);
        console.log('🔧 Connected to Firestore emulator');
    } catch (error) {
        console.log('⚠️ Firestore emulator already connected or not available');
    }
}

const seedIan = async () => {
    console.log('🌱 Seeding Ian...');

    try {
        const profile: UserProfile = {
            session_id: 'test-session-ian',
            name: 'Ian',
            email: 'ian@test.com', // Placeholder email
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

        console.log('✅ Successfully seeded Ian!');
        console.log('   ID: test-session-ian');
        console.log('   Location: Grand Rapids, MI');
        console.log('   Status: Expecting (March 2026)');

    } catch (error) {
        console.error('❌ Error seeding Ian:', error);
        process.exit(1);
    }
};

// Run the seeding
seedIan()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    });

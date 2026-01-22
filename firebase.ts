import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dad-circles",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Debug: Log the project ID to see if it's loading
console.log('Firebase Project ID:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const auth = getAuth(app);

// Connect to emulators in development mode
if (import.meta.env.DEV) {
    try {
        // Connect to Firestore emulator
        connectFirestoreEmulator(db, 'localhost', 8083);
        console.log('🔧 Connected to Firestore emulator on port 8083');

        // Connect to Functions emulator
        connectFunctionsEmulator(functions, 'localhost', 5003);
        console.log('🔧 Connected to Functions emulator on port 5003');

        // Connect to Auth emulator
        // Note: We're enabling this to support the "Simple Firebase authentication through the emulator" requirement
        connectAuthEmulator(auth, "http://localhost:9099");
        console.log('🔧 Connected to Auth emulator on port 9099');

    } catch (error: any) {
        console.log('⚠️ Emulator connection failed or already connected:', error.message);
    }
}

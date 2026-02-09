import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from "firebase/auth";
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

// Connect to emulators in development mode BEFORE setting persistence
if (import.meta.env.DEV) {
    try {
        // Use the hostname from the browser URL so it works on mobile devices on the same network
        // If accessing via IP (e.g., 192.168.1.x), emulators will be reached at that IP too
        const emulatorHost = window.location.hostname;
        
        // Connect to Auth emulator FIRST (before persistence)
        connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
        console.log(`🔧 Connected to Auth emulator at ${emulatorHost}:9099`);

        // Connect to Firestore emulator
        connectFirestoreEmulator(db, emulatorHost, 8083);
        console.log(`🔧 Connected to Firestore emulator at ${emulatorHost}:8083`);

        // Connect to Functions emulator
        connectFunctionsEmulator(functions, emulatorHost, 5003);
        console.log(`🔧 Connected to Functions emulator at ${emulatorHost}:5003`);

    } catch (error: any) {
        console.log('⚠️ Emulator connection failed or already connected:', error.message);
    }
}

// Set auth persistence to LOCAL (survives page reloads and browser restarts)
// This MUST happen after emulator connection
export const authReady = setPersistence(auth, browserLocalPersistence)
    .then(() => {
        console.log('✅ Auth persistence set to LOCAL');
    })
    .catch((error) => {
        console.error('❌ Failed to set auth persistence:', error);
    });


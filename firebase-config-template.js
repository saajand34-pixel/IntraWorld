// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
// INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com/
// 2. Select your project
// 3. Click ⚙️ Settings → Project settings
// 4. Find "Your apps" section → Web app
// 5. Copy the config object and paste values below
// 6. Replace everything in [...] with actual values
// 7. Save this file

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// ⬇️ PASTE YOUR FIREBASE CONFIG VALUES BELOW ⬇️
const firebaseConfig = {
    apiKey: "AIzaSy...",  // Replace with actual API key from Firebase Console
    authDomain: "intraworld-12345.firebaseapp.com",  // Replace with your auth domain
    projectId: "intraworld-12345",  // Replace with your project ID
    storageBucket: "intraworld-12345.appspot.com",  // Replace with your storage bucket
    messagingSenderId: "1234567890",  // Replace with your messaging sender ID
    appId: "1:1234567890:web:abc123def456"  // Replace with your app ID
};

// ==========================================
// INITIALIZE FIREBASE SERVICES
// ==========================================
try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);
    const functions = getFunctions(app, "asia-south1");

    // Enable offline persistence
    setPersistence(auth, browserLocalPersistence)
        .catch((error) => console.warn("⚠️ Auth persistence setup failed:", error));

    console.log("✅ Firebase initialized successfully!");
    console.log("Project:", firebaseConfig.projectId);

    // Export services
    export { auth, db, storage, functions };

} catch (error) {
    console.error("❌ Firebase initialization failed!");
    console.error("Error:", error.message);
    console.error("\n📝 Steps to fix:");
    console.error("1. Open https://console.firebase.google.com/");
    console.error("2. Select your project");
    console.error("3. Go to Settings ⚙️ → Project settings");
    console.error("4. Copy the web app config");
    console.error("5. Update the firebaseConfig values above");
    console.error("6. Reload this page");
}

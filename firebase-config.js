// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
// Replace the values below with your actual Firebase project credentials
// Get these from: Firebase Console → Project Settings → Web App Configuration

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// ==========================================
// YOUR FIREBASE PROJECT CREDENTIALS
// ==========================================
// ⚠️ IMPORTANT: Replace these with YOUR actual Firebase project credentials
// ⚠️ DO NOT commit this file to public repositories with real credentials

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyATrNL8GcNhpLN9uSDQmmd0qNXh40JO4rA",
  authDomain: "intraworld.firebaseapp.com",
  projectId: "intraworld",
  storageBucket: "intraworld.firebasestorage.app",
  messagingSenderId: "547389253115",
  appId: "1:547389253115:web:35bfdddadea59e298d175e",
  measurementId: "G-LQ7MKELRT3"
};

// ==========================================
// INITIALIZE FIREBASE
// ==========================================
let app = null;
let auth = null;
let db = null;
let storage = null;
let functions = null;

try {
    // Initialize Firebase App
    app = initializeApp(firebaseConfig);
    console.log("✅ Firebase App initialized successfully");

    // Initialize Auth with persistence
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence)
        .then(() => {
            console.log("✅ Firebase Auth initialized with persistence");
        })
        .catch((error) => {
            console.error("⚠️ Persistence setup failed:", error);
        });

    // Initialize Firestore
    db = getFirestore(app);
    console.log("✅ Firebase Firestore initialized");

    // Initialize Storage
    storage = getStorage(app);
    console.log("✅ Firebase Storage initialized");

    // Initialize Functions (optional, for cloud functions)
    functions = getFunctions(app, "asia-south1"); // Change region if needed
    console.log("✅ Firebase Functions initialized");

} catch (error) {
    console.error("❌ Firebase initialization failed:", error);
    console.error("Please check your firebase-config.js file and Firebase credentials");
}

// ==========================================
// EXPORT SERVICES FOR USE IN OTHER FILES
// ==========================================
export { auth, db, storage, functions };

// ==========================================
// VERIFICATION HELPER
// ==========================================
// Call this in browser console to verify Firebase is properly configured
window.verifyFirebaseConfig = function() {
    console.group("🔍 Firebase Configuration Verification");
    
    console.log("App:", app ? "✅ Initialized" : "❌ Not initialized");
    console.log("Auth:", auth ? "✅ Initialized" : "❌ Not initialized");
    console.log("Firestore:", db ? "✅ Initialized" : "❌ Not initialized");
    console.log("Storage:", storage ? "✅ Initialized" : "❌ Not initialized");
    console.log("Functions:", functions ? "✅ Initialized" : "❌ Not initialized");
    
    if (app) {
        console.log("\nProject Details:");
        console.log("Project ID:", firebaseConfig.projectId);
        console.log("Auth Domain:", firebaseConfig.authDomain);
        console.log("Storage Bucket:", firebaseConfig.storageBucket);
    }
    
    console.groupEnd();
};

// Auto-verify on load
console.log("🚀 Firebase config loaded. Run verifyFirebaseConfig() to check status.");

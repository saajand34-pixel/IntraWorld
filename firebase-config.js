/**
 * Firebase Configuration
 * Initialize Firebase app and export services for use throughout the application
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// ====================================
// FIREBASE PROJECT CONFIGURATION
// ====================================
// Replace these with your Firebase project credentials
// Get from Firebase Console > Project Settings > General
const firebaseConfig = {
    apiKey: "AIzaSyAtRNL8GcNhpLN9uSDQmmd0qNXh40JO4rA",
    authDomain: "://firebaseapp.com",
    projectId: "intraworld",
    storageBucket: "intraworld.firebasestorage.app",
    messagingSenderId: "547389253115",
    appId: "1:547389253115:web:35bfdddadea59e298d175e",
    measurementId: "G-LQ7MKELRT3" // Optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-south1'); // Or your region

// ====================================
// DEVELOPMENT: EMULATOR CONFIGURATION
// ====================================
// Uncomment to use Firebase Emulator Suite for local testing
// This requires: `firebase emulators:start` in your firebase project directory

// const isLocal = location.hostname === 'localhost';
// if (isLocal) {
//     connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
//     connectFirestoreEmulator(db, 'localhost', 8080);
//     connectStorageEmulator(storage, 'localhost', 9199);
//     connectFunctionsEmulator(functions, 'localhost', 5001);
//     console.log("✓ Connected to Firebase Emulator Suite");
// }

// ====================================
// FIRESTORE SECURITY RULES
// ====================================
/*
Deploy to Firestore with:
firebase deploy --only firestore:rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // User profiles - readable/writable by owner only
    match /User_profile/{userId} {
  allow read, write: if request.auth.uid == userId;
}
    
    // KYC Sessions - readable/writable by owner only
    // Contains sensitive identity verification data
    match /kyc_sessions/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Default: deny all access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
*/

// ====================================
// FIREBASE STORAGE SECURITY RULES
// ====================================
/*
Deploy to Storage with:
firebase deploy --only storage

service firebase.storage {
  match /b/{bucket}/o {
    
    // Profile photos - only readable by owner, uploadable during registration
    match /profile_photos/{userId}/{allPaths=**} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId && 
                      request.resource.size < 5 * 1024 * 1024 && // 5MB max
                      request.resource.contentType.matches('image/.*');
    }
    
    // Default: deny all access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
*/

// ====================================
// ERROR LOGGING (Optional: Firebase Analytics)
// ====================================
// import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
// export const analytics = getAnalytics(app);

console.log("✓ Firebase initialized for project:", firebaseConfig.projectId);

/**
 * Firebase Configuration
 * Initialize Firebase app and export services for use throughout the application
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// ====================================
// FIREBASE PROJECT CONFIGURATION
// ====================================
const firebaseConfig = {
    apiKey: "AIzaSyAtRNL8GCNhpLN9uSDQmmd0qNXh40JO4rA",
    authDomain: "intraworld.firebaseapp.com",
    projectId: "intraworld",
    storageBucket: "intraworld.firebasestorage.app",
    messagingSenderId: "547389253115",
    appId: "1:547389253115:web:35bfdddadea59e298d175e",
    measurementId: "G-LQ7MKELRT3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-south1');

console.log("✓ Firebase initialized for project:", firebaseConfig.projectId);
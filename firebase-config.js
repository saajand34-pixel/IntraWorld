// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

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
    app = initializeApp(firebaseConfig);
    console.log("✅ Firebase App initialized successfully");

    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence)
        .then(() => {
            console.log("✅ Firebase Auth initialized with persistence");
        })
        .catch((error) => {
            console.error("⚠️ Persistence setup failed:", error);
        });

    db = getFirestore(app);
    console.log("✅ Firebase Firestore initialized");

    storage = getStorage(app);
    console.log("✅ Firebase Storage initialized");

    functions = getFunctions(app, "asia-south1");
    console.log("✅ Firebase Functions initialized");

    // ATTACH TO WINDOW FOR GLOBAL ACCESS IN NON-MODULE SCRIPTS
    window.db = db;
    window.addDoc = addDoc;
    window.collection = collection;

} catch (error) {
    console.error("❌ Firebase initialization failed:", error);
}

export { auth, db, storage, functions };

window.verifyFirebaseConfig = function() {
    console.group("🔍 Firebase Configuration Verification");
    console.log("App:", app ? "✅ Initialized" : "❌ Not initialized");
    console.log("Auth:", auth ? "✅ Initialized" : "❌ Not initialized");
    console.log("Firestore:", db ? "✅ Initialized" : "❌ Not initialized");
    console.log("Storage:", storage ? "✅ Initialized" : "❌ Not initialized");
    console.log("Functions:", functions ? "✅ Initialized" : "❌ Not initialized");
    console.groupEnd();
};

console.log("🚀 Firebase config loaded. Run verifyFirebaseConfig() to check status.");
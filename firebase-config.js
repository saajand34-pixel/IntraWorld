// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
    getAuth,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    getStorage
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

import {
    getFunctions
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";


// ==========================================
// FIREBASE CONFIG
// ==========================================

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

const app = initializeApp(firebaseConfig);


// ==========================================
// FIREBASE AUTH
// ==========================================

const auth = getAuth(app);

setPersistence(
    auth,
    browserLocalPersistence
)
.then(() => {
    console.log("✅ Firebase Auth persistence enabled");
})
.catch((error) => {
    console.error(
        "❌ Auth persistence error:",
        error
    );
});


// ==========================================
// FIRESTORE
// ==========================================

const db = getFirestore(app);

console.log(
    "✅ Firestore initialized"
);


// ==========================================
// STORAGE
// ==========================================

const storage = getStorage(app);

console.log(
    "✅ Firebase Storage initialized"
);


// ==========================================
// CLOUD FUNCTIONS
// ==========================================

const functions =
    getFunctions(
        app,
        "asia-south1"
    );

console.log(
    "✅ Firebase Functions initialized"
);


// ==========================================
// GLOBAL ACCESS
// ==========================================

window.db = db;
window.addDoc = addDoc;
window.collection = collection;


// ==========================================
// VERIFY FIREBASE
// ==========================================

window.verifyFirebaseConfig = function () {

    console.group(
        "🔍 Firebase Configuration"
    );

    console.log(
        "App:",
        app ? "✅ Initialized" : "❌ Failed"
    );

    console.log(
        "Auth:",
        auth ? "✅ Initialized" : "❌ Failed"
    );

    console.log(
        "Firestore:",
        db ? "✅ Initialized" : "❌ Failed"
    );

    console.log(
        "Storage:",
        storage ? "✅ Initialized" : "❌ Failed"
    );

    console.log(
        "Functions:",
        functions ? "✅ Initialized" : "❌ Failed"
    );

    console.groupEnd();
};


// ==========================================
// EXPORT
// ==========================================

export {
    app,
    auth,
    db,
    storage,
    functions
};


console.log(
    "🚀 Firebase config loaded successfully"
);
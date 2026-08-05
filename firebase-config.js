// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCwsGATl97HlF1Y880Wb7zNF5Dr88nYBns",
  authDomain: "intel-guard-1.firebaseapp.com",
  databaseURL: "https://intel-guard-1-default-rtdb.firebaseio.com",
  projectId: "intel-guard-1",
  storageBucket: "intel-guard-1.firebasestorage.app",
  messagingSenderId: "575867762296",
  appId: "1:575867762296:web:34b74072f99881206adf8d",
  measurementId: "G-XVR56Y035W"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);

// Export Auth & Firestore Helper Functions
export { RecaptchaVerifier, signInWithPhoneNumber, doc, setDoc, getDoc, ref, uploadBytes, getDownloadURL };
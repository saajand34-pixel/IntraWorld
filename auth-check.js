import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Check local session immediately
const localUser = localStorage.getItem("currentUser");

if (!localUser) {
    // If no session exists at all, redirect to login
    alert("Please login first.");
    window.location.href = "login.html";
} else {
    // Session exists -> Wait for Firebase Auth state to sync without blocking UI
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Keep localStorage synced with active Firebase user
            const currentData = JSON.parse(localUser);
            currentData.uid = user.uid;
            localStorage.setItem("currentUser", JSON.stringify(currentData));
        }
    });
}
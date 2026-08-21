import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Check local session immediately
const localUser = localStorage.getItem("currentUser");

// IMPORTANT: Don't redirect here - let individual pages handle auth
// This just initializes Firebase auth and syncs with localStorage

if (localUser) {
    // Session exists in localStorage - sync with Firebase
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Keep localStorage synced with active Firebase user
            try {
                const currentData = JSON.parse(localStorage.getItem("currentUser") || "{}");
                currentData.uid = user.uid;
                localStorage.setItem("currentUser", JSON.stringify(currentData));
            } catch (err) {
                console.error("Error syncing user data:", err);
            }
        }
        
        // Mark auth check as complete - pages can now proceed
        document.documentElement.setAttribute("data-auth-ready", "true");
    });
} else {
    // No local session - mark ready so pages can redirect if needed
    document.documentElement.setAttribute("data-auth-ready", "true");
}

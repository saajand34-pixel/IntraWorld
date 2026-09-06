import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

function getActiveSession() {
    try {
        const raw = localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser") || localStorage.getItem("user");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.email || parsed.fullName || parsed.id || parsed.uid)) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn("Auth check session parse note:", e);
    }
    return null;
}

// Immediate synchronous check
const immediateSession = getActiveSession();

// Only monitor route if completely unauthenticated
if (!immediateSession) {
    const rawPath = window.location.pathname.toLowerCase();
    const currentPath = rawPath.endsWith("/") && rawPath.length > 1 
        ? rawPath.slice(0, -1) 
        : rawPath;

    const isLoginPage = 
        currentPath === "" || 
        currentPath === "/" || 
        currentPath.endsWith("/index.html") || 
        currentPath.endsWith("/index") ||
        currentPath.endsWith("/login.html") ||
        currentPath.endsWith("/login") ||
        currentPath.endsWith("/register.html") ||
        currentPath.endsWith("/register");

    if (!isLoginPage) {
        // Wait for Firebase Auth state before making any redirection decision
        onAuthStateChanged(auth, (user) => {
            const recheckSession = getActiveSession();
            if (!user && !recheckSession) {
                console.warn("Unauthenticated session - redirecting to landing page.");
                window.location.replace("index.html");
            }
        });
    }
}
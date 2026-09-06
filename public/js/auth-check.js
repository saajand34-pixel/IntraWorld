import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

function getActiveSession() {
    try {
        const raw = localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser");
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

// Session Guard
onAuthStateChanged(auth, (user) => {
    // Clean up current pathname
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

    const session = getActiveSession();
    const isAuthenticated = Boolean(user || session);

    if (!isAuthenticated) {
        // If unauthenticated and on a protected page, send to login/index
        if (!isLoginPage) {
            window.location.replace("index.html");
        }
    }
});

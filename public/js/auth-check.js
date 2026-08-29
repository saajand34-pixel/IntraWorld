import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Session Guard
onAuthStateChanged(auth, (user) => {
    // Clean up current pathname (normalize slashes & lowercase)
    const rawPath = window.location.pathname.toLowerCase();
    const currentPath = rawPath.endsWith("/") && rawPath.length > 1 
        ? rawPath.slice(0, -1) 
        : rawPath;

    // Identify all variations of login/landing pages
    const isLoginPage = 
        currentPath === "" || 
        currentPath === "/" || 
        currentPath.endsWith("/index.html") || 
        currentPath.endsWith("/index") ||
        currentPath.endsWith("/login.html") ||
        currentPath.endsWith("/login");

    if (!user) {
        // If unauthenticated and on a protected page, send to login/index
        if (!isLoginPage) {
            window.location.replace("index.html");
        }
    } else {
        // If authenticated and on a login/landing page, send to dashboard
        if (isLoginPage) {
            window.location.replace("dashboard.html");
        }
    }
});
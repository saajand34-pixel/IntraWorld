/**
 * IntraWorld Universal Authentication & Session Security Guard
 * Ensures unauthenticated visitors cannot view protected pages,
 * prevents back-button navigation after logout (BFCache defense),
 * and provides universal instant logout across all pages.
 */

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. Get Logged-in User Data Safely
export function getAuthenticatedUser() {
    try {
        const raw = localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser");
        if (!raw) return null;
        const user = JSON.parse(raw);
        if (!user || !user.email) return null;
        return user;
    } catch (e) {
        return null;
    }
}

// 2. Route Guard Validation (Synchronous + BFCache)
export function requireAuth(requiredRole = null) {
    const user = getAuthenticatedUser();
    
    if (!user) {
        if (document.documentElement) document.documentElement.style.display = "none";
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace("index.html");
        return null;
    }

    if (requiredRole === "admin") {
        const isAdmin = user.role === "admin" || user.email === "admin@intraworld.com";
        if (!isAdmin) {
            if (document.documentElement) document.documentElement.style.display = "none";
            window.location.replace("index.html");
            return null;
        }
    }

    return user;
}

// 3. Global Secure Logout Function (Synchronous Storage Wipe + Safe Redirect)
export function secureLogout(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 1. Immediate synchronous storage purge
    localStorage.clear();
    sessionStorage.clear();

    // 2. Clear cookies
    try {
        document.cookie.split(";").forEach((c) => {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
    } catch (err) {}

    // 3. Trigger Firebase signout in background
    try {
        if (auth && auth.currentUser) {
            signOut(auth).catch(() => {});
        }
    } catch (err) {}

    // 4. Force replace location so history stack cannot go back to dashboard
    window.location.replace("index.html");
}

// Expose globally for any inline onclick handlers
window.secureLogout = secureLogout;

// 4. Auto-bind Logout Buttons & BFCache protection on DOM Ready
function setupAuthListeners() {
    document.querySelectorAll("#logoutBtn, .logout-btn, a.logout").forEach((btn) => {
        btn.addEventListener("click", secureLogout);
    });

    window.addEventListener("pageshow", (event) => {
        const user = getAuthenticatedUser();
        if (!user) {
            if (document.documentElement) document.documentElement.style.display = "none";
            window.location.replace("index.html");
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAuthListeners);
} else {
    setupAuthListeners();
}

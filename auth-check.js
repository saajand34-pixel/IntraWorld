import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Session Guard
onAuthStateChanged(auth, (user) => {
    const isLoginPage = window.location.pathname.endsWith("index.html") || 
                        window.location.pathname.endsWith("login.html") || 
                        window.location.pathname === "/";

    if (!user && !isLoginPage) {
        // Redirect to login if unauthenticated on a protected route
        window.location.href = "index.html";
    } else if (user && isLoginPage) {
        // Redirect to dashboard if already authenticated
        window.location.href = "dashboard.html";
    }
});
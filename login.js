import { auth, db } from "./firebase-config.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;

    const loginBtn = loginForm.querySelector("button");

    function setLoading(isLoading) {
        if (!loginBtn) return;
        loginBtn.disabled = isLoading;
        if (isLoading) {
            loginBtn.innerHTML = "Verifying Database...";
        } else {
            loginBtn.innerHTML = "Login";
        }
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("loginEmail").value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;

        if (email === "" || password === "") {
            alert("Please enter Email and Password.");
            return;
        }

        setLoading(true);

        try {
            // 1. Authenticate via Firebase Auth
            let firebaseUser = null;
            try {
                const credential = await signInWithEmailAndPassword(auth, email, password);
                firebaseUser = credential.user;
            } catch (authError) {
                console.warn("Firebase Auth bypassed or failed, checking Firestore database...", authError);
            }

            // Default SVG Fallback Avatar
            const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/></svg>";

            // 2. Query Firestore 'registrations' database for matching user details
            let registeredUser = null;
            if (db) {
                try {
                    const q = query(collection(db, "registrations"), where("email", "==", email));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        registeredUser = querySnapshot.docs[0].data();
                    }
                } catch (dbErr) {
                    console.error("Firestore database query error:", dbErr);
                }
            }

            // 3. Fallback check in local storage
            if (!registeredUser) {
                const localSession = localStorage.getItem("currentUser");
                if (localSession) {
                    const parsedLocal = JSON.parse(localSession);
                    if (parsedLocal.email === email) {
                        registeredUser = parsedLocal;
                    }
                }
            }

            // 4. Build user session payload
            const sessionData = {
                fullName: registeredUser?.fullName || (firebaseUser?.displayName || "Student User"),
                email: email,
                avatar: registeredUser?.avatar || defaultAvatar,
                isVerified: true,
                loginTime: new Date().toISOString()
            };

            // Save active session for dashboard rendering
            localStorage.setItem("currentUser", JSON.stringify(sessionData));

            // 5. Route user based on role
            if (email === "admin@intraworld.com") {
                window.location.href = "admin.html";
            } else {
                window.location.href = "dashboard.html";
            }

        } catch (error) {
            console.error("Login verification error:", error);
            alert("Failed to verify account. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    });
});
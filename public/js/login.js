import { auth, db } from "../firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");

        const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
        const password = passwordInput ? passwordInput.value.trim() : "";
        const submitBtn = loginForm.querySelector("button");

        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying...`;
        }

        try {
            // ==========================================
            // 1. ADMIN LOGIN ROUTE
            // ==========================================
            if (email === "admin@intraworld.com") {
                if (password !== "intra.2026") {
                    alert("Incorrect password for Admin account.");
                    return;
                }

                if (auth) {
                    try {
                        await signInWithEmailAndPassword(auth, email, password);
                    } catch (authErr) {
                        console.warn("Admin Firebase Auth skipped:", authErr.message);
                    }
                }

                const adminSession = {
                    email: email,
                    role: "admin",
                    fullName: "System Admin",
                    isVerified: true
                };

                localStorage.setItem("currentUser", JSON.stringify(adminSession));
                localStorage.setItem("intraWorldUser", JSON.stringify(adminSession));

                window.location.href = "admin.html";
                return;
            }

            // ==========================================
            // 2. STANDARD USER LOGIN ROUTE
            // ==========================================
            // Try Firebase Auth standard sign in first
            let authSuccess = false;
            if (auth) {
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    authSuccess = true;
                } catch (authErr) {
                    console.warn("Firebase Auth standard check skipped/failed:", authErr.message);
                }
            }

            // Search Firestore 'registrations' collection first
            let querySnapshot = await getDocs(query(collection(db, "registrations"), where("email", "==", email)));

            // Fallback: If empty, search 'users' collection
            if (querySnapshot.empty) {
                querySnapshot = await getDocs(query(collection(db, "users"), where("email", "==", email)));
            }

            // If user data exists in Firestore
            if (!querySnapshot.empty) {
                const docSnap = querySnapshot.docs[0];
                const userData = docSnap.data();

                // Validate password if stored in document
                if (userData.password && userData.password !== password) {
                    alert("Incorrect password. Please try again.");
                    return;
                }

                const sessionData = {
                    id: docSnap.id,
                    fullName: userData.fullName || userData.full_name || "Student User",
                    email: email,
                    avatar: userData.avatar || userData.profilePhotoUrl || "",
                    isVerified: true,
                    ...userData
                };

                localStorage.setItem("currentUser", JSON.stringify(sessionData));
                localStorage.setItem("intraWorldUser", JSON.stringify(sessionData));

                window.location.href = "dashboard.html";
                return;
            }

            // If Firebase Auth succeeded but no Firestore record exists, still allow access
            if (authSuccess) {
                const sessionData = {
                    email: email,
                    fullName: email.split("@")[0],
                    isVerified: true
                };
                localStorage.setItem("currentUser", JSON.stringify(sessionData));
                localStorage.setItem("intraWorldUser", JSON.stringify(sessionData));

                window.location.href = "dashboard.html";
                return;
            }

            alert("No registered account found with this email.");

        } catch (error) {
            console.error("Login Error:", error);
            alert("Verification error: " + error.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login`;
            }
        }
    });
});
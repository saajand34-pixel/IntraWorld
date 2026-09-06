import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const submitBtn = document.getElementById("submitBtn");
    const alertBox = document.getElementById("loginAlertBox");

    if (!loginForm) return;

    function showAlert(message, type = "error") {
        if (!alertBox) {
            alert(message);
            return;
        }

        alertBox.style.display = "flex";
        if (type === "error") {
            alertBox.style.background = "rgba(239, 68, 68, 0.15)";
            alertBox.style.border = "1px solid rgba(239, 68, 68, 0.4)";
            alertBox.style.color = "#f87171";
            alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${message}</span>`;
        } else if (type === "success") {
            alertBox.style.background = "rgba(34, 197, 94, 0.15)";
            alertBox.style.border = "1px solid rgba(34, 197, 94, 0.4)";
            alertBox.style.color = "#4ade80";
            alertBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${message}</span>`;
        } else {
            alertBox.style.background = "rgba(56, 189, 248, 0.15)";
            alertBox.style.border = "1px solid rgba(56, 189, 248, 0.4)";
            alertBox.style.color = "#38bdf8";
            alertBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${message}</span>`;
        }
    }

    function hideAlert() {
        if (alertBox) alertBox.style.display = "none";
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert();

        const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
        const password = passwordInput ? passwordInput.value.trim() : "";

        if (!email || !password) {
            showAlert("Please enter both your registered email address and password.");
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Scanning Database & Verifying...`;
        }

        try {
            // ==========================================
            // 1. ADMIN LOGIN ROUTE
            // ==========================================
            if (email === "admin@intraworld.com") {
                if (password !== "intra.2026") {
                    showAlert("Incorrect password for System Admin account.");
                    return;
                }

                if (auth) {
                    try {
                        await signInWithEmailAndPassword(auth, email, password);
                    } catch (authErr) {
                        console.warn("Admin Firebase Auth note:", authErr.message);
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

                showAlert("Admin verified! Redirecting to dashboard...", "success");
                setTimeout(() => {
                    window.location.replace("admin.html");
                }, 350);
                return;
            }

            // ==========================================
            // 2. FIREBASE AUTHENTICATION (OPTIONAL / COMPATIBLE)
            // ==========================================
            let authSuccess = false;
            if (auth) {
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    authSuccess = true;
                } catch (authErr) {
                    console.log("Firebase Auth notice:", authErr.code || authErr.message);
                }
            }

            // ==========================================
            // 3. SCAN FIRESTORE COLLECTIONS (registrations, students, users)
            // ==========================================
            let docSnap = null;
            let userData = null;

            if (db) {
                // Check 1: 'registrations' collection
                try {
                    const regSnap = await getDocs(query(collection(db, "registrations"), where("email", "==", email)));
                    if (!regSnap.empty) {
                        docSnap = regSnap.docs[0];
                        userData = docSnap.data();
                    }
                } catch (err) {
                    console.warn("Registrations collection scan note:", err.message);
                }

                // Check 2: 'students' collection (if not found yet)
                if (!userData) {
                    try {
                        const studSnap = await getDocs(query(collection(db, "students"), where("email", "==", email)));
                        if (!studSnap.empty) {
                            docSnap = studSnap.docs[0];
                            userData = docSnap.data();
                        }
                    } catch (err) {
                        console.warn("Students collection scan note:", err.message);
                    }
                }

                // Check 3: 'users' collection (doc by email or query)
                if (!userData) {
                    try {
                        const userDocSnap = await getDoc(doc(db, "users", email));
                        if (userDocSnap.exists()) {
                            docSnap = userDocSnap;
                            userData = userDocSnap.data();
                        } else {
                            const userQuerySnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
                            if (!userQuerySnap.empty) {
                                docSnap = userQuerySnap.docs[0];
                                userData = docSnap.data();
                            }
                        }
                    } catch (err) {
                        console.warn("Users collection scan note:", err.message);
                    }
                }
            }

            // ==========================================
            // 4. VERIFY CREDENTIALS & STORE LOGGED-IN SESSION
            // ==========================================
            if (userData) {
                // If password is recorded in database, verify it
                const storedPassword = userData.password ? String(userData.password).trim() : null;

                if (storedPassword && storedPassword !== password && !authSuccess) {
                    showAlert("Incorrect password. Please verify and try again.");
                    return;
                }

                const sessionData = {
                    id: docSnap ? docSnap.id : email,
                    fullName: userData.fullName || userData.full_name || "Student User",
                    email: email,
                    mobileNumber: userData.mobileNumber || userData.mobile || userData.phone || "",
                    collegeName: userData.collegeName || userData.collegeOrUniversity || userData.college || "",
                    qualification: userData.qualification || "",
                    specialization: userData.specialization || "",
                    studentRegId: userData.studentRegId || "",
                    passoutYear: userData.passoutYear || userData.passedOutYear || userData.passout_year || "",
                    avatar: userData.avatar || userData.profilePhotoUrl || "",
                    trustScore: userData.trustScore || 100,
                    isVerified: true,
                    accountStatus: "VERIFIED_GENUINE_STUDENT",
                    ...userData
                };

                localStorage.setItem("currentUser", JSON.stringify(sessionData));
                localStorage.setItem("intraWorldUser", JSON.stringify(sessionData));

                showAlert(`🎉 Verified! Welcome back, ${sessionData.fullName}. Opening Dashboard...`, "success");
                if (submitBtn) {
                    submitBtn.style.background = "#22c55e";
                    submitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verified! Redirecting...`;
                }

                setTimeout(() => {
                    window.location.replace("dashboard.html");
                }, 400);
                return;
            }

            // If Firebase Auth succeeded without Firestore doc
            if (authSuccess) {
                const sessionData = {
                    email: email,
                    fullName: email.split("@")[0],
                    isVerified: true,
                    accountStatus: "VERIFIED_GENUINE_STUDENT"
                };

                localStorage.setItem("currentUser", JSON.stringify(sessionData));
                localStorage.setItem("intraWorldUser", JSON.stringify(sessionData));

                showAlert("🎉 Login verified! Opening Dashboard...", "success");
                setTimeout(() => {
                    window.location.replace("dashboard.html");
                }, 400);
                return;
            }

            // If not found in database and auth failed
            showAlert(`No registered account found with email "${email}". Please click Register to create your account.`);

        } catch (error) {
            console.error("Login verification error:", error);
            showAlert("Verification error: " + (error.message || "Failed to communicate with database."));
        } finally {
            if (submitBtn && submitBtn.innerHTML.indexOf("Redirecting") === -1) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login`;
            }
        }
    });
});

import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    setDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function sha256Hex(message) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    } catch (e) {
        return "";
    }
}

// Known admin credentials for offline/local administration
const ADMIN_PASSWORDS = ["intra.2026", "admin123", "admin@123", "admin", "saajan18", "saajan"];
const ADMIN_HASHES = [
    "d10435560c9675ad162bde3213f107af2cce8371990745ed9a97780ed5408235", // intra.2026
    "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9", // admin123
    "7676aaafb027c825bd9abab78b234070e702752f625b752e55e55b48e607e358"  // admin@123
];

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
            alertBox.style.background = "rgba(185, 28, 28, 0.25)";
            alertBox.style.border = "1px solid rgba(239, 68, 68, 0.5)";
            alertBox.style.color = "#fca5a5";
            alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${escapeHtml(message)}</span>`;
        } else if (type === "success") {
            alertBox.style.background = "rgba(34, 197, 94, 0.2)";
            alertBox.style.border = "1px solid rgba(34, 197, 94, 0.5)";
            alertBox.style.color = "#86efac";
            alertBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${escapeHtml(message)}</span>`;
        } else {
            alertBox.style.background = "rgba(245, 158, 11, 0.2)";
            alertBox.style.border = "1px solid rgba(245, 158, 11, 0.5)";
            alertBox.style.color = "#fde68a";
            alertBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${escapeHtml(message)}</span>`;
        }
    }

    function hideAlert() {
        if (alertBox) alertBox.style.display = "none";
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert();

        let rawInput = emailInput ? emailInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value.trim() : "";

        if (!rawInput || !password) {
            showAlert("Please enter both your email/username and password.");
            return;
        }

        let email = rawInput.toLowerCase();

        // Convenience alias: typing 'admin' maps to admin@intraworld.com
        if (email === "admin" || email === "administrator") {
            email = "admin@intraworld.com";
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Logging in...`;
        }

        try {
            // 1. ADMIN AUTHENTICATION
            const isAdminAccount = email === "admin@intraworld.com" || email === "admin";
            if (isAdminAccount) {
                const inputHash = await sha256Hex(password);
                const isPasswordValid = ADMIN_PASSWORDS.includes(password) || ADMIN_HASHES.includes(inputHash);

                if (!isPasswordValid) {
                    showAlert("Incorrect password for Administrator account.");
                    return;
                }

                const adminSession = {
                    id: "admin_master",
                    email: "admin@intraworld.com",
                    role: "admin",
                    fullName: "System Admin",
                    collegeName: "IntraWorld Administration",
                    isVerified: true,
                    accountStatus: "ADMINISTRATOR"
                };

                localStorage.setItem("currentUser", JSON.stringify(adminSession));
                localStorage.setItem("intraWorldUser", JSON.stringify(adminSession));

                showAlert("Administrator verified! Opening Admin Portal...", "success");
                setTimeout(() => {
                    window.location.replace("admin.html");
                }, 300);
                return;
            }

            // 2. STUDENT SEARCH IN FIRESTORE
            let primaryDocSnap = null;
            let regData = null;
            let studData = null;
            let uData = null;

            // Target email lookup list (includes Saajan alias mappings for seamless access)
            const searchEmails = [email];
            if (email === "saajand34@gmail.com" || email === "saajan@gmail.com" || email === "saajan") {
                searchEmails.push("saajand18@gmail.com");
            } else if (email === "saajand18@gmail.com") {
                searchEmails.push("saajand34@gmail.com");
            }

            if (db) {
                // Try direct doc read first (fastest)
                for (const targetEmail of searchEmails) {
                    try {
                        const userDoc = await getDoc(doc(db, "users", targetEmail));
                        if (userDoc.exists()) {
                            primaryDocSnap = userDoc;
                            uData = userDoc.data();
                            email = targetEmail;
                            break;
                        }
                    } catch (err) {
                        console.warn("Direct user lookup note:", err.message);
                    }
                }

                // Query registrations collection
                if (!uData) {
                    for (const targetEmail of searchEmails) {
                        try {
                            const regSnap = await getDocs(query(collection(db, "registrations"), where("email", "==", targetEmail)));
                            if (!regSnap.empty) {
                                primaryDocSnap = regSnap.docs[0];
                                regData = primaryDocSnap.data();
                                email = targetEmail;
                                break;
                            }
                        } catch (err) {
                            console.warn("Registration query note:", err.message);
                        }
                    }
                }

                // Query students collection
                if (!uData && !regData) {
                    for (const targetEmail of searchEmails) {
                        try {
                            const studSnap = await getDocs(query(collection(db, "students"), where("email", "==", targetEmail)));
                            if (!studSnap.empty) {
                                primaryDocSnap = studSnap.docs[0];
                                studData = primaryDocSnap.data();
                                email = targetEmail;
                                break;
                            }
                        } catch (err) {
                            console.warn("Student query note:", err.message);
                        }
                    }
                }

                // Broad fallback scan across registrations if exact query returned empty
                if (!uData && !regData && !studData) {
                    try {
                        const allRegs = await getDocs(collection(db, "registrations"));
                        for (const d of allRegs.docs) {
                            const data = d.data();
                            const docEmail = (data.email || "").trim().toLowerCase();
                            const docRegId = (data.studentRegId || data.regId || "").trim().toLowerCase();
                            if (searchEmails.includes(docEmail) || (rawInput && docRegId === rawInput.toLowerCase())) {
                                primaryDocSnap = d;
                                regData = data;
                                email = docEmail || email;
                                break;
                            }
                        }
                    } catch (err) {
                        console.warn("Fallback collection scan note:", err.message);
                    }
                }
            }

            const userData = regData || studData || uData 
                ? { ...regData, ...studData, ...uData } 
                : null;

            if (userData) {
                // Collect candidate passwords
                const candidates = [
                    uData?.password ? String(uData.password).trim() : null,
                    studData?.password ? String(studData.password).trim() : null,
                    regData?.password ? String(regData.password).trim() : null
                ].filter(Boolean);

                const isPasswordMatch = candidates.some(c => 
                    c === password || c.toLowerCase() === password.toLowerCase()
                );

                if (!isPasswordMatch) {
                    showAlert("Incorrect password. Please verify your credentials and try again.");
                    return;
                }

                // Build student session
                const sessionData = {
                    id: primaryDocSnap ? primaryDocSnap.id : email,
                    fullName: userData.fullName || userData.full_name || "Student User",
                    email: email,
                    mobileNumber: userData.mobileNumber || userData.mobile || userData.phone || "",
                    collegeName: userData.collegeName || userData.collegeOrUniversity || userData.college || "College",
                    qualification: userData.qualification || "Student",
                    specialization: userData.specialization || "Computer Science",
                    studentRegId: userData.studentRegId || userData.regId || "",
                    passoutYear: userData.passoutYear || userData.passedOutYear || userData.passout_year || "2026",
                    avatar: userData.avatar || userData.profilePhotoUrl || "",
                    trustScore: userData.trustScore || 100,
                    isVerified: true,
                    accountStatus: "VERIFIED_GENUINE_STUDENT",
                    ...userData
                };

                localStorage.setItem("currentUser", JSON.stringify(sessionData));
                localStorage.setItem("intraWorldUser", JSON.stringify(sessionData));

                // Optional Firebase Auth in background (non-blocking)
                if (auth) {
                    signInWithEmailAndPassword(auth, email, password).catch(() => {});
                }

                showAlert(`Welcome back, ${sessionData.fullName}! Opening dashboard...`, "success");
                if (submitBtn) {
                    submitBtn.style.background = "#22c55e";
                    submitBtn.style.color = "#ffffff";
                    submitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Redirecting...`;
                }

                setTimeout(() => {
                    window.location.replace("dashboard.html");
                }, 300);
                return;
            }

            // Fallback for creator account Saajan if first login before db sync
            if (email === "saajand34@gmail.com" || email === "saajand18@gmail.com") {
                if (password === "saajan18" || password === "admin123" || password === "admin") {
                    const sessionData = {
                        id: "saajan_lead",
                        fullName: "Saajan D",
                        email: email,
                        collegeName: "SFGC",
                        qualification: "Bachelor of Computer Applications (BCA)",
                        specialization: "Computer Science",
                        passoutYear: "2026",
                        isVerified: true,
                        role: "admin",
                        accountStatus: "VERIFIED_GENUINE_STUDENT"
                    };
                    localStorage.setItem("currentUser", JSON.stringify(sessionData));
                    localStorage.setItem("intraWorldUser", JSON.stringify(sessionData));
                    showAlert("Welcome back, Saajan D! Opening dashboard...", "success");
                    setTimeout(() => {
                        window.location.replace("dashboard.html");
                    }, 300);
                    return;
                }
            }

            showAlert(`No registered student found for "${rawInput}". Please register or check your credentials.`);

        } catch (error) {
            console.error("Login verification error:", error);
            showAlert("Login error: " + (error.message || "Failed to communicate with database."));
        } finally {
            if (submitBtn && submitBtn.innerHTML.indexOf("Redirecting") === -1) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login`;
            }
        }
    });
});

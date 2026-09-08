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
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// Hash of admin password for secure offline/client verification
const ADMIN_HASH = "d10435560c9675ad162bde3213f107af2cce8371990745ed9a97780ed5408235";

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
            alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${escapeHtml(message)}</span>`;
        } else if (type === "success") {
            alertBox.style.background = "rgba(34, 197, 94, 0.15)";
            alertBox.style.border = "1px solid rgba(34, 197, 94, 0.4)";
            alertBox.style.color = "#4ade80";
            alertBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${escapeHtml(message)}</span>`;
        } else {
            alertBox.style.background = "rgba(56, 189, 248, 0.15)";
            alertBox.style.border = "1px solid rgba(56, 189, 248, 0.4)";
            alertBox.style.color = "#38bdf8";
            alertBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${escapeHtml(message)}</span>`;
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
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;
        }

        try {
            // Admin authentication flow
            if (email === "admin@intraworld.com") {
                const inputHash = await sha256Hex(password);
                if (inputHash !== ADMIN_HASH) {
                    showAlert("Invalid credentials for system administrator.");
                    return;
                }

                if (auth) {
                    try {
                        await signInWithEmailAndPassword(auth, email, password);
                    } catch (authErr) {
                        console.warn("Firebase Auth notice:", authErr.code || authErr.message);
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

                showAlert("Administrator verified. Opening admin panel...", "success");
                setTimeout(() => {
                    window.location.replace("admin.html");
                }, 350);
                return;
            }

            // Student Firebase Auth verification
            let authSuccess = false;
            if (auth) {
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    authSuccess = true;
                } catch (authErr) {
                    console.log("Firebase Auth notice:", authErr.code || authErr.message);
                }
            }

            // Student profile verification across registrations, students, and users
            let regData = null;
            let studData = null;
            let uData = null;
            let primaryDocSnap = null;

            if (db) {
                try {
                    const regSnap = await getDocs(query(collection(db, "registrations"), where("email", "==", email)));
                    if (!regSnap.empty) {
                        primaryDocSnap = regSnap.docs[0];
                        regData = primaryDocSnap.data();
                    }
                } catch (err) {
                    console.warn("Registration lookup note:", err.message);
                }

                try {
                    const studSnap = await getDocs(query(collection(db, "students"), where("email", "==", email)));
                    if (!studSnap.empty) {
                        if (!primaryDocSnap) primaryDocSnap = studSnap.docs[0];
                        studData = studSnap.docs[0].data();
                    }
                } catch (err) {
                    console.warn("Student lookup note:", err.message);
                }

                try {
                    const userDocSnap = await getDoc(doc(db, "users", email));
                    if (userDocSnap.exists()) {
                        if (!primaryDocSnap) primaryDocSnap = userDocSnap;
                        uData = userDocSnap.data();
                    } else {
                        const userQuerySnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
                        if (!userQuerySnap.empty) {
                            if (!primaryDocSnap) primaryDocSnap = userQuerySnap.docs[0];
                            uData = userQuerySnap.docs[0].data();
                        }
                    }
                } catch (err) {
                    console.warn("User document lookup note:", err.message);
                }
            }

            const docSnap = primaryDocSnap;
            const userData = regData || studData || uData 
                ? { ...regData, ...studData, ...uData } 
                : null;

            if (userData) {
                const candidatePasswords = [
                    uData?.password ? String(uData.password).trim() : null,
                    studData?.password ? String(studData.password).trim() : null,
                    regData?.password ? String(regData.password).trim() : null
                ].filter(Boolean);

                const isPasswordMatch = candidatePasswords.includes(password) || authSuccess;

                if (!isPasswordMatch) {
                    showAlert("Incorrect password. Please verify your credentials and try again.");
                    return;
                }

                // Sync password updates if needed
                if (candidatePasswords.length > 0 && candidatePasswords.some(p => p !== password)) {
                    try {
                        if (regData && String(regData.password).trim() !== password) {
                            const rSnap = await getDocs(query(collection(db, "registrations"), where("email", "==", email)));
                            for (const d of rSnap.docs) {
                                await updateDoc(doc(db, "registrations", d.id), { password: password });
                            }
                        }
                        if (studData && String(studData.password).trim() !== password) {
                            const sSnap = await getDocs(query(collection(db, "students"), where("email", "==", email)));
                            for (const d of sSnap.docs) {
                                await updateDoc(doc(db, "students", d.id), { password: password });
                            }
                        }
                        if (uData && String(uData.password).trim() !== password) {
                            await setDoc(doc(db, "users", email), { password: password }, { merge: true });
                        }
                    } catch (syncErr) {
                        console.warn("Password sync note:", syncErr.message);
                    }
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

                showAlert(`Welcome back, ${sessionData.fullName}! Opening dashboard...`, "success");
                if (submitBtn) {
                    submitBtn.style.background = "#22c55e";
                    submitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Redirecting...`;
                }

                setTimeout(() => {
                    window.location.replace("dashboard.html");
                }, 350);
                return;
            }

            if (authSuccess) {
                const sessionData = {
                    email: email,
                    fullName: email.split("@")[0],
                    isVerified: true,
                    accountStatus: "VERIFIED_GENUINE_STUDENT"
                };

                localStorage.setItem("currentUser", JSON.stringify(sessionData));
                localStorage.setItem("intraWorldUser", JSON.stringify(sessionData));

                showAlert("Login verified. Opening dashboard...", "success");
                setTimeout(() => {
                    window.location.replace("dashboard.html");
                }, 350);
                return;
            }

            showAlert(`No registered student found for "${email}". Please register to create an account.`);

        } catch (error) {
            console.error("Login verification error:", error);
            showAlert("Login error: " + (error.message || "Failed to reach server."));
        } finally {
            if (submitBtn && submitBtn.innerHTML.indexOf("Redirecting") === -1) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login`;
            }
        }
    });
});

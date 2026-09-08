import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    updateDoc, 
    deleteDoc,
    collection, 
    query, 
    where, 
    getDocs 
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

function sanitizeUrl(url) {
    if (!url) return "";
    const clean = String(url).trim();
    if (/^(https?:\/\/|data:image\/(jpeg|png|gif|webp);base64,)/i.test(clean)) {
        return clean;
    }
    return "";
}

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/></svg>";

let selectedBase64Photo = null;
let activeDocId = null;
let activeCollection = "registrations";

function renderFields(user) {
    if (!user) return;
    
    const name = user.fullName || user.full_name || "Student User";
    const email = user.email || "";
    const phone = user.mobileNumber || user.mobile || user.phone || "";
    const regId = user.studentRegId || user.regId || user.regid || user.registerNo || user.regNumber || user.registrationNumber || user.studentId || "";
    const qual = user.qualification || "";
    const college = user.collegeName || user.collegeOrUniversity || user.college || user.institution || "";
    const passout = user.passoutYear || user.passedOutYear || user.passout_year || "";
    const avatar = user.avatar || user.profilePhotoUrl || DEFAULT_AVATAR;

    const nameEl = document.getElementById("dbFullName");
    const emailEl = document.getElementById("dbEmail");
    const mobileEl = document.getElementById("dbMobile");
    const regIdEl = document.getElementById("dbRegId");
    const qualEl = document.getElementById("dbQualification");
    const collegeEl = document.getElementById("dbCollege");
    const passoutEl = document.getElementById("dbPassout");
    const preview = document.getElementById("avatarPreview");

    if (nameEl) nameEl.value = name;
    if (emailEl) emailEl.value = email;
    if (mobileEl) mobileEl.value = phone;
    if (regIdEl) regIdEl.value = regId;
    if (qualEl) qualEl.value = qual;
    if (collegeEl) collegeEl.value = college;
    if (passoutEl) passoutEl.value = passout;

    if (preview && avatar) preview.src = sanitizeUrl(avatar) || DEFAULT_AVATAR;

    const isVerified = user.isVerified === true || user.isFeeReceiptVerified === true || user.verificationStatus === "verified";
    const badgeEl = document.getElementById("dbVerificationBadge");
    if (badgeEl) {
        badgeEl.innerHTML = `
            <span class="status-badge ${isVerified ? 'status-verified' : 'status-pending'}">
                <i class="fa-solid ${isVerified ? 'fa-circle-check' : 'fa-clock'}"></i> ${isVerified ? 'Verified Student Member' : 'Pending Verification'}
            </span>
        `;
    }
}

// 1. Synchronous Instant Render from Session
function initRender() {
    try {
        const rawSession = localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser");
        if (rawSession) {
            const user = JSON.parse(rawSession);
            renderFields(user);
        }
    } catch (e) {
        console.warn("Local session read note:", e);
    }
}

// 2. Background Firestore Sync
async function syncFromFirestore(userEmail) {
    if (!userEmail || !db) return;
    try {
        let q = query(collection(db, "registrations"), where("email", "==", userEmail));
        let snap = await getDocs(q);

        if (snap.empty) {
            q = query(collection(db, "students"), where("email", "==", userEmail));
            snap = await getDocs(q);
            activeCollection = "students";
        }

        if (snap.empty) {
            q = query(collection(db, "users"), where("email", "==", userEmail));
            snap = await getDocs(q);
            activeCollection = "users";
        }

        if (!snap.empty) {
            const docSnap = snap.docs[0];
            activeDocId = docSnap.id;
            const data = docSnap.data();

            const currentRaw = localStorage.getItem("currentUser") || "{}";
            const currentObj = JSON.parse(currentRaw);
            const college = data.collegeName || data.collegeOrUniversity || data.college || data.institution || currentObj.collegeName || "";
            const merged = { ...currentObj, ...data, collegeName: college, id: activeDocId };
            
            localStorage.setItem("currentUser", JSON.stringify(merged));
            localStorage.setItem("intraWorldUser", JSON.stringify(merged));
            renderFields(merged);
        }
    } catch (err) {
        console.warn("Firestore sync note:", err.message);
    }
}

// Auth state listener for sync
if (auth) {
    onAuthStateChanged(auth, (user) => {
        const sessionRaw = localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser");
        const email = user?.email || (sessionRaw ? JSON.parse(sessionRaw).email : null);
        if (email) {
            syncFromFirestore(email);
        }
    });
}

// 3. WhatsApp-Style DP Upload & Compression
function setupPhotoUpload() {
    const fileInput = document.getElementById("dpFileInput");
    const saveDpBtn = document.getElementById("saveDpBtn");
    const toastMsg = document.getElementById("dpToastMsg");

    function showToast(msg, isSuccess = true) {
        if (!toastMsg) return;
        toastMsg.style.display = "flex";
        toastMsg.style.background = isSuccess ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)";
        toastMsg.style.border = isSuccess ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)";
        toastMsg.style.color = isSuccess ? "#4ade80" : "#f87171";
        toastMsg.innerHTML = `<i class="fa-solid ${isSuccess ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> <span>${escapeHtml(msg)}</span>`;
        
        setTimeout(() => {
            toastMsg.style.display = "none";
        }, 5000);
    }

    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX_SIZE = 400;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    selectedBase64Photo = canvas.toDataURL("image/jpeg", 0.85);

                    const preview = document.getElementById("avatarPreview");
                    if (preview) preview.src = selectedBase64Photo;

                    if (saveDpBtn) saveDpBtn.style.display = "inline-flex";
                };
            };
        });
    }

    if (saveDpBtn) {
        saveDpBtn.addEventListener("click", async () => {
            if (!selectedBase64Photo) return;

            saveDpBtn.disabled = true;
            saveDpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                let sessionUser = JSON.parse(localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser") || "{}");
                sessionUser.avatar = selectedBase64Photo;
                sessionUser.profilePhotoUrl = selectedBase64Photo;

                localStorage.setItem("currentUser", JSON.stringify(sessionUser));
                localStorage.setItem("intraWorldUser", JSON.stringify(sessionUser));

                // Save to Firestore
                if (activeDocId && db) {
                    await updateDoc(doc(db, activeCollection, activeDocId), {
                        avatar: selectedBase64Photo,
                        profilePhotoUrl: selectedBase64Photo
                    });
                } else if (sessionUser.email && db) {
                    try {
                        const q = query(collection(db, "registrations"), where("email", "==", sessionUser.email));
                        const snap = await getDocs(q);
                        if (!snap.empty) {
                            await updateDoc(doc(db, "registrations", snap.docs[0].id), {
                                avatar: selectedBase64Photo,
                                profilePhotoUrl: selectedBase64Photo
                            });
                        }
                    } catch (err) {}
                }

                showToast("Profile picture updated and saved permanently!");
                saveDpBtn.style.display = "none";
            } catch (err) {
                console.error("Save avatar error:", err);
                showToast("Saved to current session! (" + err.message + ")", true);
            } finally {
                saveDpBtn.disabled = false;
                saveDpBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Save Photo Permanently';
            }
        });
    }
}

// 4. Deactivate & Delete Account Logic
function setupAccountDeactivation() {
    const deactivateBtn = document.getElementById("deactivateAccountBtn");
    const modal = document.getElementById("deactivateModal");
    const cancelBtn = document.getElementById("cancelDeactivateBtn");
    const confirmBtn = document.getElementById("confirmDeactivateBtn");

    if (deactivateBtn && modal) {
        deactivateBtn.addEventListener("click", () => {
            modal.style.display = "flex";
        });
    }

    if (cancelBtn && modal) {
        cancelBtn.addEventListener("click", () => {
            modal.style.display = "none";
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting Database Record...';

            try {
                const sessionRaw = localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser");
                const sessionUser = sessionRaw ? JSON.parse(sessionRaw) : {};
                const userEmail = (sessionUser.email || "").toLowerCase();

                if (userEmail && db) {
                    // 1. Delete from registrations collection
                    try {
                        const regSnap = await getDocs(query(collection(db, "registrations"), where("email", "==", userEmail)));
                        for (const d of regSnap.docs) {
                            await deleteDoc(doc(db, "registrations", d.id));
                        }
                    } catch (e) {
                        console.warn("Delete registrations note:", e);
                    }

                    // 2. Delete from students collection
                    try {
                        const studSnap = await getDocs(query(collection(db, "students"), where("email", "==", userEmail)));
                        for (const d of studSnap.docs) {
                            await deleteDoc(doc(db, "students", d.id));
                        }
                    } catch (e) {
                        console.warn("Delete students note:", e);
                    }

                    // 3. Delete from users collection
                    try {
                        await deleteDoc(doc(db, "users", userEmail));
                        const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", userEmail)));
                        for (const d of userSnap.docs) {
                            await deleteDoc(doc(db, "users", d.id));
                        }
                    } catch (e) {
                        console.warn("Delete users note:", e);
                    }
                }

                // 4. Try Firebase Auth deletion or signout
                if (auth && auth.currentUser) {
                    try {
                        await deleteUser(auth.currentUser);
                    } catch (authDelErr) {
                        try {
                            await signOut(auth);
                        } catch (soErr) {}
                    }
                }

                // 5. Clear all storage
                localStorage.clear();
                sessionStorage.clear();

                alert("✅ Your account and registration records have been permanently removed from IntraWorld.");
                window.location.replace("index.html");

            } catch (error) {
                console.error("Account deactivation error:", error);
                alert("Account removal error: " + (error.message || "Failed to delete completely. Session cleared."));
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace("index.html");
            }
        });
    }

    // Explicit Logout Handler
    
    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace("index.html");
    });

}

// 5. Setup Profile & College Name Save Logic
function setupProfileSave() {
    const saveProfileBtn = document.getElementById("saveProfileBtn");
    const profileSaveMsg = document.getElementById("profileSaveMsg");
    const collegeInput = document.getElementById("dbCollege");

    if (saveProfileBtn && collegeInput) {
        saveProfileBtn.addEventListener("click", async () => {
            const newCollege = collegeInput.value.trim();
            if (!newCollege) {
                alert("⚠️ Please enter your College or University Name.");
                collegeInput.focus();
                return;
            }

            saveProfileBtn.disabled = true;
            saveProfileBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                let sessionUser = JSON.parse(localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser") || "{}");
                sessionUser.collegeName = newCollege;
                sessionUser.college = newCollege;
                sessionUser.collegeOrUniversity = newCollege;

                localStorage.setItem("currentUser", JSON.stringify(sessionUser));
                localStorage.setItem("intraWorldUser", JSON.stringify(sessionUser));

                const email = (sessionUser.email || "").toLowerCase();
                if (email && db) {
                    // Update in users collection
                    try {
                        await updateDoc(doc(db, "users", email), {
                            collegeName: newCollege,
                            college: newCollege
                        });
                    } catch (e) {
                        console.warn("Update users note:", e);
                    }

                    // Update in active doc
                    if (activeDocId) {
                        try {
                            await updateDoc(doc(db, activeCollection, activeDocId), {
                                collegeName: newCollege,
                                college: newCollege
                            });
                        } catch (e) {
                            console.warn("Update active doc note:", e);
                        }
                    }

                    // Update all matching registration docs
                    try {
                        const q = query(collection(db, "registrations"), where("email", "==", email));
                        const snap = await getDocs(q);
                        snap.forEach(async (d) => {
                            await updateDoc(doc(db, "registrations", d.id), {
                                collegeName: newCollege,
                                college: newCollege
                            });
                        });
                    } catch (e) {
                        console.warn("Update registrations note:", e);
                    }

                    // Update all matching student docs
                    try {
                        const q = query(collection(db, "students"), where("email", "==", email));
                        const snap = await getDocs(q);
                        snap.forEach(async (d) => {
                            await updateDoc(doc(db, "students", d.id), {
                                collegeName: newCollege,
                                college: newCollege
                            });
                        });
                    } catch (e) {
                        console.warn("Update students note:", e);
                    }
                }

                if (profileSaveMsg) {
                    profileSaveMsg.style.display = "inline-flex";
                    profileSaveMsg.innerHTML = '<i class="fa-solid fa-circle-check"></i> College Name saved & synced!';
                    setTimeout(() => {
                        profileSaveMsg.style.display = "none";
                    }, 4000);
                }
            } catch (err) {
                console.error("Save profile error:", err);
                alert("Failed to save changes: " + err.message);
            } finally {
                saveProfileBtn.disabled = false;
                saveProfileBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Profile & College Name';
            }
        });
    }
}

// Initialize on DOM Ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initRender();
        setupPhotoUpload();
        setupAccountDeactivation();
        setupProfileSave();
    });
} else {
    initRender();
    setupPhotoUpload();
    setupAccountDeactivation();
    setupProfileSave();
}

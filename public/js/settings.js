import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/></svg>";

let currentUserData = null;
let currentDocId = null;
let currentCollection = "registrations";
let selectedBase64Image = null;

// Convert Uploaded File to Base64 String with quality compression
function fileToBase64Compress(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.8));
            };
        };
        reader.onerror = (error) => reject(error);
    });
}

// Update Page Avatars
function updatePageAvatars(avatarUrl) {
    const preview = document.getElementById("settings-avatar-preview");
    if (preview) preview.src = avatarUrl;
}

// Populate Inputs with User Details
function renderUserData(data) {
    if (!data) return;

    document.getElementById("userFullName").value = data.fullName || data.full_name || "";
    document.getElementById("userEmail").value = data.email || "";
    document.getElementById("userMobile").value = data.mobileNumber || data.mobile || data.phone || "";
    document.getElementById("userState").value = data.state || "";
    document.getElementById("userQualification").value = data.qualification || "";
    document.getElementById("userCollege").value = data.collegeOrUniversity || data.college || "";
    document.getElementById("userPassout").value = data.passoutYear || data.passout_year || "";

    const isVerified = data.verificationStatus === "verified" || data.isVerified === true;
    const badgeContainer = document.getElementById("userVerificationBadge");
    if (badgeContainer) {
        badgeContainer.innerHTML = `
            <span class="status-badge ${isVerified ? 'status-verified' : 'status-pending'}">
                ${isVerified ? 'Verified Member' : 'Pending Verification'}
            </span>
        `;
    }

    const avatar = data.avatar || data.profilePhotoUrl || DEFAULT_AVATAR;
    updatePageAvatars(avatar);
}

// Auth Listener & Firestore Synchronization
onAuthStateChanged(auth, async (user) => {
    let sessionUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const userEmail = user?.email || sessionUser.email;

    if (!userEmail) return;

    try {
        // Query registrations or users collection by email
        let q = query(collection(db, "registrations"), where("email", "==", userEmail));
        let querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            q = query(collection(db, "users"), where("email", "==", userEmail));
            querySnapshot = await getDocs(q);
            currentCollection = "users";
        }

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            currentDocId = docSnap.id;
            currentUserData = docSnap.data();

            // Update session storage
            localStorage.setItem("currentUser", JSON.stringify({ ...sessionUser, ...currentUserData, id: currentDocId }));
            renderUserData(currentUserData);
        } else if (sessionUser.email) {
            renderUserData(sessionUser);
        }
    } catch (err) {
        console.error("Error fetching user data from Firestore:", err);
        if (sessionUser) renderUserData(sessionUser);
    }
});

// Event Listeners Initialization
document.addEventListener("DOMContentLoaded", () => {
    const photoInput = document.getElementById("profilePhotoInput");
    const savePhotoBtn = document.getElementById("savePhotoBtn");

    if (photoInput) {
        photoInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    selectedBase64Image = await fileToBase64Compress(file);
                    updatePageAvatars(selectedBase64Image);
                    if (savePhotoBtn) savePhotoBtn.style.display = "inline-flex";
                } catch (err) {
                    alert("Failed to load selected photo.");
                }
            }
        });
    }

    if (savePhotoBtn) {
        savePhotoBtn.addEventListener("click", async () => {
            if (!selectedBase64Image) return;

            savePhotoBtn.innerText = "Saving...";
            savePhotoBtn.disabled = true;

            try {
                let sessionUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
                sessionUser.avatar = selectedBase64Image;
                localStorage.setItem("currentUser", JSON.stringify(sessionUser));

                // Save permanently into Firestore DB
                if (currentDocId) {
                    await updateDoc(doc(db, currentCollection, currentDocId), {
                        avatar: selectedBase64Image,
                        profilePhotoUrl: selectedBase64Image
                    });
                }

                alert("Profile photo updated permanently!");
                savePhotoBtn.style.display = "none";
            } catch (err) {
                console.error("Error saving permanent avatar:", err);
                alert("Saved to current session! (Firestore Update Error: " + err.message + ")");
            } finally {
                savePhotoBtn.innerText = "Save Photo";
                savePhotoBtn.disabled = false;
            }
        });
    }
});
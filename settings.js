// Helper: Convert File to Base64 String
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

// Update all photo instances on the current page
function updatePageAvatars(avatarUrl) {
    const settingsPreview = document.getElementById("settings-avatar-preview");
    if (settingsPreview) settingsPreview.src = avatarUrl;

    const navAvatar = document.getElementById("profileImage");
    if (navAvatar) navAvatar.src = avatarUrl;
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. Fetch current session user
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) return;

    const user = JSON.parse(storedUser);
    const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/></svg>";

    // Initialize photo from stored profile
    if (user.avatar && !user.avatar.includes("via.placeholder.com")) {
        updatePageAvatars(user.avatar);
    } else {
        updatePageAvatars(defaultAvatar);
    }

    // 2. Setup image selection and save handlers
    const photoInput = document.getElementById("profilePhotoInput");
    const savePhotoBtn = document.getElementById("savePhotoBtn");
    let temporaryBase64Image = null;

    if (photoInput) {
        photoInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    temporaryBase64Image = await getBase64(file);
                    
                    // Display preview immediately
                    const previewAvatar = document.getElementById("settings-avatar-preview");
                    if (previewAvatar) previewAvatar.src = temporaryBase64Image;

                    // Unhide save button
                    if (savePhotoBtn) savePhotoBtn.style.display = "inline-flex";
                } catch (err) {
                    console.error("Error reading image:", err);
                    alert("Unable to process selected image file.");
                }
            }
        });
    }

    if (savePhotoBtn) {
        savePhotoBtn.addEventListener("click", async () => {
            if (!temporaryBase64Image) return;

            // Update user object in local session
            user.avatar = temporaryBase64Image;
            localStorage.setItem("currentUser", JSON.stringify(user));

            // Synchronize on-screen avatars
            updatePageAvatars(temporaryBase64Image);

            savePhotoBtn.style.display = "none";

            // Save to Firestore if available
            try {
                const firestoreDb = window.db;
                if (firestoreDb && window.doc && window.updateDoc && user.email) {
                    const userRef = window.doc(firestoreDb, "registrations", user.email);
                    await window.updateDoc(userRef, { avatar: temporaryBase64Image });
                }
            } catch (err) {
                console.warn("Firestore sync skipped:", err);
            }

            alert("Profile photo updated successfully!");
        });
    }
});
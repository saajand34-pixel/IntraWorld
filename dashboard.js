// Helper function to read uploaded image as Base64 Data URL
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

// Helper function to update profile image elements
function updateAllAvatars(avatarUrl) {
    const topNavAvatar = document.getElementById("profileImage");
    if (topNavAvatar) topNavAvatar.src = avatarUrl;

    const previewAvatar = document.getElementById("dashboard-avatar-preview");
    if (previewAvatar) previewAvatar.src = avatarUrl;
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. Sidebar Drawer Toggle Logic
    const sidebar = document.getElementById("sidebar");
    const openMenuBtn = document.getElementById("openMenu");
    const closeMenuBtn = document.getElementById("closeMenu");
    const overlay = document.getElementById("overlay");

    if (openMenuBtn && sidebar && overlay) {
        openMenuBtn.addEventListener("click", () => {
            sidebar.classList.add("open");
            overlay.classList.add("show");
        });
    }

    const closeSidebar = () => {
        if (sidebar) sidebar.classList.remove("open");
        if (overlay) overlay.classList.remove("show");
    };

    if (closeMenuBtn) closeMenuBtn.addEventListener("click", closeSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);

    // 2. Read Session from localStorage
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
        window.location.href = "login.html";
        return;
    }

    const user = JSON.parse(storedUser);
    const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/></svg>";

    const navUserName = document.getElementById("welcomeName");
    const welcomeHeader = document.querySelector(".content h1");

    if (user) {
        if (navUserName) {
            navUserName.textContent = user.fullName || "Student User";
        }

        if (welcomeHeader && welcomeHeader.textContent.toUpperCase().includes("WELCOME")) {
            welcomeHeader.textContent = `Welcome, ${user.fullName || "Student"}`;
        }

        const activeAvatar = (user.avatar && !user.avatar.includes("via.placeholder.com")) 
            ? user.avatar 
            : defaultAvatar;
            
        updateAllAvatars(activeAvatar);
    }

    // 3. Profile Photo Upload Handler
    const photoInput = document.getElementById("profilePhotoInput");
    const savePhotoBtn = document.getElementById("savePhotoBtn");
    let temporaryBase64Image = null;

    if (photoInput) {
        photoInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    temporaryBase64Image = await getBase64(file);
                    
                    const previewAvatar = document.getElementById("dashboard-avatar-preview");
                    if (previewAvatar) previewAvatar.src = temporaryBase64Image;

                    if (savePhotoBtn) savePhotoBtn.style.display = "inline-flex";
                } catch (err) {
                    console.error("Error reading image file:", err);
                    alert("Error processing image file. Please try another image.");
                }
            }
        });
    }

    if (savePhotoBtn) {
        savePhotoBtn.addEventListener("click", async () => {
            if (!temporaryBase64Image) return;

            // Update user session object locally
            user.avatar = temporaryBase64Image;
            localStorage.setItem("currentUser", JSON.stringify(user));

            // Instantly apply changes to all images on page
            updateAllAvatars(temporaryBase64Image);

            savePhotoBtn.style.display = "none";

            // Sync to Firestore database if initialized
            try {
                const firestoreDb = window.db;
                if (firestoreDb && window.doc && window.updateDoc && user.email) {
                    const userRef = window.doc(firestoreDb, "registrations", user.email);
                    await window.updateDoc(userRef, { avatar: temporaryBase64Image });
                }
            } catch (err) {
                console.warn("Firestore update skipped:", err);
            }

            alert("Profile photo updated successfully!");
        });
    }

    // 4. Logout Handler
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("currentUser");
            window.location.href = "login.html";
        });
    }
});
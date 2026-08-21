import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initUserProfileHeader();
    initLogout();
});

// Sidebar & Overlay Controls
function initNavigation() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    const openMenu = document.getElementById("openMenu");
    const closeMenu = document.getElementById("closeMenu");

    function openSidebar() {
        sidebar?.classList.add("open");
        overlay?.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        sidebar?.classList.remove("open");
        overlay?.classList.remove("show");
        document.body.style.overflow = "";
    }

    openMenu?.addEventListener("click", openSidebar);
    closeMenu?.addEventListener("click", closeSidebar);
    overlay?.addEventListener("click", closeSidebar);

    // Close sidebar on link click or Escape key
    document.querySelectorAll(".menu a").forEach(link => {
        link.addEventListener("click", closeSidebar);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeSidebar();
    });

    // Auto-highlight active navigation link based on current path
    const currentPath = window.location.pathname.split("/").pop();
    document.querySelectorAll(".menu a").forEach(link => {
        if (link.getAttribute("href") === currentPath) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}

// Update Header Profile Information
function initUserProfileHeader() {
    const currentUserRaw = localStorage.getItem("currentUser");
    if (currentUserRaw) {
        try {
            const currentUser = JSON.parse(currentUserRaw);
            const welcomeName = document.getElementById("welcomeName");
            const profileImage = document.getElementById("profileImage");

            if (welcomeName) welcomeName.textContent = currentUser.fullName || "Student User";
            if (profileImage && currentUser.avatar) profileImage.src = currentUser.avatar;
        } catch (e) {
            console.error("Failed to parse user profile context:", e);
        }
    }
}

// Global Logout Handler
function initLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn?.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            localStorage.removeItem("currentUser");
            sessionStorage.clear();
            window.location.href = "index.html";
        } catch (error) {
            console.error("Error signing out:", error);
            alert("Failed to sign out cleanly. Please try again.");
        }
    });
}
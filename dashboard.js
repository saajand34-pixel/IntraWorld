document.addEventListener("DOMContentLoaded", () => {
    // Read session from localStorage
    const storedUser = localStorage.getItem("currentUser");
    const user = storedUser ? JSON.parse(storedUser) : null;

    // Default SVG fallback avatar
    const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/></svg>";

    // Navigation and Header elements
    const navUserName = document.getElementById("user-name") || document.querySelector(".user-profile span");
    const navUserAvatar = document.getElementById("user-avatar") || document.querySelector(".user-profile img");
    const welcomeHeader = document.querySelector("h1");

    if (user) {
        // Update user name in navbar
        if (navUserName) {
            navUserName.textContent = user.fullName || "Student User";
        }

        // Update welcome message if present
        if (welcomeHeader && welcomeHeader.textContent.includes("WELCOME")) {
            welcomeHeader.textContent = `WELCOME, ${(user.fullName || "STUDENT").toUpperCase()}`;
        }

        // Render uploaded Base64 profile photo
        if (navUserAvatar) {
            navUserAvatar.src = user.avatar || defaultAvatar;
            navUserAvatar.onerror = () => {
                navUserAvatar.src = defaultAvatar;
            };
        }
    }

    // Attach navigation click handler to redirect to profile page
    const profileContainer = document.querySelector(".user-profile") || document.getElementById("nav-profile");
    if (profileContainer) {
        profileContainer.style.cursor = "pointer";
        profileContainer.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    }
});
import { auth } from "./firebase-config.js";
import { 
    GoogleAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const googleProvider = new GoogleAuthProvider();
let isGmailVerified = false;

async function verifyGoogleAccount() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Populate email input automatically if user completed Google verification
        const emailInput = document.getElementById("email");
        if (emailInput && user.email) {
            emailInput.value = user.email;
        }

        isGmailVerified = true;

        // UI state update
        const googleBtn = document.getElementById("google-auth-btn");
        const statusText = document.getElementById("google-status");

        if (googleBtn) {
            googleBtn.style.background = "rgba(74, 222, 128, 0.2)";
            googleBtn.style.borderColor = "#4ade80";
            googleBtn.style.color = "#4ade80";
            googleBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Connected as ${user.email}`;
            googleBtn.disabled = true;
        }

        if (statusText) {
            statusText.style.display = "block";
        }

        alert(`Successfully verified identity via ${user.email}`);
    } catch (error) {
        console.error("Google Auth Error:", error);
        alert(`Google Authentication Error: ${error.message}`);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const googleBtn = document.getElementById("google-auth-btn");
    if (googleBtn) {
        googleBtn.addEventListener("click", verifyGoogleAccount);
    }

    const form = document.getElementById("registrationForm");
    if (form) {
        form.addEventListener("submit", (e) => {
            if (!isGmailVerified) {
                e.preventDefault();
                alert("Please verify your Gmail identity before submitting enrolment.");
            }
        });
    }
});
import { auth } from "./firebase-config.js";
import { 
    RecaptchaVerifier, 
    signInWithPhoneNumber 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Helper to initialize RecaptchaVerifier safely
function setupRecaptcha() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                console.log("reCAPTCHA verified");
            },
            'expired-callback': () => {
                console.log("reCAPTCHA expired");
            }
        });
    }
}

// Function to handle OTP delivery
async function sendOTP() {
    const phoneInput = document.getElementById("mobile_number");
    const phoneNumber = phoneInput ? phoneInput.value.trim() : "";

    if (!phoneNumber) {
        alert("Please enter a valid mobile number with country code (e.g. +919999999999)");
        return;
    }

    try {
        setupRecaptcha();
        const appVerifier = window.recaptchaVerifier;

        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        window.confirmationResult = confirmationResult;
        
        alert("OTP sent successfully to " + phoneNumber);
    } catch (error) {
        console.error("OTP Error:", error);
        alert("OTP Error: " + error.message);
        
        // Reset reCAPTCHA if it fails so user can retry
        if (window.recaptchaVerifier) {
            window.recaptchaVerifier.render().then(widgetId => {
                grecaptcha.reset(widgetId);
            });
        }
    }
}

// Bind event listener to the Send OTP button
document.addEventListener("DOMContentLoaded", () => {
    const sendOtpBtn = document.getElementById("send-otp-btn");
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener("click", sendOTP);
    }
});
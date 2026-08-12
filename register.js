import { auth } from "./firebase-config.js";
import { 
    RecaptchaVerifier, 
    signInWithPhoneNumber 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. Initialize the RecaptchaVerifier on page load
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
  'size': 'invisible', // or 'normal'
  'callback': (response) => {
    // reCAPTCHA solved - allow sendOTP
    console.log("reCAPTCHA verified");
  },
  'expired-callback': () => {
    // Response expired. Ask user to solve reCAPTCHA again.
    console.log("reCAPTCHA expired");
  }
});

// 2. Function called when clicking "Send OTP"
async function sendOTP() {
    const phoneNumber = "+919999999999"; // Your test or user phone number
    const appVerifier = window.recaptchaVerifier;

    try {
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        window.confirmationResult = confirmationResult;
        alert("OTP sent successfully!");
    } catch (error) {
        console.error("OTP Error:", error);
        alert("OTP Error: " + error.message);
    }
}
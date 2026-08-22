import { db } from "./firebase-config.js";
import { 
    collection, 
    addDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global OTP state variables
let generatedOTP = null;
let isGmailOtpVerified = false;

// EmailJS Credentials Configuration
const PUBLIC_KEY = "AgRvlQp55hsz50XuH";
const SERVICE_ID = "service_cuo0zfo";
const TEMPLATE_ID = "template_f5n21dq";

// Initialize EmailJS Engine
function initEmailJS() {
    if (window.emailjs) {
        try {
            window.emailjs.init(PUBLIC_KEY);
            console.log("EmailJS SDK initialized successfully.");
        } catch (e) {
            console.error("EmailJS Initialization Error:", e);
        }
    } else {
        console.error("EmailJS SDK script non-existent or failed to load from CDN.");
    }
}

// Send OTP Logic
async function sendGmailOTP() {
    const emailInput = document.getElementById("email");
    const userEmail = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const otpStatus = document.getElementById("otp-status");
    const sendBtn = document.getElementById("send-otp-btn");

    if (!userEmail) {
        alert("Please enter a valid Gmail address in Tab 1 first.");
        return;
    }

    // Generate random 6-digit passcode
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("%c DEBUG OTP CODE:", "color: #4ade80; font-size: 18px; font-weight: bold;", generatedOTP);

    if (otpStatus) {
        otpStatus.style.display = "block";
        otpStatus.style.color = "#38bdf8";
        otpStatus.innerText = `Sending OTP code to ${userEmail}...`;
    }

    if (sendBtn) sendBtn.disabled = true;

    // Parameters mapped to EmailJS template variables
    const templateParams = {
        to_email: userEmail,
        email: userEmail,
        otp_code: generatedOTP,
        name: document.querySelector('input[name="full_name"]')?.value || "Student User",
        message: `Your IntraWorld verification code is: ${generatedOTP}`
    };

    try {
        if (!window.emailjs) {
            throw new Error("EmailJS SDK is not loaded. Check network or ad-blocker.");
        }

        const response = await window.emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
        console.log("EmailJS OTP Dispatch Success:", response.status, response.text);

        if (otpStatus) {
            otpStatus.style.color = "#4ade80";
            otpStatus.innerText = `OTP sent to ${userEmail}! Check your inbox or spam folder.`;
        }
        alert(`A 6-digit OTP passcode has been sent to ${userEmail}`);

    } catch (error) {
        console.error("EmailJS Transmission Error:", error);
        
        let errorMsg = error.text || error.message || "Failed to deliver email.";
        if (otpStatus) {
            otpStatus.style.color = "#ef4444";
            otpStatus.innerText = `Delivery Error: ${errorMsg}`;
        }
        alert(`Failed to send OTP: ${errorMsg}\nCheck your developer console (F12) for detailed logs.`);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

// Verify OTP Logic
function verifyGmailOTP() {
    const otpInput = document.getElementById("otp-code");
    const userEnteredOTP = otpInput ? otpInput.value.trim() : "";
    const otpStatus = document.getElementById("otp-status");

    if (!generatedOTP) {
        alert("Please click 'Send OTP' first.");
        return;
    }

    if (userEnteredOTP === generatedOTP) {
        isGmailOtpVerified = true;
        if (otpStatus) {
            otpStatus.style.display = "block";
            otpStatus.style.color = "#4ade80";
            otpStatus.innerText = "✓ Passcode Verified Successfully!";
        }
        alert("OTP verified successfully! You can now submit your enrolment.");
    } else {
        alert("Invalid OTP passcode. Check your email and try again.");
    }
}

// Attach Form Event Listeners on DOM Load
document.addEventListener("DOMContentLoaded", () => {
    initEmailJS();

    const sendOtpBtn = document.getElementById("send-otp-btn");
    const verifyOtpBtn = document.getElementById("verify-otp-btn");
    const form = document.getElementById("registrationForm");

    if (sendOtpBtn) sendOtpBtn.addEventListener("click", sendGmailOTP);
    if (verifyOtpBtn) verifyOtpBtn.addEventListener("click", verifyGmailOTP);

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const password = document.getElementById("password")?.value || "";
            const confirmPassword = document.getElementById("confirm_password")?.value || "";

            if (password !== confirmPassword) {
                alert("Passwords do not match. Please verify your entries.");
                return;
            }

            if (!isGmailOtpVerified) {
                alert("Please complete the Gmail OTP verification before submitting enrolment.");
                return;
            }

            const submitBtn = document.getElementById("btn-final-submit");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Encrypting & Storing Data...";
            }

            const registrationPayload = {
                fullName: document.querySelector('input[name="full_name"]')?.value.trim() || "",
                email: document.getElementById("email")?.value.trim().toLowerCase() || "",
                password: password,
                mobile: document.getElementById("mobile_number")?.value.trim() || "",
                favouriteSport: document.getElementById("favourite_sport")?.value.trim() || "",
                ambition: document.getElementById("ambition")?.value.trim() || "",
                qualification: document.querySelector('select[name="qualification"]')?.value || "",
                specialization: document.querySelector('input[name="specialization"]')?.value.trim() || "",
                collegeUniversity: document.querySelector('input[name="college_university"]')?.value.trim() || "",
                skills: document.querySelector('input[name="skills"]')?.value.trim() || "",
                interests: document.querySelector('textarea[name="professional_interests"]')?.value.trim() || "",
                avatar: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/></svg>",
                isVerified: true,
                createdAt: new Date().toISOString()
            };

            localStorage.setItem("currentUser", JSON.stringify(registrationPayload));

            try {
                if (db) {
                    await addDoc(collection(db, "registrations"), registrationPayload);
                }
                alert("Account registration successful! Opening your dashboard...");
                window.location.href = "dashboard.html";
            } catch (err) {
                console.error("Firestore DB write error:", err);
                alert("Account created! Redirecting to dashboard...");
                window.location.href = "dashboard.html";
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
});
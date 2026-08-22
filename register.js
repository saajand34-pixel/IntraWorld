import { db } from "./firebase-config.js";
import { 
    collection, 
    addDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global state variables
let generatedOTP = null;
let isGmailOtpVerified = false;

// Web3Forms Key Configuration
const WEB3FORMS_KEY = "bb00ad90-e756-4918-b4b5-caf2bab0b818";

// Send OTP Logic using Web3Forms
async function sendGmailOTP() {
    const emailInput = document.getElementById("email");
    const userEmail = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const nameInput = document.querySelector('input[name="full_name"]');
    const userName = nameInput ? nameInput.value.trim() : "Student User";
    
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
        otpStatus.innerText = `Dispatching OTP code for ${userEmail}...`;
    }

    if (sendBtn) sendBtn.disabled = true;

    try {
        const response = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                access_key: WEB3FORMS_KEY,
                name: userName,
                email: userEmail,
                subject: `IntraWorld OTP Code for ${userEmail}`,
                message: `Identity Verification Request for ${userName} (${userEmail})\n\nVerification Code: ${generatedOTP}`
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log("Web3Forms OTP Dispatch Success:", data);
            
            if (otpStatus) {
                otpStatus.style.color = "#4ade80";
                otpStatus.innerText = `OTP code generated! Check pop-up or console.`;
            }
            
            alert(`OTP Passcode Generated: ${generatedOTP}\n\nType this code into the box and click 'Verify OTP'.`);
        } else {
            throw new Error(data.message || "Failed to dispatch via Web3Forms.");
        }

    } catch (error) {
        console.error("Web3Forms Transmission Error:", error);
        
        if (otpStatus) {
            otpStatus.style.color = "#ef4444";
            otpStatus.innerText = `Notice: ${error.message}`;
        }
        alert(`OTP Generated: ${generatedOTP}\n(Status: ${error.message})`);
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
        alert("Invalid OTP passcode. Check the console/alert code and try again.");
    }
}

// Attach Form Event Listeners on DOM Load
document.addEventListener("DOMContentLoaded", () => {
    const sendOtpBtn = document.getElementById("send-otp-btn");
    const verifyOtpBtn = document.getElementById("verify-otp-btn");
    const form = document.getElementById("registrationForm");

    if (sendOtpBtn) sendOtpBtn.addEventListener("click", sendGmailOTP);
    if (verifyOtpBtn) verifyOtpBtn.addEventListener("click", verifyGmailOTP);

    if (form) {
        form.addEventListener("submit", (e) => {
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
                isVerified: true,
                createdAt: new Date().toISOString()
            };

            localStorage.setItem("currentUser", JSON.stringify(registrationPayload));
            alert("Account registration successful! Opening your dashboard...");
            window.location.href = "dashboard.html";
        });
    }
});
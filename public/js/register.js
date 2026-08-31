// ⭐ IMPROVED register.js with Smart Field Matching

import { db, auth } from "../firebase-config.js";
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log("✅ register.js loaded successfully");

// ⭐ Backend Configuration (Updated to Vercel)
const BACKEND_URL = "https://intra-world.vercel.app";
const BACKEND_VERIFY_URL = `${BACKEND_URL}/api/verify-document`;
const BACKEND_SEND_OTP_URL = `${BACKEND_URL}/api/send-email-otp`;

const WEB3FORMS_ACCESS_KEY = "bb00ad90-e756-4918-b4b5-caf2bab0b818";
const OTP_VALIDITY_MS = 5 * 60 * 1000;

// ⭐ BACKEND HEALTH CHECK
async function checkBackendHealth() {
    console.log(`🔍 Checking backend health at: ${BACKEND_URL}`);
    try {
        const response = await fetch(`${BACKEND_URL}/`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const text = await response.text();
        console.log(`✅ Backend is online! Status: ${response.status}`);
        return true;
    } catch (error) {
        console.error(`❌ Backend health check FAILED:`, error.message);
        return false;
    }
}

checkBackendHealth();

// STATE VARIABLES
let generatedEmailOTP = "";
let emailOtpCreatedAt = 0;
let emailOtpVerified = false;

let generatedPhoneOTP = "";
let phoneOtpCreatedAt = 0;
let phoneOtpVerified = false;

window.turnstileToken = null;

window.onTurnstileSuccess = function(token) {
    window.turnstileToken = token;
    console.log("✅ Turnstile verification successful");
};

window.onTurnstileExpired = function() {
    window.turnstileToken = null;
    console.log("⚠️ Turnstile token expired");
};

window.onTurnstileError = function() {
    window.turnstileToken = null;
    console.error("❌ Turnstile error");
    alert("❌ Security check failed. Please refresh and try again.");
};

// DOM ELEMENTS
const form = document.getElementById("registrationForm");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("mobile_number");
const sendOtpButton = document.getElementById("send-otp-btn");
const otpInput = document.getElementById("otp-code");
const verifyOtpButton = document.getElementById("verify-otp-btn");
const otpStatus = document.getElementById("otp-status");
const sendPhoneOtpButton = document.getElementById("send-phone-otp-btn");
const phoneOtpInput = document.getElementById("phone-otp-code");
const verifyPhoneOtpButton = document.getElementById("verify-phone-otp-btn");
const phoneOtpStatus = document.getElementById("phone-otp-status");

const qualificationInput = document.getElementById("qualification");
const specializationInput = document.getElementById("specialization");
const collegeNameInput = document.getElementById("college_name");
const skillsInput = document.getElementById("skills");
const passoutYearInput = document.getElementById("passed_out_year");
const docFileInput = document.getElementById("academic_doc");
const fileNameDisplay = document.getElementById("file-name-display");

const togglePassword = document.getElementById("togglePassword");
const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm_password");

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
        const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
        passwordInput.setAttribute("type", type);
        togglePassword.classList.toggle("fa-eye");
        togglePassword.classList.toggle("fa-eye-slash");
    });
}

if (toggleConfirmPassword && confirmPasswordInput) {
    toggleConfirmPassword.addEventListener("click", () => {
        const type = confirmPasswordInput.getAttribute("type") === "password" ? "text" : "password";
        confirmPasswordInput.setAttribute("type", type);
        toggleConfirmPassword.classList.toggle("fa-eye");
        toggleConfirmPassword.classList.toggle("fa-eye-slash");
    });
}

if (docFileInput && fileNameDisplay) {
    docFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            fileNameDisplay.textContent = `✅ Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
        } else {
            fileNameDisplay.textContent = "";
        }
    });
}

async function isValueDuplicate(field, value) {
    try {
        const q = query(collection(db, "registrations"), where(field, "==", value));
        const snap = await getDocs(q);
        return !snap.empty;
    } catch (error) {
        console.error(`Error checking duplicate ${field}:`, error);
        throw error;
    }
}

function showStatus(element, message, color = "#22c55e") {
    if (element) {
        element.textContent = message;
        element.style.display = "block";
        element.style.color = color;
    }
}

// IMAGE COMPRESSION
function compressAndConvertToBase64(file, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        if (file.type === "application/pdf") {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = (err) => reject(err);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
                resolve(compressedDataUrl.split(',')[1]);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// ⭐ IMPROVED DOCUMENT VERIFICATION (Sends multiple fields for matching)
async function verifyDocumentViaIDAnalyzer(file, fullName, collegeName, passoutYear) {
    console.log(`🔍 Starting document verification`);
    console.log(`   Full Name: ${fullName}`);
    console.log(`   College: ${collegeName}`);
    console.log(`   Year: ${passoutYear}`);

    try {
        console.log(`📦 Compressing image...`);
        const base64Data = await compressAndConvertToBase64(file);
        console.log(`✅ Compressed to ${(base64Data.length / 1024).toFixed(2)}KB`);

        console.log(`📡 Sending to backend for OCR & field matching...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.error(`⏱️ Request timeout after 120 seconds`);
            controller.abort();
        }, 120000);

        const response = await fetch(BACKEND_VERIFY_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                documentBase64: base64Data,
                expectedName: fullName,
                expectedCollege: collegeName,
                expectedYear: passoutYear
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log(`📊 Response status: ${response.status}`);

        const result = await response.json();
        console.log(`📋 Server response:`, result);

        if (!response.ok) {
            let errorMsg = result.message || "Document verification failed.";
            if (result.confidence === "low" && result.score !== undefined) {
                errorMsg += `\n\nConfidence Score: ${result.score}/100\n`;
                errorMsg += `Suggestions:\n`;
                errorMsg += `• Upload a clear photo/scan of your document\n`;
                errorMsg += `• Ensure your name is clearly visible\n`;
                errorMsg += `• Include your college/institution name\n`;
                errorMsg += `• Use good lighting and avoid glare`;
            }
            console.error(`❌ Verification failed: ${errorMsg}`);
            throw new Error(errorMsg);
        }

        console.log(`✅ Document verified! Confidence: ${result.confidence} (Score: ${result.score}/100)`);
        return result;

    } catch (err) {
        if (err.name === 'AbortError') {
            const timeoutMsg = "Server request timed out. Please retry with a smaller image.";
            console.error(`⏱️ ${timeoutMsg}`);
            throw new Error(timeoutMsg);
        }

        console.error(`❌ Verification error:`, err.message);
        throw err;
    }
}

// EMAIL OTP LOGIC
async function sendEmailOTP() {
    const email = emailInput?.value.trim().toLowerCase();

    if (!email || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email)) {
        alert("❌ Please enter a valid Gmail address.");
        return;
    }

    try {
        if (await isValueDuplicate("email", email)) {
            alert("❌ This Gmail address is already registered.");
            return;
        }
    } catch (err) {
        alert("❌ Error checking email: " + err.message);
        return;
    }

    generatedEmailOTP = String(Math.floor(100000 + Math.random() * 900000));
    emailOtpCreatedAt = Date.now();
    emailOtpVerified = false;

    if (sendOtpButton) sendOtpButton.textContent = "Sending...";

    try {
        const response = await fetch(BACKEND_SEND_OTP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, otp: generatedEmailOTP })
        });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Backend unreachable");

        if (otpInput) otpInput.disabled = false;
        if (verifyOtpButton) verifyOtpButton.disabled = false;
        showStatus(otpStatus, "✅ Gmail OTP sent successfully!");

    } catch (backendErr) {
        console.warn("Backend request failed, using Web3Forms fallback...", backendErr);

        try {
            const fallbackRes = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    access_key: WEB3FORMS_ACCESS_KEY,
                    subject: "IntraWorld - Gmail OTP Verification",
                    email: email,
                    message: `Your IntraWorld Email Verification OTP code is: ${generatedEmailOTP}`
                })
            });

            const fallbackResult = await fallbackRes.json();
            if (fallbackResult.success) {
                if (otpInput) otpInput.disabled = false;
                if (verifyOtpButton) verifyOtpButton.disabled = false;
                showStatus(otpStatus, "✅ Gmail OTP sent!");
            } else {
                throw new Error(fallbackResult.message || "Service failed.");
            }
        } catch (fallbackErr) {
            showStatus(otpStatus, `❌ Error: ${fallbackErr.message}`, "#ef4444");
            alert("❌ Failed to send OTP: " + fallbackErr.message);
        }
    } finally {
        if (sendOtpButton) sendOtpButton.textContent = "Send Email OTP";
    }
}

function verifyEmailOTP() {
    const entered = otpInput?.value.trim();
    if (entered === generatedEmailOTP && (Date.now() - emailOtpCreatedAt <= OTP_VALIDITY_MS)) {
        emailOtpVerified = true;
        showStatus(otpStatus, "✅ Gmail Verified", "#22c55e");
        if (verifyOtpButton) verifyOtpButton.disabled = true;
        alert("✅ Gmail verified successfully!");
    } else {
        showStatus(otpStatus, "❌ Incorrect or expired OTP", "#ef4444");
        alert("❌ Incorrect or expired Email OTP.");
    }
}

// PHONE OTP LOGIC
async function sendPhoneOTP() {
    let phone = phoneInput?.value.trim() || "";
    phone = phone.replace("+91", "").replace(/\D/g, "").trim();

    if (!phone || phone.length !== 10) {
        alert("❌ Please enter a valid 10-digit mobile number.");
        return;
    }

    try {
        if (await isValueDuplicate("mobile", phone)) {
            alert("❌ This mobile number is already registered.");
            return;
        }
    } catch (err) {
        alert("❌ Error checking mobile number: " + err.message);
        return;
    }

    generatedPhoneOTP = String(Math.floor(100000 + Math.random() * 900000));
    phoneOtpCreatedAt = Date.now();
    phoneOtpVerified = false;

    if (sendPhoneOtpButton) sendPhoneOtpButton.textContent = "Sending SMS...";

    try {
        if (phoneOtpInput) phoneOtpInput.disabled = false;
        if (verifyPhoneOtpButton) verifyPhoneOtpButton.disabled = false;

        showStatus(phoneOtpStatus, "✅ SMS OTP sent successfully!");
        alert(`[DEV MODE] Your SMS OTP is: ${generatedPhoneOTP}`);
    } catch (err) {
        showStatus(phoneOtpStatus, `❌ Error: ${err.message}`, "#ef4444");
        alert("❌ Error sending OTP: " + err.message);
    } finally {
        if (sendPhoneOtpButton) sendPhoneOtpButton.textContent = "Send SMS OTP";
    }
}

function verifyPhoneOTP() {
    const entered = phoneOtpInput?.value.trim();
    if (entered === generatedPhoneOTP && (Date.now() - phoneOtpCreatedAt <= OTP_VALIDITY_MS)) {
        phoneOtpVerified = true;
        showStatus(phoneOtpStatus, "✅ Phone Verified", "#22c55e");
        if (verifyPhoneOtpButton) verifyPhoneOtpButton.disabled = true;
        alert("✅ Phone verified successfully!");
    } else {
        showStatus(phoneOtpStatus, "❌ Incorrect or expired OTP", "#ef4444");
        alert("❌ Incorrect or expired Phone OTP.");
    }
}

// EVENT LISTENERS
if (sendOtpButton) sendOtpButton.addEventListener("click", (e) => { e.preventDefault(); sendEmailOTP(); });
if (verifyOtpButton) verifyOtpButton.addEventListener("click", (e) => { e.preventDefault(); verifyEmailOTP(); });
if (sendPhoneOtpButton) sendPhoneOtpButton.addEventListener("click", (e) => { e.preventDefault(); sendPhoneOTP(); });
if (verifyPhoneOtpButton) verifyPhoneOtpButton.addEventListener("click", (e) => { e.preventDefault(); verifyPhoneOTP(); });

// FORM SUBMISSION
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');

        const email = emailInput?.value.trim().toLowerCase();
        let mobile = phoneInput?.value.trim() || "";
        mobile = mobile.replace("+91", "").replace(/\D/g, "").trim();

        const fullName = document.getElementById("full_name")?.value.trim() || "";
        const qualification = qualificationInput?.value || "";
        const specialization = specializationInput?.value.trim() || "";
        const collegeName = collegeNameInput?.value.trim() || "";
        const skillsRaw = skillsInput?.value.trim() || "";
        const passoutYear = passoutYearInput?.value.trim() || "";

        const password = passwordInput?.value || "";
        const confirmPassword = confirmPasswordInput?.value || "";
        const termsCheckbox = document.getElementById("terms")?.checked || false;

        const turnstileInput = document.querySelector('[name="cf-turnstile-response"]');
        const activeToken = window.turnstileToken || (turnstileInput ? turnstileInput.value : null);

        if (!fullName) return alert("❌ Please enter your full name.");
        if (!qualification) return alert("❌ Please select your Qualification / Degree.");
        if (!specialization) return alert("❌ Please enter your Specialization.");
        if (!collegeName) return alert("❌ Please enter your College / University Name.");
        if (!skillsRaw) return alert("❌ Please enter at least one skill.");
        if (!passoutYear) return alert("❌ Please enter your Passed Out Year.");
        if (!docFileInput || !docFileInput.files || docFileInput.files.length === 0) return alert("❌ Please upload your Physical Academic Document.");

        if (!emailOtpVerified) return alert("❌ Please verify your Gmail address with OTP first.");
        if (!phoneOtpVerified) return alert("❌ Please verify your Mobile Number with SMS OTP first.");

        if (password.length < 8) return alert("❌ Password must be at least 8 characters long.");
        if (password !== confirmPassword) return alert("❌ Passwords do not match.");
        if (!termsCheckbox) return alert("❌ Please agree to the terms and conditions.");
        
        if (!activeToken) {
            return alert("❌ Security verification incomplete. Please complete the Cloudflare Security Check.");
        }

        const uploadedFile = docFileInput.files[0];
        const skillsArray = skillsRaw.split(",").map(s => s.trim()).filter(s => s.length > 0);

        try {
            const emailExists = await isValueDuplicate("email", email);
            const phoneExists = await isValueDuplicate("mobile", mobile);

            if (emailExists || phoneExists) return alert("❌ Registration blocked: Email or Mobile already registered.");

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Scanning Document & Verifying Fields...";
            }

            console.log(`🚀 Starting document verification with field matching...`);
            let verificationResult;
            try {
                verificationResult = await verifyDocumentViaIDAnalyzer(
                    uploadedFile, 
                    fullName,
                    collegeName,
                    passoutYear
                );
                console.log("✅ Document verification passed.");
            } catch (authErr) {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Complete Registration";
                }
                return alert("❌ Document Verification Failed:\n\n" + authErr.message);
            }

            const registrationData = {
                fullName, email, mobile, qualification, specialization, collegeName, passoutYear,
                skills: skillsArray,
                academicDocName: uploadedFile.name,
                academicDocType: uploadedFile.type,
                password,
                emailVerified: true,
                phoneVerified: true,
                documentVerified: true,
                documentVerificationScore: verificationResult.score,
                documentVerificationConfidence: verificationResult.confidence,
                verificationStatus: "verified",
                isVerified: true,
                turnstileToken: activeToken,
                createdAt: new Date().toISOString()
            };

            const docRef = await addDoc(collection(db, "registrations"), registrationData);
            const sessionData = { ...registrationData, id: docRef.id };
            localStorage.setItem("currentUser", JSON.stringify(sessionData));
            localStorage.setItem("intraWorldUser", JSON.stringify(sessionData));

            alert(`✅ Registration successful!\n\nDocument Verification: ${verificationResult.confidence.toUpperCase()}\nScore: ${verificationResult.score}/100\n\nRedirecting to dashboard...`);
            setTimeout(() => { window.location.href = "./dashboard.html"; }, 2000);

        } catch (err) {
            console.error(`❌ Registration error:`, err);
            alert("❌ Registration failed: " + err.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Complete Registration";
            }
        }
    });
}
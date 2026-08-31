// Global Configuration
const BACKEND_BASE_URL = "https://intraworld.web.app"; // Update with your deployment URL
const BACKEND_SEND_OTP_URL = `${BACKEND_BASE_URL}/api/send-email-otp`;
const BACKEND_VERIFY_URL = `${BACKEND_BASE_URL}/api/verify-document`;
const WEB3FORMS_ACCESS_KEY = "bb00ad90-e756-4918-b4b5-caf2bab0b818";

// OTP State Management
let generatedEmailOTP = null;
let emailOtpCreatedAt = 0;
let emailOtpVerified = false;

let generatedPhoneOTP = null;
let phoneOtpCreatedAt = 0;
let phoneOtpVerified = false;

// UI Elements
const emailInput = document.getElementById("email");
const otpInput = document.getElementById("emailOtp");
const sendOtpButton = document.getElementById("sendEmailOtpBtn");
const verifyOtpButton = document.getElementById("verifyEmailOtpBtn");
const otpStatus = document.getElementById("emailOtpStatus");

const phoneInput = document.getElementById("phone");
const phoneOtpInput = document.getElementById("phoneOtp");
const sendPhoneOtpButton = document.getElementById("sendPhoneOtpBtn");
const verifyPhoneOtpButton = document.getElementById("verifyPhoneOtpBtn");
const phoneOtpStatus = document.getElementById("phoneOtpStatus");

// Helper: Helper Status Display
function showStatus(element, text, color = "#22c55e") {
    if (!element) return;
    element.textContent = text;
    element.style.color = color;
    element.style.display = "block";
}

// ⭐ 1. SEND GMAIL OTP FUNCTION
async function sendEmailOTP() {
    const email = emailInput?.value.trim().toLowerCase();

    if (!email || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email)) {
        alert("❌ Please enter a valid Gmail address.");
        return;
    }

    try {
        if (typeof isValueDuplicate === "function" && await isValueDuplicate("email", email)) {
            alert("❌ This Gmail address is already registered.");
            return;
        }
    } catch (err) {
        console.warn("Duplicate check skipped or failed:", err.message);
    }

    generatedEmailOTP = String(Math.floor(100000 + Math.random() * 900000));
    emailOtpCreatedAt = Date.now();
    emailOtpVerified = false;

    if (sendOtpButton) sendOtpButton.textContent = "Sending...";

    try {
        // Primary Attempt: Backend Route
        const response = await fetch(BACKEND_SEND_OTP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, otp: generatedEmailOTP })
        });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Backend email request failed.");

        if (otpInput) otpInput.disabled = false;
        if (verifyOtpButton) verifyOtpButton.disabled = false;
        showStatus(otpStatus, "✅ Gmail OTP sent! Check your inbox.");
        alert(`✅ OTP sent to ${email}`);

    } catch (backendErr) {
        console.warn("Backend failed, attempting Web3Forms Direct API...", backendErr);

        try {
            // Fallback Attempt: Direct Web3Forms Call
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
                alert(`✅ OTP sent to ${email}`);
            } else {
                throw new Error(fallbackResult.message || "Web3Forms submission failed.");
            }
        } catch (fallbackErr) {
            console.error("Direct fallback failed, switching to Dev Auto-Fill Mode:", fallbackErr);
            
            // Fail-Safe: Dev Auto-Fill Mode
            if (otpInput) {
                otpInput.disabled = false;
                otpInput.value = generatedEmailOTP;
            }
            if (verifyOtpButton) verifyOtpButton.disabled = false;
            showStatus(otpStatus, `⚠️ Demo Mode OTP: ${generatedEmailOTP}`, "#eab308");
            alert(`[NETWORK FALLBACK] Gmail delivery unavailable.\n\nYour test OTP is: ${generatedEmailOTP}\n(Auto-filled into input box)`);
        }
    } finally {
        if (sendOtpButton) sendOtpButton.textContent = "Send Email OTP";
    }
}

// ⭐ 2. VERIFY GMAIL OTP FUNCTION
function verifyEmailOTP() {
    const userEnteredOTP = otpInput?.value.trim();

    if (!generatedEmailOTP) {
        alert("❌ Please request an OTP first.");
        return;
    }

    if (Date.now() - emailOtpCreatedAt > 10 * 60 * 1000) {
        alert("❌ OTP expired. Please request a new one.");
        return;
    }

    if (userEnteredOTP === generatedEmailOTP) {
        emailOtpVerified = true;
        if (otpInput) otpInput.disabled = true;
        if (verifyOtpButton) verifyOtpButton.disabled = true;
        showStatus(otpStatus, "✅ Gmail verified successfully!", "#22c55e");
        alert("✅ Gmail OTP verified successfully!");
    } else {
        alert("❌ Invalid Email OTP code. Please try again.");
    }
}

// ⭐ 3. SEND SMS OTP FUNCTION (Simulated with Auto-Fill)
async function sendPhoneOTP() {
    let phone = phoneInput?.value.trim() || "";
    phone = phone.replace("+91", "").replace(/\D/g, "").trim();

    if (!phone || phone.length !== 10) {
        alert("❌ Please enter a valid 10-digit mobile number.");
        return;
    }

    try {
        if (typeof isValueDuplicate === "function" && await isValueDuplicate("mobile", phone)) {
            alert("❌ This mobile number is already registered.");
            return;
        }
    } catch (err) {
        console.warn("Duplicate mobile check skipped or failed:", err.message);
    }

    generatedPhoneOTP = String(Math.floor(100000 + Math.random() * 900000));
    phoneOtpCreatedAt = Date.now();
    phoneOtpVerified = false;

    if (sendPhoneOtpButton) sendPhoneOtpButton.textContent = "Sending SMS...";

    setTimeout(() => {
        if (phoneOtpInput) {
            phoneOtpInput.disabled = false;
            phoneOtpInput.value = generatedPhoneOTP; // Auto-fill for instant testing
        }
        if (verifyPhoneOtpButton) verifyPhoneOtpButton.disabled = false;

        showStatus(phoneOtpStatus, `✅ Demo SMS Sent! Code: ${generatedPhoneOTP}`, "#22c55e");
        alert(`[DEV MODE] SMS Gateway Simulated.\n\nYour Mobile OTP is: ${generatedPhoneOTP}\n(Auto-filled into input box)`);
        
        if (sendPhoneOtpButton) sendPhoneOtpButton.textContent = "Send SMS OTP";
    }, 800);
}

// ⭐ 4. VERIFY SMS OTP FUNCTION
function verifyPhoneOTP() {
    const userEnteredOTP = phoneOtpInput?.value.trim();

    if (!generatedPhoneOTP) {
        alert("❌ Please request an SMS OTP first.");
        return;
    }

    if (Date.now() - phoneOtpCreatedAt > 10 * 60 * 1000) {
        alert("❌ OTP expired. Please request a new one.");
        return;
    }

    if (userEnteredOTP === generatedPhoneOTP) {
        phoneOtpVerified = true;
        if (phoneOtpInput) phoneOtpInput.disabled = true;
        if (verifyPhoneOtpButton) verifyPhoneOtpButton.disabled = true;
        showStatus(phoneOtpStatus, "✅ Mobile number verified successfully!", "#22c55e");
        alert("✅ Mobile OTP verified successfully!");
    } else {
        alert("❌ Invalid Mobile OTP code. Please try again.");
    }
}

// ⭐ 5. SMART DOCUMENT VERIFICATION ENGINE
async function verifyDocumentViaIDAnalyzer(file, fullName, collegeName, passoutYear) {
    console.log(`🔍 Starting smart document verification`);
    try {
        const base64Data = await compressAndConvertToBase64(file);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

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
        const result = await response.json();

        if (!response.ok) {
            let errorMsg = result.message || "Document verification failed.";
            if (result.score !== undefined) {
                errorMsg += `\n\nScore: ${result.score}/100 (LOW CONFIDENCE)\n`;
                errorMsg += `• Ensure your name matches the registration\n`;
                errorMsg += `• Ensure the college name is clearly visible`;
            }
            throw new Error(errorMsg);
        }

        console.log(`✅ Document verified! Confidence: ${result.confidence.toUpperCase()} (${result.score}/100)`);
        return result;

    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error("Server request timed out. Please retry with a smaller image.");
        }
        throw err;
    }
}

// Event Listener Attachments
document.addEventListener("DOMContentLoaded", () => {
    sendOtpButton?.addEventListener("click", sendEmailOTP);
    verifyOtpButton?.addEventListener("click", verifyEmailOTP);
    sendPhoneOtpButton?.addEventListener("click", sendPhoneOTP);
    verifyPhoneOtpButton?.addEventListener("click", verifyPhoneOTP);
});
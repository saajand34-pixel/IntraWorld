// ==========================================
// CONFIGURATION & ENDPOINTS
// ==========================================
// UPDATE THIS to your live Vercel backend domain (e.g., https://intraworld-backend.vercel.app)
const BACKEND_BASE_URL = "http://localhost:3000"; 

const BACKEND_VERIFY_URL = `${BACKEND_BASE_URL}/api/verify-document`;
const BACKEND_SEND_OTP_URL = `${BACKEND_BASE_URL}/api/send-email-otp`;
const WEB3FORMS_ACCESS_KEY = "bb00ad90-e756-4918-b4b5-caf2bab0b818";

// State Variables
let generatedEmailOTP = null;
let generatedPhoneOTP = null;
let emailOtpVerified = false;
let phoneOtpVerified = false;

// UI Helpers
function showStatus(element, message, color = "#22c55e") {
    if (!element) return;
    element.style.color = color;
    element.textContent = message;
}

// Dummy duplication check fallback
async function isValueDuplicate(field, value) {
    return false; // Replace with your actual Firebase/Database check if needed
}

// ==========================================
// 1. HELPER: FILE COMPRESSION & BASE64 FIX
// ==========================================
function compressAndConvertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1000;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Return clean Base64 data without data:image header
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                const base64Clean = dataUrl.split(',')[1];
                resolve(base64Clean);
            };
            img.onerror = (err) => reject(new Error("Failed to load document image."));
        };
        reader.onerror = (err) => reject(new Error("Failed to read document file."));
    });
}

// ==========================================
// 2. DOCUMENT VERIFICATION FUNCTION
// ==========================================
async function verifyDocumentViaIDAnalyzer(file, fullName, collegeName, passoutYear) {
    console.log(`🔍 Starting document verification for: ${fullName}`);
    try {
        const base64Data = await compressAndConvertToBase64(file);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

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
                errorMsg += `\n\nScore: ${result.score}/100`;
            }
            throw new Error(errorMsg);
        }

        console.log(`✅ Document verified! Score: ${result.score}/100`);
        return result;

    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error("Server request timed out. Image might be too large.");
        }
        throw err;
    }
}

// ==========================================
// 3. GMAIL OTP FUNCTION (Dual Fallback)
// ==========================================
async function sendEmailOTP() {
    const emailInput = document.getElementById("emailInput");
    const otpInput = document.getElementById("otpInput");
    const sendOtpButton = document.getElementById("sendOtpBtn");
    const verifyOtpButton = document.getElementById("verifyOtpBtn");
    const otpStatus = document.getElementById("otpStatus");

    const email = emailInput?.value.trim().toLowerCase();

    if (!email || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email)) {
        alert("❌ Please enter a valid Gmail address.");
        return;
    }

    generatedEmailOTP = String(Math.floor(100000 + Math.random() * 900000));
    if (sendOtpButton) sendOtpButton.textContent = "Sending...";

    try {
        // Step A: Attempt Backend Endpoint
        const response = await fetch(BACKEND_SEND_OTP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, otp: generatedEmailOTP })
        });
        const result = await response.json();
        
        if (!response.ok || !result.success) throw new Error(result.message);

        if (otpInput) otpInput.disabled = false;
        if (verifyOtpButton) verifyOtpButton.disabled = false;
        showStatus(otpStatus, "✅ Gmail OTP sent! Check your inbox.");
        alert(`✅ OTP sent to ${email}`);

    } catch (err) {
        console.warn("Backend unavailable. Using direct Web3Forms fallback...", err.message);

        try {
            // Step B: Direct Web3Forms Fallback
            const fallbackRes = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    access_key: WEB3FORMS_ACCESS_KEY,
                    subject: "IntraWorld - Gmail Verification OTP",
                    email: email,
                    message: `Your OTP verification code is: ${generatedEmailOTP}`
                })
            });

            const fallbackResult = await fallbackRes.json();
            if (fallbackResult.success) {
                if (otpInput) otpInput.disabled = false;
                if (verifyOtpButton) verifyOtpButton.disabled = false;
                showStatus(otpStatus, "✅ Gmail OTP sent via Web3Forms fallback!");
                alert(`✅ OTP sent to ${email}`);
            } else {
                // Testing Fallback: Unlock input directly if network blocks API
                if (otpInput) {
                    otpInput.disabled = false;
                    otpInput.value = generatedEmailOTP;
                }
                if (verifyOtpButton) verifyOtpButton.disabled = false;
                showStatus(otpStatus, `⚠️ Demo OTP Code: ${generatedEmailOTP}`, "#f59e0b");
                alert(`[DEMO MODE] Email API blocked. Auto-filled test OTP: ${generatedEmailOTP}`);
            }
        } catch (fallbackErr) {
            alert("❌ Failed to send OTP: " + fallbackErr.message);
        }
    } finally {
        if (sendOtpButton) sendOtpButton.textContent = "Send Email OTP";
    }
}

// ==========================================
// 4. SMS OTP FUNCTION (Dev Auto-Fill)
// ==========================================
async function sendPhoneOTP() {
    const phoneInput = document.getElementById("phoneInput");
    const phoneOtpInput = document.getElementById("phoneOtpInput");
    const sendPhoneOtpButton = document.getElementById("sendPhoneOtpBtn");
    const verifyPhoneOtpButton = document.getElementById("verifyPhoneOtpBtn");
    const phoneOtpStatus = document.getElementById("phoneOtpStatus");

    let phone = phoneInput?.value.trim() || "";
    phone = phone.replace("+91", "").replace(/\D/g, "").trim();

    if (!phone || phone.length !== 10) {
        alert("❌ Please enter a valid 10-digit mobile number.");
        return;
    }

    generatedPhoneOTP = String(Math.floor(100000 + Math.random() * 900000));
    if (sendPhoneOtpButton) sendPhoneOtpButton.textContent = "Sending...";

    setTimeout(() => {
        if (phoneOtpInput) {
            phoneOtpInput.disabled = false;
            phoneOtpInput.value = generatedPhoneOTP; // Auto-fills test OTP
        }
        if (verifyPhoneOtpButton) verifyPhoneOtpButton.disabled = false;

        showStatus(phoneOtpStatus, `✅ Demo SMS Sent! Code: ${generatedPhoneOTP}`, "#22c55e");
        alert(`[DEV MODE] Mobile OTP: ${generatedPhoneOTP}\n\nCode auto-filled into input field.`);
        
        if (sendPhoneOtpButton) sendPhoneOtpButton.textContent = "Send SMS OTP";
    }, 600);
}

// ==========================================
// 5. EVENT LISTENERS INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("sendOtpBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        sendEmailOTP();
    });

    document.getElementById("sendPhoneOtpBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        sendPhoneOTP();
    });

    document.getElementById("verifyDocBtn")?.addEventListener("click", async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("documentInput");
        const fullName = document.getElementById("fullNameInput")?.value || "";
        const collegeName = document.getElementById("collegeInput")?.value || "";
        const passoutYear = document.getElementById("yearInput")?.value || "";

        if (!fileInput || !fileInput.files[0]) {
            alert("❌ Please select a document image file first.");
            return;
        }

        try {
            showStatus(document.getElementById("docStatus"), "⏳ Verifying document...", "#f59e0b");
            const result = await verifyDocumentViaIDAnalyzer(fileInput.files[0], fullName, collegeName, passoutYear);
            showStatus(document.getElementById("docStatus"), `✅ Document Accepted (${result.score}/100)`, "#22c55e");
            alert("✅ Document verified successfully!");
        } catch (err) {
            showStatus(document.getElementById("docStatus"), `❌ ${err.message}`, "#ef4444");
            alert(`❌ Document Verification Failed: ${err.message}`);
        }
    });
});
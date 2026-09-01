// CONFIGURATION & ENDPOINTS
const BACKEND_BASE_URL = "https://intra-world.vercel.app"; // Update with your active Vercel domain
const BACKEND_VERIFY_URL = `${BACKEND_BASE_URL}/api/verify-document`;
const BACKEND_SEND_EMAIL_OTP_URL = `${BACKEND_BASE_URL}/api/send-email-otp`;
const BACKEND_SEND_SMS_OTP_URL = `${BACKEND_BASE_URL}/api/send-sms-otp`;
const WEB3FORMS_ACCESS_KEY = "bb00ad90-e756-4918-b4b5-caf2bab0b818";

let generatedEmailOTP = null;
let generatedPhoneOTP = null;

function showStatus(element, message, color = "#22c55e") {
    if (!element) return;
    element.style.display = "block";
    element.style.color = color;
    element.textContent = message;
}

// 1. FILE BASE64 CONVERTER
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
                let width = img.width, height = img.height;

                if (width > height && width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                } else if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
            };
            img.onerror = () => reject(new Error("Failed to load document image."));
        };
        reader.onerror = () => reject(new Error("Failed to read document file."));
    });
}

// 2. DOCUMENT VERIFICATION FUNCTION
async function verifyDocument(file) {
    const fullName = document.getElementById("full_name")?.value || "";
    const collegeName = document.getElementById("college_name")?.value || "";
    const passoutYear = document.getElementById("passed_out_year")?.value || "";
    const fileNameDisplay = document.getElementById("file-name-display");

    if (fileNameDisplay) fileNameDisplay.textContent = `Selected: ${file.name} (Verifying...)`;

    try {
        const base64Data = await compressAndConvertToBase64(file);
        const response = await fetch(BACKEND_VERIFY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                documentBase64: base64Data,
                expectedName: fullName,
                expectedCollege: collegeName,
                expectedYear: passoutYear
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Document verification failed.");

        if (fileNameDisplay) {
            fileNameDisplay.style.color = "#22c55e";
            fileNameDisplay.textContent = `✅ Verified: ${file.name} (Score: ${result.score}/100)`;
        }
        alert("✅ Document verified successfully!");
    } catch (err) {
        if (fileNameDisplay) {
            fileNameDisplay.style.color = "#ef4444";
            fileNameDisplay.textContent = `❌ Verification Failed: ${err.message}`;
        }
        alert(`❌ Document Verification Error: ${err.message}`);
    }
}

// 3. GMAIL OTP FUNCTION
async function sendEmailOTP() {
    const emailInput = document.getElementById("email");
    const otpInput = document.getElementById("otp-code");
    const sendBtn = document.getElementById("send-otp-btn");
    const verifyBtn = document.getElementById("verify-otp-btn");
    const statusMsg = document.getElementById("otp-status");

    const email = emailInput?.value.trim().toLowerCase();
    if (!email || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email)) {
        alert("❌ Please enter a valid Gmail address.");
        return;
    }

    generatedEmailOTP = String(Math.floor(100000 + Math.random() * 900000));
    if (sendBtn) sendBtn.textContent = "Sending...";

    try {
        const response = await fetch(BACKEND_SEND_EMAIL_OTP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, otp: generatedEmailOTP })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message);

        if (otpInput) otpInput.disabled = false;
        if (verifyBtn) verifyBtn.disabled = false;
        showStatus(statusMsg, "✅ Gmail OTP sent! Check your inbox.");
    } catch (err) {
        // Fallback directly to Web3Forms
        const fallbackRes = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                access_key: WEB3FORMS_ACCESS_KEY,
                subject: "IntraWorld OTP",
                email: email,
                message: `Your OTP code is: ${generatedEmailOTP}`
            })
        });
        const fallbackResult = await fallbackRes.json();
        if (fallbackResult.success) {
            if (otpInput) otpInput.disabled = false;
            if (verifyBtn) verifyBtn.disabled = false;
            showStatus(statusMsg, "✅ Gmail OTP sent via Web3Forms!");
        } else {
            showStatus(statusMsg, `❌ Failed to send OTP: ${err.message}`, "#ef4444");
        }
    } finally {
        if (sendBtn) sendBtn.textContent = "Send Email OTP";
    }
}

// 4. SMS OTP FUNCTION (2Factor Integration)
async function sendPhoneOTP() {
    const phoneInput = document.getElementById("mobile_number");
    const otpInput = document.getElementById("phone-otp-code");
    const sendBtn = document.getElementById("send-phone-otp-btn");
    const verifyBtn = document.getElementById("verify-phone-otp-btn");
    const statusMsg = document.getElementById("phone-otp-status");

    let phone = phoneInput?.value.trim() || "";
    phone = phone.replace("+91", "").replace(/\D/g, "").trim();

    if (!phone || phone.length !== 10) {
        alert("❌ Enter a valid 10-digit mobile number.");
        return;
    }

    generatedPhoneOTP = String(Math.floor(100000 + Math.random() * 900000));
    if (sendBtn) sendBtn.textContent = "Sending...";

    try {
        const response = await fetch(BACKEND_SEND_SMS_OTP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: phone, otp: generatedPhoneOTP })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message);

        if (otpInput) otpInput.disabled = false;
        if (verifyBtn) verifyBtn.disabled = false;
        showStatus(statusMsg, "✅ SMS OTP sent to your phone!");
    } catch (err) {
        showStatus(statusMsg, `❌ SMS Error: ${err.message}`, "#ef4444");
    } finally {
        if (sendBtn) sendBtn.textContent = "Send SMS OTP";
    }
}

// 5. ATTACH LISTENERS MATCHING HTML IDs EXACTLY
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("send-otp-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        sendEmailOTP();
    });

    document.getElementById("send-phone-otp-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        sendPhoneOTP();
    });

    document.getElementById("academic_doc")?.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            verifyDocument(e.target.files[0]);
        }
    });
});
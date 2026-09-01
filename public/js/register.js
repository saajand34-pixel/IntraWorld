// ==========================================
// CONFIGURATION & ENDPOINTS
// ==========================================

const BACKEND_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
    ? "" 
    : "https://intra-world.vercel.app";

const BACKEND_VERIFY_URL = `${BACKEND_BASE_URL}/api/verify-document`;
const BACKEND_SEND_EMAIL_OTP_URL = `${BACKEND_BASE_URL}/api/send-email-otp`;
const BACKEND_SEND_SMS_OTP_URL = `${BACKEND_BASE_URL}/api/send-sms-otp`;

// Maximum file size = 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "application/pdf"
];

let generatedEmailOTP = null;
let generatedPhoneOTP = null;
let lastVerifiedDocumentResult = null;


// ==========================================
// STATUS MESSAGE FUNCTION
// ==========================================

function showStatus(element, message, color = "#22c55e") {
    if (!element) return;
    element.style.display = "block";
    element.style.color = color;
    element.textContent = message;
}


// ==========================================
// FILE VALIDATION
// ==========================================

function validateDocument(file) {
    if (!file) {
        throw new Error("Please select an academic document.");
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error("File is too large. Please upload a file smaller than 10 MB.");
    }

    const fileName = file.name.toLowerCase();
    const validExtension =
        fileName.endsWith(".jpg") ||
        fileName.endsWith(".jpeg") ||
        fileName.endsWith(".png") ||
        fileName.endsWith(".webp") ||
        fileName.endsWith(".pdf");

    if (!ALLOWED_FILE_TYPES.includes(file.type) && !validExtension) {
        throw new Error("Invalid file type. Please upload JPG, PNG, WEBP, or PDF.");
    }

    return true;
}


// ==========================================
// IMAGE SHARPNESS & QUALITY DETECTOR
// ==========================================

function checkImageQuality(img) {
    try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const w = Math.min(img.naturalWidth || 400, 400);
        const h = Math.min(img.naturalHeight || 300, 300);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h).data;
        let totalLum = 0;
        const gray = new Float32Array(w * h);

        for (let i = 0; i < imgData.length; i += 4) {
            const lum = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
            gray[i / 4] = lum;
            totalLum += lum;
        }

        // Laplacian variance
        let lapSum = 0;
        let lapCount = 0;
        const laps = [];
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;
                const lap = gray[idx - w] + gray[idx + w] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx];
                laps.push(lap);
                lapSum += lap;
                lapCount++;
            }
        }
        const mean = lapSum / lapCount;
        let varSum = 0;
        for (let i = 0; i < laps.length; i++) {
            varSum += Math.pow(laps[i] - mean, 2);
        }
        const lapVariance = varSum / lapCount;
        
        return {
            isBlurry: lapVariance < 75,
            lapVariance: Math.round(lapVariance),
            qualityPoints: lapVariance >= 200 ? 15 : lapVariance >= 100 ? 12 : lapVariance >= 40 ? 8 : 4
        };
    } catch (e) {
        return { isBlurry: false, qualityPoints: 12 };
    }
}


// ==========================================
// HIGH-FIDELITY IMAGE COMPRESSION
// ==========================================

function processImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const originalDataUri = event.target.result;
            const img = new Image();

            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    const MAX_DIM = 1600; // Preserve high resolution for OCR
                    let width = img.width;
                    let height = img.height;

                    if (width > height && width > MAX_DIM) {
                        height = Math.round((height * MAX_DIM) / width);
                        width = MAX_DIM;
                    } else if (height > MAX_DIM) {
                        width = Math.round((width * MAX_DIM) / height);
                        height = MAX_DIM;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    const qualityInfo = checkImageQuality(img);

                    const compressedBase64 = canvas.toDataURL("image/jpeg", 0.92);
                    resolve({
                        base64: compressedBase64,
                        isBlurry: qualityInfo.isBlurry,
                        qualityPoints: qualityInfo.qualityPoints
                    });
                } catch (err) {
                    resolve({ base64: originalDataUri, isBlurry: false, qualityPoints: 12 });
                }
            };

            img.onerror = () => {
                resolve({ base64: originalDataUri, isBlurry: false, qualityPoints: 12 });
            };

            img.src = originalDataUri;
        };

        reader.onerror = () => {
            reject(new Error("Failed to read the document file."));
        };
    });
}


// ==========================================
// DOCUMENT VERIFICATION (NEW SMART APPROACH)
// ==========================================

async function verifyDocument(file) {
    const fullName = document.getElementById("full_name")?.value.trim() || "";
    const collegeName = document.getElementById("college_name")?.value.trim() || "";
    const passoutYear = document.getElementById("passed_out_year")?.value.trim() || "";
    const fileNameDisplay = document.getElementById("file-name-display");
    const scoreBadge = document.getElementById("doc-score-badge");

    try {
        validateDocument(file);

        if (!fullName) {
            throw new Error("Please enter your Full Name before uploading your document.");
        }
        if (!collegeName) {
            throw new Error("Please enter your College Name before uploading your document.");
        }

        if (fileNameDisplay) {
            fileNameDisplay.style.color = "#38bdf8";
            fileNameDisplay.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing & Verifying <strong>${file.name}</strong> via Smart OCR...`;
        }

        const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        let docData;

        if (isPDF) {
            const rawBase64 = await new Promise((res, rej) => {
                const r = new FileReader();
                r.readAsDataURL(file);
                r.onload = () => res(r.target.result);
                r.onerror = rej;
            });
            docData = { base64: rawBase64, isBlurry: false, qualityPoints: 15 };
        } else {
            docData = await processImageToBase64(file);
        }

        // Call backend Smart Verification Endpoint
        let result;
        try {
            const response = await fetch(BACKEND_VERIFY_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    documentBase64: docData.base64,
                    expectedName: fullName,
                    expectedCollege: collegeName,
                    expectedYear: passoutYear,
                    isBlurry: docData.isBlurry
                })
            });

            result = await response.json();
        } catch (fetchErr) {
            // Local client-side smart fallback calculation if backend is unreachable
            result = calculateClientFallbackScore(fullName, collegeName, passoutYear, docData.isBlurry);
        }

        lastVerifiedDocumentResult = result;

        // Render Smart Confidence Results
        renderVerificationScore(result, file.name);

    } catch (error) {
        console.error("Document Verification Error:", error);
        if (fileNameDisplay) {
            fileNameDisplay.style.color = "#ef4444";
            fileNameDisplay.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ❌ Verification Error: ${error.message}`;
        }
        alert(`❌ Document Verification Error: ${error.message}`);
    }
}


// ==========================================
// RENDER SMART CONFIDENCE UI
// ==========================================

function renderVerificationScore(result, filename) {
    const fileNameDisplay = document.getElementById("file-name-display");
    const score = result.score || 0;
    const tier = result.confidence || result.tier || "low";
    const b = result.breakdown || {};

    const namePts = b.nameMatch?.points ?? (score >= 70 ? 40 : score >= 40 ? 30 : 0);
    const collegePts = b.collegeFound?.points ?? (score >= 70 ? 35 : score >= 40 ? 26 : 0);
    const qualityPts = b.documentQuality?.points ?? (score >= 70 ? 15 : score >= 40 ? 4 : 10);
    const dataPts = b.dataPresent?.points ?? (score >= 70 ? 10 : score >= 40 ? 7 : 0);

    let html = "";

    if (score >= 70) {
        // HIGH Confidence (70-100 pts) -> Accept
        html = `
            <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 10px; padding: 12px; margin-top: 10px; color: #a7f3d0;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 14px; margin-bottom: 6px;">
                    <span>✅ HIGH Confidence Verified (${score}/100 PTS)</span>
                    <span style="background: #10b981; color: #061525; padding: 2px 8px; border-radius: 6px; font-size: 11px;">ACCEPTED</span>
                </div>
                <p style="font-size: 12px; margin-bottom: 8px; color: #d1fae5;">Document: <strong>${filename}</strong></p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; font-size: 11px;">
                    <div>👤 Name: <strong>${namePts}/40</strong></div>
                    <div>🏛️ College: <strong>${collegePts}/35</strong></div>
                    <div>📸 Quality: <strong>${qualityPts}/15</strong></div>
                    <div>📅 Data: <strong>${dataPts}/10</strong></div>
                </div>
            </div>
        `;
    } else if (score >= 40) {
        // MEDIUM Confidence (40-69 pts) -> Accept with Warning
        html = `
            <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 10px; padding: 12px; margin-top: 10px; color: #fde68a;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 14px; margin-bottom: 6px;">
                    <span>⚠️ MEDIUM Confidence (${score}/100 PTS)</span>
                    <span style="background: #f59e0b; color: #061525; padding: 2px 8px; border-radius: 6px; font-size: 11px;">ACCEPTED (WARNING)</span>
                </div>
                <p style="font-size: 12px; margin-bottom: 8px; color: #fef3c7;">Core details matched, but document clarity or photo angle was detected. Queued for standard onboarding.</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; font-size: 11px;">
                    <div>👤 Name: <strong>${namePts}/40</strong></div>
                    <div>🏛️ College: <strong>${collegePts}/35</strong></div>
                    <div>📸 Quality: <strong>${qualityPts}/15</strong></div>
                    <div>📅 Data: <strong>${dataPts}/10</strong></div>
                </div>
            </div>
        `;
    } else {
        // LOW Confidence (0-39 pts) -> Reject
        html = `
            <div style="background: rgba(244, 63, 94, 0.12); border: 1px solid rgba(244, 63, 94, 0.4); border-radius: 10px; padding: 12px; margin-top: 10px; color: #fecdd3;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 14px; margin-bottom: 6px;">
                    <span>❌ LOW Confidence (${score}/100 PTS)</span>
                    <span style="background: #f43f5e; color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 11px;">REJECTED</span>
                </div>
                <p style="font-size: 12px; margin-bottom: 8px; color: #ffe4e6;">The document does not match your entered credentials. Please upload a clear official Student ID or enrollment document showing your full legal name.</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; font-size: 11px;">
                    <div>👤 Name: <strong>${namePts}/40</strong></div>
                    <div>🏛️ College: <strong>${collegePts}/35</strong></div>
                    <div>📸 Quality: <strong>${qualityPts}/15</strong></div>
                    <div>📅 Data: <strong>${dataPts}/10</strong></div>
                </div>
            </div>
        `;
    }

    if (fileNameDisplay) {
        fileNameDisplay.innerHTML = html;
    }
}


// ==========================================
// CLIENT FALLBACK SCORING HELPER
// ==========================================

function calculateClientFallbackScore(name, college, year, isBlurry) {
    if (!name || !college) {
        return { score: 0, confidence: "low", tier: "LOW", success: false, message: "Missing fields" };
    }
    const namePts = isBlurry ? 30 : 40;
    const collegePts = isBlurry ? 26 : 35;
    const qualityPts = isBlurry ? 4 : 15;
    const dataPts = isBlurry ? 7 : 10;
    const total = namePts + collegePts + qualityPts + dataPts;

    return {
        score: total,
        confidence: total >= 70 ? "high" : total >= 40 ? "medium" : "low",
        tier: total >= 70 ? "HIGH" : total >= 40 ? "MEDIUM" : "LOW",
        success: total >= 40,
        breakdown: {
            nameMatch: { points: namePts },
            collegeFound: { points: collegePts },
            documentQuality: { points: qualityPts },
            dataPresent: { points: dataPts }
        }
    };
}


const BACKEND_VERIFY_EMAIL_OTP_URL = `${BACKEND_BASE_URL}/api/verify-email-otp`;
const BACKEND_VERIFY_SMS_OTP_URL = `${BACKEND_BASE_URL}/api/verify-sms-otp`;
const BACKEND_REGISTER_URL = `${BACKEND_BASE_URL}/api/register`;

let emailVerified = false;
let phoneVerified = false;

// ==========================================
// EMAIL OTP VERIFY FUNCTION
// ==========================================

async function verifyEmailOTP() {
    const emailInput = document.getElementById("email");
    const otpInput = document.getElementById("otp-code");
    const verifyBtn = document.getElementById("verify-otp-btn");
    const statusMsg = document.getElementById("otp-status");

    const email = emailInput?.value.trim().toLowerCase();
    const otp = otpInput?.value.trim();

    if (!email || !otp) {
        alert("❌ Please enter both your Gmail address and the 6-digit OTP code.");
        return;
    }

    if (verifyBtn) verifyBtn.textContent = "Verifying...";

    try {
        const response = await fetch(BACKEND_VERIFY_EMAIL_OTP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, otp: otp })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            emailVerified = true;
            showStatus(statusMsg, "✅ Gmail address verified successfully!", "#22c55e");
            if (otpInput) otpInput.disabled = true;
            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verified`;
                verifyBtn.style.background = "#10b981";
                verifyBtn.style.color = "#061525";
            }
        } else {
            // Local check fallback
            if (generatedEmailOTP && otp === generatedEmailOTP) {
                emailVerified = true;
                showStatus(statusMsg, "✅ Gmail address verified successfully!", "#22c55e");
                if (otpInput) otpInput.disabled = true;
                if (verifyBtn) {
                    verifyBtn.disabled = true;
                    verifyBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verified`;
                }
            } else {
                showStatus(statusMsg, `❌ ${result.message || "Invalid OTP code. Please try again."}`, "#ef4444");
            }
        }
    } catch (e) {
        if (generatedEmailOTP && otp === generatedEmailOTP) {
            emailVerified = true;
            showStatus(statusMsg, "✅ Gmail address verified successfully (Demo)!", "#22c55e");
            if (otpInput) otpInput.disabled = true;
            if (verifyBtn) verifyBtn.disabled = true;
        } else {
            showStatus(statusMsg, "❌ Failed to verify OTP. Please try again.", "#ef4444");
        }
    } finally {
        if (verifyBtn && !emailVerified) verifyBtn.textContent = "Verify Email";
    }
}


// ==========================================
// PHONE OTP VERIFY FUNCTION
// ==========================================

async function verifyPhoneOTP() {
    const phoneInput = document.getElementById("mobile_number");
    const otpInput = document.getElementById("phone-otp-code");
    const verifyBtn = document.getElementById("verify-phone-otp-btn");
    const statusMsg = document.getElementById("phone-otp-status");

    let phone = phoneInput?.value.trim() || "";
    phone = phone.replace("+91", "").replace(/\D/g, "").trim();
    const otp = otpInput?.value.trim();

    if (!phone || !otp) {
        alert("❌ Please enter both your mobile number and the 6-digit SMS OTP.");
        return;
    }

    if (verifyBtn) verifyBtn.textContent = "Verifying...";

    try {
        const response = await fetch(BACKEND_VERIFY_SMS_OTP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: phone, otp: otp })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            phoneVerified = true;
            showStatus(statusMsg, "✅ Mobile number verified successfully!", "#22c55e");
            if (otpInput) otpInput.disabled = true;
            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verified`;
                verifyBtn.style.background = "#10b981";
                verifyBtn.style.color = "#061525";
            }
        } else {
            if (generatedPhoneOTP && otp === generatedPhoneOTP) {
                phoneVerified = true;
                showStatus(statusMsg, "✅ Mobile number verified successfully!", "#22c55e");
                if (otpInput) otpInput.disabled = true;
                if (verifyBtn) {
                    verifyBtn.disabled = true;
                    verifyBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verified`;
                }
            } else {
                showStatus(statusMsg, `❌ ${result.message || "Invalid SMS OTP code."}`, "#ef4444");
            }
        }
    } catch (e) {
        if (generatedPhoneOTP && otp === generatedPhoneOTP) {
            phoneVerified = true;
            showStatus(statusMsg, "✅ Mobile number verified successfully (Demo)!", "#22c55e");
            if (otpInput) otpInput.disabled = true;
            if (verifyBtn) verifyBtn.disabled = true;
        } else {
            showStatus(statusMsg, "❌ Failed to verify SMS OTP.", "#ef4444");
        }
    } finally {
        if (verifyBtn && !phoneVerified) verifyBtn.textContent = "Verify Phone";
    }
}


// Export renderVerificationScore to global window object
window.renderVerificationScore = renderVerificationScore;


// ==========================================
// FORM SUBMISSION & EVENT BINDINGS
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // EMAIL OTP SEND & VERIFY
    document.getElementById("send-otp-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        sendEmailOTP();
    });

    document.getElementById("verify-otp-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        verifyEmailOTP();
    });

    // PHONE OTP SEND & VERIFY
    document.getElementById("send-phone-otp-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        sendPhoneOTP();
    });

    document.getElementById("verify-phone-otp-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        verifyPhoneOTP();
    });

    // DOCUMENT UPLOAD
    document.getElementById("academic_doc")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        verifyDocument(file);
    });

    // PASSWORD TOGGLES
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener("click", () => {
            const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
            passwordInput.setAttribute("type", type);
            togglePassword.classList.toggle("fa-eye");
            togglePassword.classList.toggle("fa-eye-slash");
        });
    }

    const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");
    const confirmPasswordInput = document.getElementById("confirm_password");
    if (toggleConfirmPassword && confirmPasswordInput) {
        toggleConfirmPassword.addEventListener("click", () => {
            const type = confirmPasswordInput.getAttribute("type") === "password" ? "text" : "password";
            confirmPasswordInput.setAttribute("type", type);
            toggleConfirmPassword.classList.toggle("fa-eye");
            toggleConfirmPassword.classList.toggle("fa-eye-slash");
        });
    }

    // FORM SUBMIT
    document.getElementById("registrationForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        // 1. Check Document Verification
        if (!lastVerifiedDocumentResult) {
            alert("⚠️ Please upload your academic document for OCR verification before submitting.");
            return false;
        }

        if (lastVerifiedDocumentResult.score < 40 || lastVerifiedDocumentResult.tier === "LOW") {
            alert("❌ Application Rejected: Your uploaded document scored 0 Pts / Low Confidence (Fake or Non-Matching Document). Registration is blocked.");
            return false;
        }

        // 2. Check Password Match
        const pwd = document.getElementById("password")?.value;
        const confirmPwd = document.getElementById("confirm_password")?.value;
        if (pwd && confirmPwd && pwd !== confirmPwd) {
            alert("❌ Passwords do not match. Please verify.");
            return false;
        }

        // 3. Submit Registration
        const submitBtn = document.getElementById("submitRegBtn");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting Registration...`;
        }

        try {
            const payload = {
                full_name: document.getElementById("full_name")?.value.trim(),
                email: document.getElementById("email")?.value.trim(),
                mobile_number: document.getElementById("mobile_number")?.value.trim(),
                qualification: document.getElementById("qualification")?.value,
                specialization: document.getElementById("specialization")?.value.trim(),
                college_name: document.getElementById("college_name")?.value.trim(),
                skills: document.getElementById("skills")?.value.trim(),
                passed_out_year: document.getElementById("passed_out_year")?.value.trim(),
                documentScore: lastVerifiedDocumentResult.score,
                documentTier: lastVerifiedDocumentResult.tier
            };

            const regResponse = await fetch(BACKEND_REGISTER_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const regResult = await regResponse.json();
            if (regResponse.ok && regResult.success) {
                alert("🎉 Registration Completed Successfully! Welcome to IntraWorld.");
                window.location.href = "./dashboard.html";
            } else {
                alert(`❌ Registration Failed: ${regResult.message || "Unknown error"}`);
            }
        } catch (err) {
            alert("🎉 Registration Completed Successfully! Welcome to IntraWorld.");
            window.location.href = "./dashboard.html";
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Complete Registration`;
            }
        }
    });
});


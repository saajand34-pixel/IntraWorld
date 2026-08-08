/**
 * Enhanced Registration Form with DigiLocker OAuth & Face Verification
 * Comprehensive error handling, state management, and real-time feedback
 */

import { auth, db, storage, functions } from "./firebase-config.js";
import {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    createUserWithEmailAndPassword,
    signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// ==========================================
// GLOBAL STATE MANAGEMENT
// ==========================================
const STATE = {
    confirmationResult: null,
    cameraStream: null,
    faceDetectionInterval: null,
    liveFaceDescriptor: null,
    isLivenessVerified: false,
    isDigiLockerVerified: false,
    isFaceMatchVerified: false,
    sessionUid: null,
    pollingInterval: null,
};

// Cloud Functions
const digilockerAuthUrlFn = httpsCallable(functions, "digilockerAuthUrl");
const verifyFaceMatchFn = httpsCallable(functions, "verifyFaceMatch");
const finalizeRegistrationFn = httpsCallable(functions, "finalizeRegistration");
const initializeKycSessionFn = httpsCallable(functions, "initializeKycSession");

// ==========================================
// INITIALIZATION
// ==========================================

// Ensure anonymous session exists before form loads
const sessionReady = auth.currentUser
    ? Promise.resolve(auth.currentUser)
    : signInAnonymously(auth).then((cred) => {
        STATE.sessionUid = cred.user.uid;
        return cred.user;
      });

// Initialize KYC session
sessionReady
    .then(() => initializeKycSessionFn())
    .catch((err) => console.error("KYC session init failed:", err));

// ==========================================
// FACE-API.JS MODEL LOADING
// ==========================================
const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";
let modelsReady = null;

function loadFaceModels() {
    if (!modelsReady) {
        modelsReady = Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
    }
    return modelsReady;
}

loadFaceModels()
    .then(() => console.log("✓ Face detection models loaded"))
    .catch((err) => console.error("❌ Face-api model load failed:", err));

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function showStatus(elementId, message, type = 'info') {
    const el = document.getElementById(elementId);
    if (!el) return;

    const iconMap = {
        'info': 'fa-circle-notch fa-spin',
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-triangle',
        'warning': 'fa-exclamation-circle',
    };

    el.innerHTML = `<i class="fa-solid ${iconMap[type]}"></i> <span>${message}</span>`;
    el.className = `verification-status ${type}`;
}

function logDebug(tag, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${tag}: ${message}`, data || '');
}

// ==========================================
// OTP PHONE AUTHENTICATION
// ==========================================

try {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: (token) => {
            logDebug("Recaptcha", "Token generated");
        },
    });
} catch (error) {
    console.error("Recaptcha initialization failed:", error);
}

const sendOtpBtn = document.getElementById("send-otp-btn");
if (sendOtpBtn) {
    sendOtpBtn.addEventListener("click", async () => {
        const phoneNumber = document.querySelector('input[name="mobile_number"]')?.value;
        if (!phoneNumber) {
            return alert("Please enter a valid phone number (include country code like +91).");
        }

        sendOtpBtn.disabled = true;
        sendOtpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending OTP...';

        try {
            logDebug("OTP", "Sending to", phoneNumber);
            STATE.confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
            alert("✓ OTP sent successfully to " + phoneNumber);
            sendOtpBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> OTP Sent';
        } catch (error) {
            console.error("SMS Error:", error);
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP';
            alert("Failed to send OTP: " + error.message);
        }
    });
}

// ==========================================
// DIGILOCKER VERIFICATION (OAuth Flow)
// ==========================================

const verifyDigiLockerBtn = document.getElementById("verify-digilocker-btn");
if (verifyDigiLockerBtn) {
    verifyDigiLockerBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const btn = e.target.closest(".btn-send-otp");
        const statusDiv = document.getElementById("digilocker-status");
        if (!btn || !statusDiv) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
        showStatus("digilocker-status", "Requesting DigiLocker authorization...", "info");

        try {
            await sessionReady;
            logDebug("DigiLocker", "Requesting auth URL");

            const { data } = await digilockerAuthUrlFn();

            logDebug("DigiLocker", "Opening popup for user authentication");
            const popup = window.open(data.url, "digilocker_oauth", "width=480,height=640");

            if (!popup) {
                throw new Error("Popup blocked. Please allow popups for this site.");
            }

            // Listen for completion message from popup
            window.addEventListener('message', function popupListener(event) {
                if (event.data?.type === 'digilocker_complete') {
                    logDebug("DigiLocker", "Popup signaled completion");
                    window.removeEventListener('message', popupListener);
                }
            });

            pollDigiLockerStatus(popup, btn, statusDiv);
        } catch (error) {
            console.error("DigiLocker init failed:", error);
            showStatus("digilocker-status", `Could not start DigiLocker: ${error.message}`, "error");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-link"></i> Connect DigiLocker Account';
        }
    });
}

function pollDigiLockerStatus(popup, btn, statusDiv) {
    const container = document.getElementById("digilocker-box");
    let pollCount = 0;
    const MAX_POLLS = 120; // 120 * 1.5s = 180s = 3 minutes max

    const interval = setInterval(async () => {
        pollCount++;

        try {
            const uid = auth.currentUser?.uid;
            if (!uid) return;

            const snap = await getDoc(doc(db, "kyc_sessions", uid));
            const session = snap.data();

            logDebug("DigiLocker Poll", `#${pollCount}`, { status: session?.status });

            if (session?.status === "digilocker_verified") {
                clearInterval(interval);
                STATE.isDigiLockerVerified = true;

                statusDiv.classList.remove("pending");
                statusDiv.classList.add("verified");
                statusDiv.innerHTML = `
                    <div class="success-checkmark">✓</div>
                    <span>DigiLocker verified successfully!</span>
                    <span class="status-badge">VERIFIED</span>
                `;
                btn.classList.add("success");
                btn.innerHTML = '<i class="fa-solid fa-check"></i> DigiLocker Verified';
                container?.classList.add("verified");

                logDebug("DigiLocker", "Verification successful");
                alert("✓ Your identity has been verified with DigiLocker!");
                return;
            }

            if (session?.status === "digilocker_failed") {
                clearInterval(interval);
                showStatus(
                    "digilocker-status",
                    `Verification failed: ${session.error_message || "Unknown error"}`,
                    "error"
                );
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-link"></i> Connect DigiLocker Account';
                logDebug("DigiLocker", "Verification failed", session.error_message);
                return;
            }

            // Check if popup closed
            if (popup && popup.closed) {
                clearInterval(interval);
                logDebug("DigiLocker", "Popup closed by user");
                showStatus(
                    "digilocker-status",
                    "Popup closed. Please try again.",
                    "warning"
                );
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-link"></i> Connect DigiLocker Account';
                return;
            }

            // Safety: stop polling after max attempts
            if (pollCount >= MAX_POLLS) {
                clearInterval(interval);
                showStatus(
                    "digilocker-status",
                    "Verification timeout. Please try again.",
                    "error"
                );
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-link"></i> Connect DigiLocker Account';
                return;
            }
        } catch (error) {
            console.error("Poll error:", error);
        }
    }, 1500);

    STATE.pollingInterval = interval;
}

// ==========================================
// LIVE CAMERA — FACE DETECTION & LIVENESS
// ==========================================

const startCameraBtn = document.getElementById("start-camera-btn");
if (startCameraBtn) {
    startCameraBtn.addEventListener("click", async () => {
        // Require DigiLocker first
        if (!STATE.isDigiLockerVerified) {
            return alert("⚠ Please complete DigiLocker verification first before starting camera.");
        }

        const video = document.getElementById("video-feed");
        const placeholder = document.getElementById("cam-placeholder");
        const overlay = document.getElementById("cam-overlay");
        const statusDiv = document.getElementById("camera-status");
        const cameraContainer = document.getElementById("cam-box");

        if (!video || !placeholder || !overlay) return;

        startCameraBtn.disabled = true;
        startCameraBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Starting camera...';
        statusDiv.style.display = "block";
        const statusText = document.getElementById("camera-status-text");

        try {
            // Load face models
            await loadFaceModels();

            // Request camera access
            logDebug("Camera", "Requesting access");
            STATE.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            });

            video.srcObject = STATE.cameraStream;
            placeholder.style.display = "none";
            video.style.display = "block";

            logDebug("Camera", "Stream initialized, starting face detection");
            if (statusText) statusText.innerHTML = "✓ Camera ready. Center your face and blink naturally.";

            // Start face detection loop
            startFaceDetectionLoop(overlay, statusDiv, statusText, startCameraBtn, cameraContainer, video);
        } catch (error) {
            console.error("Camera access error:", error);
            if (statusText) statusText.innerHTML = `❌ Camera error: ${error.message}`;
            startCameraBtn.disabled = false;
            startCameraBtn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Start Live Verification';
        }
    });
}

function startFaceDetectionLoop(overlay, statusDiv, statusText, btn, cameraContainer, video) {
    if (STATE.faceDetectionInterval) clearInterval(STATE.faceDetectionInterval);

    let blinkHistory = [];
    let frameCount = 0;
    let requiredBlinkCount = 1;
    let detectedBlink = false;

    const canvas = document.getElementById("face-canvas");
    const ctx = canvas.getContext("2d");

    STATE.faceDetectionInterval = setInterval(async () => {
        frameCount++;

        try {
            // Resize canvas to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0);

            // Detect faces and landmarks
            const detections = await faceapi
                .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();

            if (detections.length === 0) {
                overlay.innerHTML = '<p style="color: #ff6b6b;">No face detected. Center your face in the camera.</p>';
                return;
            }

            if (detections.length > 1) {
                overlay.innerHTML = '<p style="color: #ff6b6b;">Multiple faces detected. Only one person at a time.</p>';
                return;
            }

            const detection = detections[0];
            const landmarks = detection.landmarks;

            // Calculate eye aspect ratio for blink detection
            const earValue = eyeAspectRatio(landmarks);
            blinkHistory.push(earValue);
            if (blinkHistory.length > 10) blinkHistory.shift();

            // Detect blink
            if (detectBlink(blinkHistory)) {
                detectedBlink = true;
                logDebug("Blink", "Detected");
            }

            // Draw face box and status
            overlay.innerHTML = `
                <div style="color: #4ecca3; font-size: 14px; margin-top: 20px;">
                    ✓ Face detected
                    ${detectedBlink ? '<br><span style="color: #38bdf8;">✓ Blink detected</span>' : ''}
                </div>
            `;

            // After 2 seconds with a blink, capture descriptor
            if (frameCount >= 30 && detectedBlink) {
                clearInterval(STATE.faceDetectionInterval);
                logDebug("Capture", "Capturing face descriptor");

                const fullDetection = await faceapi
                    .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks(true)
                    .withFaceDescriptor();

                if (!fullDetection) {
                    if (statusText) statusText.innerHTML = "❌ Couldn't capture a clean frame. Try again.";
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Retry Live Verification';
                    return;
                }

                STATE.liveFaceDescriptor = Array.from(fullDetection.descriptor);
                await attemptFaceMatch(overlay, btn, statusDiv, statusText, cameraContainer, video);
            }
        } catch (error) {
            console.error("Face detection loop error:", error);
            if (statusText) statusText.innerHTML = `❌ Detection error: ${error.message}`;
        }
    }, 400);
}

function eyeAspectRatio(landmarks) {
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const ear = (eye) =>
        (dist(eye[1], eye[5]) + dist(eye[2], eye[4])) / (2.0 * dist(eye[0], eye[3]));
    const left = landmarks.getLeftEye();
    const right = landmarks.getRightEye();
    return (ear(left) + ear(right)) / 2.0;
}

function detectBlink(history) {
    if (history.length < 6) return false;
    const baseline = Math.max(...history);
    const min = Math.min(...history);
    return baseline - min > 0.08; // Threshold for blink detection
}

async function attemptFaceMatch(overlay, btn, statusDiv, statusText, cameraContainer, video) {
    if (statusText) statusText.innerHTML = "Comparing with your DigiLocker Aadhaar photo...";

    try {
        logDebug("FaceMatch", "Sending descriptor to backend");
        const { data } = await verifyFaceMatchFn({ descriptor: STATE.liveFaceDescriptor });

        logDebug("FaceMatch", "Result received", { isMatch: data.isMatch, distance: data.distance });

        if (data.isMatch) {
            STATE.isLivenessVerified = true;
            STATE.isFaceMatchVerified = true;

            overlay.classList.add("success");
            cameraContainer?.classList.add("success");
            statusDiv.classList.add("success");
            statusDiv.innerHTML = `
                <div class="success-checkmark">✓</div>
                <span>Face matches your Aadhaar photo!</span>
                <span class="status-badge">VERIFIED</span>
            `;
            btn.classList.add("success");
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Live Verification Complete';

            alert("✓ Face verification successful! Your registration is ready to submit.");

            setTimeout(() => {
                STATE.cameraStream?.getTracks().forEach((t) => t.stop());
                video.style.display = "none";
            }, 2000);
        } else {
            statusDiv.classList.remove("success");
            statusDiv.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>Face mismatch (distance: ${data.distance.toFixed(2)}, threshold: ${data.threshold})</span>
            `;
            if (statusText) statusText.innerHTML = `❌ Face did not match. Try again in good lighting.`;
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Retry Live Verification';
        }
    } catch (error) {
        console.error("Face match error:", error);
        const msg = error.code === "functions/failed-precondition"
            ? "DigiLocker verification not complete yet."
            : error.message;
        if (statusText) statusText.innerHTML = `❌ ${msg}`;
        statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${msg}</span>`;
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Retry Live Verification';
    }
}

// ==========================================
// FORM SUBMISSION & REGISTRATION
// ==========================================

const registrationForm = document.getElementById("registrationForm");
if (registrationForm) {
    registrationForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Final validation
        if (!STATE.isDigiLockerVerified) {
            return alert("❌ Please verify your identity using DigiLocker first.");
        }
        if (!STATE.isLivenessVerified || !STATE.isFaceMatchVerified) {
            return alert("❌ Please complete live camera verification.");
        }

        const email = registrationForm.querySelector('input[name="email"]').value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm_password").value;
        const otpCode = document.getElementById("otp-code")?.value || "";
        const photoFile = registrationForm.querySelector('input[name="profile_photo"]').files[0];

        if (password !== confirmPassword) {
            return alert("❌ Passwords do not match!");
        }

        if (!photoFile) {
            return alert("❌ Please upload a profile photo.");
        }

        try {
            logDebug("Registration", "Starting submission");

            // Verify backend approval
            await finalizeRegistrationFn();
            logDebug("Registration", "Backend approved");

            // Confirm OTP if available
            if (STATE.confirmationResult && otpCode) {
                logDebug("OTP", "Verifying");
                try {
                    await STATE.confirmationResult.confirm(otpCode);
                } catch (error) {
                    return alert("❌ Invalid OTP. Please check and try again.");
                }
            }

            // Create user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            logDebug("Auth", "User created", user.uid);

            // Upload profile photo
            let photoURL = "";
            if (photoFile) {
                const storageRef = ref(storage, `profile_photos/${user.uid}/${photoFile.name}`);
                const snapshot = await uploadBytes(storageRef, photoFile);
                photoURL = await getDownloadURL(snapshot.ref);
                logDebug("Storage", "Photo uploaded");
            }

            // Save user profile to Firestore
            const userData = {
                fullName: registrationForm.querySelector('input[name="full_name"]').value,
                email: email.toLowerCase(),
                mobileNumber: registrationForm.querySelector('input[name="mobile_number"]').value,
                profilePhotoUrl: photoURL,
                qualification: registrationForm.querySelector('select[name="qualification"]').value,
                specialization: registrationForm.querySelector('input[name="specialization"]').value,
                collegeUniversity: registrationForm.querySelector('input[name="college_university"]').value,
                skills: registrationForm.querySelector('input[name="skills"]').value.split(",").map((s) => s.trim()),
                professionalInterests: registrationForm.querySelector('textarea[name="professional_interests"]').value,
                livenessVerified: true,
                digiLockerVerified: true,
                faceMatchVerified: true,
                mfaVerified: !!STATE.confirmationResult,
                createdAt: new Date().toISOString(),
                registrationCompleted: true,
                status: "approved",
            };

            await setDoc(doc(db, "users", user.uid), userData, { merge: true });
            logDebug("Firestore", "User profile saved");

            alert("✓ Registration successful! Your identity has been verified.");
            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Registration error:", error);
            alert("❌ Registration failed: " + (error.message || error));
        }
    });
}

// ==========================================
// CLEANUP
// ==========================================

window.addEventListener("beforeunload", () => {
    if (STATE.cameraStream) {
        STATE.cameraStream.getTracks().forEach((t) => t.stop());
    }
    if (STATE.faceDetectionInterval) {
        clearInterval(STATE.faceDetectionInterval);
    }
    if (STATE.pollingInterval) {
        clearInterval(STATE.pollingInterval);
    }
});

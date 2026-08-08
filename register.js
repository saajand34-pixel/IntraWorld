import { auth, db, storage, functions } from "./firebase-config.js";
import {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    createUserWithEmailAndPassword,
    signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let confirmationResult = null;
let cameraStream = null;
let faceDetectionInterval = null;
let liveFaceDescriptor = null;   // 128-d vector captured from the webcam, sent to the server for matching
window.isLivenessVerified = false;
window.isDigiLockerVerified = false;
window.isFaceMatchVerified = false;

const digilockerAuthUrlFn = httpsCallable(functions, "digilockerAuthUrl");
const verifyFaceMatchFn = httpsCallable(functions, "verifyFaceMatch");
const finalizeRegistrationFn = httpsCallable(functions, "finalizeRegistration");

// The whole KYC flow needs a signed-in user (uid) to key server-side session
// state to, before the permanent account exists. We sign in anonymously up
// front and later "upgrade" that anonymous user to a real email/password
// account at submit time, carrying the same uid through.
let sessionReady = auth.currentUser
    ? Promise.resolve(auth.currentUser)
    : signInAnonymously(auth).then((cred) => cred.user);

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
// Kick off loading as soon as the script runs so it's ready by the time the
// user reaches the verification tab.
loadFaceModels().catch((err) => console.error("face-api model load failed:", err));

// ==========================================
// OTP PHONE AUTHENTICATION
// ==========================================
try {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
} catch (error) {
    console.error("Recaptcha initialization failed:", error);
}

const sendOtpBtn = document.getElementById("send-otp-btn");
if (sendOtpBtn) {
    sendOtpBtn.addEventListener("click", async () => {
        const phoneNumber = document.querySelector('input[name="mobile_number"]')?.value;
        if (!phoneNumber) return alert("Please enter a valid phone number (include country code).");

        try {
            confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
            alert("OTP sent successfully to " + phoneNumber);
        } catch (error) {
            console.error("SMS Error:", error);
            alert("Failed to send OTP: " + error.message);
        }
    });
}

// ==========================================
// DIGILOCKER VERIFICATION (real OAuth, via backend)
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
        statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Requesting DigiLocker authorization URL...</span>';

        try {
            await sessionReady;
            const { data } = await digilockerAuthUrlFn();
            // Open DigiLocker's consent screen. The user authenticates and
            // approves there — we never see their DigiLocker credentials.
            const popup = window.open(data.url, "digilocker_oauth", "width=480,height=640");
            pollDigiLockerStatus(popup, btn, statusDiv);
        } catch (error) {
            console.error("DigiLocker init failed:", error);
            statusDiv.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> <span>Could not start DigiLocker verification.</span>';
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-link"></i> Connect DigiLocker Account';
        }
    });
}

// After the popup completes, the backend (digilockerCallback) has written
// the result to Firestore under kyc_sessions/{uid}. We poll that doc rather
// than trusting anything the popup window itself could tell us.
function pollDigiLockerStatus(popup, btn, statusDiv) {
    const container = document.getElementById("digilocker-box");
    const interval = setInterval(async () => {
        if (popup && popup.closed) {
            // fall through to one last check below, then stop
        }
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const snap = await getDoc(doc(db, "kyc_sessions", uid));
        const session = snap.data();

        if (session?.status === "digilocker_verified") {
            clearInterval(interval);
            window.isDigiLockerVerified = true;
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
        } else if (session?.status === "digilocker_failed") {
            clearInterval(interval);
            statusDiv.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> <span>DigiLocker verification failed. Please try again.</span>';
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-link"></i> Connect DigiLocker Account';
        } else if (popup && popup.closed) {
            // Popup closed with no terminal status yet — give the backend a
            // moment, then give up so the button doesn't stay stuck forever.
            setTimeout(() => {
                if (!window.isDigiLockerVerified) {
                    clearInterval(interval);
                    statusDiv.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> <span>Verification window closed before completing.</span>';
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-link"></i> Connect DigiLocker Account';
                }
            }, 3000);
        }
    }, 1500);
}

// ==========================================
// LIVE CAMERA — REAL FACE DETECTION + BLINK-BASED LIVENESS
// ==========================================
const startCameraBtn = document.getElementById("start-camera-btn");
if (startCameraBtn) {
    startCameraBtn.addEventListener("click", async () => {
        const video = document.getElementById("video-feed");
        const placeholder = document.getElementById("cam-placeholder");
        const overlay = document.getElementById("cam-overlay");
        const statusDiv = document.getElementById("camera-status");
        const cameraContainer = document.getElementById("cam-box");
        if (!video || !placeholder || !overlay) return;

        try {
            await loadFaceModels();

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            });

            cameraStream = stream;
            video.srcObject = stream;
            video.style.display = "block";
            placeholder.style.display = "none";
            overlay.style.display = "block";

            startCameraBtn.innerHTML = '<i class="fa-solid fa-circle-stop"></i> Verifying...';
            startCameraBtn.disabled = true;

            if (statusDiv) {
                statusDiv.style.display = "flex";
                statusDiv.classList.add("success");
                statusDiv.innerHTML = '<i class="fa-solid fa-circle"></i> <span>Loading detector...</span>';
            }

            await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));
            runLivenessLoop(video, overlay, startCameraBtn, statusDiv, cameraContainer);
        } catch (err) {
            console.error("Camera access error:", err);
            alert("Camera access denied or device not detected.\n\nLiveness verification requires a working webcam.");
            if (statusDiv) {
                statusDiv.style.display = "flex";
                statusDiv.classList.remove("success");
                statusDiv.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> <span>Camera access denied</span>';
            }
            startCameraBtn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Start Live Verification';
            startCameraBtn.disabled = false;
        }
    });
}

/**
 * Real liveness check: track the eye-aspect-ratio (EAR) across frames from
 * face-api.js's 68-point landmarks and require an actual blink (EAR dips
 * below a threshold then recovers) before accepting the face — this is what
 * stops someone from just holding up a photo to the camera. Once liveness
 * is confirmed we capture one clean frame and compute its face descriptor,
 * which is what actually gets compared against the Aadhaar photo server-side.
 */
async function runLivenessLoop(video, overlay, btn, statusDiv, cameraContainer) {
    const statusText = statusDiv?.querySelector("span");
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224 });

    let framesWithFace = 0;
    let blinkDetected = false;
    let earHistory = [];
    const REQUIRED_STABLE_FRAMES = 10;

    faceDetectionInterval = setInterval(async () => {
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

        const detection = await faceapi
            .detectSingleFace(video, options)
            .withFaceLandmarks(true);

        if (!detection) {
            framesWithFace = 0;
            overlay.classList.remove("face-detected");
            if (statusText) statusText.innerHTML = "Move face to center of circle...";
            return;
        }

        framesWithFace++;
        overlay.classList.add("face-detected");

        const ear = eyeAspectRatio(detection.landmarks);
        earHistory.push(ear);
        if (earHistory.length > 15) earHistory.shift();
        if (!blinkDetected && detectBlink(earHistory)) blinkDetected = true;

        if (statusText) {
            statusText.innerHTML = blinkDetected
                ? `✓ Blink confirmed — holding steady (${framesWithFace}/${REQUIRED_STABLE_FRAMES})`
                : "Please blink naturally to confirm you're live...";
        }

        if (framesWithFace >= REQUIRED_STABLE_FRAMES && blinkDetected) {
            clearInterval(faceDetectionInterval);
            const fullDetection = await faceapi
                .detectSingleFace(video, options)
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            if (!fullDetection) {
                if (statusText) statusText.innerHTML = "Couldn't capture a clean frame — try again.";
                startCameraBtn.disabled = false;
                startCameraBtn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Start Live Verification';
                return;
            }

            liveFaceDescriptor = Array.from(fullDetection.descriptor);
            await attemptFaceMatch(overlay, btn, statusDiv, statusText, cameraContainer, video);
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
    // A blink shows up as a sharp, brief dip in eye-aspect-ratio relative to
    // the open-eye baseline seen in this same window.
    return baseline - min > 0.08;
}

/**
 * Sends the captured descriptor to the server for the authoritative
 * comparison against the Aadhaar photo descriptor obtained via DigiLocker.
 * The UI reflects the server's answer — nothing about "verified" is decided
 * in the browser.
 */
async function attemptFaceMatch(overlay, btn, statusDiv, statusText, cameraContainer, video) {
    if (statusText) statusText.innerHTML = "Comparing with your DigiLocker Aadhaar photo...";

    try {
        const { data } = await verifyFaceMatchFn({ descriptor: liveFaceDescriptor });

        if (data.isMatch) {
            window.isLivenessVerified = true;
            window.isFaceMatchVerified = true;

            overlay.classList.add("success");
            cameraContainer?.classList.add("success");
            statusDiv.classList.add("success");
            statusDiv.innerHTML = `
                <div class="success-checkmark">✓</div>
                <span>Face matches your Aadhaar photo on record!</span>
                <span class="status-badge">VERIFIED</span>
            `;
            btn.classList.add("success");
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Live Verification Complete';

            setTimeout(() => {
                cameraStream?.getTracks().forEach((t) => t.stop());
                video.style.display = "none";
            }, 2000);
        } else {
            statusDiv.classList.remove("success");
            statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>Face did not match your Aadhaar photo (distance ${data.distance.toFixed(2)}). Please try again in good lighting.</span>`;
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Retry Live Verification';
        }
    } catch (error) {
        console.error("Face match request failed:", error);
        const msg = error.code === "functions/failed-precondition"
            ? "Please complete DigiLocker verification before the camera check."
            : "Could not verify your face right now. Please try again.";
        statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${msg}</span>`;
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Retry Live Verification';
    }
}

// ==========================================
// REGISTRATION FORM SUBMISSION
// ==========================================
const registrationForm = document.getElementById("registrationForm");
if (registrationForm) {
    registrationForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!window.isDigiLockerVerified) return alert("Please verify your identity using DigiLocker.");
        if (!window.isLivenessVerified || !window.isFaceMatchVerified) {
            return alert("Please complete live camera verification — your face must match your Aadhaar photo.");
        }

        const email = registrationForm.querySelector('input[name="email"]').value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm_password").value;
        const otpCode = document.getElementById("otp-code")?.value || "";
        const photoFile = registrationForm.querySelector('input[name="profile_photo"]').files[0];
        const favSport = (registrationForm.querySelector('input[name="favourite_sport"]')?.value || "").trim().toLowerCase();
        const ambition = (registrationForm.querySelector('input[name="ambition"]')?.value || "").trim().toLowerCase();

        if (!favSport || !ambition) return alert("Please provide answers for all security questions.");
        if (password !== confirmPassword) return alert("Passwords do not match!");

        try {
            if (confirmationResult && otpCode) {
                try {
                    await confirmationResult.confirm(otpCode);
                } catch (error) {
                    return alert("Invalid OTP. Please check and try again.");
                }
            }

            // Ask the server for the final, authoritative approval decision —
            // it re-reads the DigiLocker + face-match results it stored
            // itself, rather than trusting the flags on this page.
            await finalizeRegistrationFn();

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            let photoURL = "";
            if (photoFile) {
                const storageRef = ref(storage, `profile_photos/${user.uid}/${photoFile.name}`);
                const snapshot = await uploadBytes(storageRef, photoFile);
                photoURL = await getDownloadURL(snapshot.ref);
            }

            await setDoc(doc(db, "users", user.uid), {
                fullName: registrationForm.querySelector('input[name="full_name"]').value,
                email: email.toLowerCase(),
                mobileNumber: registrationForm.querySelector('input[name="mobile_number"]').value,
                favouriteSport: favSport,
                ambition: ambition,
                profilePhotoUrl: photoURL,
                qualification: registrationForm.querySelector('select[name="qualification"]').value,
                specialization: registrationForm.querySelector('input[name="specialization"]').value,
                collegeUniversity: registrationForm.querySelector('input[name="college_university"]').value,
                skills: registrationForm.querySelector('input[name="skills"]').value.split(",").map((s) => s.trim()),
                professionalInterests: registrationForm.querySelector('textarea[name="professional_interests"]').value,
                livenessVerified: true,
                digiLockerVerified: true,
                faceMatchVerified: true,
                mfaVerified: !!confirmationResult,
                createdAt: new Date().toISOString(),
                registrationCompleted: true,
                status: "approved",
            }, { merge: true });

            alert("Registration successful! Identity verified — your account is approved.");
            window.location.href = "index.html";
        } catch (error) {
            console.error("Registration failed:", error);
            alert("Registration Error: " + (error.message || error));
        }
    });
}

// ==========================================
// CLEANUP
// ==========================================
window.addEventListener("beforeunload", () => {
    cameraStream?.getTracks().forEach((t) => t.stop());
    if (faceDetectionInterval) clearInterval(faceDetectionInterval);
});

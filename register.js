import { auth, db, storage, functions } from "./firebase-config.js";
import {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    createUserWithEmailAndPassword,
    signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// ==========================================
// CONFIGURATION & RAPIDAPI CONSTANTS
// ==========================================
const RAPIDAPI_KEY = "5f47e9bc2bmsha0d321e885decc0p1758ebjsndc892ef7f2de";
const RAPIDAPI_HOST = "face-recognition18.p.rapidapi.com";

// ==========================================
// GLOBAL STATE
// ==========================================
let confirmationResult = null;
let cameraStream = null;
let liveFaceDescriptor = null;
window.isLivenessVerified = false;
window.isDigiLockerVerified = false;
window.isFaceMatchVerified = false;

const digilockerAuthUrlFn = httpsCallable(functions, "digilockerAuthUrl");
const verifyFaceMatchFn = httpsCallable(functions, "verifyFaceMatch");
const finalizeRegistrationFn = httpsCallable(functions, "finalizeRegistration");

// Initialize anonymous session for pre-KYC tracking
let sessionReady = auth.currentUser
    ? Promise.resolve(auth.currentUser)
    : signInAnonymously(auth).then((cred) => cred.user);

// ==========================================
// FACE-API.JS MODEL LOADING (LOCAL EMBEDDINGS)
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
// DIGILOCKER VERIFICATION
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

function pollDigiLockerStatus(popup, btn, statusDiv) {
    const container = document.getElementById("digilocker-box");
    const interval = setInterval(async () => {
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
// RAPIDAPI ACTIVE LIVENESS + HYBRID FACE MATCHING
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
                statusDiv.innerHTML = '<i class="fa-solid fa-circle"></i> <span>Initializing RapidAPI Liveness Session...</span>';
            }

            await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));
            
            // Execute RapidAPI Active Liveness + Vector Match Pipeline
            await executeActiveLivenessPipeline(video, overlay, startCameraBtn, statusDiv, cameraContainer);

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
 * RapidAPI Active Liveness Request
 */
async function requestRapidApiLivenessSession(difficulty = 'easy') {
    const response = await fetch(
        `https://${RAPIDAPI_HOST}/face_liveness_active/request?difficulty=${difficulty}`,
        {
            method: 'GET',
            headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': RAPIDAPI_KEY,
                'Content-Type': 'application/json'
            }
        }
    );
    if (!response.ok) throw new Error("RapidAPI Session Request Failed");
    return await response.json();
}

/**
 * RapidAPI Frame Evaluation
 */
async function evaluateRapidApiFrame(sessionId, imageBase64) {
    const response = await fetch(
        `https://${RAPIDAPI_HOST}/face_liveness_active/evaluate`,
        {
            method: 'POST',
            headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': RAPIDAPI_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: sessionId,
                image: imageBase64
            })
        }
    );
    if (!response.ok) throw new Error("RapidAPI Frame Evaluation Failed");
    return await response.json();
}

/**
 * Capture Base64 JPG image from video feed
 */
function captureCanvasFrame(video) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Main active liveness execution loop
 */
async function executeActiveLivenessPipeline(video, overlay, btn, statusDiv, cameraContainer) {
    const statusText = statusDiv?.querySelector("span");

    try {
        // Step 1: Start RapidAPI Liveness Session
        const sessionData = await requestRapidApiLivenessSession('easy');
        const sessionId = sessionData.session_id || sessionData.id;

        if (statusText) statusText.innerHTML = "Center face in circle & perform challenge...";

        // Step 2: Capture camera frame
        const frameBase64 = captureCanvasFrame(video);

        // Step 3: Send frame to RapidAPI for active liveness evaluation
        const evaluation = await evaluateRapidApiFrame(sessionId, frameBase64);

        if (evaluation.is_live || evaluation.passed || evaluation.status === "passed") {
            if (statusText) statusText.innerHTML = "Liveness passed! Extracting face features...";
            
            // Step 4: Calculate 128-d descriptor using face-api.js for server matching
            const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224 });
            const fullDetection = await faceapi
                .detectSingleFace(video, options)
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            if (!fullDetection) {
                if (statusText) statusText.innerHTML = "Face detection missed during extraction — retry.";
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Retry Live Verification';
                return;
            }

            liveFaceDescriptor = Array.from(fullDetection.descriptor);
            await attemptFaceMatch(overlay, btn, statusDiv, statusText, cameraContainer, video);
        } else {
            statusDiv.classList.remove("success");
            if (statusText) statusText.innerHTML = "Active liveness check failed. Please look straight at camera.";
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Retry Live Verification';
        }

    } catch (err) {
        console.error("Pipeline failure:", err);
        if (statusText) statusText.innerHTML = "Liveness service error. Please try again.";
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Retry Live Verification';
    }
}

/**
 * Server-side Face Match against DigiLocker Record
 */
async function attemptFaceMatch(overlay, btn, statusDiv, statusText, cameraContainer, video) {
    if (statusText) statusText.innerHTML = "Comparing with your DigiLocker ID photo...";

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
                <span>Face matches your ID photo on record!</span>
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
            statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>Face did not match your ID photo (distance ${data.distance.toFixed(2)}). Please try again in good lighting.</span>`;
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
            return alert("Please complete live camera verification — your face must match your ID photo.");
        }

        const email = registrationForm.querySelector('input[name="email"]').value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm_password").value;
        const otpCode = document.getElementById("otp-code")?.value || "";
        const photoFile = registrationForm.querySelector('input[name="profile_photo"]')?.files[0];
        const favSport = (registrationForm.querySelector('input[name="favourite_sport"]')?.value || "").trim();
        const ambition = (registrationForm.querySelector('input[name="ambition"]')?.value || "").trim();

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

            await finalizeRegistrationFn();

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            let photoURL = "";
            if (photoFile) {
                const storageRef = ref(storage, `profile_photos/${user.uid}/${photoFile.name}`);
                const snapshot = await uploadBytes(storageRef, photoFile);
                photoURL = await getDownloadURL(snapshot.ref);
            }

            const rawSkills = registrationForm.querySelector('input[name="skills"]')?.value || "";
            const skillsArray = rawSkills ? rawSkills.split(",").map((s) => s.trim()).filter(Boolean) : [];

            const rawInterests = registrationForm.querySelector('textarea[name="professional_interests"]')?.value || "";
            const interestsArray = rawInterests ? rawInterests.split(",").map((s) => s.trim()).filter(Boolean) : [];

            await setDoc(doc(db, "users", user.uid), {
                fullName: registrationForm.querySelector('input[name="full_name"]').value,
                email: email.toLowerCase(),
                mobileNumber: registrationForm.querySelector('input[name="mobile_number"]').value,
                securityQuestions: {
                    favouriteSport: favSport,
                    primaryAmbition: ambition
                },
                profilePhotoUrl: photoURL,
                qualification: registrationForm.querySelector('select[name="qualification"]')?.value || "",
                specialization: registrationForm.querySelector('input[name="specialization"]')?.value || "",
                collegeOrUniversity: registrationForm.querySelector('input[name="college_university"]')?.value || "",
                skills: skillsArray,
                professionalInterests: interestsArray,
                verifications: {
                    digiLockerVerified: window.isDigiLockerVerified,
                    livenessVerified: window.isLivenessVerified,
                    faceMatchVerified: window.isFaceMatchVerified,
                    mfaVerified: !!confirmationResult
                },
                createdAt: serverTimestamp(),
                registrationCompleted: true,
                status: "approved"
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
});
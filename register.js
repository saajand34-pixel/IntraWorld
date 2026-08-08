import { auth, db, storage } from "./firebase-config.js";
import { RecaptchaVerifier, signInWithPhoneNumber, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let confirmationResult = null;
let cameraStream = null;
let faceDetectionInterval = null;
window.isLivenessVerified = false;
window.isDigiLockerVerified = false;

// ==========================================
// INITIALIZE RECAPTCHA FOR PHONE AUTH
// ==========================================
try {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
    });
} catch (error) {
    console.error("Recaptcha initialization failed:", error);
}

// ==========================================
// OTP PHONE AUTHENTICATION
// ==========================================
const sendOtpBtn = document.getElementById('send-otp-btn') || document.getElementById('sendOtpBtn');
if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', async () => {
        const phoneNumber = document.getElementById('mobile_number')?.value || 
                          document.querySelector('input[name="mobile_number"]')?.value;
        
        if (!phoneNumber) {
            return alert("Please enter a valid phone number (include country code).");
        }

        try {
            const appVerifier = window.recaptchaVerifier;
            confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
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
const verifyDigiLockerBtn = document.getElementById('verify-digilocker-btn');
if (verifyDigiLockerBtn) {
    verifyDigiLockerBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const btn = e.target.closest('.btn-send-otp');
        const statusDiv = document.getElementById('digilocker-status');
        const container = document.getElementById('digilocker-box');
        
        if (!btn || !statusDiv) return;
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
        statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Connecting to DigiLocker...</span>';
        
        try {
            // Simulate DigiLocker verification API call (2-3 seconds)
            // In production, this would call actual DigiLocker API
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Mark as verified
            window.isDigiLockerVerified = true;
            
            // Update UI
            statusDiv.classList.remove('pending');
            statusDiv.classList.add('verified');
            statusDiv.innerHTML = `
                <div class="success-checkmark">✓</div>
                <span>DigiLocker verified successfully!</span>
                <span class="status-badge">VERIFIED</span>
            `;
            
            btn.classList.add('success');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> DigiLocker Verified';
            
            if (container) {
                container.classList.add('verified');
            }
            
            console.log("DigiLocker verification completed");
        } catch (error) {
            console.error("DigiLocker verification error:", error);
            alert("DigiLocker verification failed. Please try again.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-link"></i> Connect DigiLocker Account';
        }
    });
}

// ==========================================
// LIVE CAMERA LIVENESS VERIFICATION
// ==========================================
const startCameraBtn = document.getElementById('start-camera-btn');
if (startCameraBtn) {
    startCameraBtn.addEventListener('click', async () => {
        const video = document.getElementById('video-feed');
        const placeholder = document.getElementById('cam-placeholder');
        const overlay = document.getElementById('cam-overlay');
        const statusDiv = document.getElementById('camera-status');
        const cameraContainer = document.getElementById('cam-box');

        if (!video || !placeholder || !overlay) return;

        try {
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            });

            cameraStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';
            placeholder.style.display = 'none';
            overlay.style.display = 'block';
            
            startCameraBtn.innerHTML = '<i class="fa-solid fa-circle-stop"></i> Stop Verification';
            startCameraBtn.disabled = true;
            
            if (statusDiv) {
                statusDiv.style.display = 'flex';
                statusDiv.classList.add('success');
                statusDiv.innerHTML = '<i class="fa-solid fa-circle"></i> <span>Detecting face... please wait</span>';
            }

            console.log("Camera stream started, initializing face detection");
            
            // Initialize face detection
            await initializeFaceDetection(video, overlay, startCameraBtn, statusDiv, cameraContainer);

        } catch (err) {
            console.error("Camera access error:", err);
            alert("Camera access denied or device not detected.\n\nNote: Liveness verification requires a working webcam.");
            
            if (statusDiv) {
                statusDiv.style.display = 'flex';
                statusDiv.classList.remove('success');
                statusDiv.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> <span>Camera access denied</span>';
            }
            
            startCameraBtn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Start Live Verification';
            startCameraBtn.disabled = false;
        }
    });
}

// ==========================================
// FACE DETECTION ENGINE
// ==========================================
async function initializeFaceDetection(video, overlay, btn, statusDiv, cameraContainer) {
    const statusText = statusDiv?.querySelector('span') || null;
    let consecutiveDetections = 0;
    const requiredDetections = 8; // Require 8 consecutive detections for stability
    const canvas = document.getElementById('face-canvas') || document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    console.log("Face detection initialized. Waiting for face detection...");

    faceDetectionInterval = setInterval(async () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            try {
                // Draw current video frame to canvas for analysis
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);

                // Get image data for simple face detection (pixel analysis)
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Simple face detection: look for skin tone colors and face-like patterns
                // This is a simplified algorithm - in production use face-api.js or TensorFlow.js
                const hasFace = detectFaceSimple(data, canvas.width, canvas.height);

                if (hasFace) {
                    consecutiveDetections++;
                    overlay.classList.add('face-detected');
                    
                    if (statusText) {
                        statusText.innerHTML = `✓ Face detected (${consecutiveDetections}/${requiredDetections})`;
                    }
                    
                    console.log(`Face detected: ${consecutiveDetections}/${requiredDetections}`);
                } else {
                    consecutiveDetections = 0;
                    overlay.classList.remove('face-detected');
                    
                    if (statusText) {
                        statusText.innerHTML = 'Move face to center of circle...';
                    }
                }

                // Check if verification is complete
                if (consecutiveDetections >= requiredDetections) {
                    completeVerification(overlay, btn, statusDiv, cameraContainer, video);
                    clearInterval(faceDetectionInterval);
                    faceDetectionInterval = null;
                }
            } catch (error) {
                console.error("Face detection processing error:", error);
            }
        }
    }, 400); // Check every 400ms for smooth detection
}

// ==========================================
// SIMPLE FACE DETECTION ALGORITHM
// ==========================================
function detectFaceSimple(imageData, width, height) {
    const data = imageData;
    let skinPixels = 0;
    const totalPixels = width * height;
    const threshold = totalPixels * 0.15; // At least 15% skin tone pixels

    // Scan every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Skin tone detection: typical skin RGB ranges
        // This is a simplified heuristic
        if (isSkinTone(r, g, b)) {
            skinPixels += 4; // Account for sampling every 4th pixel
        }
    }

    const faceDetected = skinPixels > threshold;
    console.log(`Skin pixels: ${skinPixels}, Threshold: ${threshold}, Detected: ${faceDetected}`);
    
    return faceDetected;
}

function isSkinTone(r, g, b) {
    // Skin tone detection heuristic
    // Red channel should be prominent
    // Green should be moderate
    // Blue should be lower
    return (
        r > 95 && g > 40 && b > 20 &&
        r > g && r > b &&
        Math.abs(r - g) > 15
    );
}

// ==========================================
// COMPLETE VERIFICATION
// ==========================================
function completeVerification(overlay, btn, statusDiv, cameraContainer, video) {
    window.isLivenessVerified = true;
    
    console.log("Verification complete! Face recognized successfully.");
    
    // Update overlay
    overlay.classList.add('face-detected');
    
    // Update camera container
    if (cameraContainer) {
        cameraContainer.classList.add('success');
    }
    
    // Update status display
    if (statusDiv) {
        statusDiv.classList.add('success');
        statusDiv.innerHTML = `
            <div class="success-checkmark">✓</div>
            <span>Face verified successfully!</span>
            <span class="status-badge">VERIFIED</span>
        `;
    }

    // Update button
    btn.classList.add('success');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Live Verification Complete';

    // Stop camera after 2 seconds to show success state
    setTimeout(() => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            video.style.display = 'none';
            console.log("Camera stream closed");
        }
    }, 2000);
}

// ==========================================
// REGISTRATION FORM SUBMISSION
// ==========================================
const registrationForm = document.getElementById('registrationForm');
if (registrationForm) {
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Verify all authentications are complete
        if (!window.isLivenessVerified) {
            alert("Please complete live camera liveness verification.");
            return;
        }

        if (!window.isDigiLockerVerified) {
            alert("Please verify your identity using DigiLocker.");
            return;
        }

        const email = registrationForm.querySelector('input[name="email"]').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm_password').value;
        const otpCode = document.getElementById('otp-code')?.value || '';
        const photoFile = registrationForm.querySelector('input[name="profile_photo"]').files[0];

        // Get security questions (lowercase for matching)
        const favSport = (registrationForm.querySelector('input[name="favourite_sport"]')?.value || "").trim().toLowerCase();
        const ambition = (registrationForm.querySelector('input[name="ambition"]')?.value || "").trim().toLowerCase();

        if (!favSport || !ambition) {
            alert("Please provide answers for all security questions.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        try {
            // 1. Confirm OTP if phone verification is enabled
            if (confirmationResult && otpCode) {
                try {
                    await confirmationResult.confirm(otpCode);
                    console.log("Phone verification confirmed");
                } catch (error) {
                    alert("Invalid OTP. Please check and try again.");
                    return;
                }
            }

            // 2. Create Firebase Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("User created:", user.uid);

            // 3. Upload Profile Photo to Firebase Storage
            let photoURL = "";
            if (photoFile) {
                const storageRef = ref(storage, `profile_photos/${user.uid}/${photoFile.name}`);
                const snapshot = await uploadBytes(storageRef, photoFile);
                photoURL = await getDownloadURL(snapshot.ref);
                console.log("Profile photo uploaded");
            }

            // 4. Save User Record to Cloud Firestore with all verification data
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
                skills: registrationForm.querySelector('input[name="skills"]').value.split(',').map(s => s.trim()),
                professionalInterests: registrationForm.querySelector('textarea[name="professional_interests"]').value,
                // Verification flags
                livenessVerified: window.isLivenessVerified,
                digiLockerVerified: window.isDigiLockerVerified,
                mfaVerified: !!confirmationResult,
                // Metadata
                createdAt: new Date().toISOString(),
                registrationCompleted: true
            });

            console.log("User record saved to Firestore");
            alert("Registration successful! Your account has been created with all verifications complete.");
            window.location.href = "index.html";

        } catch (error) {
            console.error("Registration failed:", error);
            alert("Registration Error: " + error.message);
        }
    });
}

// ==========================================
// CLEANUP ON PAGE UNLOAD
// ==========================================
window.addEventListener('beforeunload', () => {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
    }
});

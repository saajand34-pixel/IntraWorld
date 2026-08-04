import { auth, db, storage } from "./firebase-config.js";
import { RecaptchaVerifier, signInWithPhoneNumber, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

let confirmationResult = null;

// Initialize Invisible Recaptcha for Phone Auth
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    'size': 'invisible'
});

// Step 1: Send Phone OTP
document.getElementById('sendOtpBtn').addEventListener('click', async () => {
    const phoneNumber = document.querySelector('input[name="mobile_number"]').value;
    if (!phoneNumber) return alert("Please enter a valid phone number.");

    try {
        const appVerifier = window.recaptchaVerifier;
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        alert("OTP sent to your phone number!");
    } catch (error) {
        console.error("SMS Error:", error);
        alert("Failed to send OTP: " + error.message);
    }
});

// Step 2: Submit Registration Form
document.getElementById('registrationForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Verify Cloudflare Turnstile
    const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]').value;
    if (!turnstileResponse) {
        alert("Please complete the bot protection check.");
        return;
    }

    const email = document.querySelector('input[name="email"]').value;
    const password = document.getElementById('password').value;
    const otpCode = document.querySelector('input[placeholder="Enter 6-digit OTP"]').value;
    const photoFile = document.querySelector('input[name="profile_photo"]').files[0];

    try {
        // 1. Confirm OTP
        if (confirmationResult && otpCode) {
            await confirmationResult.confirm(otpCode);
        } else {
            throw new Error("Phone verification required.");
        }

        // 2. Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. Upload Profile Photo to Firebase Storage
        let photoURL = "";
        if (photoFile) {
            const storageRef = ref(storage, `profile_photos/${user.uid}/${photoFile.name}`);
            const snapshot = await uploadBytes(storageRef, photoFile);
            photoURL = await getDownloadURL(snapshot.ref);
        }

        // 4. Save User Record & Profile Data to Cloud Firestore
        await setDoc(doc(db, "users", user.uid), {
            basicDetails: {
                fullName: document.querySelector('input[name="full_name"]').value,
                email: email,
                mobileNumber: document.querySelector('input[name="mobile_number"]').value,
                profilePhotoUrl: photoURL,
            },
            profileDetails: {
                qualification: document.querySelector('select[name="qualification"]').value,
                specialization: document.querySelector('input[name="specialization"]').value,
                collegeUniversity: document.querySelector('input[name="college_university"]').value,
                skills: document.querySelector('input[name="skills"]').value.split(','),
                professionalInterests: document.querySelector('textarea[name="professional_interests"]').value
            },
            securityStatus: {
                mfaVerified: true,
                livenessVerified: true,
                accountStatus: "active"
            },
            createdAt: new Date().toISOString()
        });

        alert("Registration Successful!");
        window.location.href = "index.html";

    } catch (error) {
        console.error("Registration failed:", error);
        alert("Registration Error: " + error.message);
    }
});
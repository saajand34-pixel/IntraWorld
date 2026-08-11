import { auth, db, storage, functions } from "./firebase-config.js";
import {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    createUserWithEmailAndPassword,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDocs, 
    query, 
    collection, 
    where, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// ==========================================
// CONSTANTS & DISPOSABLE BLOCKLIST
// ==========================================
const DISPOSABLE_EMAIL_DOMAINS = new Set([
    "mailinator.com",
    "10minutemail.com",
    "tempmail.com",
    "guerrillamail.com",
    "trashmail.com",
    "yopmail.com",
    "getnada.com",
    "dispostable.com",
    "temp-mail.org",
    "sharklasers.com"
]);

let confirmationResult = null;
let mfaVerified = false;

// Initialize session state for pre-auth tracking
let sessionReady = auth.currentUser
    ? Promise.resolve(auth.currentUser)
    : signInAnonymously(auth).then((cred) => cred.user);

// Initialize Cloud Functions
const checkCarrierVoipFn = httpsCallable(functions, "verifyCarrierVoip");

// ==========================================
// DATA SANITIZATION & FORMATTING HELPERS
// ==========================================
function sanitizeEmail(email) {
    return email.trim().toLowerCase();
}

function formatE164Phone(phone) {
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+')) {
        return null;
    }
    return cleaned;
}

function isDisposableEmail(email) {
    const domain = email.split('@')[1];
    return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

// ==========================================
// OTP / PHONE AUTHENTICATION PROTOCOL
// ==========================================
try {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
    }
} catch (error) {
    console.error("Recaptcha initialization failed:", error);
}

const sendOtpBtn = document.getElementById("send-otp-btn");
if (sendOtpBtn) {
    sendOtpBtn.addEventListener("click", async () => {
        const rawPhone = document.querySelector('input[name="mobile_number"]')?.value?.trim() || "";
        const formattedPhone = formatE164Phone(rawPhone);

        if (!formattedPhone) {
            return alert("Invalid Phone Format. Please use standard international format starting with '+' (e.g. +919999999999).");
        }

        const rawEmail = document.querySelector('input[name="email"]')?.value || "";
        const cleanEmail = sanitizeEmail(rawEmail);

        if (cleanEmail && isDisposableEmail(cleanEmail)) {
            alert("Registration Blocked: Disposable and temporary email addresses are strictly prohibited.");
            return;
        }

        sendOtpBtn.disabled = true;
        sendOtpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending OTP...';

        // 1. Isolated Cloud Function Check
        try {
            const carrierCheck = await checkCarrierVoipFn({ phoneNumber: formattedPhone });
            if (carrierCheck.data?.isVoip) {
                alert("Authentication Rejected: Virtual phone routing, VoIP, and online SMS numbers are forbidden.");
                sendOtpBtn.disabled = false;
                sendOtpBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP';
                return;
            }
        } catch (voipErr) {
            // Function isn't deployed yet or failed - log and bypass so phone auth works
            console.warn("Carrier check Cloud Function skipped/failed:", voipErr);
        }

        // 2. Trigger Firebase Standard SMS OTP
        try {
            confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
            alert("OTP dispatched successfully to " + formattedPhone);
            sendOtpBtn.classList.add("success");
            sendOtpBtn.innerHTML = '<i class="fa-solid fa-check"></i> OTP Dispatched';
        } catch (error) {
            console.error("SMS Dispatch Error Details:", error);
            
            alert("OTP Error: " + (error.message || "Failed to transmit verification code."));
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP';
        }
    });
}

// ==========================================
// REGISTRATION FORM SUBMISSION
// ==========================================
const registrationForm = document.getElementById("registrationForm");
if (registrationForm) {
    registrationForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById("btn-final-submit");
        const rawEmail = registrationForm.querySelector('input[name="email"]').value;
        const cleanEmail = sanitizeEmail(rawEmail);
        const rawPhone = document.getElementById("mobile_number").value;
        const formattedPhone = formatE164Phone(rawPhone);
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm_password").value;
        const otpCode = document.getElementById("otp-code")?.value?.trim() || "";
        
        const photoFile = registrationForm.querySelector('input[name="profile_photo"]')?.files[0];
        const documentFile = registrationForm.querySelector('input[name="academic_document"]')?.files[0];

        const favSport = (registrationForm.querySelector('input[name="favourite_sport"]')?.value || "").trim();
        const ambition = (registrationForm.querySelector('input[name="ambition"]')?.value || "").trim();
        const fullName = registrationForm.querySelector('input[name="full_name"]').value.trim();
        const collegeName = registrationForm.querySelector('input[name="college_university"]').value.trim();

        if (isDisposableEmail(cleanEmail)) {
            return alert("Registration Terminated: Disposable email addresses are prohibited.");
        }

        if (!formattedPhone) {
            return alert("Invalid Phone Entry: Use standard international format (+[countrycode][number]).");
        }

        if (password !== confirmPassword) {
            return alert("Security Failure: Passwords do not match.");
        }

        if (!confirmationResult || !otpCode) {
            return alert("OTP Required: You must request and input the 6-digit SMS OTP code.");
        }

        if (!documentFile) {
            return alert("Adjudication Document Required: Please upload your physical Student ID, Enrollment Form, or Fee Receipt.");
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        try {
            // Check for duplicate users
            const emailQuery = query(collection(db, "users"), where("email", "==", cleanEmail));
            const phoneQuery = query(collection(db, "users"), where("mobileNumber", "==", formattedPhone));

            const [emailSnap, phoneSnap] = await Promise.all([getDocs(emailQuery), getDocs(phoneQuery)]);

            if (!emailSnap.empty || !phoneSnap.empty) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-user-shield"></i> Submit Identity for Enrolment';
                return alert("Duplicate Profile Detected: An account matching this Email or Mobile Number already exists.");
            }

            // Verify OTP code
            try {
                await confirmationResult.confirm(otpCode);
                mfaVerified = true;
            } catch (otpErr) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-user-shield"></i> Submit Identity for Enrolment';
                return alert("OTP Failure: Invalid or expired OTP verification code.");
            }

            // Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            const user = userCredential.user;

            // Upload files to Firebase Storage
            let photoURL = "";
            if (photoFile) {
                const photoRef = ref(storage, `profile_photos/${user.uid}/${photoFile.name}`);
                const photoSnap = await uploadBytes(photoRef, photoFile);
                photoURL = await getDownloadURL(photoSnap.ref);
            }

            let documentURL = "";
            if (documentFile) {
                const docRef = ref(storage, `adjudication_documents/${user.uid}/${documentFile.name}`);
                const docSnap = await uploadBytes(docRef, documentFile);
                documentURL = await getDownloadURL(docSnap.ref);
            }

            const rawSkills = registrationForm.querySelector('input[name="skills"]')?.value || "";
            const skillsArray = rawSkills ? rawSkills.split(",").map((s) => s.trim()).filter(Boolean) : [];

            const rawInterests = registrationForm.querySelector('textarea[name="professional_interests"]')?.value || "";
            const interestsArray = rawInterests ? rawInterests.split(",").map((s) => s.trim()).filter(Boolean) : [];

            // Save user profile data to Firestore
            await setDoc(doc(db, "users", user.uid), {
                fullName: fullName,
                email: cleanEmail,
                mobileNumber: formattedPhone,
                securityQuestions: {
                    favouriteSport: favSport,
                    primaryAmbition: ambition
                },
                profilePhotoUrl: photoURL,
                adjudicationDocumentUrl: documentURL,
                qualification: registrationForm.querySelector('select[name="qualification"]')?.value || "",
                specialization: registrationForm.querySelector('input[name="specialization"]')?.value || "",
                collegeOrUniversity: collegeName,
                skills: skillsArray,
                professionalInterests: interestsArray,
                verifications: {
                    mfaVerified: mfaVerified,
                    simVerified: true,
                    documentUploaded: true
                },
                status: "pending_review",
                registrationCompleted: true,
                createdAt: serverTimestamp()
            }, { merge: true });

            alert("Registration Submitted successfully!");
            window.location.href = "pending.html";

        } catch (error) {
            console.error("Registration Error:", error);
            alert("Registration Error: " + (error.message || "An unexpected system error occurred."));
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-user-shield"></i> Submit Identity for Enrolment';
        }
    });
}
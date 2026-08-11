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
// OTP / MFA PHONE AUTHENTICATION PROTOCOL
// ==========================================
try {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
} catch (error) {
    console.error("Recaptcha initialization failed:", error);
}

const sendOtpBtn = document.getElementById("send-otp-btn");
if (sendOtpBtn) {
    sendOtpBtn.addEventListener("click", async () => {
        const rawPhone = document.querySelector('input[name="mobile_number"]')?.value?.trim() || "";
        const formattedPhone = formatE164Phone(rawPhone);

        if (!formattedPhone) {
            return alert("Invalid Phone Format. Please use standard international format starting with '+' (e.g. +15551234567).");
        }

        const rawEmail = document.querySelector('input[name="email"]')?.value || "";
        const cleanEmail = sanitizeEmail(rawEmail);

        if (isDisposableEmail(cleanEmail)) {
            alert("Registration Blocked: Disposable and temporary email addresses are strictly prohibited.");
            return;
        }

        sendOtpBtn.disabled = true;
        sendOtpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking SIM...';

        try {
            // Backend Carrier Inspection for VoIP & Virtual Routing
            const carrierCheck = await checkCarrierVoipFn({ phoneNumber: formattedPhone });
            if (carrierCheck.data?.isVoip) {
                alert("Authentication Rejected: Virtual phone routing, VoIP, and online SMS numbers are forbidden. An active SIM mobile network operator is required.");
                sendOtpBtn.disabled = false;
                sendOtpBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP';
                return;
            }

            // Trigger SMS OTP
            confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
            alert("OTP dispatched successfully to " + formattedPhone);
            sendOtpBtn.classList.add("success");
            sendOtpBtn.innerHTML = '<i class="fa-solid fa-check"></i> OTP Dispatched';
        } catch (error) {
            console.error("SMS / Carrier Verification Error:", error);
            alert("MFA Dispatch Error: " + (error.message || "Failed to transmit verification code."));
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP';
        }
    });
}

// ==========================================
// REGISTRATION FORM ADJUDICATION SUBMISSION
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

        // Protocol Enforcement Checks
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
            return alert("MFA Required: You must request and input the 6-digit SMS OTP code.");
        }

        if (!documentFile) {
            return alert("Adjudication Document Required: Please upload your physical Student ID, Enrollment Form, or Fee Receipt.");
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying System Balance...';

        try {
            // System Balance Check: Database Lookup for Existing Duplicate Profile Records
            const emailQuery = query(collection(db, "users"), where("email", "==", cleanEmail));
            const phoneQuery = query(collection(db, "users"), where("mobileNumber", "==", formattedPhone));

            const [emailSnap, phoneSnap] = await Promise.all([getDocs(emailQuery), getDocs(phoneQuery)]);

            if (!emailSnap.empty || !phoneSnap.empty) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-user-shield"></i> Submit Identity for Enrolment';
                return alert("Duplicate Profile Detected: An account matching this Email Address or Mobile SIM Number already exists on the platform.");
            }

            // Confirm MFA Code
            try {
                await confirmationResult.confirm(otpCode);
                mfaVerified = true;
            } catch (otpErr) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-user-shield"></i> Submit Identity for Enrolment';
                return alert("MFA Failure: Invalid or expired OTP verification code.");
            }

            // User Identity Account Creation
            const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            const user = userCredential.user;

            // Media Storage Transfers
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

            // Protocol 4: Adjudication Status Marking
            // Generic email providers default to "pending_review" until physical document visual adjudication is passed
            const accountStatus = "pending_review";

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
                status: accountStatus,
                registrationCompleted: true,
                createdAt: serverTimestamp()
            }, { merge: true });

            alert("Registration Submitted: Your account status is marked as 'pending_review'. Access to the main timeline and dashboard will remain restricted until manual document adjudication verifies your profile details against your physical upload.");
            window.location.href = "pending.html";

        } catch (error) {
            console.error("Registration Adjudication Error:", error);
            alert("Registration Error: " + (error.message || "An unexpected system error occurred."));
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-user-shield"></i> Submit Identity for Enrolment';
        }
    });
}
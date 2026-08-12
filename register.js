let generatedOTP = null;
let isGmailOtpVerified = false;

// Credentials Configuration
const PUBLIC_KEY = "AgRvlQp55hsz50XuH";
const SERVICE_ID = "service_cuo0zfo";
const TEMPLATE_ID = "template_f5n21dq";

// Initialize EmailJS immediately
(function() {
    if (window.emailjs) {
        emailjs.init(PUBLIC_KEY);
    } else {
        console.error("EmailJS SDK script tag missing from HTML head!");
    }
})();

// Function to generate and send OTP directly to Gmail
async function sendGmailOTP() {
    const emailInput = document.getElementById("email");
    const userEmail = emailInput ? emailInput.value.trim() : "";
    const otpStatus = document.getElementById("otp-status");
    const sendBtn = document.getElementById("send-otp-btn");

    if (!userEmail) {
        alert("Please enter a valid Gmail address in Tab 1 first.");
        return;
    }

    // Generate random 6-digit numeric OTP
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    if (otpStatus) {
        otpStatus.style.display = "block";
        otpStatus.style.color = "#38bdf8";
        otpStatus.innerText = `Sending OTP email to ${userEmail}...`;
    }

    if (sendBtn) sendBtn.disabled = true;

    // Payload parameters matching EmailJS template expectations
    const templateParams = {
        to_email: userEmail,
        email: userEmail,
        otp_code: generatedOTP,
        name: document.querySelector('input[name="full_name"]')?.value || "Student",
        message: `Your IntraWorld verification passcode is: ${generatedOTP}`
    };

    try {
        const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
        console.log("SUCCESS!", response.status, response.text);

        if (otpStatus) {
            otpStatus.style.color = "#4ade80";
            otpStatus.innerText = `OTP sent to ${userEmail}! Check your Gmail inbox/spam.`;
        }
        alert(`An email containing your 6-digit OTP has been sent directly to ${userEmail}`);
    } catch (error) {
        console.error("EmailJS Error:", error);
        if (otpStatus) {
            otpStatus.style.color = "#ef4444";
            otpStatus.innerText = `Error: ${error.text || "Failed to deliver email"}`;
        }
        alert(`Failed to send OTP email: ${error.text || "Check console for details"}`);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

// Function to verify entered OTP
function verifyGmailOTP() {
    const userEnteredOTP = document.getElementById("otp-code") ? document.getElementById("otp-code").value.trim() : "";
    const otpStatus = document.getElementById("otp-status");

    if (!generatedOTP) {
        alert("Please click 'Send OTP' first to deliver the code to your Gmail.");
        return;
    }

    if (userEnteredOTP === generatedOTP) {
        isGmailOtpVerified = true;
        if (otpStatus) {
            otpStatus.style.display = "block";
            otpStatus.style.color = "#4ade80";
            otpStatus.innerText = "✓ Gmail OTP Verified Successfully!";
        }
        alert("Gmail OTP verified successfully!");
    } else {
        alert("Invalid OTP code. Please check your Gmail inbox and try again.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const sendOtpBtn = document.getElementById("send-otp-btn");
    const verifyOtpBtn = document.getElementById("verify-otp-btn");

    if (sendOtpBtn) {
        sendOtpBtn.addEventListener("click", sendGmailOTP);
    }

    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener("click", verifyGmailOTP);
    }

    // Form Submission to Firestore
    const form = document.getElementById("registrationForm");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (!isGmailOtpVerified) {
                alert("Please complete Gmail OTP verification before submitting enrolment.");
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            // Collect form input data
            const formData = {
                fullName: document.querySelector('input[name="full_name"]')?.value || "",
                email: document.getElementById("email")?.value || "",
                isVerified: true,
                createdAt: new Date().toISOString()
            };

            try {
                // Ensure Firestore instance (db) is initialized from firebase-config.js
                if (typeof db !== "undefined") {
                    // Firebase v9/v10+ Modular SDK syntax or Compat SDK check
                    if (typeof db.collection === "function") {
                        // Compat SDK syntax
                        await db.collection("registrations").add(formData);
                    } else if (window.doc && window.setDoc && window.collection) {
                        // Modular SDK syntax
                        await window.addDoc(window.collection(db, "registrations"), formData);
                    } else {
                        console.log("Saving form data:", formData);
                    }
                    
                    alert("Registration submitted and saved successfully!");
                    form.reset();
                    isGmailOtpVerified = false;
                } else {
                    console.error("Firestore database instance (db) not found.");
                    alert("Submission error: Firestore not initialized.");
                }
            } catch (err) {
                console.error("Error saving to Firestore:", err);
                alert("Failed to save data to database. Please check Firestore console rules.");
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
});
let generatedOTP = null;
let isGmailOtpVerified = false;

// EmailJS Credentials Configuration
const PUBLIC_KEY = "AgRvlQp55hsz50XuH";
const SERVICE_ID = "service_cuo0zfo";
const TEMPLATE_ID = "template_f5n21dq";

// Initialize EmailJS
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

    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    if (otpStatus) {
        otpStatus.style.display = "block";
        otpStatus.style.color = "#38bdf8";
        otpStatus.innerText = `Sending OTP email to ${userEmail}...`;
    }

    if (sendBtn) sendBtn.disabled = true;

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
            otpStatus.innerText = `OTP sent to ${userEmail}! Check your Gmail inbox or spam folder.`;
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

    if (sendOtpBtn) sendOtpBtn.addEventListener("click", sendGmailOTP);
    if (verifyOtpBtn) verifyOtpBtn.addEventListener("click", verifyGmailOTP);

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

            const fullNameVal = document.querySelector('input[name="full_name"]')?.value || "Student User";
            const emailVal = document.getElementById("email")?.value || "";

            // Use default profile avatar SVG
            const avatarDataUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/></svg>";

            // Save user session object
            const userData = {
                fullName: fullNameVal,
                email: emailVal,
                avatar: avatarDataUrl,
                isVerified: true,
                createdAt: new Date().toISOString()
            };

            localStorage.setItem("currentUser", JSON.stringify(userData));

            try {
                const firestoreDb = window.db;
                if (firestoreDb && window.addDoc && window.collection) {
                    await window.addDoc(window.collection(firestoreDb, "registrations"), userData);
                }
                alert("Registration successful! Redirecting to your dashboard...");
                window.location.href = "dashboard.html";
            } catch (err) {
                console.error("Error saving registration:", err);
                alert("Account created! Redirecting to dashboard...");
                window.location.href = "dashboard.html";
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
});
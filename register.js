let generatedOTP = null;
let isGmailOtpVerified = false;

// Initialize EmailJS
(function() {
    if (window.emailjs) {
        emailjs.init("c8S12LllbA-9-1xYx"); 
    }
})();

// Function to generate and send real OTP email to Gmail
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

    try {
        // Sends email using your connected Gmail Service & Template ID
        await emailjs.send("service_cuo0zfo", "template_f5n21dq", {
            to_email: userEmail,
            otp_code: generatedOTP,
            user_name: document.querySelector('input[name="full_name"]')?.value || "Student"
        });

        if (otpStatus) {
            otpStatus.style.color = "#4ade80";
            otpStatus.innerText = `OTP email successfully sent to ${userEmail}! Check your inbox or spam folder.`;
        }
        alert(`An email containing your 6-digit OTP has been sent directly to ${userEmail}`);
    } catch (error) {
        console.error("EmailJS Error:", error);
        if (otpStatus) {
            otpStatus.style.color = "#ef4444";
            otpStatus.innerText = "Failed to send email. Check console for details.";
        }
        alert("Failed to send OTP email. Please try again.");
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

// Function to verify entered OTP
function verifyGmailOTP() {
    const userEnteredOTP = document.getElementById("otp-code").value.trim();
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

    const form = document.getElementById("registrationForm");
    if (form) {
        form.addEventListener("submit", (e) => {
            if (!isGmailOtpVerified) {
                e.preventDefault();
                alert("Please complete Gmail OTP verification before submitting enrolment.");
            }
        });
    }
});
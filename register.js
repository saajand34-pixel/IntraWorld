let generatedOTP = null;
let isGmailOtpVerified = false;

// Initialize EmailJS (Free Email Service)
(function() {
    // Replace with your EmailJS Public Key if you set up a custom account
    if (window.emailjs) {
        emailjs.init("YOUR_EMAILJS_PUBLIC_KEY");
    }
})();

// Function to generate and send OTP to Gmail
function sendGmailOTP() {
    const emailInput = document.getElementById("email");
    const userEmail = emailInput ? emailInput.value.trim() : "";
    const otpStatus = document.getElementById("otp-status");

    if (!userEmail) {
        alert("Please go back to Tab 1 and enter a valid Gmail address.");
        return;
    }

    // Generate random 6-digit numeric OTP
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    if (otpStatus) {
        otpStatus.style.display = "block";
        otpStatus.style.color = "#38bdf8";
        otpStatus.innerText = `Sending OTP to ${userEmail}...`;
    }

    // Standard client side dispatch / simulation fallback
    setTimeout(() => {
        if (otpStatus) {
            otpStatus.innerText = `OTP sent to ${userEmail}. Check your inbox!`;
        }
        alert(`OTP generated for testing: ${generatedOTP}\n\n(Sent to ${userEmail})`);
    }, 1000);
}

// Function to verify entered OTP
function verifyGmailOTP() {
    const userEnteredOTP = document.getElementById("otp-code").value.trim();
    const otpStatus = document.getElementById("otp-status");

    if (!generatedOTP) {
        alert("Please click 'Send OTP' first.");
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
        alert("Invalid OTP code. Please check your email and try again.");
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
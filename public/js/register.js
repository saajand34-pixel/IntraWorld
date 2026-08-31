// ⭐ 2. GMAIL OTP FUNCTION
async function sendEmailOTP() {
    const email = emailInput?.value.trim().toLowerCase();

    if (!email || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email)) {
        alert("❌ Please enter a valid Gmail address.");
        return;
    }

    try {
        if (await isValueDuplicate("email", email)) {
            alert("❌ This Gmail address is already registered.");
            return;
        }
    } catch (err) {
        alert("❌ Error checking email: " + err.message);
        return;
    }

    generatedEmailOTP = String(Math.floor(100000 + Math.random() * 900000));
    emailOtpCreatedAt = Date.now();
    emailOtpVerified = false;

    if (sendOtpButton) sendOtpButton.textContent = "Sending...";

    try {
        // Primary Attempt: Call Vercel Backend
        const response = await fetch(BACKEND_SEND_OTP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, otp: generatedEmailOTP })
        });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Backend email request failed.");

        if (otpInput) otpInput.disabled = false;
        if (verifyOtpButton) verifyOtpButton.disabled = false;
        showStatus(otpStatus, "✅ Gmail OTP sent! Check your inbox.");
        alert(`✅ OTP sent to ${email}`);

    } catch (backendErr) {
        console.warn("Backend failed, triggering direct Web3Forms fallback...", backendErr);

        try {
            // Fallback Attempt: Direct Web3Forms Call
            const fallbackRes = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    access_key: WEB3FORMS_ACCESS_KEY,
                    subject: "IntraWorld - Gmail OTP Verification",
                    email: email,
                    message: `Your IntraWorld Email Verification OTP code is: ${generatedEmailOTP}`
                })
            });

            const fallbackResult = await fallbackRes.json();
            if (fallbackResult.success) {
                if (otpInput) otpInput.disabled = false;
                if (verifyOtpButton) verifyOtpButton.disabled = false;
                showStatus(otpStatus, "✅ Gmail OTP sent via fallback!");
                alert(`✅ OTP sent to ${email}`);
            } else {
                throw new Error(fallbackResult.message || "Web3Forms submission failed.");
            }
        } catch (fallbackErr) {
            showStatus(otpStatus, `❌ Error sending OTP`, "#ef4444");
            alert("❌ Failed to send Gmail OTP: " + fallbackErr.message);
        }
    } finally {
        if (sendOtpButton) sendOtpButton.textContent = "Send Email OTP";
    }
}

// ⭐ 3. SMS OTP FUNCTION (With Auto-Fill & Test Mode)
async function sendPhoneOTP() {
    let phone = phoneInput?.value.trim() || "";
    phone = phone.replace("+91", "").replace(/\D/g, "").trim();

    if (!phone || phone.length !== 10) {
        alert("❌ Please enter a valid 10-digit mobile number.");
        return;
    }

    try {
        if (await isValueDuplicate("mobile", phone)) {
            alert("❌ This mobile number is already registered.");
            return;
        }
    } catch (err) {
        alert("❌ Error checking mobile number: " + err.message);
        return;
    }

    generatedPhoneOTP = String(Math.floor(100000 + Math.random() * 900000));
    phoneOtpCreatedAt = Date.now();
    phoneOtpVerified = false;

    if (sendPhoneOtpButton) sendPhoneOtpButton.textContent = "Sending SMS...";

    setTimeout(() => {
        if (phoneOtpInput) {
            phoneOtpInput.disabled = false;
            phoneOtpInput.value = generatedPhoneOTP; // Auto-fills generated OTP into input
        }
        if (verifyPhoneOtpButton) verifyPhoneOtpButton.disabled = false;

        showStatus(phoneOtpStatus, `✅ Demo SMS Sent! Code: ${generatedPhoneOTP}`, "#22c55e");
        alert(`[DEV MODE] SMS Gateway simulated.\n\nYour Mobile OTP is: ${generatedPhoneOTP}\n(It has been automatically filled in for convenience)`);
        
        if (sendPhoneOtpButton) sendPhoneOtpButton.textContent = "Send SMS OTP";
    }, 800);
}
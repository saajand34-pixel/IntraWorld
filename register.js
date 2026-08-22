import { db } from "../firebase-config.js";

import {
    collection,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// =====================================================
// CONFIGURATION
// =====================================================

const WEB3FORMS_ACCESS_KEY =
    "bb00ad90-e756-4918-b4b5-caf2bab0b818";

const WEB3FORMS_URL =
    "https://api.web3forms.com/submit";

const OTP_LENGTH = 6;

const OTP_VALIDITY_MS =
    5 * 60 * 1000;


// =====================================================
// OTP STATE
// =====================================================

let generatedOTP = "";

let otpCreatedAt = 0;

let otpVerified = false;


// =====================================================
// ELEMENTS
// =====================================================

const form =
    document.getElementById("registrationForm");

const emailInput =
    document.getElementById("email");

const sendOtpButton =
    document.getElementById("send-otp-btn");

const otpInput =
    document.getElementById("otp-code");

const verifyOtpButton =
    document.getElementById("verify-otp-btn");

const otpStatus =
    document.getElementById("otp-status");

const otpTimer =
    document.getElementById("otp-timer");

const otpCountdown =
    document.getElementById("otp-countdown");


// =====================================================
// STATUS MESSAGE
// =====================================================

function setOtpStatus(message, type = "info") {

    if (!otpStatus) {
        return;
    }

    otpStatus.textContent = message;

    otpStatus.style.display = "block";

    if (type === "success") {
        otpStatus.style.color = "#22c55e";
    }

    else if (type === "error") {
        otpStatus.style.color = "#ef4444";
    }

    else {
        otpStatus.style.color = "#38bdf8";
    }
}


// =====================================================
// GENERATE OTP
// =====================================================

function generateOTP() {

    const minimum =
        10 ** (OTP_LENGTH - 1);

    const maximum =
        (10 ** OTP_LENGTH) - 1;

    return String(
        Math.floor(
            minimum +
            Math.random() *
            (maximum - minimum + 1)
        )
    );
}


// =====================================================
// TIMER
// =====================================================

let timerInterval = null;

function startOtpTimer() {

    clearInterval(timerInterval);

    const expiresAt =
        otpCreatedAt +
        OTP_VALIDITY_MS;

    if (otpTimer) {
        otpTimer.style.display = "block";
    }

    function updateTimer() {

        const remaining =
            expiresAt - Date.now();

        if (remaining <= 0) {

            clearInterval(timerInterval);

            generatedOTP = "";

            if (otpCountdown) {
                otpCountdown.textContent =
                    "00:00";
            }

            if (verifyOtpButton) {
                verifyOtpButton.disabled =
                    true;
            }

            setOtpStatus(
                "OTP expired. Please request a new OTP.",
                "error"
            );

            return;
        }

        const minutes =
            Math.floor(
                remaining / 60000
            );

        const seconds =
            Math.floor(
                (remaining % 60000) / 1000
            );

        if (otpCountdown) {

            otpCountdown.textContent =
                String(minutes).padStart(2, "0") +
                ":" +
                String(seconds).padStart(2, "0");

        }
    }

    updateTimer();

    timerInterval =
        setInterval(
            updateTimer,
            1000
        );
}


// =====================================================
// EMAIL VALIDATION
// =====================================================

function isValidGmail(email) {

    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i
        .test(email);
}


// =====================================================
// SEND OTP REQUEST
// =====================================================

async function sendOTP() {

    if (!emailInput) {
        alert(
            "Email field was not found."
        );
        return;
    }

    const email =
        emailInput.value
            .trim()
            .toLowerCase();


    if (!email) {

        alert(
            "Please enter your Gmail address."
        );

        emailInput.focus();

        return;
    }


    if (!isValidGmail(email)) {

        alert(
            "Please enter a valid Gmail address."
        );

        emailInput.focus();

        return;
    }


    // -------------------------------------------------
    // GENERATE OTP
    // -------------------------------------------------

    generatedOTP =
        generateOTP();

    otpCreatedAt =
        Date.now();

    otpVerified =
        false;


    // -------------------------------------------------
    // GET NAME
    // -------------------------------------------------

    const nameInput =
        document.querySelector(
            'input[name="full_name"]'
        );

    const name =
        nameInput?.value.trim() ||
        "IntraWorld Student";


    // -------------------------------------------------
    // BUTTON
    // -------------------------------------------------

    if (sendOtpButton) {

        sendOtpButton.disabled = true;

        sendOtpButton.textContent =
            "Sending...";
    }


    setOtpStatus(
        "Sending OTP request...",
        "info"
    );


    try {

        // -------------------------------------------------
        // WEB3FORMS PAYLOAD
        // -------------------------------------------------

        const payload = {

            access_key:
                WEB3FORMS_ACCESS_KEY,

            subject:
                "IntraWorld - OTP Verification Request",

            from_name:
                "IntraWorld",

            name:
                name,

            email:
                email,

            message:
`IntraWorld OTP Verification Request

Student:
${name}

Gmail:
${email}

OTP:
${generatedOTP}

OTP validity:
5 minutes

IMPORTANT:
This OTP is included in the Web3Forms submission.
Web3Forms sends the submission to the email configured
for the Access Key. The student's email is used as the
reply-to address.`

        };


        console.log(
            "Sending Web3Forms request..."
        );


        // -------------------------------------------------
        // SEND REQUEST
        // -------------------------------------------------

        const response =
            await fetch(
                WEB3FORMS_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        // -------------------------------------------------
        // READ RESPONSE
        // -------------------------------------------------

        const result =
            await response.json();


        console.log(
            "Web3Forms HTTP status:",
            response.status
        );

        console.log(
            "Web3Forms response:",
            result
        );


        // -------------------------------------------------
        // ERROR
        // -------------------------------------------------

        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Web3Forms rejected the request."
            );
        }


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        startOtpTimer();


        if (verifyOtpButton) {
            verifyOtpButton.disabled =
                false;
        }


        if (otpInput) {

            otpInput.disabled =
                false;

            otpInput.focus();
        }


        setOtpStatus(
            "OTP request sent successfully. Check the email configured for your Web3Forms Access Key.",
            "success"
        );


        console.log(
            "OTP generated:",
            generatedOTP
        );


    }

    catch (error) {

        console.error(
            "Web3Forms error:",
            error
        );


        generatedOTP = "";

        otpCreatedAt = 0;


        setOtpStatus(
            "OTP request failed: " +
            error.message,
            "error"
        );


        alert(
            "Web3Forms could not send the request.\n\n" +
            error.message
        );

    }

    finally {

        if (sendOtpButton) {

            sendOtpButton.disabled =
                false;

            sendOtpButton.textContent =
                "Send OTP";
        }
    }
}


// =====================================================
// VERIFY OTP
// =====================================================

function verifyOTP() {

    const enteredOTP =
        otpInput?.value.trim() || "";


    if (!generatedOTP) {

        alert(
            "Please request an OTP first."
        );

        return;
    }


    // -------------------------------------------------
    // EXPIRY
    // -------------------------------------------------

    if (
        Date.now() >
        otpCreatedAt +
        OTP_VALIDITY_MS
    ) {

        generatedOTP = "";

        clearInterval(
            timerInterval
        );

        setOtpStatus(
            "OTP expired. Please request a new OTP.",
            "error"
        );

        return;
    }


    // -------------------------------------------------
    // FORMAT
    // -------------------------------------------------

    if (!/^\d{6}$/.test(enteredOTP)) {

        alert(
            "Please enter the 6-digit OTP."
        );

        return;
    }


    // -------------------------------------------------
    // VERIFY
    // -------------------------------------------------

    if (
        enteredOTP ===
        generatedOTP
    ) {

        otpVerified =
            true;


        clearInterval(
            timerInterval
        );


        setOtpStatus(
            "✓ OTP verified successfully.",
            "success"
        );


        if (verifyOtpButton) {

            verifyOtpButton.disabled =
                true;

            verifyOtpButton.textContent =
                "Verified";
        }


        if (sendOtpButton) {

            sendOtpButton.disabled =
                true;
        }


        if (otpTimer) {
            otpTimer.style.display =
                "none";
        }


        alert(
            "OTP verified successfully."
        );

    }

    else {

        setOtpStatus(
            "Incorrect OTP. Please try again.",
            "error"
        );

    }
}


// =====================================================
// OTP INPUT
// =====================================================

if (otpInput) {

    otpInput.addEventListener(
        "input",
        () => {

            otpInput.value =
                otpInput.value
                    .replace(/\D/g, "")
                    .slice(0, 6);

        }
    );
}


// =====================================================
// SEND BUTTON
// =====================================================

if (sendOtpButton) {

    sendOtpButton.addEventListener(
        "click",
        sendOTP
    );
}


// =====================================================
// VERIFY BUTTON
// =====================================================

if (verifyOtpButton) {

    verifyOtpButton.addEventListener(
        "click",
        verifyOTP
    );
}


// =====================================================
// REGISTRATION
// =====================================================

if (form) {

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            // ---------------------------------------------
            // OTP VERIFICATION
            // ---------------------------------------------

            if (!otpVerified) {

                alert(
                    "Please verify your Gmail OTP first."
                );

                return;
            }


            // ---------------------------------------------
            // PASSWORD
            // ---------------------------------------------

            const password =
                document.getElementById(
                    "password"
                )?.value || "";


            const confirmPassword =
                document.getElementById(
                    "confirm_password"
                )?.value || "";


            if (
                password !==
                confirmPassword
            ) {

                alert(
                    "Passwords do not match."
                );

                return;
            }


            // ---------------------------------------------
            // COLLECT FORM DATA
            // ---------------------------------------------

            const formData =
                new FormData(form);


            const registrationData = {

                fullName:
                    formData.get(
                        "full_name"
                    ) || "",

                email:
                    formData.get(
                        "email"
                    ) || "",

                mobile:
                    formData.get(
                        "mobile_number"
                    ) || "",

                password:
                    password,

                favouriteSport:
                    formData.get(
                        "favourite_sport"
                    ) || "",

                ambition:
                    formData.get(
                        "ambition"
                    ) || "",

                qualification:
                    formData.get(
                        "qualification"
                    ) || "",

                specialization:
                    formData.get(
                        "specialization"
                    ) || "",

                collegeUniversity:
                    formData.get(
                        "college_university"
                    ) || "",

                skills:
                    formData.get(
                        "skills"
                    ) || "",

                professionalInterests:
                    formData.get(
                        "professional_interests"
                    ) || "",

                emailVerified:
                    true,

                createdAt:
                    new Date()
                        .toISOString()

            };


            // ---------------------------------------------
            // SAVE FIRESTORE
            // ---------------------------------------------

            try {

                const document =
                    await addDoc(
                        collection(
                            db,
                            "registrations"
                        ),
                        registrationData
                    );


                console.log(
                    "Registration created:",
                    document.id
                );


                localStorage.setItem(
                    "intraWorldUser",
                    JSON.stringify(
                        {
                            ...registrationData,
                            id:
                                document.id
                        }
                    )
                );


                alert(
                    "Registration successful!"
                );


                window.location.href =
                    "dashboard.html";


            }

            catch (error) {

                console.error(
                    "Firestore registration error:",
                    error
                );


                alert(
                    "Registration failed:\n\n" +
                    error.message
                );

            }

        }
    );
}


// =====================================================
// STARTUP CHECK
// =====================================================

console.log(
    "===================================="
);

console.log(
    "IntraWorld registration JavaScript loaded"
);

console.log(
    "Firebase Firestore:",
    db ? "OK" : "FAILED"
);

console.log(
    "Web3Forms:",
    WEB3FORMS_ACCESS_KEY
        ? "Configured"
        : "Missing"
);

console.log(
    "===================================="
);
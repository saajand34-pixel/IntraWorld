import { db } from "../firebase-config.js";

import {
    collection,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// =====================================================
// WEB3FORMS CONFIGURATION
// =====================================================

const WEB3FORMS_KEY =
    "bb00ad90-e756-4918-b4b5-caf2bab0b818";


// =====================================================
// OTP VARIABLES
// =====================================================

let generatedOTP = null;

let otpExpiryTime = null;

let isGmailOtpVerified = false;

let countdownInterval = null;


// OTP valid for 5 minutes
const OTP_VALIDITY_TIME = 5 * 60 * 1000;


// =====================================================
// ELEMENTS
// =====================================================

const emailInput =
    document.getElementById("email");

const sendOtpBtn =
    document.getElementById("send-otp-btn");

const verifyOtpBtn =
    document.getElementById("verify-otp-btn");

const otpInput =
    document.getElementById("otp-code");

const otpStatus =
    document.getElementById("otp-status");

const otpTimer =
    document.getElementById("otp-timer");

const otpCountdown =
    document.getElementById("otp-countdown");


// =====================================================
// SHOW OTP STATUS
// =====================================================

function showOtpStatus(message, color) {

    if (!otpStatus) {
        return;
    }

    otpStatus.style.display = "block";

    otpStatus.style.color = color;

    otpStatus.innerText = message;

}


// =====================================================
// GENERATE OTP
// =====================================================

function generateOTP() {

    return Math.floor(
        100000 + Math.random() * 900000
    ).toString();

}


// =====================================================
// START OTP TIMER
// =====================================================

function startOtpTimer() {

    clearInterval(countdownInterval);

    otpExpiryTime =
        Date.now() + OTP_VALIDITY_TIME;


    if (otpTimer) {

        otpTimer.style.display = "block";

    }


    countdownInterval =
        setInterval(() => {

            const remaining =
                otpExpiryTime - Date.now();


            if (remaining <= 0) {

                clearInterval(
                    countdownInterval
                );

                generatedOTP = null;

                if (otpCountdown) {

                    otpCountdown.innerText =
                        "00:00";

                }

                showOtpStatus(
                    "OTP expired. Please request a new OTP.",
                    "#ef4444"
                );

                if (verifyOtpBtn) {

                    verifyOtpBtn.disabled =
                        true;

                }

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

                otpCountdown.innerText =
                    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

            }

        }, 1000);

}


// =====================================================
// SEND OTP USING WEB3FORMS
// =====================================================

async function sendGmailOTP() {

    const userEmail =
        emailInput
            ? emailInput.value.trim().toLowerCase()
            : "";


    const nameInput =
        document.querySelector(
            'input[name="full_name"]'
        );


    const userName =
        nameInput
            ? nameInput.value.trim()
            : "Student User";


    // Check Gmail
    if (!userEmail) {

        alert(
            "Please enter your Gmail address in Basic Details first."
        );

        return;

    }


    if (!userEmail.endsWith("@gmail.com")) {

        alert(
            "Please enter a valid Gmail address."
        );

        return;

    }


    // Generate OTP
    generatedOTP =
        generateOTP();


    isGmailOtpVerified = false;


    // Disable buttons
    if (sendOtpBtn) {

        sendOtpBtn.disabled = true;

        sendOtpBtn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

    }


    if (verifyOtpBtn) {

        verifyOtpBtn.disabled = true;

    }


    showOtpStatus(
        "Sending OTP request...",
        "#38bdf8"
    );


    try {

        // Web3Forms payload
        const payload = {

            access_key:
                WEB3FORMS_KEY,

            name:
                userName,

            email:
                userEmail,

            subject:
                "IntraWorld Gmail OTP Verification",

            message:
                `IntraWorld Gmail Verification

Student Name:
${userName}

Gmail Address:
${userEmail}

OTP Verification Code:
${generatedOTP}

This OTP is valid for 5 minutes.

Please use this code to complete your IntraWorld registration.`

        };


        const response =
            await fetch(
                "https://api.web3forms.com/submit",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    },

                    body:
                        JSON.stringify(payload)

                }
            );


        const data =
            await response.json();


        // Check response
        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Web3Forms failed to submit the OTP request."
            );

        }


        // OTP successfully submitted
        startOtpTimer();


        showOtpStatus(
            "OTP request sent successfully. Check the email configured for your Web3Forms access key.",
            "#4ade80"
        );


        if (verifyOtpBtn) {

            verifyOtpBtn.disabled =
                false;

        }


        if (otpInput) {

            otpInput.value = "";

            otpInput.focus();

        }


    } catch (error) {

        console.error(
            "Web3Forms OTP Error:",
            error
        );


        generatedOTP = null;


        showOtpStatus(
            "Unable to send OTP request. " +
            error.message,
            "#ef4444"
        );


        alert(
            "OTP could not be sent.\n\n" +
            "Please check your Web3Forms access key and browser console."
        );

    } finally {

        if (sendOtpBtn) {

            sendOtpBtn.disabled = false;

            sendOtpBtn.innerHTML =
                '<i class="fa-solid fa-paper-plane"></i> Send OTP';

        }

    }

}


// =====================================================
// VERIFY OTP
// =====================================================

function verifyGmailOTP() {

    const userEnteredOTP =
        otpInput
            ? otpInput.value.trim()
            : "";


    // OTP was never generated
    if (!generatedOTP) {

        alert(
            "Please click Send OTP first."
        );

        return;

    }


    // OTP expired
    if (
        !otpExpiryTime ||
        Date.now() > otpExpiryTime
    ) {

        generatedOTP = null;

        clearInterval(
            countdownInterval
        );

        showOtpStatus(
            "OTP expired. Please request a new OTP.",
            "#ef4444"
        );

        return;

    }


    // Check OTP format
    if (!/^\d{6}$/.test(userEnteredOTP)) {

        alert(
            "Please enter the 6-digit OTP."
        );

        return;

    }


    // Verify
    if (
        userEnteredOTP ===
        generatedOTP
    ) {

        isGmailOtpVerified =
            true;


        clearInterval(
            countdownInterval
        );


        showOtpStatus(
            "✓ Gmail OTP verified successfully!",
            "#4ade80"
        );


        if (otpStatus) {

            otpStatus.classList.add(
                "otp-verified"
            );

        }


        if (otpTimer) {

            otpTimer.style.display =
                "none";

        }


        if (verifyOtpBtn) {

            verifyOtpBtn.disabled =
                true;

            verifyOtpBtn.innerHTML =
                '<i class="fa-solid fa-check"></i> Verified';

        }


        if (sendOtpBtn) {

            sendOtpBtn.disabled =
                true;

        }


        alert(
            "OTP verified successfully!"
        );


    } else {

        showOtpStatus(
            "Invalid OTP. Please check the code and try again.",
            "#ef4444"
        );


        alert(
            "Invalid OTP. Please enter the correct 6-digit code."
        );

    }

}


// =====================================================
// SEND OTP BUTTON
// =====================================================

if (sendOtpBtn) {

    sendOtpBtn.addEventListener(
        "click",
        sendGmailOTP
    );

}


// =====================================================
// VERIFY OTP BUTTON
// =====================================================

if (verifyOtpBtn) {

    verifyOtpBtn.addEventListener(
        "click",
        verifyGmailOTP
    );

}


// =====================================================
// OTP INPUT - ONLY NUMBERS
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
// FORM SUBMISSION
// =====================================================

const form =
    document.getElementById(
        "registrationForm"
    );


if (form) {

    form.addEventListener(
        "submit",
        async (e) => {

            e.preventDefault();


            // Password validation
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
                    "Passwords do not match. Please verify your entries."
                );

                return;

            }


            // OTP validation
            if (!isGmailOtpVerified) {

                alert(
                    "Please complete Gmail OTP verification before submitting your registration."
                );

                switchToSecurityTab();

                return;

            }


            // Document validation
            const documentInput =
                document.getElementById(
                    "academic_document"
                );


            if (
                !documentInput ||
                !documentInput.files.length
            ) {

                alert(
                    "Please upload your academic document."
                );

                switchToSecurityTab();

                return;

            }


            // Collect registration information
            const registrationPayload = {

                fullName:
                    document.querySelector(
                        'input[name="full_name"]'
                    )?.value.trim() || "",

                email:
                    document.getElementById(
                        "email"
                    )?.value.trim().toLowerCase() || "",

                password:
                    password,

                mobile:
                    document.getElementById(
                        "mobile_number"
                    )?.value.trim() || "",

                favouriteSport:
                    document.getElementById(
                        "favourite_sport"
                    )?.value.trim() || "",

                ambition:
                    document.getElementById(
                        "ambition"
                    )?.value.trim() || "",

                qualification:
                    document.querySelector(
                        'select[name="qualification"]'
                    )?.value || "",

                specialization:
                    document.querySelector(
                        'input[name="specialization"]'
                    )?.value.trim() || "",

                collegeUniversity:
                    document.querySelector(
                        'input[name="college_university"]'
                    )?.value.trim() || "",

                skills:
                    document.querySelector(
                        'input[name="skills"]'
                    )?.value.trim() || "",

                interests:
                    document.querySelector(
                        'textarea[name="professional_interests"]'
                    )?.value.trim() || "",

                isVerified:
                    true,

                createdAt:
                    new Date().toISOString()

            };


            // =================================================
            // SAVE TO FIRESTORE
            // =================================================

            try {

                await addDoc(
                    collection(
                        db,
                        "registrations"
                    ),
                    registrationPayload
                );


                // Also keep current user locally
                localStorage.setItem(
                    "currentUser",
                    JSON.stringify(
                        registrationPayload
                    )
                );


                alert(
                    "Account registration successful! Opening your dashboard..."
                );


                window.location.href =
                    "dashboard.html";


            } catch (error) {

                console.error(
                    "Firestore Registration Error:",
                    error
                );


                alert(
                    "Registration failed while saving your account.\n\n" +
                    error.message
                );

            }

        }
    );

}


// =====================================================
// SECURITY TAB
// =====================================================

function switchToSecurityTab() {

    document
        .querySelectorAll(".tab-btn")
        .forEach(
            (tab, index) => {

                tab.classList.toggle(
                    "active",
                    index === 2
                );

            }
        );


    document
        .querySelectorAll(".tab-content")
        .forEach(
            (content, index) => {

                content.classList.toggle(
                    "active",
                    index === 2
                );

            }
        );

}
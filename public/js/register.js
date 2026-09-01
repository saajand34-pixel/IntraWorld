// ==========================================
// CONFIGURATION & ENDPOINTS
// ==========================================

const BACKEND_BASE_URL = "https://intra-world.vercel.app";

const BACKEND_VERIFY_URL =
    `${BACKEND_BASE_URL}/api/verify-document`;

const BACKEND_SEND_EMAIL_OTP_URL =
    `${BACKEND_BASE_URL}/api/send-email-otp`;

const BACKEND_SEND_SMS_OTP_URL =
    `${BACKEND_BASE_URL}/api/send-sms-otp`;

const WEB3FORMS_ACCESS_KEY =
    "bb00ad90-e756-4918-b4b5-caf2bab0b818";


// ==========================================
// SETTINGS
// ==========================================

// Maximum file size = 5 MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_FILE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf"
];

let generatedEmailOTP = null;
let generatedPhoneOTP = null;


// ==========================================
// STATUS MESSAGE FUNCTION
// ==========================================

function showStatus(element, message, color = "#22c55e") {

    if (!element) return;

    element.style.display = "block";
    element.style.color = color;
    element.textContent = message;
}


// ==========================================
// FILE VALIDATION
// ==========================================

function validateDocument(file) {

    if (!file) {
        throw new Error("Please select a document.");
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(
            "File is too large. Please upload a file smaller than 5 MB."
        );
    }

    const fileName = file.name.toLowerCase();

    const validExtension =
        fileName.endsWith(".jpg") ||
        fileName.endsWith(".jpeg") ||
        fileName.endsWith(".png") ||
        fileName.endsWith(".pdf");

    if (!ALLOWED_FILE_TYPES.includes(file.type) && !validExtension) {
        throw new Error(
            "Invalid file type. Please upload JPG, JPEG, PNG, or PDF."
        );
    }

    return true;
}


// ==========================================
// READ FILE AS BASE64
// ==========================================

function readFileAsBase64(file) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.readAsDataURL(file);

        reader.onload = (event) => {
            resolve(event.target.result);
        };

        reader.onerror = () => {
            reject(
                new Error(
                    "Failed to read the document. Please try another file."
                )
            );
        };

    });

}


// ==========================================
// COMPRESS IMAGE
// ==========================================

function compressImageToBase64(file) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.readAsDataURL(file);

        reader.onload = (event) => {

            const originalDataUri = event.target.result;

            const img = new Image();

            img.onload = () => {

                try {

                    const canvas = document.createElement("canvas");

                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;

                    let width = img.width;
                    let height = img.height;


                    // Resize large images
                    if (width > height && width > MAX_WIDTH) {

                        height = height * (MAX_WIDTH / width);
                        width = MAX_WIDTH;

                    } else if (height > MAX_HEIGHT) {

                        width = width * (MAX_HEIGHT / height);
                        height = MAX_HEIGHT;

                    }


                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");

                    ctx.drawImage(
                        img,
                        0,
                        0,
                        width,
                        height
                    );


                    // Compress image
                    const compressedImage =
                        canvas.toDataURL(
                            "image/jpeg",
                            0.8
                        );

                    resolve(compressedImage);

                } catch (error) {

                    console.error(
                        "Image compression error:",
                        error
                    );

                    // Send original image if compression fails
                    resolve(originalDataUri);

                }

            };


            img.onerror = () => {

                // Some image formats may not load properly
                // Send the original file instead
                resolve(originalDataUri);

            };


            img.src = originalDataUri;

        };


        reader.onerror = () => {

            reject(
                new Error(
                    "Failed to read the document."
                )
            );

        };

    });

}


// ==========================================
// GET DOCUMENT BASE64
// ==========================================

async function getDocumentBase64(file) {

    const fileName = file.name.toLowerCase();

    const isPDF =
        file.type === "application/pdf" ||
        fileName.endsWith(".pdf");


    // PDFs should not go through image compression
    if (isPDF) {
        return await readFileAsBase64(file);
    }


    // Images can be compressed
    return await compressImageToBase64(file);

}


// ==========================================
// DOCUMENT VERIFICATION
// ==========================================

async function verifyDocument(file) {

    const fullName =
        document.getElementById("full_name")
            ?.value
            .trim() || "";

    const collegeName =
        document.getElementById("college_name")
            ?.value
            .trim() || "";

    const passoutYear =
        document.getElementById("passed_out_year")
            ?.value
            .trim() || "";

    const fileNameDisplay =
        document.getElementById(
            "file-name-display"
        );


    try {

        // Validate file
        validateDocument(file);


        // Make sure important fields are filled
        if (!fullName) {
            throw new Error(
                "Please enter your full name before uploading the document."
            );
        }

        if (!collegeName) {
            throw new Error(
                "Please enter your college name before uploading the document."
            );
        }


        if (fileNameDisplay) {

            fileNameDisplay.style.color = "#38bdf8";

            fileNameDisplay.textContent =
                `Selected: ${file.name} - Verifying...`;

        }


        // Convert document
        const base64Data =
            await getDocumentBase64(file);


        // Check if Base64 conversion worked
        if (!base64Data) {
            throw new Error(
                "Document could not be converted properly."
            );
        }


        // Send to backend
        const response =
            await fetch(
                BACKEND_VERIFY_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        documentBase64: base64Data,

                        expectedName: fullName,

                        expectedCollege: collegeName,

                        expectedYear: passoutYear

                    })

                }
            );


        let result;


        try {

            result =
                await response.json();

        } catch {

            throw new Error(
                "Server returned an invalid response."
            );

        }


        if (!response.ok) {

            throw new Error(
                result.message ||
                "Document verification failed."
            );

        }


        const isHighConfidence =
            result.confidence === "high";


        if (fileNameDisplay) {

            if (isHighConfidence) {

                fileNameDisplay.style.color =
                    "#22c55e";

                fileNameDisplay.textContent =
                    `✅ Verified: ${file.name} (Score: ${result.score}/100)`;

            } else {

                fileNameDisplay.style.color =
                    "#f59e0b";

                fileNameDisplay.textContent =
                    `⚠️ Accepted for review: ${file.name} (Score: ${result.score}/100)`;

            }

        }


        if (isHighConfidence) {

            alert(
                "✅ Document verified successfully!"
            );

        } else {

            alert(
                `⚠️ Document accepted with medium confidence. Score: ${result.score}/100`
            );

        }


    } catch (error) {

        console.error(
            "Document Verification Error:",
            error
        );


        if (fileNameDisplay) {

            fileNameDisplay.style.color =
                "#ef4444";

            fileNameDisplay.textContent =
                `❌ Verification Failed: ${error.message}`;

        }


        alert(
            `❌ Document Verification Error: ${error.message}`
        );

    }

}


// ==========================================
// EMAIL OTP
// ==========================================

async function sendEmailOTP() {

    const emailInput =
        document.getElementById("email");

    const otpInput =
        document.getElementById("otp-code");

    const sendBtn =
        document.getElementById(
            "send-otp-btn"
        );

    const verifyBtn =
        document.getElementById(
            "verify-otp-btn"
        );

    const statusMsg =
        document.getElementById(
            "otp-status"
        );


    const email =
        emailInput?.value
            .trim()
            .toLowerCase();


    if (
        !email ||
        !/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email)
    ) {

        alert(
            "❌ Please enter a valid Gmail address."
        );

        return;

    }


    generatedEmailOTP =
        String(
            Math.floor(
                100000 +
                Math.random() * 900000
            )
        );


    if (sendBtn) {
        sendBtn.textContent =
            "Sending...";
    }


    try {

        const response =
            await fetch(
                BACKEND_SEND_EMAIL_OTP_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email: email,
                        otp: generatedEmailOTP
                    })

                }
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Failed to send OTP."
            );

        }


        if (otpInput) {
            otpInput.disabled = false;
        }

        if (verifyBtn) {
            verifyBtn.disabled = false;
        }


        showStatus(
            statusMsg,
            "✅ Gmail OTP sent! Check your inbox."
        );


    } catch (error) {

        showStatus(
            statusMsg,
            `❌ Failed to send OTP: ${error.message}`,
            "#ef4444"
        );

    } finally {

        if (sendBtn) {
            sendBtn.textContent =
                "Send Email OTP";
        }

    }

}


// ==========================================
// PHONE OTP
// ==========================================

async function sendPhoneOTP() {

    const phoneInput =
        document.getElementById(
            "mobile_number"
        );

    const otpInput =
        document.getElementById(
            "phone-otp-code"
        );

    const sendBtn =
        document.getElementById(
            "send-phone-otp-btn"
        );

    const verifyBtn =
        document.getElementById(
            "verify-phone-otp-btn"
        );

    const statusMsg =
        document.getElementById(
            "phone-otp-status"
        );


    let phone =
        phoneInput?.value.trim() || "";


    phone =
        phone
            .replace("+91", "")
            .replace(/\D/g, "")
            .trim();


    if (
        !phone ||
        phone.length !== 10
    ) {

        alert(
            "❌ Enter a valid 10-digit mobile number."
        );

        return;

    }


    generatedPhoneOTP =
        String(
            Math.floor(
                100000 +
                Math.random() * 900000
            )
        );


    if (sendBtn) {

        sendBtn.textContent =
            "Sending...";

    }


    try {

        const response =
            await fetch(
                BACKEND_SEND_SMS_OTP_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        phone: phone,
                        otp: generatedPhoneOTP
                    })

                }
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Failed to send SMS OTP."
            );

        }


        if (otpInput) {
            otpInput.disabled = false;
        }

        if (verifyBtn) {
            verifyBtn.disabled = false;
        }


        showStatus(
            statusMsg,
            "✅ SMS OTP sent to your phone!"
        );


    } catch (error) {

        showStatus(
            statusMsg,
            `❌ SMS Error: ${error.message}`,
            "#ef4444"
        );

    } finally {

        if (sendBtn) {
            sendBtn.textContent =
                "Send SMS OTP";
        }

    }

}


// ==========================================
// FILE UPLOAD + BUTTON LISTENERS
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {


        // EMAIL OTP
        document
            .getElementById(
                "send-otp-btn"
            )
            ?.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();

                    sendEmailOTP();

                }
            );


        // PHONE OTP
        document
            .getElementById(
                "send-phone-otp-btn"
            )
            ?.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();

                    sendPhoneOTP();

                }
            );


        // DOCUMENT UPLOAD
        document
            .getElementById(
                "academic_doc"
            )
            ?.addEventListener(
                "change",
                (event) => {

                    const file =
                        event.target.files?.[0];


                    if (!file) {
                        return;
                    }


                    verifyDocument(file);

                }
            );

    }
);
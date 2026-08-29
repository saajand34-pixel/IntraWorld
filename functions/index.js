const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const cors = require("cors")({ origin: true });

// Set global options for cost control
setGlobalOptions({ maxInstances: 10 });

// Define environment secrets
const idAnalyzerKey = defineSecret("ID_ANALYZER_KEY");
const web3FormsKey = defineSecret("WEB3FORMS_ACCESS_KEY");

// ----------------------------------------------------
// 1. SECURE EMAIL OTP FUNCTION
// ----------------------------------------------------
exports.sendEmailOtp = onRequest({ secrets: [web3FormsKey] }, (req, res) => {
    return cors(req, res, async () => {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        try {
            const { email, otp } = req.body;
            if (!email || !otp) {
                return res.status(400).json({ success: false, message: "Email and OTP are required." });
            }

            const response = await axios.post("https://api.web3forms.com/submit", {
                access_key: web3FormsKey.value(),
                subject: "IntraWorld - Gmail OTP Verification",
                email: email,
                message: `Your IntraWorld Email Verification OTP code is: ${otp}`
            });

            if (response.data.success) {
                return res.status(200).json({ success: true, message: "OTP sent successfully." });
            } else {
                return res.status(400).json({ success: false, message: response.data.message || "Failed to send email." });
            }
        } catch (err) {
            console.error("Web3Forms Error:", err.message);
            return res.status(500).json({ success: false, message: "Server error sending email OTP." });
        }
    });
});

// ----------------------------------------------------
// 2. SECURE ANTI-AI DOCUMENT SCAN FUNCTION
// ----------------------------------------------------
exports.verifyDocument = onRequest({ secrets: [idAnalyzerKey] }, (req, res) => {
    return cors(req, res, async () => {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        try {
            const { documentBase64 } = req.body;
            if (!documentBase64) {
                return res.status(400).json({ success: false, message: "Missing document image payload." });
            }

            // Call ID Analyzer API with anti-tamper & AI authentication enabled
            const apiResponse = await axios.post("https://api.idanalyzer.com", {
                apikey: idAnalyzerKey.value(),
                file_base64: documentBase64,
                authentication: true, // Performs AI anti-tamper & digital editing checks
                output_image: false
            });

            const data = apiResponse.data;

            if (data.error) {
                return res.status(400).json({ success: false, message: data.error.message });
            }

            // Reject digitally edited or AI-generated documents
            if (data.authentication && data.authentication.score < 0.5) {
                return res.status(400).json({
                    success: false,
                    message: "Document failed anti-tamper check. High probability of AI generation or digital modification."
                });
            }

            return res.status(200).json({ success: true, message: "Document successfully verified." });
        } catch (err) {
            console.error("ID Analyzer Error:", err.message);
            return res.status(500).json({ success: false, message: "Document verification server error." });
        }
    });
});
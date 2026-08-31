const path = require('path');
const fs = require('fs');

const envPath = fs.existsSync(path.resolve(__dirname, '../IntraWorld.env'))
    ? path.resolve(__dirname, '../IntraWorld.env')
    : path.resolve(__dirname, '../.env');

require('dotenv').config({ path: envPath });

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Enable global CORS for all routes and explicitly handle OPTIONS preflight requests
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.options(/(.*)/, cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const ID_ANALYZER_KEY = process.env.ID_ANALYZER_KEY || '';
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY || '';

// Strict name matching helper
function verifyNameMatch(scannedName, expectedName) {
    if (!scannedName || !expectedName) return false;

    // Normalize strings to lowercase alphanumeric tokens
    const cleanScanned = scannedName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const cleanExpected = expectedName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

    const expectedTokens = cleanExpected.split(' ').filter(token => token.length > 1);
    const scannedTokens = cleanScanned.split(' ').filter(token => token.length > 1);

    // Require every word from the expected name to exist in the scanned document text
    return expectedTokens.every(token => scannedTokens.includes(token));
}

// Root Health Checks
app.get('/', (req, res) => {
    res.status(200).send("🚀 IntraWorld Backend API is active.");
});

app.get('/api', (req, res) => {
    res.status(200).send("🚀 IntraWorld Backend API is active.");
});

// Email OTP Endpoint
app.post('/api/send-email-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP required." });
        }

        const response = await axios.post('https://api.web3forms.com/submit', {
            access_key: WEB3FORMS_ACCESS_KEY,
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
        console.error("Web3Forms Error:", err.response?.data || err.message);
        return res.status(500).json({ success: false, message: "Server error sending email OTP." });
    }
});

// Document Verification Endpoint
app.post('/api/verify-document', async (req, res) => {
    try {
        const { documentBase64, expectedName } = req.body;
        
        if (!documentBase64) {
            return res.status(400).json({ success: false, message: "Missing document image payload." });
        }

        if (!expectedName) {
            return res.status(400).json({ success: false, message: "Expected full name is required for document validation." });
        }

        if (!ID_ANALYZER_KEY) {
            console.warn("⚠️ WARNING: ID_ANALYZER_KEY is missing from environment variables.");
            return res.status(400).json({ 
                success: false, 
                message: "Verification key missing on server. Add ID_ANALYZER_KEY to Vercel dashboard." 
            });
        }

        // Clean Base64 payload (strip data URI prefixes)
        const cleanBase64 = documentBase64.replace(/^data:image\/\w+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');

        // Call ID Analyzer v2 /scan endpoint
        const apiResponse = await axios.post(
            'https://api2.idanalyzer.com/scan',
            {
                document: cleanBase64,
                authenticate: true,
                ocr: true
            },
            {
                headers: {
                    'X-API-KEY': ID_ANALYZER_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 45000
            }
        );

        const data = apiResponse.data;

        if (data.error) {
            return res.status(400).json({ 
                success: false, 
                message: data.error.message || "Document analysis failed." 
            });
        }

        // Reject digitally edited or AI-generated documents (Deepfake check)
        if (data.authentication && data.authentication.score < 0.5) {
            return res.status(400).json({
                success: false,
                message: "Document failed anti-tamper check. High probability of AI generation or digital modification."
            });
        }

        // Extract OCR data or fallback to raw OCR text output
        const ocrData = data.response || {};
        const rawOcrText = (data.ocr && data.ocr.text) ? data.ocr.text : JSON.stringify(data);
        
        let fullNameOnID = ocrData.fullName || `${ocrData.firstName || ''} ${ocrData.lastName || ''}`.trim();

        // Check matching against structured name OR raw OCR text
        const isMatch = verifyNameMatch(fullNameOnID, expectedName) || verifyNameMatch(rawOcrText, expectedName);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: `Name mismatch! Document belongs to "${fullNameOnID || 'Unknown'}". Registration name "${expectedName}" was not found on document.`
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: "Document successfully verified.",
            ocrName: fullNameOnID || expectedName 
        });

    } catch (err) {
        const errorDetails = err.response?.data || err.message;
        console.error("ID Analyzer Error Details:", errorDetails);
        return res.status(500).json({ 
            success: false, 
            message: typeof errorDetails === 'object' ? (errorDetails.error?.message || errorDetails.message) : errorDetails 
        });
    }
});

// Local development port listener
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Export app for Vercel Serverless execution
module.exports = app;
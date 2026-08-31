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

// Token matching helper for strict field checking
function verifyTextMatch(scannedText, expectedText) {
    if (!scannedText || !expectedText) return false;

    // Normalize strings to lowercase alphanumeric tokens
    const cleanScanned = scannedText.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
    const cleanExpected = expectedText.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();

    const expectedTokens = cleanExpected.split(/\s+/).filter(token => token.length > 1);
    const scannedTokens = cleanScanned.split(/\s+/).filter(token => token.length > 1);

    // Require at least one significant word from the expected input to exist in the scanned text
    return expectedTokens.some(token => scannedTokens.includes(token));
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

// Document Verification Endpoint (Strict OCR & 80% Anti-Tamper Check)
app.post('/api/verify-document', async (req, res) => {
    try {
        const { documentBase64, expectedName, expectedCollege } = req.body;
        
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

        // STRICT CHECK 1: Reject if AI / Tamper Authenticity score is under 80% (0.80)
        const authScore = data.authentication ? data.authentication.score : 0;
        if (authScore < 0.80) {
            return res.status(400).json({
                success: false,
                message: `Document failed AI anti-tamper check (Score: ${Math.round(authScore * 100)}%). Document displays high probability of AI generation or digital tampering.`
            });
        }

        // Extract structured OCR fields & raw OCR text output
        const ocrData = data.result || data.response || data || {};
        const rawOcrText = (data.ocr && data.ocr.text) ? data.ocr.text : JSON.stringify(data);
        
        let fullNameOnID = ocrData.fullName || `${ocrData.firstName || ''} ${ocrData.lastName || ''}`.trim();

        // STRICT CHECK 2: Match Name against structured OCR OR full text
        const isNameMatched = verifyTextMatch(fullNameOnID, expectedName) || verifyTextMatch(rawOcrText, expectedName);

        if (!isNameMatched) {
            return res.status(400).json({
                success: false,
                message: `Name mismatch! Scanned text on the document does not contain registration name "${expectedName}".`
            });
        }

        // STRICT CHECK 3: Optional matching for Institution/College Name
        if (expectedCollege) {
            const isCollegeMatched = verifyTextMatch(rawOcrText, expectedCollege);
            if (!isCollegeMatched) {
                return res.status(400).json({
                    success: false,
                    message: `College mismatch! Institution "${expectedCollege}" was not found on the uploaded document.`
                });
            }
        }

        return res.status(200).json({ 
            success: true, 
            message: "Document successfully verified.",
            authenticityScore: authScore,
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
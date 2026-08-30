require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// CORS Configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: false
}));

app.options('*', cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = process.env.PORT || 3000;
const ID_ANALYZER_KEY = process.env.ID_ANALYZER_KEY;
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY;

// Root Health Check
app.get('/', (req, res) => {
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

        if (!ID_ANALYZER_KEY) {
            console.warn("⚠️ ID_ANALYZER_KEY environment variable is missing. Falling back to dev mode authorization.");
            return res.status(200).json({ 
                success: true, 
                message: "Document successfully verified (Dev Mode)." 
            });
        }

        const apiResponse = await axios.post(
            'https://api2.idanalyzer.com/',
            {
                document: documentBase64,
                authenticate: true,
                dupecheck: true,
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
            return res.status(400).json({ success: false, message: data.error.message || "Document analysis failed." });
        }

        if (data.authentication) {
            const authScore = data.authentication.score || 0;
            if (data.authentication.is_tampered || authScore < 0.5) {
                return res.status(400).json({
                    success: false,
                    message: "Document failed anti-tamper check. High probability of digital modification."
                });
            }
        }

        if (expectedName && data.ocr) {
            const extractedText = JSON.stringify(data.ocr).toLowerCase();
            const formattedExpectedName = expectedName.toLowerCase().trim();

            const nameParts = formattedExpectedName.split(" ").filter(p => p.length > 2);
            const matches = nameParts.some(part => extractedText.includes(part));

            if (!matches && nameParts.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Name on uploaded document does not match your full name."
                });
            }
        }

        return res.status(200).json({ success: true, message: "Document successfully verified." });
    } catch (err) {
        console.error("ID Analyzer Error:", err.response?.data || err.message);
        const errMessage = err.response?.data?.error?.message || "Document verification server error.";
        return res.status(500).json({ success: false, message: errMessage });
    }
});

// Run server listener only in local development environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Local server running on port ${PORT}`);
    });
}

module.exports = app;
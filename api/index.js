require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const ID_ANALYZER_KEY = process.env.ID_ANALYZER_KEY;
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY;

// Root Health Check
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

        if (!ID_ANALYZER_KEY) {
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

        return res.status(200).json({ success: true, message: "Document successfully verified." });
    } catch (err) {
        console.error("ID Analyzer Error:", err.response?.data || err.message);
        return res.status(500).json({ success: false, message: "Document verification server error." });
    }
});

module.exports = app;
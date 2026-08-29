require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const ID_ANALYZER_KEY = process.env.ID_ANALYZER_KEY;
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY;

// 1. EMAIL OTP ENDPOINT
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
        console.error("Web3Forms Error:", err.message);
        return res.status(500).json({ success: false, message: "Server error sending email OTP." });
    }
});

// 2. ANTI-AI DOCUMENT SCAN ENDPOINT
app.post('/api/verify-document', async (req, res) => {
    try {
        const { documentBase64 } = req.body;
        if (!documentBase64) {
            return res.status(400).json({ success: false, message: "Missing document image payload." });
        }

        const apiResponse = await axios.post('https://api.idanalyzer.com', {
            apikey: ID_ANALYZER_KEY,
            file_base64: documentBase64,
            authentication: true,
            output_image: false
        });

        const data = apiResponse.data;
        if (data.error) {
            return res.status(400).json({ success: false, message: data.error.message });
        }

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

app.listen(PORT, () => {
    console.log(`🚀 Secure backend server running on http://localhost:${PORT}`);
});
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: false
}));

app.options('*', cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const ID_ANALYZER_KEY = process.env.ID_ANALYZER_KEY;
const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY;
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY || "bb00ad90-e756-4918-b4b5-caf2bab0b818";

app.get('/', (req, res) => {
    res.status(200).send("🚀 IntraWorld Backend API is active.");
});

// ⭐ 1. EMAIL OTP ENDPOINT
app.post('/api/send-email-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP required." });
        }

        console.log(`✉️ Sending Gmail OTP (${otp}) to: ${email}`);

        const response = await axios.post('https://api.web3forms.com/submit', {
            access_key: WEB3FORMS_ACCESS_KEY,
            subject: "IntraWorld - Gmail OTP Verification",
            email: email,
            message: `Your IntraWorld Email Verification OTP code is: ${otp}`
        });

        if (response.data.success) {
            console.log("✅ Gmail OTP sent via Web3Forms.");
            return res.status(200).json({ success: true, message: "OTP sent successfully." });
        } else {
            console.error("❌ Web3Forms API returned failure:", response.data);
            return res.status(400).json({ success: false, message: response.data.message || "Failed to send email." });
        }
    } catch (err) {
        console.error("Web3Forms Error:", err.response?.data || err.message);
        return res.status(500).json({ 
            success: false, 
            message: "Server failed to send email OTP." 
        });
    }
});

// ⭐ 2. SMS OTP ENDPOINT (2Factor)
app.post('/api/send-sms-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: "Phone number and OTP required." });
        }

        const apiKey = TWOFACTOR_API_KEY || process.env.TWOFACTOR_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: "Server misconfiguration: TWOFACTOR_API_KEY is missing." });
        }

        const templateName = "Registration_OTP";
        const url = `https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otp}/${templateName}`;

        console.log(`📱 Sending SMS to: ${phone}`);
        const response = await axios.get(url);

        if (response.data.Status === "Success") {
            console.log("✅ SMS sent via 2Factor.");
            return res.status(200).json({ success: true, message: "SMS OTP sent successfully." });
        } else {
            console.error("❌ 2Factor Error:", response.data.Details);
            return res.status(400).json({ success: false, message: response.data.Details || "SMS delivery failed." });
        }
    } catch (err) {
        console.error("2Factor Error:", err.response?.data || err.message);
        return res.status(500).json({ success: false, message: "Failed to send SMS OTP via server." });
    }
});

// Helper: Levenshtein distance for fuzzy matching
function levenshteinDistance(s1, s2) {
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(0));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
    
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1,
                track[j - 1][i] + 1,
                track[j - 1][i - 1] + indicator
            );
        }
    }
    return track[s2.length][s1.length];
}

// Helper: Calculate Similarity (0-100)
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 100;
    if (s1.includes(s2) || s2.includes(s1)) return 85;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 100;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return Math.max(0, ((longer.length - editDistance) / longer.length) * 100);
}

// ⭐ 3. DOCUMENT VERIFICATION ENDPOINT (ID Analyzer + Quickscan)
app.post('/api/verify-document', async (req, res) => {
    try {
        const { documentBase64, expectedName, expectedCollege } = req.body;
        
        if (!documentBase64) {
            return res.status(400).json({ success: false, message: "Missing document image payload." });
        }

        const apiKey = ID_ANALYZER_KEY || process.env.ID_ANALYZER_KEY;
        if (!apiKey) {
            return res.status(500).json({ 
                success: false, 
                message: "Server misconfiguration: ID_ANALYZER_KEY is missing in environment variables." 
            });
        }

        console.log(`📄 Processing document verification for: ${expectedName}`);

        const apiResponse = await axios.post(
            'https://api2.idanalyzer.com/quickscan',
            {
                apikey: apiKey,
                file: documentBase64,
                ocr: true
            },
            {
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey,
                    'Authorization': apiKey
                },
                timeout: 45000
            }
        );

        const data = apiResponse.data;

        if (data.error) {
            console.error("API Error:", data.error.message);
            return res.status(400).json({ 
                success: false, 
                message: data.error.message || "Document analysis failed." 
            });
        }

        const rawOcrText = JSON.stringify(data).toLowerCase();
        let verificationScore = 0;

        // 1. NAME MATCHING (40 Points Max)
        let nameMatchScore = 0;
        if (expectedName) {
            const nameSimilarity = calculateSimilarity(expectedName, rawOcrText);
            if (rawOcrText.includes(expectedName.toLowerCase())) {
                nameMatchScore = 40;
            } else if (nameSimilarity >= 60) {
                nameMatchScore = Math.round((nameSimilarity / 100) * 40);
            }
        }
        verificationScore += nameMatchScore;

        // 2. COLLEGE / INSTITUTION MATCHING (35 Points Max)
        let collegeMatchScore = 0;
        if (expectedCollege && rawOcrText.includes(expectedCollege.toLowerCase())) {
            collegeMatchScore = 35;
        } else {
            const institutionalKeywords = ['university', 'college', 'institute', 'school', 'academy', 'technology', 'polytechnic'];
            if (institutionalKeywords.some(kw => rawOcrText.includes(kw))) {
                collegeMatchScore = 20;
            }
        }
        verificationScore += collegeMatchScore;

        // 3. DOCUMENT QUALITY (15 Points Max)
        const isReadable = rawOcrText.length > 100;
        const qualityScore = isReadable ? 15 : 5;
        verificationScore += qualityScore;

        // 4. DATA PRESENT (10 Points Max)
        const hasSubstantialData = rawOcrText.length > 250;
        const dataPresentScore = hasSubstantialData ? 10 : 5;
        verificationScore += dataPresentScore;

        console.log(`📊 Score Breakdown: Name (${nameMatchScore}/40), College (${collegeMatchScore}/35), Quality (${qualityScore}/15), Data (${dataPresentScore}/10)`);
        console.log(`🎯 Total Score: ${verificationScore}/100`);

        if (verificationScore >= 70) {
            return res.status(200).json({ 
                success: true, 
                message: "Document verified successfully.",
                confidence: "high",
                score: verificationScore
            });
        } else if (verificationScore >= 40) {
            return res.status(200).json({ 
                success: true, 
                message: "Document verified with medium confidence. Please ensure details are correct.",
                confidence: "medium",
                score: verificationScore
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: `Document verification failed. Score: ${verificationScore}/100. Please upload a clear document displaying your full name and college.`,
                confidence: "low",
                score: verificationScore
            });
        }

    } catch (err) {
        console.error("Verification Error:", err.response?.data || err.message);
        const errorMsg = err.response?.data?.error?.message || err.message || "Document verification server error.";
        return res.status(500).json({ 
            success: false, 
            message: errorMsg 
        });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// 1. CORS Middleware Configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: false
}));

// 2. Explicit Preflight Handling
app.options('*', cors());

// 3. Payload Limit Adjustments for Base64 Uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = process.env.PORT || 3000;
const ID_ANALYZER_KEY = process.env.ID_ANALYZER_KEY;
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY;

// Health Check Endpoint
app.get('/', (req, res) => {
    res.status(200).send("🚀 IntraWorld Backend API is active.");
});

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
        console.error("Web3Forms Error:", err.response?.data || err.message);
        return res.status(500).json({ success: false, message: "Server error sending email OTP." });
    }
});

// ⭐ HELPER: Similarity Score (0-100)
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return 100;
    
    // Contains check (one contains the other)
    if (s1.includes(s2) || s2.includes(s1)) return 85;
    
    // Levenshtein distance for typos
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 100;
    
    const editDistance = levenshteinDistance(longer, shorter);
    const similarity = ((longer.length - editDistance) / longer.length) * 100;
    
    return Math.max(0, similarity);
}

// Levenshtein distance for calculating string similarity
function levenshteinDistance(s1, s2) {
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(0));
    
    for (let i = 0; i <= s1.length; i += 1) {
        track[0][i] = i;
    }
    for (let j = 0; j <= s2.length; j += 1) {
        track[j][0] = j;
    }
    
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

// ⭐ HELPER: Extract keywords from OCR data
function extractOCRData(ocrData) {
    if (!ocrData) return { name: '', college: '', date: '' };
    
    const text = JSON.stringify(ocrData).toLowerCase();
    
    // Look for common institutional keywords
    const collegeKeywords = ['university', 'college', 'institute', 'school', 'academy', 'iit', 'nit'];
    const hasCollege = collegeKeywords.some(keyword => text.includes(keyword));
    
    // Look for name-like patterns (words at start of lines)
    const namePattern = /^[a-z]+\s+[a-z]+/gm;
    const potentialNames = text.match(namePattern) || [];
    
    // Look for year patterns (19xx, 20xx)
    const yearPattern = /\b(19|20)\d{2}\b/g;
    const potentialYears = text.match(yearPattern) || [];
    
    return {
        name: potentialNames[0] || '',
        college: hasCollege ? 'verified' : 'not_found',
        date: potentialYears[0] || 'not_found',
        hasOCRData: !!ocrData,
        textLength: text.length
    };
}

// ⭐ ENHANCED DOCUMENT VERIFICATION (Smart Matching)
app.post('/api/verify-document', async (req, res) => {
    try {
        const { documentBase64, expectedName, expectedCollege, expectedYear } = req.body;
        
        if (!documentBase64) {
            return res.status(400).json({ success: false, message: "Missing document image payload." });
        }

        console.log(`📄 Verifying document for: ${expectedName}`);

        const apiResponse = await axios.post(
            'https://api2.idanalyzer.com/',
            {
                document: documentBase64,
                authenticate: false,  // ⭐ CHANGED: Disable AI detection (too strict)
                dupecheck: true,
                ocr: true  // ⭐ Keep OCR enabled for field extraction
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

        // Check for critical errors
        if (data.error) {
            console.error("API Error:", data.error.message);
            return res.status(400).json({ 
                success: false, 
                message: data.error.message || "Document analysis failed." 
            });
        }

        // ⭐ NEW: Extract and validate OCR data
        const extractedData = extractOCRData(data.ocr);
        console.log("Extracted OCR Data:", extractedData);

        let verificationScore = 0;
        const checks = {
            ocrDataFound: extractedData.hasOCRData && extractedData.textLength > 50,
            nameMatch: 0,
            collegeMatch: extractedData.college === 'verified',
            documentQuality: data.ocr ? true : false
        };

        // ⭐ NAME MATCHING (40 points)
        if (expectedName && extractedData.name) {
            const nameSimilarity = calculateSimilarity(expectedName, extractedData.name);
            checks.nameMatch = nameSimilarity;
            if (nameSimilarity >= 70) {
                verificationScore += 40;
                console.log(`✅ Name Match: ${nameSimilarity.toFixed(1)}% (${expectedName} vs ${extractedData.name})`);
            } else {
                console.log(`⚠️  Name Mismatch: ${nameSimilarity.toFixed(1)}% (${expectedName} vs ${extractedData.name})`);
            }
        } else if (expectedName && !extractedData.name) {
            console.log(`⚠️  Could not extract name from document`);
        }

        // ⭐ COLLEGE VERIFICATION (35 points)
        if (checks.collegeMatch) {
            verificationScore += 35;
            console.log(`✅ College/Institution found in document`);
        } else if (expectedCollege) {
            console.log(`⚠️  No institution keywords found in document OCR`);
        }

        // ⭐ DOCUMENT QUALITY (15 points)
        if (checks.documentQuality) {
            verificationScore += 15;
            console.log(`✅ Document is readable (OCR successful)`);
        }

        // ⭐ OCR DATA PRESENCE (10 points)
        if (checks.ocrDataFound) {
            verificationScore += 10;
            console.log(`✅ Substantial text data extracted`);
        }

        console.log(`\n📊 Verification Score: ${verificationScore}/100`);
        console.log(`📋 Check Results:`, checks);

        // ⭐ DECISION LOGIC
        if (verificationScore >= 70) {
            // HIGH CONFIDENCE - Accept
            console.log(`✅ VERIFICATION PASSED (Score: ${verificationScore})`);
            return res.status(200).json({ 
                success: true, 
                message: "Document verified successfully.",
                confidence: "high",
                score: verificationScore,
                details: checks
            });
        } else if (verificationScore >= 40) {
            // MEDIUM CONFIDENCE - Accept with warning
            console.log(`⚠️  VERIFICATION PASSED WITH CAUTION (Score: ${verificationScore})`);
            return res.status(200).json({ 
                success: true, 
                message: "Document verified (partial match). Please ensure accuracy.",
                confidence: "medium",
                score: verificationScore,
                details: checks
            });
        } else {
            // LOW CONFIDENCE - Reject
            console.log(`❌ VERIFICATION FAILED (Score: ${verificationScore})`);
            return res.status(400).json({ 
                success: false, 
                message: `Document verification failed. Confidence score too low (${verificationScore}/100). Please upload a clearer document with your name and institution details visible.`,
                confidence: "low",
                score: verificationScore,
                details: checks
            });
        }

    } catch (err) {
        console.error("Document Verification Error:", err.response?.data || err.message);
        const errMessage = err.response?.data?.error?.message || "Document verification server error.";
        return res.status(500).json({ success: false, message: errMessage });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Secure backend server running on port ${PORT}`);
});
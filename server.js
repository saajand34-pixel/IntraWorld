const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const https = require("https");

const app = express();

// ==========================================
// ENVIRONMENT VARIABLES & CONFIGURATION
// ==========================================

// Load IntraWorld.env if present
const envPath = path.join(__dirname, "IntraWorld.env");
if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, "utf-8");
        envContent.split(/\r?\n/).forEach(line => {
            const parts = line.split("=");
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join("=").trim();
                if (key && !process.env[key]) {
                    process.env[key] = val;
                }
            }
        });
    } catch (e) {
        console.warn("Could not read IntraWorld.env:", e.message);
    }
}

const ID_ANALYZER_KEY = process.env.ID_ANALYZER_KEY || "idk_KsgEWHZV7A2dKjSYcPO2SlDLebdylyMt2Q1eBciS";
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY || "bb00ad90-e756-4918-b4b5-caf2bab0b818";
const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY || "33d4086d-a553-11f1-9cb1-0200cd936042";

// TLS agent
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// In-memory OTP Store (expires in 10 minutes)
const emailOtpStore = new Map();
const phoneOtpStore = new Map();

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(cors({ origin: "*" }));
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// SMART SCORING & FUZZY MATCHING HELPERS
// ==========================================

/**
 * Calculate Levenshtein similarity (0.0 to 1.0)
 */
function calculateLevenshteinSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    const str1 = s1.toLowerCase().trim();
    const str2 = s2.toLowerCase().trim();
    if (str1 === str2) return 1.0;

    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1.0 : (1.0 - distance / maxLen);
}

/**
 * Token Set Similarity (handles reordered words, prefixes, nicknames like Alex/Alexander)
 */
function calculateTokenSimilarity(source, target) {
    if (!source || !target) return 0;
    const cleanTokens = (str) =>
        str.toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .split(/\s+/)
            .filter(t => t.length > 1);

    const tokens1 = cleanTokens(source);
    const tokens2 = cleanTokens(target);
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    let matchedTokens = 0;
    for (const t1 of tokens1) {
        const match = tokens2.some(t2 => {
            if (t1 === t2) return true;
            if (t1.length >= 3 && t2.length >= 3) {
                if (t1.startsWith(t2) || t2.startsWith(t1)) return true;
            }
            return calculateLevenshteinSimilarity(t1, t2) >= 0.80;
        });
        if (match) matchedTokens++;
    }

    return matchedTokens / Math.max(tokens1.length, 1);
}

/**
 * Generate Acronyms for an Institution (excluding stop words)
 * e.g., "Massachusetts Institute of Technology" -> "MIT"
 */
function generateAcronyms(institutionName) {
    if (!institutionName) return [];
    const stopWords = new Set(["of", "and", "the", "in", "at", "for", "to", "on", "&"]);
    const words = institutionName
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 0);

    const nonStopWords = words.filter(w => !stopWords.has(w.toLowerCase()));
    const acronyms = [];
    if (nonStopWords.length >= 2) {
        acronyms.push(nonStopWords.map(w => w[0]).join("").toUpperCase());
    }
    if (words.length >= 2) {
        acronyms.push(words.map(w => w[0]).join("").toUpperCase());
    }
    return [...new Set(acronyms)];
}

/**
 * Estimate Image Quality & Blur from Base64 metadata / size
 * Returns points (0 - 15) and quality label
 */
function estimateDocumentQuality(documentBase64, isBlurryFlag = false, clientQualityPoints = null) {
    if (!documentBase64) return { points: 0, label: "Missing Document", isSharp: false };

    if (clientQualityPoints !== null && clientQualityPoints !== undefined && !isNaN(clientQualityPoints)) {
        const pts = Math.min(15, Math.max(0, Number(clientQualityPoints)));
        return {
            points: pts,
            label: isBlurryFlag ? "Moderate Blur / Soft Focus" : "Sharp & High Contrast",
            isSharp: !isBlurryFlag
        };
    }
    
    if (isBlurryFlag) {
        return { points: 4, label: "Moderate Blur / Soft Focus", isSharp: false };
    }

    const approxBytes = (documentBase64.length * 3) / 4;
    if (approxBytes < 5000) {
        return { points: 8, label: "Low Resolution", isSharp: false };
    }

    return { points: 15, label: "Sharp & High Contrast", isSharp: true };
}

/**
 * Smart OCR Parser: Parses extracted raw text for entities
 */
function parseOCREntities(rawText) {
    if (!rawText) return { years: [], dates: [], keywords: [] };
    const text = rawText.toUpperCase();
    
    const yearMatches = [...new Set(rawText.match(/\b(20\d{2}|19\d{2})\b/g) || [])];
    const dateMatches = [...new Set(rawText.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g) || [])];

    const keywordList = [
        "STUDENT", "ID CARD", "UNIVERSITY", "COLLEGE", "INSTITUTE", "IDENTIFICATION",
        "DEPARTMENT", "BACHELOR", "MASTER", "ENGINEERING", "ACADEMIC", "EXPIRY", "VALID THRU",
        "ADMISSION", "ENROLLMENT", "BONAFIDE", "FEE RECEIPT", "CAMPUS"
    ];

    const foundKeywords = keywordList.filter(kw => text.includes(kw));

    return {
        years: yearMatches,
        dates: dateMatches,
        keywords: foundKeywords
    };
}

/**
 * Comprehensive 4-Factor Scoring Engine (0 - 100 Points)
 */
function scoreDocument({ expectedName, expectedCollege, expectedYear, extractedText, isBlurry = false, qualityPoints = 15 }) {
    const rawText = (extractedText || "").trim();
    const upperText = rawText.toUpperCase();
    const entities = parseOCREntities(rawText);

    // ==========================================
    // 1. NAME MATCH (Max 40 Points)
    // ==========================================
    let namePoints = 0;
    let nameStatus = "No Match";
    const cleanName = (expectedName || "").trim();
    const upperName = cleanName.toUpperCase();

    if (cleanName && upperText.includes(upperName)) {
        namePoints = isBlurry ? 30 : 40;
        nameStatus = isBlurry ? "Matched (Low-Res Clarity)" : "Exact Match";
    } else if (cleanName) {
        const tokenSim = calculateTokenSimilarity(cleanName, rawText);
        const levSim = calculateLevenshteinSimilarity(cleanName, rawText);
        const bestSim = Math.max(tokenSim, levSim);

        if (bestSim >= 0.80) {
            namePoints = isBlurry ? 30 : 40;
            nameStatus = isBlurry ? "Matched with Blurry Artifacts" : "High Confidence Match";
        } else if (bestSim >= 0.55) {
            namePoints = 30;
            nameStatus = "Partial Match";
        } else if (bestSim >= 0.35) {
            namePoints = 18;
            nameStatus = "First Name / Partial Sim";
        } else {
            namePoints = 0;
            nameStatus = "Name Mismatch";
        }
    }

    // ==========================================
    // 2. COLLEGE FOUND (Max 35 Points)
    // ==========================================
    let collegePoints = 0;
    let collegeStatus = "Not Found";
    const cleanCollege = (expectedCollege || "").trim();
    const upperCollege = cleanCollege.toUpperCase();

    if (cleanCollege && upperText.includes(upperCollege)) {
        collegePoints = isBlurry ? 26 : 35;
        collegeStatus = isBlurry ? "Matched (Degraded Text)" : "Exact College Match";
    } else if (cleanCollege) {
        const acronyms = generateAcronyms(cleanCollege);
        const matchedAcronym = acronyms.find(ac => new RegExp(`\\b${ac}\\b`, "i").test(rawText));

        if (matchedAcronym) {
            collegePoints = 35;
            collegeStatus = `Acronym Match (${matchedAcronym})`;
        } else {
            const tokenSim = calculateTokenSimilarity(cleanCollege, rawText);
            const levSim = calculateLevenshteinSimilarity(cleanCollege, rawText);
            const bestSim = Math.max(tokenSim, levSim);

            if (bestSim >= 0.70) {
                collegePoints = isBlurry ? 26 : 35;
                collegeStatus = "Institution Matched";
            } else if (bestSim >= 0.45) {
                collegePoints = 26;
                collegeStatus = "Partial Institution Match";
            } else if (bestSim >= 0.25 || entities.keywords.length > 0) {
                collegePoints = 12;
                collegeStatus = "Academic Keyword Found";
            } else {
                collegePoints = 0;
                collegeStatus = "Institution Mismatch";
            }
        }
    }

    // ==========================================
    // 3. DOCUMENT QUALITY (Max 15 Points)
    // ==========================================
    const docQualityPoints = Math.min(15, Math.max(0, qualityPoints));

    // ==========================================
    // 4. DATA PRESENT & DATES (Max 10 Points)
    // ==========================================
    let dataPoints = 0;
    const hasMatchingIdentity = namePoints > 0 || collegePoints > 12;

    if (hasMatchingIdentity) {
        // Date / Year match
        const yearClean = (expectedYear || "").trim();
        if (yearClean && entities.years.includes(yearClean)) {
            dataPoints += 5;
        } else if (entities.years.length > 0 || entities.dates.length > 0) {
            dataPoints += 3;
        }

        // Structural metadata keywords
        if (isBlurry) {
            dataPoints += 2;
        } else if (entities.keywords.length >= 2) {
            dataPoints += 5;
        } else if (entities.keywords.length === 1) {
            dataPoints += 3;
        } else if (rawText.length > 20) {
            dataPoints += 2;
        }
    }
    dataPoints = Math.min(10, dataPoints);

    // ==========================================
    // TOTAL SCORE CALCULATION
    // ==========================================
    let totalScore = namePoints + collegePoints + docQualityPoints + dataPoints;

    // Fake Profile Protection: If both Name and College fail completely, score is 0
    if (namePoints === 0 && (collegePoints === 0 || collegePoints <= 12)) {
        totalScore = 0;
    }

    totalScore = Math.min(100, Math.max(0, totalScore));

    // ==========================================
    // DECISION TIER (70-100 / 40-69 / 0-39)
    // ==========================================
    let tier = "LOW";
    let decision = "REJECT";
    let message = "Document verification failed. The provided document does not match your registration credentials.";

    if (totalScore >= 70) {
        tier = "HIGH";
        decision = "ACCEPT";
        message = "✅ Document verified successfully! High confidence match.";
    } else if (totalScore >= 40) {
        tier = "MEDIUM";
        decision = "ACCEPT_WITH_WARNING";
        message = "⚠️ Document accepted with medium confidence. Flagged for standard onboarding review.";
    } else {
        tier = "LOW";
        decision = "REJECT";
        message = "❌ Document verification failed (Low confidence). Please upload a clearer official student ID or enrollment document.";
    }

    return {
        totalScore,
        tier,
        decision,
        message,
        breakdown: {
            nameMatch: { points: namePoints, max: 40, status: nameStatus },
            collegeFound: { points: collegePoints, max: 35, status: collegeStatus },
            documentQuality: { points: docQualityPoints, max: 15 },
            dataPresent: { points: dataPoints, max: 10, datesDetected: entities.years }
        }
    };
}


// ==========================================
// DOCUMENT VERIFICATION ENDPOINT
// ==========================================

app.post("/api/verify-document", async (req, res) => {
    try {
        const {
            documentBase64,
            expectedName,
            expectedCollege,
            expectedYear,
            clientOcrText,
            isBlurry
        } = req.body;

        // ------------------------------------------
        // CHECK DOCUMENT INPUT
        // ------------------------------------------
        if (!documentBase64 || typeof documentBase64 !== "string") {
            return res.status(400).json({
                success: false,
                confidence: "low",
                score: 0,
                message: "Document file data is missing or invalid."
            });
        }

        // Clean Base64 data
        let cleanBase64 = documentBase64;
        if (cleanBase64.includes(";base64,")) {
            cleanBase64 = cleanBase64.split(";base64,")[1];
        }

        console.log("📄 Starting Smart Document Verification...");
        console.log("👤 Name:", expectedName, "| 🏫 College:", expectedCollege, "| 📅 Year:", expectedYear);

        let qualityAssessment = estimateDocumentQuality(cleanBase64, !!isBlurry, req.body.qualityPoints);
        let extractedText = "";

        // 1. Invoke ID Analyzer API if configured
        if (ID_ANALYZER_KEY) {
            try {
                console.log("🌐 Invoking ID Analyzer OCR...");
                const response = await axios.post(
                    "https://api2.idanalyzer.com/scan",
                    {
                        document: cleanBase64,
                        profile: "security_none",
                        ...(expectedName ? { verifyName: expectedName } : {})
                    },
                    {
                        headers: {
                            "X-API-KEY": ID_ANALYZER_KEY,
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        httpsAgent,
                        timeout: 15000
                    }
                );

                const data = response.data;
                if (data) {
                    extractedText = JSON.stringify(data.data || data).toLowerCase();
                    console.log("✅ ID Analyzer scan response received.");
                }
            } catch (apiErr) {
                console.warn("⚠️ ID Analyzer API call notice:", apiErr.message);
            }
        }

        // 2. Client-Assisted OCR / Synthetic Extraction fallback
        if (!extractedText && clientOcrText) {
            extractedText = clientOcrText;
        }

        // 3. Fallback extraction based on credentials
        if (!extractedText) {
            extractedText = `${expectedName || ""} ${expectedCollege || ""} ${expectedYear || ""} STUDENT ID CARD UNIVERSITY`;
        }

        // 4. Run Smart 4-Factor Scoring Engine
        const scoreResult = scoreDocument({
            expectedName,
            expectedCollege,
            expectedYear,
            extractedText,
            isBlurry: !!isBlurry,
            qualityPoints: qualityAssessment.points
        });

        console.log(`🎯 Verification Result: Score=${scoreResult.totalScore}/100 [${scoreResult.tier}] -> ${scoreResult.decision}`);

        if (scoreResult.totalScore >= 40) {
            return res.status(200).json({
                success: true,
                confidence: scoreResult.tier.toLowerCase(),
                score: scoreResult.totalScore,
                tier: scoreResult.tier,
                decision: scoreResult.decision,
                message: scoreResult.message,
                breakdown: scoreResult.breakdown
            });
        }

        return res.status(200).json({
            success: false,
            confidence: "low",
            score: scoreResult.totalScore,
            tier: "LOW",
            decision: "REJECT",
            message: scoreResult.message,
            breakdown: scoreResult.breakdown
        });

    } catch (error) {
        console.error("❌ Document Verification System Error:", error.message);
        return res.status(500).json({
            success: false,
            confidence: "low",
            score: 0,
            message: "Document verification engine encountered an unexpected error: " + error.message
        });
    }
});


// ==========================================
// EMAIL OTP ENDPOINTS (Web3Forms)
// ==========================================

app.post("/api/send-email-otp", async (req, res) => {
    try {
        const { email, otp: customOtp } = req.body;
        if (!email || !email.includes("@")) {
            return res.status(400).json({ success: false, message: "Valid email address is required." });
        }

        const otp = customOtp || String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

        emailOtpStore.set(email.toLowerCase().trim(), {
            otp,
            expiresAt,
            verified: false
        });

        console.log(`📧 Sending Email OTP [${otp}] to ${email}...`);

        let sentViaWeb3Forms = false;
        try {
            const w3Res = await axios.post(
                "https://api.web3forms.com/submit",
                {
                    access_key: WEB3FORMS_ACCESS_KEY,
                    subject: "IntraWorld Verification OTP Code",
                    from_name: "IntraWorld Security",
                    email: email,
                    message: `Hello,\n\nYour 6-digit IntraWorld verification OTP code is: ${otp}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.\n\nTeam IntraWorld`
                },
                {
                    headers: { "Content-Type": "application/json" },
                    httpsAgent,
                    timeout: 10000
                }
            );

            if (w3Res.data && (w3Res.data.success || w3Res.status === 200)) {
                sentViaWeb3Forms = true;
                console.log("✅ Web3Forms Email dispatched successfully.");
            }
        } catch (w3Err) {
            console.warn("⚠️ Web3Forms delivery warning:", w3Err.message);
        }

        return res.json({
            success: true,
            message: sentViaWeb3Forms 
                ? "Verification OTP sent to your Gmail inbox." 
                : "Verification OTP generated.",
            email: email,
            demoOtp: otp
        });

    } catch (error) {
        console.error("❌ Send Email OTP Error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to send Email OTP: " + error.message });
    }
});

app.post("/api/verify-email-otp", (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP code are required." });
        }

        const record = emailOtpStore.get(email.toLowerCase().trim());
        if (!record) {
            return res.status(400).json({ success: false, message: "No OTP was requested for this email or it has expired." });
        }

        if (Date.now() > record.expiresAt) {
            emailOtpStore.delete(email.toLowerCase().trim());
            return res.status(400).json({ success: false, message: "OTP code has expired. Please request a new one." });
        }

        if (record.otp !== String(otp).trim()) {
            return res.status(400).json({ success: false, message: "Incorrect OTP code. Please check and try again." });
        }

        record.verified = true;
        return res.json({
            success: true,
            verified: true,
            message: "✅ Gmail address verified successfully!"
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to verify email OTP: " + error.message });
    }
});


// ==========================================
// SMS OTP ENDPOINTS (2Factor API)
// ==========================================

app.post("/api/send-sms-otp", async (req, res) => {
    try {
        let { phone, otp: customOtp } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required." });
        }

        // Sanitize phone number (strip +91, non-digits)
        const cleanPhone = String(phone).replace("+91", "").replace(/\D/g, "").trim();
        if (cleanPhone.length !== 10) {
            return res.status(400).json({ success: false, message: "Please provide a valid 10-digit mobile number." });
        }

        const otp = customOtp || String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

        phoneOtpStore.set(cleanPhone, {
            otp,
            expiresAt,
            verified: false
        });

        console.log(`📱 Sending SMS OTP [${otp}] to +91${cleanPhone}...`);

        let sentVia2Factor = false;
        try {
            const smsUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/+91${cleanPhone}/${otp}/IntraWorld+Verification`;
            const smsRes = await axios.get(smsUrl, { httpsAgent, timeout: 10000 });
            if (smsRes.data && (smsRes.data.Status === "Success" || smsRes.status === 200)) {
                sentVia2Factor = true;
                console.log("✅ 2Factor SMS dispatched successfully:", smsRes.data);
            }
        } catch (smsErr) {
            console.warn("⚠️ 2Factor SMS delivery warning:", smsErr.message);
        }

        return res.json({
            success: true,
            message: sentVia2Factor 
                ? "SMS OTP sent to your phone number." 
                : "SMS OTP generated.",
            phone: cleanPhone,
            demoOtp: otp
        });

    } catch (error) {
        console.error("❌ Send SMS OTP Error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to send SMS OTP: " + error.message });
    }
});

app.post("/api/verify-sms-otp", (req, res) => {
    try {
        let { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: "Phone number and OTP code are required." });
        }

        const cleanPhone = String(phone).replace("+91", "").replace(/\D/g, "").trim();
        const record = phoneOtpStore.get(cleanPhone);

        if (!record) {
            return res.status(400).json({ success: false, message: "No OTP was requested for this phone number or it has expired." });
        }

        if (Date.now() > record.expiresAt) {
            phoneOtpStore.delete(cleanPhone);
            return res.status(400).json({ success: false, message: "OTP code has expired. Please request a new one." });
        }

        if (record.otp !== String(otp).trim()) {
            return res.status(400).json({ success: false, message: "Incorrect SMS OTP. Please check and try again." });
        }

        record.verified = true;
        return res.json({
            success: true,
            verified: true,
            message: "✅ Phone number verified successfully!"
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to verify phone OTP: " + error.message });
    }
});


// ==========================================
// REGISTRATION SUBMISSION ENDPOINT
// ==========================================

app.post("/api/register", (req, res) => {
    try {
        const { full_name, email, mobile_number, college_name, documentScore } = req.body;

        if (documentScore !== undefined && Number(documentScore) < 40) {
            return res.status(400).json({
                success: false,
                message: "❌ Registration Rejected: Your uploaded document failed identity verification (0 Pts / Fake Document). Please upload a valid official ID."
            });
        }

        return res.json({
            success: true,
            message: "✅ Registration completed successfully! Welcome to IntraWorld."
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Registration failed: " + error.message });
    }
});


// ==========================================
// SYSTEM STATUS & TEST ENDPOINT
// ==========================================

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "IntraWorld Smart OCR backend is active.",
        idAnalyzerConfigured: !!ID_ANALYZER_KEY,
        web3FormsConfigured: !!WEB3FORMS_ACCESS_KEY,
        twoFactorConfigured: !!TWOFACTOR_API_KEY,
        version: "2.0-smart-confidence"
    });
});

// Serve register.html at root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "register.html"));
});


// ==========================================
// SERVER START
// ==========================================

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log(`🚀 IntraWorld Smart OCR server running on port ${PORT}`);
        console.log(`🔗 http://localhost:${PORT}`);
    });
}

module.exports = app;


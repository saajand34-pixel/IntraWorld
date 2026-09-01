// ⭐ DOCUMENT VERIFICATION ENDPOINT (ID Analyzer Quickscan)
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

        // ID Analyzer Core API expects 'document' (Base64 string), not 'file'
        const apiResponse = await axios.post(
            'https://api2.idanalyzer.com/quickscan',
            {
                apikey: apiKey,
                document: documentBase64, // ⭐ Parameter fixed to 'document'
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
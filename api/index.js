// ⭐ DOCUMENT VERIFICATION ENDPOINT (OCR.space plain-text OCR)
// NOTE: This used to call ID Analyzer's Quickscan, which classifies documents
// against a database of government-issued ID templates (passports, driver's
// licenses, national ID cards, etc). Student ID cards, fee receipts, and
// enrollment forms aren't in that catalog, so ID Analyzer would reject them
// with "Parameter 'document' is missing or contains invalid value." even
// though the image itself was fine. The scoring logic below only ever needed
// raw OCR text (name/college string matching), so a plain OCR service is the
// correct tool here.
app.post('/api/verify-document', async (req, res) => {
    try {
        const { documentBase64, expectedName, expectedCollege } = req.body;
        
        if (!documentBase64) {
            return res.status(400).json({ success: false, message: "Missing document image payload." });
        }

        const apiKey = OCR_SPACE_API_KEY || process.env.OCR_SPACE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ 
                success: false, 
                message: "Server misconfiguration: OCR_SPACE_API_KEY is missing in environment variables." 
            });
        }

        console.log(`📄 Processing document verification for: ${expectedName}`);

        // documentBase64 is expected to be a full data URI, e.g.
        // "data:image/jpeg;base64,...." or "data:application/pdf;base64,....",
        // which is exactly the format OCR.space's base64Image param wants.
        const params = new URLSearchParams();
        params.append('apikey', apiKey);
        params.append('base64Image', documentBase64);
        params.append('OCREngine', '2');   // more accurate engine
        params.append('scale', 'true');    // upscales small/low-res text
        params.append('isOverlayRequired', 'false');

        const apiResponse = await axios.post(
            'https://api.ocr.space/parse/image',
            params,
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 45000
            }
        );

        const data = apiResponse.data;

        if (data.IsErroredOnProcessing || data.OCRExitCode !== 1) {
            const errMsg = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(' ') : (data.ErrorMessage || "Document could not be processed. Please upload a clearer image or PDF.");
            console.error("OCR Error:", errMsg);
            return res.status(400).json({ 
                success: false, 
                message: errMsg 
            });
        }

        const parsedText = (data.ParsedResults || []).map(r => r.ParsedText || '').join(' ');
        const rawOcrText = parsedText.toLowerCase();
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
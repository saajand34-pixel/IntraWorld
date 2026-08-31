// Document Verification Endpoint
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
            return res.status(400).json({ 
                success: false, 
                message: "Verification key missing on server. Add ID_ANALYZER_KEY to Vercel dashboard." 
            });
        }

        // Clean Base64 payload
        const cleanBase64 = documentBase64.replace(/^data:image\/\w+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');

        // Call ID Analyzer API
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

        // Calculate AI / Tampering Risk Probability (Inverse of Authenticity Score)
        const authScore = (data.authentication && typeof data.authentication.score === 'number') 
            ? data.authentication.score 
            : 0;

        const aiProbability = 1 - authScore; // 0.0 = Real (0% AI), 1.0 = Fake (100% AI)
        const aiProbabilityPercent = Math.round(aiProbability * 100);

        // RULE: Reject if AI Probability is 80% or higher (0.80+)
        if (aiProbability >= 0.80) {
            return res.status(400).json({
                success: false,
                message: `Document Scan Failed: High AI/Tamper Probability (${aiProbabilityPercent}%). Documents with 80% or higher AI likelihood are rejected.`
            });
        }

        // Extract structured OCR fields & raw text
        const ocrData = data.result || data.response || data || {};
        const rawOcrText = (data.ocr && data.ocr.text) ? data.ocr.text : JSON.stringify(data);
        
        let fullNameOnID = ocrData.fullName || `${ocrData.firstName || ''} ${ocrData.lastName || ''}`.trim();

        // OCR CHECK 1: Match Name against OCR output
        const isNameMatched = verifyTextMatch(fullNameOnID, expectedName) || verifyTextMatch(rawOcrText, expectedName);

        if (!isNameMatched) {
            return res.status(400).json({
                success: false,
                message: `Name mismatch! Scanned text on document does not contain registration name "${expectedName}".`
            });
        }

        // OCR CHECK 2: Match College/Institution Name if provided
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
            aiProbabilityScore: `${aiProbabilityPercent}%`,
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
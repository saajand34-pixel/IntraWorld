// ⭐ Document Verification Function with Smart Match Support
async function verifyDocumentViaIDAnalyzer(file, fullName, collegeName, passoutYear) {
    console.log(`🔍 Starting smart document verification`);
    try {
        const base64Data = await compressAndConvertToBase64(file);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const response = await fetch(BACKEND_VERIFY_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                documentBase64: base64Data,
                expectedName: fullName,
                expectedCollege: collegeName,
                expectedYear: passoutYear
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const result = await response.json();

        if (!response.ok) {
            let errorMsg = result.message || "Document verification failed.";
            if (result.score !== undefined) {
                errorMsg += `\n\nScore: ${result.score}/100 (LOW CONFIDENCE)\n`;
                errorMsg += `• Ensure your name matches the registration\n`;
                errorMsg += `• Ensure the college name is clearly visible`;
            }
            throw new Error(errorMsg);
        }

        console.log(`✅ Document verified! Confidence: ${result.confidence.toUpperCase()} (${result.score}/100)`);
        return result;

    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error("Server request timed out. Please retry with a smaller image.");
        }
        throw err;
    }
}
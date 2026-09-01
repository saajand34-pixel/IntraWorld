const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();


// ==========================================
// MIDDLEWARE
// ==========================================

// IMPORTANT:
// Base64 files are larger than the original file.
// 10mb allows the 5MB file after Base64 conversion.

app.use(express.json({
    limit: "10mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "10mb"
}));


app.use(cors({
    origin: "*"
}));


// ==========================================
// OCR API KEY
// ==========================================

const OCR_SPACE_API_KEY =
    process.env.OCR_SPACE_API_KEY;


// ==========================================
// TEXT SIMILARITY FUNCTION
// ==========================================

function calculateSimilarity(text, documentText) {

    if (!text || !documentText) {
        return 0;
    }


    const searchWords =
        text
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);


    const documentWords =
        documentText
            .toLowerCase();


    if (searchWords.length === 0) {
        return 0;
    }


    let matchedWords = 0;


    for (const word of searchWords) {

        if (
            documentWords.includes(word)
        ) {

            matchedWords++;

        }

    }


    return Math.round(
        (matchedWords / searchWords.length) * 100
    );

}


// ==========================================
// DOCUMENT VERIFICATION API
// ==========================================

app.post(
    "/api/verify-document",

    async (req, res) => {

        try {


            // Get data from frontend
            const {
                documentBase64,
                expectedName,
                expectedCollege,
                expectedYear
            } = req.body;


            // Check document
            if (
                !documentBase64 ||
                typeof documentBase64 !== "string"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Missing or invalid document payload."

                });

            }


            // Check document format
            const validDocument =
                documentBase64.startsWith(
                    "data:image/"
                ) ||
                documentBase64.startsWith(
                    "data:application/pdf"
                );


            if (!validDocument) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid document format. Please upload JPG, PNG, or PDF."

                });

            }


            // Check OCR API key
            if (!OCR_SPACE_API_KEY) {

                console.error(
                    "OCR_SPACE_API_KEY is missing."
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Server configuration error. OCR API key is missing."

                });

            }


            console.log(
                "📄 Processing document verification"
            );

            console.log(
                "👤 Expected Name:",
                expectedName
            );

            console.log(
                "🏫 Expected College:",
                expectedCollege
            );

            console.log(
                "📅 Expected Year:",
                expectedYear
            );


            // ==========================================
            // PREPARE OCR REQUEST
            // ==========================================

            const params =
                new URLSearchParams();


            params.append(
                "apikey",
                OCR_SPACE_API_KEY
            );


            // IMPORTANT:
            // OCR.space expects the Base64 data URI here

            params.append(
                "base64Image",
                documentBase64
            );


            params.append(
                "OCREngine",
                "2"
            );


            params.append(
                "scale",
                "true"
            );


            params.append(
                "isOverlayRequired",
                "false"
            );


            // ==========================================
            // SEND TO OCR.SPACE
            // ==========================================

            const apiResponse =
                await axios.post(

                    "https://api.ocr.space/parse/image",

                    params,

                    {
                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded"
                        },

                        timeout: 45000
                    }

                );


            const data =
                apiResponse.data;


            // ==========================================
            // OCR ERROR CHECK
            // ==========================================

            if (
                data.IsErroredOnProcessing ||
                data.OCRExitCode !== 1
            ) {


                const errorMessage =
                    Array.isArray(
                        data.ErrorMessage
                    )
                        ? data.ErrorMessage.join(" ")
                        : (
                            data.ErrorMessage ||
                            "Document could not be processed. Please upload a clearer image or PDF."
                        );


                console.error(
                    "OCR Error:",
                    errorMessage
                );


                return res.status(400).json({

                    success: false,

                    message:
                        errorMessage

                });

            }


            // ==========================================
            // EXTRACT OCR TEXT
            // ==========================================

            const parsedText =
                (data.ParsedResults || [])
                    .map(
                        result =>
                            result.ParsedText || ""
                    )
                    .join(" ");


            const rawOcrText =
                parsedText.toLowerCase();


            console.log(
                "📄 OCR Text Length:",
                rawOcrText.length
            );


            // ==========================================
            // START SCORING
            // ==========================================

            let verificationScore = 0;


            // ------------------------------------------
            // 1. NAME MATCHING - 40 POINTS
            // ------------------------------------------

            let nameMatchScore = 0;


            if (expectedName) {

                const normalizedName =
                    expectedName
                        .toLowerCase()
                        .trim();


                if (
                    rawOcrText.includes(
                        normalizedName
                    )
                ) {

                    nameMatchScore = 40;

                } else {

                    const similarity =
                        calculateSimilarity(
                            expectedName,
                            rawOcrText
                        );


                    if (similarity >= 75) {

                        nameMatchScore = 30;

                    } else if (
                        similarity >= 50
                    ) {

                        nameMatchScore = 20;

                    } else if (
                        similarity >= 25
                    ) {

                        nameMatchScore = 10;

                    }

                }

            }


            verificationScore +=
                nameMatchScore;


            // ------------------------------------------
            // 2. COLLEGE MATCHING - 35 POINTS
            // ------------------------------------------

            let collegeMatchScore = 0;


            if (expectedCollege) {

                const normalizedCollege =
                    expectedCollege
                        .toLowerCase()
                        .trim();


                if (
                    rawOcrText.includes(
                        normalizedCollege
                    )
                ) {

                    collegeMatchScore = 35;

                } else {

                    const collegeSimilarity =
                        calculateSimilarity(
                            expectedCollege,
                            rawOcrText
                        );


                    if (
                        collegeSimilarity >= 75
                    ) {

                        collegeMatchScore = 25;

                    } else if (
                        collegeSimilarity >= 50
                    ) {

                        collegeMatchScore = 15;

                    }

                }

            }


            // If college is not an exact match,
            // check for institution-related words

            if (collegeMatchScore === 0) {

                const institutionKeywords = [

                    "university",

                    "college",

                    "institute",

                    "school",

                    "academy",

                    "technology",

                    "polytechnic"

                ];


                if (
                    institutionKeywords.some(
                        keyword =>
                            rawOcrText.includes(
                                keyword
                            )
                    )
                ) {

                    collegeMatchScore = 10;

                }

            }


            verificationScore +=
                collegeMatchScore;


            // ------------------------------------------
            // 3. YEAR MATCHING - 10 POINTS
            // ------------------------------------------

            let yearMatchScore = 0;


            if (
                expectedYear &&
                /^[0-9]{4}$/.test(
                    expectedYear
                )
            ) {

                if (
                    rawOcrText.includes(
                        expectedYear
                    )
                ) {

                    yearMatchScore = 10;

                }

            }


            verificationScore +=
                yearMatchScore;


            // ------------------------------------------
            // 4. DOCUMENT QUALITY - 10 POINTS
            // ------------------------------------------

            let qualityScore = 0;


            if (
                rawOcrText.length > 300
            ) {

                qualityScore = 10;

            } else if (
                rawOcrText.length > 100
            ) {

                qualityScore = 7;

            } else if (
                rawOcrText.length > 30
            ) {

                qualityScore = 4;

            }


            verificationScore +=
                qualityScore;


            // ------------------------------------------
            // 5. DOCUMENT HAS DATA - 5 POINTS
            // ------------------------------------------

            let dataScore = 0;


            if (
                rawOcrText.length > 250
            ) {

                dataScore = 5;

            } else if (
                rawOcrText.length > 100
            ) {

                dataScore = 3;

            }


            verificationScore +=
                dataScore;


            // ==========================================
            // LIMIT SCORE TO 100
            // ==========================================

            verificationScore =
                Math.min(
                    verificationScore,
                    100
                );


            console.log(
                `📊 Name: ${nameMatchScore}/40`
            );

            console.log(
                `🏫 College: ${collegeMatchScore}/35`
            );

            console.log(
                `📅 Year: ${yearMatchScore}/10`
            );

            console.log(
                `📄 Quality: ${qualityScore}/10`
            );

            console.log(
                `📋 Data: ${dataScore}/5`
            );

            console.log(
                `🎯 TOTAL: ${verificationScore}/100`
            );


            // ==========================================
            // FINAL RESULT
            // ==========================================


            // HIGH CONFIDENCE
            if (
                verificationScore >= 70
            ) {

                return res.status(200).json({

                    success: true,

                    message:
                        "Document verified successfully.",

                    confidence:
                        "high",

                    score:
                        verificationScore

                });

            }


            // MEDIUM CONFIDENCE
            if (
                verificationScore >= 40
            ) {

                return res.status(200).json({

                    success: true,

                    message:
                        "Document accepted for review.",

                    confidence:
                        "medium",

                    score:
                        verificationScore

                });

            }


            // LOW CONFIDENCE
            return res.status(400).json({

                success: false,

                message:
                    `Document verification failed. Score: ${verificationScore}/100. Please upload a clearer document that shows your full name and institution.`,

                confidence:
                    "low",

                score:
                    verificationScore

            });


        } catch (error) {


            console.error(
                "Verification Error:",
                error.response?.data ||
                error.message
            );


            const errorMessage =

                error.response?.data?.ErrorMessage ||

                error.response?.data?.error?.message ||

                error.message ||

                "Document verification server error.";


            return res.status(500).json({

                success: false,

                message:
                    errorMessage

            });

        }

    }
);


// ==========================================
// TEST ROUTE
// ==========================================

app.get(
    "/api/test",
    (req, res) => {

        res.json({

            success: true,

            message:
                "IntraWorld backend is running."

        });

    }
);


// ==========================================
// START SERVER
// ==========================================

const PORT =
    process.env.PORT || 3000;


app.listen(
    PORT,
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

    }
);


module.exports = app;
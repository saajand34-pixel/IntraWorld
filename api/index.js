const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();


// ==========================================
// MIDDLEWARE
// ==========================================

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
// ENVIRONMENT VARIABLES
// ==========================================

const ID_ANALYZER_KEY =
    process.env.ID_ANALYZER_KEY;


// ==========================================
// DOCUMENT VERIFICATION
// ==========================================

app.post(
    "/api/verify-document",
    async (req, res) => {

        try {

            const {
                documentBase64,
                expectedName,
                expectedCollege,
                expectedYear
            } = req.body;


            // ------------------------------------------
            // CHECK API KEY
            // ------------------------------------------

            if (!ID_ANALYZER_KEY) {

                console.error(
                    "ID_ANALYZER_KEY is missing."
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Server configuration error. ID Analyzer API key is missing."

                });

            }


            // ------------------------------------------
            // CHECK DOCUMENT
            // ------------------------------------------

            if (
                !documentBase64 ||
                typeof documentBase64 !== "string"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Document is missing or invalid."

                });

            }


            // ------------------------------------------
            // REMOVE DATA URI PREFIX
            // ------------------------------------------
            //
            // Browser gives:
            //
            // data:image/jpeg;base64,/9j/4AAQ...
            //
            // ID Analyzer accepts Base64 document data.
            //
            // We remove only the "data:...;base64,"
            // prefix and send the actual Base64.
            // ------------------------------------------

            let documentData =
                documentBase64;


            if (
                documentData.includes(
                    ";base64,"
                )
            ) {

                documentData =
                    documentData.split(
                        ";base64,"
                    )[1];

            }


            if (!documentData) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid document Base64 data."

                });

            }


            console.log(
                "📄 Starting ID Analyzer verification..."
            );

            console.log(
                "👤 Name:",
                expectedName
            );

            console.log(
                "🏫 College:",
                expectedCollege
            );

            console.log(
                "📅 Year:",
                expectedYear
            );


            // ==========================================
            // ID ANALYZER REQUEST
            // ==========================================

            const response =
                await axios.post(

                    "https://api2.idanalyzer.com/scan",

                    {

                        // IMPORTANT:
                        // ID Analyzer requires the field
                        // to be called "document".

                        document:
                            documentData,

                        // Use a suitable profile.
                        // security_none is useful when
                        // you mainly need document OCR.

                        profile:
                            "security_none",

                        // Verify the entered name
                        // against the document.

                        ...(expectedName
                            ? {
                                verifyName:
                                    expectedName
                            }
                            : {})

                    },

                    {

                        headers: {

                            "X-API-KEY":
                                ID_ANALYZER_KEY,

                            "Accept":
                                "application/json",

                            "Content-Type":
                                "application/json"

                        },

                        timeout:
                            60000

                    }

                );


            const data =
                response.data;


            console.log(
                "✅ ID Analyzer response received."
            );


            // ==========================================
            // CHECK RESPONSE
            // ==========================================

            if (!data) {

                return res.status(400).json({

                    success: false,

                    message:
                        "ID Analyzer returned an empty response."

                });

            }


            // ==========================================
            // EXTRACT OCR DATA
            // ==========================================

            let extractedText = "";


            if (data.data) {

                try {

                    extractedText =
                        JSON.stringify(
                            data.data
                        ).toLowerCase();

                } catch {

                    extractedText = "";

                }

            }


            // Also include response text so that
            // name/college matching can work even
            // if the response structure changes.

            const completeResponseText =
                JSON.stringify(
                    data
                ).toLowerCase();


            const searchableText =
                (
                    extractedText +
                    " " +
                    completeResponseText
                );


            // ==========================================
            // NAME CHECK
            // ==========================================

            let nameMatch = false;


            if (expectedName) {

                const name =
                    expectedName
                        .trim()
                        .toLowerCase();


                nameMatch =
                    searchableText.includes(
                        name
                    );

            }


            // ==========================================
            // COLLEGE CHECK
            // ==========================================

            let collegeMatch = false;


            if (expectedCollege) {

                const college =
                    expectedCollege
                        .trim()
                        .toLowerCase();


                collegeMatch =
                    searchableText.includes(
                        college
                    );

            }


            // ==========================================
            // YEAR CHECK
            // ==========================================

            let yearMatch = false;


            if (
                expectedYear &&
                /^[0-9]{4}$/.test(
                    expectedYear
                )
            ) {

                yearMatch =
                    searchableText.includes(
                        expectedYear
                    );

            }


            // ==========================================
            // SCORING
            // ==========================================

            let score = 0;


            if (nameMatch) {

                score += 50;

            }


            if (collegeMatch) {

                score += 30;

            }


            if (yearMatch) {

                score += 20;

            }


            // ==========================================
            // IF ID ANALYZER ITSELF REJECTED DOCUMENT
            // ==========================================

            if (
                data.success === false ||
                data.error
            ) {

                console.error(
                    "ID Analyzer Error:",
                    data
                );


                return res.status(400).json({

                    success: false,

                    message:
                        data.error?.message ||
                        data.message ||
                        "ID Analyzer could not process this document."

                });

            }


            // ==========================================
            // FINAL RESULT
            // ==========================================

            if (score >= 70) {

                return res.status(200).json({

                    success: true,

                    message:
                        "Document verified successfully.",

                    confidence:
                        "high",

                    score:
                        score,

                    nameMatch:
                        nameMatch,

                    collegeMatch:
                        collegeMatch,

                    yearMatch:
                        yearMatch

                });

            }


            if (score >= 40) {

                return res.status(200).json({

                    success: true,

                    message:
                        "Document accepted with medium confidence.",

                    confidence:
                        "medium",

                    score:
                        score,

                    nameMatch:
                        nameMatch,

                    collegeMatch:
                        collegeMatch,

                    yearMatch:
                        yearMatch

                });

            }


            return res.status(400).json({

                success: false,

                message:
                    "Document verification failed. Please make sure the document clearly shows your name and institution.",

                confidence:
                    "low",

                score:
                    score,

                nameMatch:
                    nameMatch,

                collegeMatch:
                    collegeMatch,

                yearMatch:
                    yearMatch

            });


        } catch (error) {

            console.error(
                "ID Analyzer verification error:"
            );


            console.error(
                error.response?.data ||
                error.message
            );


            const status =
                error.response?.status || 500;


            const apiError =
                error.response?.data;


            return res.status(status).json({

                success: false,

                message:
                    apiError?.message ||
                    apiError?.error ||
                    error.message ||
                    "Document verification server error."

            });

        }

    }
);


// ==========================================
// TEST ENDPOINT
// ==========================================

app.get(
    "/api/test",
    (req, res) => {

        res.json({

            success: true,

            message:
                "IntraWorld backend is running.",

            idAnalyzerConfigured:
                !!ID_ANALYZER_KEY

        });

    }
);


// ==========================================
// SERVER
// ==========================================

const PORT =
    process.env.PORT || 3000;


app.listen(
    PORT,
    () => {

        console.log(
            `IntraWorld server running on port ${PORT}`
        );

    }
);


module.exports = app;
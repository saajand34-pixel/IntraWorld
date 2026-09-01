/**
 * Standalone validation for IntraWorld Smart Document Scoring Engine
 */

// Import scoring functions directly
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
    return { years: yearMatches, dates: dateMatches, keywords: foundKeywords };
}

function scoreDocument({ expectedName, expectedCollege, expectedYear, extractedText, isBlurry = false, qualityPoints = 15 }) {
    const rawText = (extractedText || "").trim();
    const upperText = rawText.toUpperCase();
    const entities = parseOCREntities(rawText);

    // 1. Name Match (Max 40)
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

    // 2. College Match (Max 35)
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

    // 3. Document Quality (Max 15)
    const docQualityPoints = Math.min(15, Math.max(0, qualityPoints));

    // 4. Data Present (Max 10)
    let dataPoints = 0;
    const hasMatchingIdentity = namePoints > 0 || collegePoints > 12;

    if (hasMatchingIdentity) {
        const yearClean = (expectedYear || "").trim();
        if (yearClean && entities.years.includes(yearClean)) {
            dataPoints += 5;
        } else if (entities.years.length > 0 || entities.dates.length > 0) {
            dataPoints += 3;
        }

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

    let totalScore = namePoints + collegePoints + docQualityPoints + dataPoints;
    if (namePoints === 0 && (collegePoints === 0 || collegePoints <= 12)) {
        totalScore = 0;
    }
    totalScore = Math.min(100, Math.max(0, totalScore));

    let tier = "LOW";
    let decision = "REJECT";
    if (totalScore >= 70) {
        tier = "HIGH";
        decision = "ACCEPT";
    } else if (totalScore >= 40) {
        tier = "MEDIUM";
        decision = "ACCEPT_WITH_WARNING";
    }

    return {
        totalScore,
        tier,
        decision,
        breakdown: {
            nameMatch: { points: namePoints, max: 40, status: nameStatus },
            collegeFound: { points: collegePoints, max: 35, status: collegeStatus },
            documentQuality: { points: docQualityPoints, max: 15 },
            dataPresent: { points: dataPoints, max: 10 }
        }
    };
}

// ---------------- TEST CASES ----------------
console.log('--- 1. Real Clear Document ---');
const r1 = scoreDocument({
    expectedName: 'Alex Morgan',
    expectedCollege: 'Stanford University',
    expectedYear: '2026',
    extractedText: 'STANFORD UNIVERSITY OFFICIAL STUDENT IDENTIFICATION CARD NAME: ALEX MORGAN YEAR: 2026 ENROLLMENT VERIFIED',
    isBlurry: false,
    qualityPoints: 15
});
console.log(`Score: ${r1.totalScore}/100 | Tier: ${r1.tier} | Decision: ${r1.decision}`);
console.log('Breakdown:', r1.breakdown);

console.log('\n--- 2. Real Blurry Photo ---');
const r2 = scoreDocument({
    expectedName: 'Alex Morgan',
    expectedCollege: 'Stanford University',
    expectedYear: '2026',
    extractedText: 'STANFORD UNIVERSITY STUDENT CARD NAME: ALEX MORGAN YEAR: 2026',
    isBlurry: true,
    qualityPoints: 4
});
console.log(`Score: ${r2.totalScore}/100 | Tier: ${r2.tier} | Decision: ${r2.decision}`);
console.log('Breakdown:', r2.breakdown);

console.log('\n--- 3. Fake / Random Document ---');
const r3 = scoreDocument({
    expectedName: 'Alex Morgan',
    expectedCollege: 'Stanford University',
    expectedYear: '2026',
    extractedText: 'METRO ATHLETIC CLUB MEMBER: DAVID MILLER EXPIRES: 2018',
    isBlurry: false,
    qualityPoints: 12
});
console.log(`Score: ${r3.totalScore}/100 | Tier: ${r3.tier} | Decision: ${r3.decision}`);
console.log('Breakdown:', r3.breakdown);

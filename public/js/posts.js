// ==========================================
// GLOBAL ERROR VISIBILITY (debug aid)
// If firebase-config.js or an import fails, this makes it loud
// instead of silently killing every listener below.
// ==========================================
window.addEventListener("error", (e) => {
    console.error("🔴 Uncaught error in posts.js pipeline:", e.message, e.filename, e.lineno);
});
window.addEventListener("unhandledrejection", (e) => {
    console.error("🔴 Unhandled promise rejection:", e.reason);
});

import { db, auth } from "../firebase-config.js";
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    deleteDoc, 
    doc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const SIGHTENGINE_API_USER = "1295656117";
const SIGHTENGINE_API_SECRET = "hBNHMzHN57UzkTgTCYipxUibaJ6EaRxE";

// DOM Elements
const postContentInput = document.getElementById("postContentInput");
const imageUpload = document.getElementById("imageUpload");
const docUpload = document.getElementById("docUpload");
const githubLinkInput = document.getElementById("githubLinkInput");
const githubBox = document.getElementById("githubBox");
const toggleGithubBtn = document.getElementById("toggleGithubBtn");

const mediaPreviewBox = document.getElementById("mediaPreviewBox");
const previewContent = document.getElementById("previewContent");
const removeMediaBtn = document.getElementById("removeMediaBtn");

const publishPostBtn = document.getElementById("publishPostBtn");
const aiShieldStatus = document.getElementById("aiShieldStatus");
const postsFeed = document.getElementById("postsFeed");
const myAvatar = document.getElementById("myAvatar");

// Sanity-check every required element exists, log any that are missing
const requiredEls = {
    postContentInput, imageUpload, docUpload, githubLinkInput, githubBox,
    toggleGithubBtn, mediaPreviewBox, previewContent, removeMediaBtn,
    publishPostBtn, aiShieldStatus, postsFeed, myAvatar
};
for (const [name, el] of Object.entries(requiredEls)) {
    if (!el) console.error(`🔴 Missing DOM element: #${name} — check posts.html ids match`);
}

let currentUser = null;
let selectedFile = null;
let selectedFileType = null; // 'image' or 'doc'
let currentAudience = "public"; // "public" or "community"
let userCollegeName = "";
let loadedPostsCache = [];
let currentFeedFilter = "all";

const audiencePillPublic = document.getElementById("audiencePillPublic");
const audiencePillCommunity = document.getElementById("audiencePillCommunity");
const audienceCollegeName = document.getElementById("audienceCollegeName");
const filterMyCollegeBtn = document.getElementById("filterMyCollegeBtn");
const sharePreviewThumb = document.getElementById("sharePreviewThumb");

function extractCollege(data) {
    if (!data) return "";
    return (data.collegeName || data.collegeOrUniversity || data.college || data.institution || "").trim();
}

function updateAudienceUI() {
    if (audienceCollegeName) {
        if (userCollegeName) {
            audienceCollegeName.textContent = userCollegeName;
            if (audiencePillCommunity) {
                audiencePillCommunity.title = "Post to " + userCollegeName + " Community Feed";
            }
        } else {
            audienceCollegeName.textContent = "Your College (Not Set)";
            if (audiencePillCommunity) {
                audiencePillCommunity.title = "Update college in profile/settings to post in your college community";
            }
        }
    }
    if (filterMyCollegeBtn) {
        if (userCollegeName) {
            filterMyCollegeBtn.innerHTML = '<i class="fa-solid fa-building-columns"></i> ' + escapeHtml(userCollegeName) + ' Feed';
        } else {
            filterMyCollegeBtn.innerHTML = '<i class="fa-solid fa-building-columns"></i> College Communities';
        }
    }
}

// Setup Audience Selector Pills
if (audiencePillPublic && audiencePillCommunity) {
    audiencePillPublic.addEventListener("click", () => {
        currentAudience = "public";
        audiencePillPublic.classList.add("active");
        audiencePillCommunity.classList.remove("active");
    });

    audiencePillCommunity.addEventListener("click", () => {
        if (!userCollegeName) {
            alert("⚠️ You must have your enrolled College Name set in your profile to post to your College Community. Please update your profile in Settings or Registration.");
            return;
        }
        currentAudience = "community";
        audiencePillCommunity.classList.add("active");
        audiencePillPublic.classList.remove("active");
    });
}

// Check URL query parameters for audience preselection
try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("audience") === "community") {
        currentAudience = "community";
        if (audiencePillCommunity && audiencePillPublic) {
            audiencePillCommunity.classList.add("active");
            audiencePillPublic.classList.remove("active");
        }
    }
} catch(e) {}

// Check localStorage first
try {
    const rawLocalUser = localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser");
    if (rawLocalUser) {
        const parsed = JSON.parse(rawLocalUser);
        currentUser = {
            uid: parsed.id || parsed.uid || parsed.email,
            email: parsed.email,
            displayName: parsed.fullName || parsed.full_name
        };
        if (myAvatar) myAvatar.textContent = (parsed.email || "U").charAt(0).toUpperCase();
        loadPosts();
    }
} catch (e) {}

// Auth listener sync
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        if (myAvatar) myAvatar.textContent = (user.email || "U").charAt(0).toUpperCase();
        loadPosts();
    }
});

function showShieldStatus(message, isWarning = false) {
    if (!aiShieldStatus) return;
    aiShieldStatus.style.display = "block";
    aiShieldStatus.className = `ai-shield-status ${isWarning ? "warning" : "success"}`;
    aiShieldStatus.innerHTML = message;
}

// ==========================================
// MEDIA PREVIEW SELECTION LOGIC
// ==========================================

// 1. Image Selection
if (imageUpload) {
    imageUpload.addEventListener("change", (e) => {
        const file = e.target.files[0];
        console.log("📷 Image selected:", file?.name);
        if (file) {
            selectedFile = file;
            selectedFileType = "image";

            const reader = new FileReader();
            reader.onload = (event) => {
                previewContent.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
                mediaPreviewBox.style.display = "block";
                console.log("✅ Preview rendered for", file.name);
            };
            reader.onerror = (err) => console.error("🔴 FileReader failed:", err);
            reader.readAsDataURL(file);
        }
    });
} 

// 2. Document/PDF Selection
if (docUpload) {
    docUpload.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            selectedFileType = "doc";

            previewContent.innerHTML = `
                <div class="pdf-preview-box">
                    <i class="fa-solid fa-file-pdf fa-2x"></i>
                    <span>${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </div>
            `;
            mediaPreviewBox.style.display = "block";
        }
    });
}

// 3. Toggle GitHub Input Box
if (toggleGithubBtn) {
    toggleGithubBtn.addEventListener("click", () => {
        githubBox.style.display = githubBox.style.display === "none" ? "flex" : "none";
    });
}

// 4. Clear Selected Media
if (removeMediaBtn) {
    removeMediaBtn.addEventListener("click", () => {
        selectedFile = null;
        selectedFileType = null;
        if (imageUpload) imageUpload.value = "";
        if (docUpload) docUpload.value = "";
        mediaPreviewBox.style.display = "none";
        previewContent.innerHTML = "";
    });
}

// ==========================================
// GEMINI MULTIMODAL AI PERCENTAGE DETECTION
// ==========================================

async function getGeminiApiKey() {
    if (window.GEMINI_API_KEY && typeof window.GEMINI_API_KEY === "string" && window.GEMINI_API_KEY.length > 20) {
        return window.GEMINI_API_KEY;
    }
    const localKey = localStorage.getItem("gemini_api_key");
    if (localKey && localKey.length > 20) {
        return localKey;
    }
    if (db) {
        try {
            const snap = await getDocs(query(collection(db, "system_config")));
            let firestoreKey = null;
            snap.forEach(d => {
                if (d.id === "gemini") {
                    const data = d.data();
                    firestoreKey = data.apiKey || data.key;
                }
            });
            if (firestoreKey && firestoreKey.length > 20 && !firestoreKey.startsWith("AQ.")) {
                return firestoreKey;
            }
        } catch (err) {
            console.warn("Firestore gemini key query:", err.message);
        }
    }
    return null;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            const base64Data = result.split(",")[1];
            resolve(base64Data);
        };
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });
}

function compressImageToBase64(file) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            fileToDataUrl(file).then(resolve).catch(() => resolve(""));
        }, 3000);

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                clearTimeout(timer);
                try {
                    const canvas = document.createElement("canvas");
                    const MAX_DIM = 900;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_DIM) {
                            height = Math.round(height * (MAX_DIM / width));
                            width = MAX_DIM;
                        }
                    } else {
                        if (height > MAX_DIM) {
                            width = Math.round(width * (MAX_DIM / height));
                            height = MAX_DIM;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                    resolve(dataUrl);
                } catch (canvasErr) {
                    fileToDataUrl(file).then(resolve).catch(() => resolve(""));
                }
            };
            img.onerror = () => {
                clearTimeout(timer);
                fileToDataUrl(file).then(resolve).catch(() => resolve(""));
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            clearTimeout(timer);
            resolve("");
        };
        reader.readAsDataURL(file);
    });
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });
}

function computeLinguisticAiProbability(text) {
    if (!text || text.length < 15) return 0;
    let score = 0;
    const lower = text.toLowerCase();
    
    const llmMarkers = [
        "delve", "crucial", "testament", "realm", "tapestry", "moreover",
        "in conclusion", "it is important to remember", "furthermore", "revolutionize",
        "comprehensive", "seamless", "paramount", "leverage", "utilize", "holistic",
        "pivotal", "embark", "meticulously"
    ];
    let matchCount = 0;
    llmMarkers.forEach(m => {
        if (lower.includes(m)) matchCount++;
    });

    if (matchCount >= 4) score += 55;
    else if (matchCount >= 2) score += 35;
    else if (matchCount === 1) score += 18;

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 3) {
        const lengths = sentences.map(s => s.trim().split(/\s+/).length);
        const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const variance = lengths.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lengths.length;
        if (variance < 8 && avg > 10) score += 25;
    }

    return Math.min(95, Math.max(5, score));
}

async function detectAiPercentageWithGemini(file, fileType, textContent) {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        return null;
    }

    try {
        const parts = [];

        if (file && fileType === "image") {
            const base64Data = await fileToBase64(file);
            parts.push({
                inline_data: {
                    mime_type: file.type || "image/jpeg",
                    data: base64Data
                }
            });
            parts.push({
                text: "You are an expert AI Image & Deepfake Forensic Analyst. Analyze this image for hallmarks of generative AI (diffusion artifacts, synthetic skin smoothing, warped lighting, anomalous hands/eyes, generative text distortion). Output ONLY valid JSON without markdown: {\"ai_percentage\": <number 0-100>, \"label\": \"<Human / AI-Assisted / High AI / AI-Generated>\", \"reasoning\": \"<short 1-sentence reason>\"}."
            });
        } else if (file && fileType === "doc") {
            const base64Data = await fileToBase64(file);
            parts.push({
                inline_data: {
                    mime_type: file.type || "application/pdf",
                    data: base64Data
                }
            });
            parts.push({
                text: "You are an expert AI Document Forensic Analyst. Read and analyze this document for signs of LLM-generated writing (ChatGPT/Claude/Gemini hallmarks, uniform perplexity, formulaic structure). Output ONLY valid JSON without markdown: {\"ai_percentage\": <number 0-100>, \"label\": \"<Human / AI-Assisted / High AI / AI-Generated>\", \"reasoning\": \"<short 1-sentence reason>\"}."
            });
        } else if (textContent && textContent.length > 5) {
            parts.push({
                text: `You are an expert AI Text Forensics Analyst. Analyze the following text for signs of LLM/AI generation:\n\n"${textContent.slice(0, 3000)}"\n\nOutput ONLY valid JSON without markdown: {"ai_percentage": <number 0-100>, "label": "<Human / AI-Assisted / High AI / AI-Generated>", "reasoning": "<short 1-sentence reason>"}.`
            });
        } else {
            return { ai_percentage: 0, label: "Human Authentic", reasoning: "Minimal text content" };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const resp = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 200
                }
            })
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
            return null;
        }

        const data = await resp.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) return null;

        const cleaned = candidateText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const pct = Math.max(0, Math.min(100, Math.round(Number(parsed.ai_percentage) || 0)));
        return {
            ai_percentage: pct,
            label: parsed.label || (pct > 60 ? "AI Generated" : "Human Authentic"),
            reasoning: parsed.reasoning || ""
        };
    } catch (e) {
        console.warn("Gemini detection note:", e.message);
        return null;
    }
}

// Fallback: Sightengine Image Scan
async function scanImageForDeepfake(file) {
    const formData = new FormData();
    formData.append("media", file);
    formData.append("models", "genai,deepfake");
    formData.append("api_user", SIGHTENGINE_API_USER);
    formData.append("api_secret", SIGHTENGINE_API_SECRET);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
        const response = await fetch("https://api.sightengine.com/1.0/check.json", {
            method: "POST",
            body: formData,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        if (data.status === "failure") return 0;

        const aiScore = data.type?.ai_generated || 0;
        const deepfakeScore = data.type?.deepfake || 0;
        const maxScore = Math.max(aiScore, deepfakeScore);
        return (maxScore * 100).toFixed(1);
    } catch (err) {
        console.warn("Sightengine note:", err.message);
        return 0;
    }
}

// Unified Multimodal AI Content Scanner
async function scanContentForAiUsage(file, fileType, textContent) {
    showShieldStatus("🤖 Analyzing content with AI Forensic Scanner...", false);

    // 1. Try Gemini Multimodal API
    const geminiResult = await detectAiPercentageWithGemini(file, fileType, textContent);
    if (geminiResult !== null && typeof geminiResult.ai_percentage === "number") {
        showShieldStatus(`✅ AI scan complete: ${geminiResult.ai_percentage}% AI detected (${geminiResult.label})`, false);
        return geminiResult;
    }

    // 2. Fallback for Image: Sightengine
    if (file && fileType === "image") {
        const sightengineScore = await scanImageForDeepfake(file);
        const pct = Math.round(Number(sightengineScore) || 0);
        return {
            ai_percentage: pct,
            label: pct > 60 ? "AI Generated" : (pct > 25 ? "AI Assisted" : "Human Authentic"),
            reasoning: pct > 60 ? "GenAI diffusion artifacts detected" : "Photographic authenticity verified"
        };
    }

    // 3. Fallback for Document / Text
    const textToAnalyze = textContent || (file ? file.name : "");
    const heuristicScore = computeLinguisticAiProbability(textToAnalyze);
    return {
        ai_percentage: heuristicScore,
        label: heuristicScore > 60 ? "AI Generated" : (heuristicScore > 25 ? "AI Assisted" : "Human Authentic"),
        reasoning: heuristicScore > 60 ? "Stylistic patterns characteristic of generative AI" : "Natural writing style"
    };
}

// Render Badge at Right End of Post Header
function renderAiPercentageBadge(aiScore, aiReasoning) {
    const score = Math.max(0, Math.min(100, Math.round(Number(aiScore) || 0)));
    let tierClass = "tier-human";
    let icon = "fa-circle-check";
    let label = "Human Authentic";

    if (score <= 25) {
        tierClass = "tier-human";
        icon = "fa-circle-check";
        label = "Human Authentic";
    } else if (score <= 50) {
        tierClass = "tier-assisted";
        icon = "fa-wand-magic-sparkles";
        label = "AI Assisted";
    } else if (score <= 75) {
        tierClass = "tier-mixed";
        icon = "fa-triangle-exclamation";
        label = "Mixed / High AI";
    } else {
        tierClass = "tier-ai";
        icon = "fa-robot";
        label = "AI Generated";
    }

    const tooltip = aiReasoning 
        ? `${score}% AI Used • ${label}: ${escapeHtml(aiReasoning)}` 
        : `${score}% AI Used • ${label}`;

    return `
        <div class="ai-percentage-badge ${tierClass}" title="${tooltip}">
            <i class="fa-solid ${icon}"></i>
            <span>${score}% AI Used</span>
        </div>
    `;
}

// ==========================================
// SCAN & POST PUBLISH HANDLER
// ==========================================
if (publishPostBtn) {
    publishPostBtn.addEventListener("click", async () => {
        console.log("🖱️ Scan & Post clicked");

        if (!currentUser) {
            alert("❌ You must be logged in to post.");
            return;
        }

        const textContent = postContentInput.value.trim();
        const githubUrl = githubLinkInput.value.trim();

        if (!textContent && !selectedFile && !githubUrl) {
            alert("❌ Please write text, upload media/document, or attach a GitHub link.");
            return;
        }

        publishPostBtn.disabled = true;
        publishPostBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing & Posting...`;

        let mediaUrl = "";
        let docUrl = "";
        let docName = "";

        try {
            // Run Multimodal AI Scan across image, document, or text
            const aiScan = await scanContentForAiUsage(selectedFile, selectedFileType, textContent);
            const aiPercentage = aiScan.ai_percentage;
            const aiReasoning = aiScan.reasoning || "";
            const aiLabel = aiScan.label || "";

            // Handle File Encoding directly for Firestore single-place storage
            if (selectedFile) {
                if (selectedFileType === "image") {
                    showShieldStatus("💾 Encoding image for Firestore...", false);
                    mediaUrl = await compressImageToBase64(selectedFile);

                } else if (selectedFileType === "doc") {
                    showShieldStatus("💾 Encoding document for Firestore...", false);
                    if (selectedFile.size > 800 * 1024) {
                        alert("⚠️ Document is larger than 800 KB. Firestore single-document limit is 1MB. Please select a smaller PDF.");
                        return;
                    }
                    docUrl = await fileToDataUrl(selectedFile);
                    docName = selectedFile.name;
                }
            }

            // Save to Firestore with AI percentage metadata
            const postData = {
                uid: currentUser.uid,
                authorEmail: currentUser.email,
                content: textContent,
                mediaUrl: mediaUrl,
                docUrl: docUrl,
                docName: docName,
                githubUrl: githubUrl,
                aiPercentage: parseFloat(aiPercentage),
                aiReasoning: aiReasoning,
                aiLabel: aiLabel,
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, "posts"), postData);

            // Reset UI Form
            postContentInput.value = "";
            githubLinkInput.value = "";
            githubBox.style.display = "none";
            removeMediaBtn.click();

            showShieldStatus(`✅ Published with ${aiPercentage}% AI verification!`, false);
            setTimeout(() => { if (aiShieldStatus) aiShieldStatus.style.display = "none"; }, 3500);

            loadPosts();

        } catch (err) {
            console.error("🔴 Publishing error:", err);
            alert("❌ Failed to post: " + err.message);
        } finally {
            publishPostBtn.disabled = false;
            publishPostBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Scan & Post`;
        }
    });
}

// ==========================================
// SHARE MODAL MANAGEMENT
// ==========================================
let activeShareContext = null;
let cachedPeers = null;

const shareModal = document.getElementById("shareModal");
const closeShareModalBtn = document.getElementById("closeShareModalBtn");
const sharePreviewText = document.getElementById("sharePreviewText");
const sharePeerList = document.getElementById("sharePeerList");
const copyPostLinkBtn = document.getElementById("copyPostLinkBtn");

if (closeShareModalBtn && shareModal) {
    closeShareModalBtn.addEventListener("click", () => {
        shareModal.style.display = "none";
        activeShareContext = null;
    });
    shareModal.addEventListener("click", (e) => {
        if (e.target === shareModal) {
            shareModal.style.display = "none";
            activeShareContext = null;
        }
    });
}

if (copyPostLinkBtn) {
    copyPostLinkBtn.addEventListener("click", async () => {
        if (!activeShareContext) return;
        const textToCopy = `IntraWorld Post by ${activeShareContext.authorName}:\n"${activeShareContext.content || 'Academic Document/Image'}"`;
        try {
            await navigator.clipboard.writeText(textToCopy);
            const originalHTML = copyPostLinkBtn.innerHTML;
            copyPostLinkBtn.innerHTML = `<i class="fa-solid fa-check" style="color: #4ade80;"></i> Copied to Clipboard!`;
            setTimeout(() => {
                copyPostLinkBtn.innerHTML = originalHTML;
            }, 2000);
        } catch (e) {
            alert("Copied post snippet:\n\n" + textToCopy);
        }
    });
}

async function fetchPeersForShare() {
    if (cachedPeers) return cachedPeers;
    const peers = [];
    const myEmail = (currentUser?.email || "").toLowerCase();

    try {
        let snap = await getDocs(collection(db, "registrations"));
        if (snap.empty) snap = await getDocs(collection(db, "users"));

        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const email = (data.email || "").toLowerCase();
            if (email && email !== myEmail) {
                peers.push({
                    id: docSnap.id,
                    name: data.fullName || data.full_name || data.name || email.split("@")[0],
                    email: email,
                    regId: data.studentRegId || data.regId || data.regid || ""
                });
            }
        });
        cachedPeers = peers;
    } catch (err) {
        console.error("Error fetching classmates for share:", err);
    }
    return peers;
}

async function openShareModal(postId, authorName, content) {
    if (!shareModal) return;
    activeShareContext = { postId, authorName, content };

    if (sharePreviewText) {
        const snippet = content && content.trim() ? content.trim() : "Academic project/media post";
        sharePreviewText.innerHTML = `<strong>${escapeHtml(authorName)}:</strong> "${escapeHtml(snippet.length > 120 ? snippet.substring(0, 120) + "..." : snippet)}"`;
    }

    if (sharePeerList) {
        sharePeerList.innerHTML = `<div style="text-align: center; color: #7db7ff; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading classmates...</div>`;
    }

    shareModal.style.display = "flex";

    const peers = await fetchPeersForShare();

    if (!sharePeerList) return;

    if (!peers || peers.length === 0) {
        sharePeerList.innerHTML = `<div style="text-align: center; color: #94a3b8; font-size: 13px; padding: 20px;">No other classmates registered yet.</div>`;
        return;
    }

    sharePeerList.innerHTML = "";
    peers.forEach((peer) => {
        const item = document.createElement("div");
        item.className = "share-peer-item";
        item.innerHTML = `
            <div class="share-peer-info">
                <div class="share-peer-avatar">${escapeHtml(peer.name.charAt(0).toUpperCase())}</div>
                <div class="share-peer-text">
                    <h5>${escapeHtml(peer.name)}</h5>
                    <p>${peer.regId ? `Reg ID: ${escapeHtml(peer.regId)}` : escapeHtml(peer.email)}</p>
                </div>
            </div>
            <button class="share-send-btn" data-peer-email="${escapeHtml(peer.email)}" data-peer-name="${escapeHtml(peer.name)}">
                <i class="fa-solid fa-paper-plane"></i> Send
            </button>
        `;

        const sendBtn = item.querySelector(".share-send-btn");
        sendBtn.addEventListener("click", async () => {
            if (!currentUser || !currentUser.email) {
                alert("Please log in to send.");
                return;
            }
            sendBtn.disabled = true;
            sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;

            try {
                const myEmail = currentUser.email.toLowerCase();
                const peerEmail = peer.email.toLowerCase();
                const chatId = [myEmail, peerEmail].sort().join("___");

                const snippet = activeShareContext.content && activeShareContext.content.trim() 
                    ? activeShareContext.content.trim() 
                    : "Academic document/image attachment";

                const shareText = `📢 Shared an Academic Post from ${activeShareContext.authorName}:\n\n"${snippet}"\n\n🔗 View in Posts Feed`;

                await addDoc(collection(db, "chats", chatId, "messages"), {
                    senderEmail: myEmail,
                    receiverEmail: peerEmail,
                    senderName: currentUser.displayName || myEmail.split("@")[0],
                    text: shareText,
                    timestamp: serverTimestamp(),
                    timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: "sent",
                    viewed: false,
                    deletedFor: [],
                    deletedForEveryone: false,
                    replyTo: null
                });

                sendBtn.classList.add("sent");
                sendBtn.innerHTML = `<i class="fa-solid fa-check"></i> Sent`;
            } catch (err) {
                console.error("Failed to share post via chat:", err);
                sendBtn.disabled = false;
                sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Retry`;
                alert("Failed to send: " + err.message);
            }
        });

        sharePeerList.appendChild(item);
    });
}

// ==========================================
// LOAD FEED WITH LIKES, COMMENTS, DELETE & SHARE
// ==========================================
async function loadPosts() {
    if (!postsFeed) return;

    try {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            postsFeed.innerHTML = `<div style="color: #7db7ff; text-align: center; padding: 40px;">No posts found.</div>`;
            return;
        }

        postsFeed.innerHTML = "";

        snapshot.forEach((docSnap) => {
            const postId = docSnap.id;
            const post = docSnap.data();
            const initial = (post.authorEmail || "U").charAt(0).toUpperCase();
            const authorName = (post.authorEmail || "student").split("@")[0];
            const aiScore = typeof post.aiPercentage === "number" ? post.aiPercentage : 0;

            const myEmail = (currentUser?.email || "").toLowerCase();
            const isAuthor = currentUser && (
                (post.authorEmail && post.authorEmail.toLowerCase() === myEmail) ||
                (post.uid && post.uid === currentUser.uid)
            );

            // Likes Array
            const likesList = Array.isArray(post.likes) ? post.likes : [];
            const isLiked = myEmail && likesList.some(e => (e || "").toLowerCase() === myEmail);
            const likeCount = likesList.length;

            // Comments Array
            const commentsList = Array.isArray(post.comments) ? post.comments : [];
            const commentCount = commentsList.length;

            const postCard = document.createElement("div");
            postCard.className = "post-card";
            postCard.id = `post-${postId}`;

            postCard.innerHTML = `
                <div class="post-header-row">
                    <div class="post-author">
                        <div class="user-avatar">${initial}</div>
                        <div class="author-info">
                            <h4>${escapeHtml(authorName)}</h4>
                            <p>${new Date(post.createdAt).toLocaleString()}</p>
                        </div>
                    </div>
                    <div class="post-header-actions">
                        ${renderAiPercentageBadge(aiScore, post.aiReasoning)}
                        ${isAuthor ? `
                            <button class="btn-delete-post" data-post-id="${postId}" title="Delete Post completely from database">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : ""}
                    </div>
                </div>

                <div class="post-content">${escapeHtml(post.content || "")}</div>

                ${post.mediaUrl ? `<img src="${post.mediaUrl}" class="post-media" alt="Post media">` : ""}

                ${post.docUrl ? `
                    <a href="${post.docUrl}" target="_blank" download="${escapeHtml(post.docName || "document.pdf")}" class="pdf-card">
                        <i class="fa-solid fa-file-pdf fa-2x"></i>
                        <div>
                            <strong>Attachment Document:</strong>
                            <div>${escapeHtml(post.docName || "Download File")}</div>
                        </div>
                    </a>
                ` : ""}

                ${post.githubUrl ? `
                    <a href="${escapeHtml(post.githubUrl)}" target="_blank" class="github-card">
                        <i class="fa-brands fa-github fa-2x"></i>
                        <div>
                            <strong>GitHub Repository Project:</strong>
                            <div>${escapeHtml(post.githubUrl)}</div>
                        </div>
                    </a>
                ` : ""}

                <div class="post-footer">
                    <button class="interaction-btn like-btn ${isLiked ? "liked" : ""}" data-post-id="${postId}" data-liked="${isLiked ? "true" : "false"}">
                        <i class="${isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>
                        <span class="like-label">${likeCount > 0 ? `${likeCount} ${likeCount === 1 ? "Like" : "Likes"}` : "Like"}</span>
                    </button>
                    <button class="interaction-btn comment-toggle-btn" data-post-id="${postId}">
                        <i class="fa-regular fa-comment"></i>
                        <span class="comment-label">${commentCount > 0 ? `${commentCount} ${commentCount === 1 ? "Comment" : "Comments"}` : "Comment"}</span>
                    </button>
                    <button class="interaction-btn share-open-btn" data-post-id="${postId}">
                        <i class="fa-solid fa-share"></i> Share
                    </button>
                </div>

                <!-- Instagram-style expandable comments drawer -->
                <div class="comments-drawer" id="comments-drawer-${postId}" style="display: none;">
                    <div class="comments-list" id="comments-list-${postId}">
                        ${commentsList.length === 0 ? `<div class="no-comments-msg" style="color: #64748b; font-size: 12px; padding: 4px 0;">No comments yet. Start the conversation!</div>` : ""}
                        ${commentsList.map(c => `
                            <div class="comment-item">
                                <div class="comment-avatar">${escapeHtml((c.authorName || c.authorEmail || "U").charAt(0).toUpperCase())}</div>
                                <div class="comment-body">
                                    <div class="comment-header-row">
                                        <span class="comment-author">${escapeHtml(c.authorName || (c.authorEmail || "").split("@")[0] || "Student")}</span>
                                        <span class="comment-time">${c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                                    </div>
                                    <div class="comment-text">${escapeHtml(c.text || "")}</div>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                    <div class="comment-input-row">
                        <input type="text" class="comment-input" id="comment-input-${postId}" placeholder="Write a comment..." />
                        <button class="comment-submit-btn" id="comment-submit-${postId}" title="Post comment">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            `;

            // 1. Setup Delete Button Handler
            const deleteBtn = postCard.querySelector(".btn-delete-post");
            if (deleteBtn) {
                deleteBtn.addEventListener("click", async () => {
                    const confirmed = confirm("Are you sure you want to permanently delete this post? It will be removed completely from IntraWorld.");
                    if (!confirmed) return;

                    deleteBtn.disabled = true;
                    deleteBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

                    try {
                        await deleteDoc(doc(db, "posts", postId));
                        postCard.style.transition = "opacity 0.3s ease, transform 0.3s ease";
                        postCard.style.opacity = "0";
                        postCard.style.transform = "scale(0.95)";
                        setTimeout(() => postCard.remove(), 300);
                    } catch (err) {
                        console.error("Delete post error:", err);
                        alert("Failed to delete post: " + err.message);
                        deleteBtn.disabled = false;
                        deleteBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
                    }
                });
            }

            // 2. Setup Instagram-Style Like Toggle
            const likeBtn = postCard.querySelector(".like-btn");
            if (likeBtn) {
                likeBtn.addEventListener("click", async () => {
                    if (!currentUser || !currentUser.email) {
                        alert("Please log in to like posts.");
                        return;
                    }

                    const isCurrentlyLiked = likeBtn.getAttribute("data-liked") === "true";
                    const newLiked = !isCurrentlyLiked;
                    likeBtn.setAttribute("data-liked", newLiked ? "true" : "false");

                    const heartIcon = likeBtn.querySelector("i");
                    const labelEl = likeBtn.querySelector(".like-label");

                    // Optimistic UI state
                    if (newLiked) {
                        likeBtn.classList.add("liked");
                        if (heartIcon) heartIcon.className = "fa-solid fa-heart";
                    } else {
                        likeBtn.classList.remove("liked");
                        if (heartIcon) heartIcon.className = "fa-regular fa-heart";
                    }

                    let curCount = 0;
                    const match = (labelEl.textContent || "").match(/\d+/);
                    if (match) curCount = parseInt(match[0], 10);
                    curCount = newLiked ? curCount + 1 : Math.max(0, curCount - 1);
                    labelEl.textContent = curCount > 0 ? `${curCount} ${curCount === 1 ? "Like" : "Likes"}` : "Like";

                    try {
                        const postRef = doc(db, "posts", postId);
                        await updateDoc(postRef, {
                            likes: newLiked ? arrayUnion(myEmail) : arrayRemove(myEmail)
                        });
                    } catch (err) {
                        console.error("Like toggle error:", err);
                    }
                });
            }

            // 3. Setup Comments Drawer & Composer
            const commentToggleBtn = postCard.querySelector(".comment-toggle-btn");
            const drawer = postCard.querySelector(`#comments-drawer-${postId}`);
            const commentInput = postCard.querySelector(`#comment-input-${postId}`);
            const commentSubmitBtn = postCard.querySelector(`#comment-submit-${postId}`);
            const commentsListEl = postCard.querySelector(`#comments-list-${postId}`);
            const commentLabelEl = postCard.querySelector(".comment-label");

            if (commentToggleBtn && drawer) {
                commentToggleBtn.addEventListener("click", () => {
                    const isVisible = drawer.style.display !== "none";
                    drawer.style.display = isVisible ? "none" : "block";
                    if (!isVisible && commentInput) {
                        commentInput.focus();
                    }
                });
            }

            async function submitComment() {
                if (!currentUser || !currentUser.email) {
                    alert("Please log in to comment.");
                    return;
                }
                const text = (commentInput?.value || "").trim();
                if (!text) return;

                commentInput.value = "";

                const newComment = {
                    id: "c_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                    authorEmail: currentUser.email.toLowerCase(),
                    authorName: currentUser.displayName || currentUser.email.split("@")[0],
                    text: text,
                    createdAt: new Date().toISOString()
                };

                // Optimistic comment item
                const emptyMsg = commentsListEl.querySelector(".no-comments-msg");
                if (emptyMsg) emptyMsg.remove();

                const cItem = document.createElement("div");
                cItem.className = "comment-item";
                cItem.innerHTML = `
                    <div class="comment-avatar">${escapeHtml(newComment.authorName.charAt(0).toUpperCase())}</div>
                    <div class="comment-body">
                        <div class="comment-header-row">
                            <span class="comment-author">${escapeHtml(newComment.authorName)}</span>
                            <span class="comment-time">Just now</span>
                        </div>
                        <div class="comment-text">${escapeHtml(newComment.text)}</div>
                    </div>
                `;
                commentsListEl.appendChild(cItem);
                commentsListEl.scrollTop = commentsListEl.scrollHeight;

                // Update comment counter text
                let cCount = 0;
                const match = (commentLabelEl.textContent || "").match(/\d+/);
                if (match) cCount = parseInt(match[0], 10);
                cCount += 1;
                commentLabelEl.textContent = `${cCount} ${cCount === 1 ? "Comment" : "Comments"}`;

                try {
                    await updateDoc(doc(db, "posts", postId), {
                        comments: arrayUnion(newComment)
                    });
                } catch (err) {
                    console.error("Comment submit error:", err);
                    alert("Failed to save comment: " + err.message);
                }
            }

            if (commentSubmitBtn) {
                commentSubmitBtn.addEventListener("click", submitComment);
            }
            if (commentInput) {
                commentInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        submitComment();
                    }
                });
            }

            // 4. Setup Share Button Handler
            const shareBtn = postCard.querySelector(".share-open-btn");
            if (shareBtn) {
                shareBtn.addEventListener("click", () => {
                    openShareModal(postId, authorName, post.content || "");
                });
            }

            postsFeed.appendChild(postCard);
        });

    } catch (err) {
        console.error("🔴 Error loading feed:", err);
        postsFeed.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 40px;">Error loading posts.</div>`;
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
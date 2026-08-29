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

import { db, auth, storage } from "../firebase-config.js";
import { collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

console.log("✅ posts.js module loaded. storage import:", storage ? "OK" : "❌ MISSING/UNDEFINED — check firebase-config.js exports 'storage'");

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

// Auth Check
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        if (myAvatar) myAvatar.textContent = (user.email || "U").charAt(0).toUpperCase();
        loadPosts();
    } else {
        window.location.href = "index.html";
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
// DEEPFAKE SCAN (IMAGE ONLY)
// ==========================================
async function scanImageForDeepfake(file) {
    showShieldStatus("🔍 Scanning image with AI Shield for Deepfakes...", false);

    const formData = new FormData();
    formData.append("media", file);
    formData.append("models", "genai,deepfake");
    formData.append("api_user", SIGHTENGINE_API_USER);
    formData.append("api_secret", SIGHTENGINE_API_SECRET);

    try {
        const response = await fetch("https://api.sightengine.com/1.0/check.json", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        console.log("Sightengine API Response:", data);

        if (data.status === "failure") {
            console.warn("Sightengine Error:", data.error?.message);
            showShieldStatus(`⚠️ AI Shield scan failed: ${data.error?.message || "unknown error"}. Posting without verification.`, true);
            return 0;
        }

        const aiScore = data.type?.ai_generated || 0;
        const deepfakeScore = data.type?.deepfake || 0;

        const maxScore = Math.max(aiScore, deepfakeScore);
        return (maxScore * 100).toFixed(1);

    } catch (err) {
        console.error("🔴 Deepfake API exception (check CSP connect-src allows api.sightengine.com):", err);
        showShieldStatus("⚠️ Could not reach AI Shield (network/CSP issue). Posting without verification.", true);
        return 0;
    }
}

// ==========================================
// SCAN & POST PUBLISH HANDLER
// ==========================================
if (publishPostBtn) {
    publishPostBtn.addEventListener("click", async () => {
        console.log("🖱️ Scan & Post clicked");

        if (!currentUser) {
            alert("❌ You must be logged in to post.");
            console.error("🔴 publishPostBtn clicked but currentUser is null — auth listener may not have fired yet.");
            return;
        }

        const textContent = postContentInput.value.trim();
        const githubUrl = githubLinkInput.value.trim();

        if (!textContent && !selectedFile && !githubUrl) {
            alert("❌ Please write text, upload media/document, or attach a GitHub link.");
            return;
        }

        publishPostBtn.disabled = true;
        publishPostBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;

        let mediaUrl = "";
        let docUrl = "";
        let docName = "";
        let aiPercentage = 0;

        try {
            // Handle File Uploads
            if (selectedFile) {
                if (!storage) {
                    throw new Error("Firebase Storage is not initialized (check firebase-config.js exports 'storage').");
                }

                if (selectedFileType === "image") {
                    // Scan deepfake FIRST, before upload — matches "verify then post"
                    aiPercentage = await scanImageForDeepfake(selectedFile);

                    // Upload to Firebase Storage
                    showShieldStatus("📤 Uploading image to storage...", false);
                    const storageRef = ref(storage, `posts/images/${Date.now()}_${selectedFile.name}`);
                    const snapshot = await uploadBytes(storageRef, selectedFile);
                    mediaUrl = await getDownloadURL(snapshot.ref);

                } else if (selectedFileType === "doc") {
                    showShieldStatus("📤 Uploading document to storage...", false);
                    const storageRef = ref(storage, `posts/docs/${Date.now()}_${selectedFile.name}`);
                    const snapshot = await uploadBytes(storageRef, selectedFile);
                    docUrl = await getDownloadURL(snapshot.ref);
                    docName = selectedFile.name;
                }
            }

            // Save to Firestore
            const postData = {
                uid: currentUser.uid,
                authorEmail: currentUser.email,
                content: textContent,
                mediaUrl: mediaUrl,
                docUrl: docUrl,
                docName: docName,
                githubUrl: githubUrl,
                aiPercentage: parseFloat(aiPercentage),
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, "posts"), postData);

            // Reset UI Form
            postContentInput.value = "";
            githubLinkInput.value = "";
            githubBox.style.display = "none";
            removeMediaBtn.click();

            showShieldStatus("✅ Post published successfully!", false);
            setTimeout(() => { if (aiShieldStatus) aiShieldStatus.style.display = "none"; }, 3000);

            loadPosts();

        } catch (err) {
            console.error("🔴 Publishing error:", err);
            alert("❌ Failed to post: " + err.message);
        } finally {
            publishPostBtn.disabled = false;
            publishPostBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Scan & Post`;
        }
    });
} else {
    console.error("🔴 #publishPostBtn not found — Scan & Post button will never respond.");
}

// ==========================================
// LOAD FEED
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
            const post = docSnap.data();
            const initial = (post.authorEmail || "U").charAt(0).toUpperCase();
            const aiScore = post.aiPercentage || 0;

            // Tagline badge visible to every viewer of the post, not just the poster.
            let badgeIcon = "fa-circle-check", badgeColor = "#22c55e", veracityText = `Verified Real News (${aiScore}% AI detected)`;

            if (aiScore >= 30 && aiScore < 60) {
                badgeIcon = "fa-circle-exclamation"; badgeColor = "#f59e0b"; veracityText = `Mixed / Edited Media (${aiScore}% AI detected)`;
            } else if (aiScore >= 60) {
                badgeIcon = "fa-triangle-exclamation"; badgeColor = "#ef4444"; veracityText = `AI / False News Detected (${aiScore}% AI generated)`;
            }

            const postHTML = `
                <div class="post-card">
                    <div class="post-author">
                        <div class="user-avatar">${initial}</div>
                        <div class="author-info">
                            <h4>${post.authorEmail.split("@")[0]}</h4>
                            <p>${new Date(post.createdAt).toLocaleString()}</p>
                        </div>
                    </div>

                    ${post.mediaUrl ? `
                        <div class="deepfake-verified-badge" style="color: ${badgeColor}; border-color: ${badgeColor}; background: rgba(0, 0, 0, 0.2);">
                            <i class="fa-solid ${badgeIcon}"></i> ${veracityText}
                        </div>
                    ` : ""}

                    <div class="post-content">${post.content}</div>

                    ${post.mediaUrl ? `<img src="${post.mediaUrl}" class="post-media" alt="Post media">` : ""}

                    ${post.docUrl ? `
                        <a href="${post.docUrl}" target="_blank" class="pdf-card">
                            <i class="fa-solid fa-file-pdf fa-2x"></i>
                            <div>
                                <strong>Attachment Document:</strong>
                                <div>${post.docName || "Download File"}</div>
                            </div>
                        </a>
                    ` : ""}

                    ${post.githubUrl ? `
                        <a href="${post.githubUrl}" target="_blank" class="github-card">
                            <i class="fa-brands fa-github fa-2x"></i>
                            <div>
                                <strong>GitHub Repository Project:</strong>
                                <div>${post.githubUrl}</div>
                            </div>
                        </a>
                    ` : ""}

                    <div class="post-footer">
                        <button class="interaction-btn"><i class="fa-regular fa-thumbs-up"></i> Like</button>
                        <button class="interaction-btn"><i class="fa-regular fa-comment"></i> Comment</button>
                        <button class="interaction-btn"><i class="fa-solid fa-share"></i> Share</button>
                    </div>
                </div>
            `;

            postsFeed.innerHTML += postHTML;
        });

    } catch (err) {
        console.error("🔴 Error loading feed:", err);
        postsFeed.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 40px;">Error loading posts.</div>`;
    }
}
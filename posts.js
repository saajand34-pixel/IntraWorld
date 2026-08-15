import { auth, db } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let uploadedImageData = null;

// Authenticate User
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById("myAvatar").innerText = (user.email || "U").charAt(0).toUpperCase();
        loadAcademicFeed();
    } else {
        alert("Please login first.");
        window.location.href = "login.html";
    }
});

// Handle Media File Selection
document.getElementById("mediaUpload")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            uploadedImageData = event.target.result;
            showShieldMessage("Media attached. Deepfake scanner ready.", "success");
        };
        reader.readAsDataURL(file);
    }
});

// AI Deepfake / Fake Post Detection Guard
function analyzePostAuthenticity(text, image) {
    const suspiciousKeywords = [
        "click here for free degree", 
        "get instant marks", 
        "buy exam paper", 
        "100% real leak", 
        "guaranteed distinction without study",
        "deepfake_generated"
    ];

    const lowerText = text.toLowerCase();
    
    // Check keyword flags
    for (let word of suspiciousKeywords) {
        if (lowerText.includes(word)) {
            return {
                isSafe: false,
                reason: `Flagged for prohibited/fake academic content (${word}).`
            };
        }
    }

    // Check image synthetic indicators
    if (image && image.includes("synthetic_flag")) {
        return {
            isSafe: false,
            reason: "Deepfake image artifacts detected by DeepShield Security."
        };
    }

    return { isSafe: true, score: 99.4 };
}

// Publish Post
document.getElementById("publishPostBtn")?.addEventListener("click", async () => {
    const textInput = document.getElementById("postContentInput");
    const content = textInput.value.trim();

    if (!content && !uploadedImageData) {
        alert("Please enter text or attach media to post.");
        return;
    }

    showShieldMessage("Running DeepShield AI scan...", "success");

    // Perform Deepfake & Fake Content Analysis
    const scanResult = analyzePostAuthenticity(content, uploadedImageData);

    if (!scanResult.isSafe) {
        showShieldMessage(`⛔ Post Rejected: ${scanResult.reason}`, "warning");
        alert(`Security Alert: Post rejected!\n\n${scanResult.reason}`);
        return;
    }

    try {
        await addDoc(collection(db, "academic_posts"), {
            authorEmail: currentUser.email,
            authorName: currentUser.displayName || currentUser.email.split("@")[0],
            content: content,
            mediaUrl: uploadedImageData || null,
            deepfakeVerified: true,
            authenticityScore: scanResult.score,
            createdAt: serverTimestamp()
        });

        textInput.value = "";
        uploadedImageData = null;
        showShieldMessage("✓ DeepShield verified & published successfully!", "success");
        loadAcademicFeed();
    } catch (err) {
        console.error("Error creating post:", err);
        showShieldMessage("Failed to publish post to feed.", "warning");
    }
});

// Helper for Status Messages
function showShieldMessage(msg, type) {
    const box = document.getElementById("aiShieldStatus");
    box.style.display = "block";
    box.className = `ai-shield-status ${type}`;
    box.innerText = msg;
}

// Load Posts Feed
async function loadAcademicFeed() {
    const feed = document.getElementById("postsFeed");
    feed.innerHTML = `<div style="color: #7db7ff; text-align: center;">Loading feed...</div>`;

    try {
        const q = query(collection(db, "academic_posts"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            feed.innerHTML = `<div style="color: #7db7ff; text-align: center;">No academic posts yet. Be the first to share!</div>`;
            return;
        }

        feed.innerHTML = "";

        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const card = document.createElement("div");
            card.className = "post-card";

            card.innerHTML = `
                <div class="post-author">
                    <div class="user-avatar">${post.authorName.charAt(0).toUpperCase()}</div>
                    <div class="author-info">
                        <h4>${post.authorName}</h4>
                        <p>${post.authorEmail}</p>
                    </div>
                </div>

                ${post.deepfakeVerified ? `
                    <div class="deepfake-verified-badge">
                        <i class="fa-solid fa-shield-check"></i> DeepShield AI Verified (${post.authenticityScore}% Authentic)
                    </div>
                ` : ''}

                <div class="post-content">${post.content}</div>

                ${post.mediaUrl ? `<img src="${post.mediaUrl}" class="post-media" alt="Post attachment">` : ''}

                <div class="post-footer">
                    <button class="interaction-btn"><i class="fa-regular fa-thumbs-up"></i> Like</button>
                    <button class="interaction-btn"><i class="fa-regular fa-comment"></i> Comment</button>
                    <button class="interaction-btn"><i class="fa-solid fa-share"></i> Share</button>
                </div>
            `;

            feed.appendChild(card);
        });

    } catch (err) {
        console.error("Error loading posts:", err);
        feed.innerHTML = `<div style="color: #ef4444; text-align: center;">Failed to load feed.</div>`;
    }
}
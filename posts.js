import { auth, db } from "./firebase-config.js";
import { collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;

// CHECK LOCALSTORAGE FIRST - this is our source of truth
const localUser = localStorage.getItem("currentUser");
if (!localUser) {
    alert("Please log in first.");
    window.location.href = "login.html";
} else {
    // localStorage has user - use it as source of truth
    const storedUserData = JSON.parse(localUser);
    
    // Try to sync with Firebase in background (optional)
    onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
            // Firebase authenticated
            currentUser = firebaseUser;
        } else {
            // Firebase not authenticated - use localStorage data
            currentUser = {
                uid: storedUserData.uid || "localStorage-user",
                email: storedUserData.email,
                displayName: storedUserData.fullName
            };
        }
        
        // Initialize page after we have user data
        initializePostsPage();
    });
}

// Initialize the posts page
async function initializePostsPage() {
    await loadPublishedPosts();
}

// Load all published posts from Firestore
async function loadPublishedPosts() {
    const postsFeed = document.getElementById("postsFeed");
    if (!postsFeed) return;

    postsFeed.innerHTML = '<div style="color: #7db7ff; text-align: center; padding: 40px;">Loading posts...</div>';

    try {
        const postsSnapshot = await getDocs(collection(db, "posts"));
        postsFeed.innerHTML = "";

        if (postsSnapshot.empty) {
            postsFeed.innerHTML = '<div style="color: #7db7ff; text-align: center; padding: 40px;">No posts yet. Be the first to share!</div>';
            return;
        }

        const posts = [];
        postsSnapshot.forEach((doc) => {
            posts.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by newest first
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Render posts
        posts.forEach(post => {
            const postElement = createPostElement(post);
            postsFeed.appendChild(postElement);
        });

    } catch (err) {
        console.error("Error loading posts:", err);
        postsFeed.innerHTML = '<div style="color: #ef4444; text-align: center; padding: 40px;">Error loading posts</div>';
    }
}

// Create post element
function createPostElement(post) {
    const postCard = document.createElement("div");
    postCard.className = "post-card";

    const authorName = post.authorName || "Anonymous";
    const authorInitial = authorName.charAt(0).toUpperCase();
    const createdDate = new Date(post.createdAt).toLocaleDateString();

    let contentHTML = `
        <div class="post-author">
            <div class="user-avatar">${authorInitial}</div>
            <div class="author-info">
                <h4>${authorName}</h4>
                <p>${createdDate}</p>
            </div>
        </div>
    `;

    if (post.deepfakeVerified) {
        contentHTML += `
            <div class="deepfake-verified-badge">
                <i class="fa-solid fa-shield-check"></i> Verified Authentic
            </div>
        `;
    }

    contentHTML += `<div class="post-content">${post.content}</div>`;

    if (post.mediaUrl) {
        contentHTML += `<img src="${post.mediaUrl}" alt="Post media" class="post-media">`;
    }

    contentHTML += `
        <div class="post-footer">
            <button class="interaction-btn">
                <i class="fa-solid fa-thumbs-up"></i> Like
            </button>
            <button class="interaction-btn">
                <i class="fa-solid fa-comment"></i> Comment
            </button>
            <button class="interaction-btn">
                <i class="fa-solid fa-share"></i> Share
            </button>
        </div>
    `;

    postCard.innerHTML = contentHTML;
    return postCard;
}

// Publish new post
document.addEventListener("DOMContentLoaded", () => {
    const publishBtn = document.getElementById("publishPostBtn");
    const postInput = document.getElementById("postContentInput");
    const mediaUpload = document.getElementById("mediaUpload");

    if (publishBtn) {
        publishBtn.addEventListener("click", async () => {
            const content = postInput.value.trim();
            if (!content) {
                alert("Please write something to post!");
                return;
            }

            if (!currentUser) {
                alert("Please log in first.");
                return;
            }

            publishBtn.disabled = true;
            publishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';

            try {
                const localUserData = JSON.parse(localStorage.getItem("currentUser") || "{}");
                
                await addDoc(collection(db, "posts"), {
                    content: content,
                    authorId: currentUser.uid || localUserData.uid,
                    authorName: currentUser.displayName || localUserData.fullName,
                    authorEmail: currentUser.email || localUserData.email,
                    createdAt: serverTimestamp(),
                    deepfakeVerified: true,
                    mediaUrl: null,
                    likes: 0,
                    comments: 0
                });

                postInput.value = "";
                alert("Post published successfully!");
                await loadPublishedPosts();

            } catch (err) {
                console.error("Error publishing post:", err);
                alert("Failed to publish post: " + err.message);
            } finally {
                publishBtn.disabled = false;
                publishBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Scan & Post';
            }
        });
    }
});

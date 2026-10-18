import { auth, db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    doc, 
    setDoc,
    addDoc,
    updateDoc,
    query, 
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let myRegId = "";
let myFullName = "";

const userConnections = new Set();
const sentPendingRequests = new Map(); // targetEmail -> requestDocId
let receivedPendingRequests = []; // [{ id, fromEmail, fromName, fromRegId, fromUid, createdAt }]
let cachedStudents = [];

// 1. Initial Session Setup from localStorage
const localUserRaw = localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser");
if (!localUserRaw) {
    window.location.replace("index.html");
} else {
    try {
        const storedUserData = JSON.parse(localUserRaw);
        currentUser = {
            uid: storedUserData.id || storedUserData.uid || storedUserData.email,
            email: (storedUserData.email || "").toLowerCase(),
            displayName: storedUserData.fullName || storedUserData.full_name || "Student User"
        };
        myRegId = storedUserData.studentRegId || storedUserData.regId || storedUserData.regid || storedUserData.registerNo || "";
        myFullName = currentUser.displayName;
    } catch (e) {
        console.error("Local session parse error:", e);
    }
}

// 2. Auth State Sync & Data Initialization
onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
        currentUser = {
            uid: firebaseUser.uid,
            email: (firebaseUser.email || currentUser?.email || "").toLowerCase(),
            displayName: firebaseUser.displayName || currentUser?.displayName || "Student User"
        };
    }

    if (!currentUser || !currentUser.email) return;

    // Listen for requests & connections in real time
    listenToConnections();
    listenToConnectionRequests();
    await loadAllStudents();
});

// CONNECTIONS & REQUESTS REAL-TIME LISTENERS

// Listen to my accepted connections
async function listenToConnections() {
    if (!currentUser || !currentUser.email) return;
    const myEmail = currentUser.email.toLowerCase();

    try {
        // Query connections by UID
        if (currentUser.uid) {
            const connSnap = await getDocs(collection(db, "users", currentUser.uid, "connections"));
            connSnap.forEach((d) => {
                userConnections.add(d.id.toLowerCase());
                const data = d.data();
                if (data.email) userConnections.add(data.email.toLowerCase());
            });
        }

        // Also query connections by Email doc for redundancy
        const emailConnSnap = await getDocs(collection(db, "users", myEmail, "connections"));
        emailConnSnap.forEach((d) => {
            userConnections.add(d.id.toLowerCase());
            const data = d.data();
            if (data.email) userConnections.add(data.email.toLowerCase());
        });

    } catch (err) {
        console.warn("Connection sync note:", err.message);
    }
}

// Listen to 2-Way Connection Requests
function listenToConnectionRequests() {
    if (!currentUser || !currentUser.email) return;
    const myEmail = currentUser.email.toLowerCase();

    try {
        // 1. Listen for Incoming Requests to ME
        const incomingQuery = query(
            collection(db, "connection_requests"),
            where("toEmail", "==", myEmail),
            where("status", "==", "pending")
        );

        onSnapshot(incomingQuery, (snap) => {
            receivedPendingRequests = [];
            snap.forEach((d) => {
                receivedPendingRequests.push({ id: d.id, ...d.data() });
            });
            renderIncomingRequests();
            renderStudentCards();
        }, (err) => {
            console.warn("Incoming requests listener note:", err.message);
        });

        // 2. Listen for Requests sent BY ME
        const outgoingQuery = query(
            collection(db, "connection_requests"),
            where("fromEmail", "==", myEmail),
            where("status", "==", "pending")
        );

        onSnapshot(outgoingQuery, (snap) => {
            sentPendingRequests.clear();
            snap.forEach((d) => {
                const data = d.data();
                if (data.toEmail) {
                    sentPendingRequests.set(data.toEmail.toLowerCase(), d.id);
                }
            });
            renderStudentCards();
        }, (err) => {
            console.warn("Outgoing requests listener note:", err.message);
        });

    } catch (err) {
        console.error("Requests listener error:", err);
    }
}

// RENDER INCOMING REQUESTS (MUTUAL APPROVAL)
function renderIncomingRequests() {
    const section = document.getElementById("incomingRequestsSection");
    const grid = document.getElementById("requestsGrid");
    const badge = document.getElementById("requestsCountBadge");

    if (!section || !grid) return;

    if (receivedPendingRequests.length === 0) {
        section.style.display = "none";
        return;
    }

    section.style.display = "block";
    if (badge) badge.textContent = receivedPendingRequests.length;

    grid.innerHTML = "";

    receivedPendingRequests.forEach((req) => {
        const senderName = req.fromName || (req.fromEmail || "Student").split("@")[0];
        const senderRegId = req.fromRegId || "Reg ID not set";
        const initial = senderName.charAt(0).toUpperCase();

        const card = document.createElement("div");
        card.className = "request-card";
        card.id = `req-${req.id}`;
        const avatarUrl = sanitizeUrl(student.avatar);
        card.innerHTML = `
            <div class="student-avatar" style="cursor: pointer; overflow: hidden;" title="Click to view posts & profile">
                ${avatarUrl ? `<img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="${escapeHtml(student.name)}" onerror="this.onerror=null; this.parentElement.innerHTML='${escapeHtml(student.name.charAt(0).toUpperCase())}';" />` : escapeHtml(student.name.charAt(0).toUpperCase())}
            </div>
            <h3 style="cursor: pointer;" title="Click to view posts & profile">${escapeHtml(student.name)}</h3>
            <div class="student-regid-tag">
                <i class="fa-solid fa-id-card"></i> Reg ID: ${escapeHtml(student.regId || "Not Registered")}
            </div>
            <p>${escapeHtml(student.college)}</p>
            <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
                ${actionButtonHTML}
                <button type="button" class="view-posts-btn" id="btn-posts-${student.id}" title="View ${escapeHtml(student.name)}'s public & college posts">
                    <i class="fa-solid fa-newspaper"></i> View Posts
                </button>
            </div>
        `;

        // Click on DP, Name, or View Posts button opens User Profile & Posts Modal
        const avatarEl = card.querySelector(".student-avatar");
        const nameHeaderEl = card.querySelector("h3");
        const viewPostsBtn = card.querySelector(`#btn-posts-${student.id}`);
        [avatarEl, nameHeaderEl, viewPostsBtn].forEach(el => {
            if (el) el.addEventListener("click", () => openUserProfileModal(student));
        });

        // Connect button handler (Sends connection request for mutual approval)
        const connectBtn = card.querySelector(`#btn-connect-${student.id}`);
        if (connectBtn) {
            connectBtn.addEventListener("click", async () => {
                if (!currentUser || !currentUser.email) {
                    alert("Please log in to connect.");
                    return;
                }

                connectBtn.disabled = true;
                connectBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending Request...`;

                try {
                    const myEmail = currentUser.email.toLowerCase();
                    const targetEmail = studentEmail;

                    const requestPayload = {
                        fromEmail: myEmail,
                        fromName: myFullName,
                        fromUid: currentUser.uid || "",
                        fromRegId: myRegId || "",
                        toEmail: targetEmail,
                        toName: student.name,
                        toUid: student.id,
                        toRegId: student.regId || "",
                        status: "pending",
                        createdAt: new Date().toISOString()
                    };

                    const docRef = await addDoc(collection(db, "connection_requests"), requestPayload);
                    sentPendingRequests.set(targetEmail, docRef.id);

                    connectBtn.className = "connect-btn pending";
                    connectBtn.innerHTML = `<i class="fa-solid fa-clock"></i> Request Sent`;
                    alert(`Connection request sent to ${student.name}! They will be notified to accept.`);
                } catch (err) {
                    console.error("Send request error:", err);
                    alert("Failed to send request: " + err.message);
                    connectBtn.disabled = false;
                    connectBtn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Connect`;
                }
            });
        }

        // View in requests handler
        const respondBtn = card.querySelector(`#btn-respond-${student.id}`);
        if (respondBtn) {
            respondBtn.addEventListener("click", () => {
                const reqSec = document.getElementById("incomingRequestsSection");
                if (reqSec) {
                    reqSec.scrollIntoView({ behavior: "smooth" });
                }
            });
        }

        grid.appendChild(card);
    });
}

async function handleAcceptRequest(req, btnElement) {
    if (!currentUser) return;
    btnElement.disabled = true;
    btnElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Accepting...`;

    try {
        const myEmail = currentUser.email.toLowerCase();
        const peerEmail = (req.fromEmail || "").toLowerCase();
        const peerUid = req.fromUid || peerEmail;
        const myUid = currentUser.uid || myEmail;
        const now = new Date().toISOString();

        // 1. Update request status to 'accepted'
        await updateDoc(doc(db, "connection_requests", req.id), {
            status: "accepted",
            acceptedAt: now
        });

        // 2. Create reciprocal connections in Firestore
        // My connection to Peer
        await setDoc(doc(db, "users", myUid, "connections", peerUid), {
            name: req.fromName || "Student",
            email: peerEmail,
            regId: req.fromRegId || "",
            connectedAt: now
        });
        await setDoc(doc(db, "users", myEmail, "connections", peerEmail), {
            name: req.fromName || "Student",
            email: peerEmail,
            regId: req.fromRegId || "",
            connectedAt: now
        });

        // Peer connection to Me
        await setDoc(doc(db, "users", peerUid, "connections", myUid), {
            name: myFullName,
            email: myEmail,
            regId: myRegId,
            connectedAt: now
        });
        await setDoc(doc(db, "users", peerEmail, "connections", myEmail), {
            name: myFullName,
            email: myEmail,
            regId: myRegId,
            connectedAt: now
        });

        // 3. Update local state
        userConnections.add(peerEmail);
        userConnections.add(peerUid);
        receivedPendingRequests = receivedPendingRequests.filter(r => r.id !== req.id);

        renderIncomingRequests();
        renderStudentCards();

        alert(`✅ Connected with ${req.fromName || 'classmate'}! You can now chat and share posts.`);
    } catch (err) {
        console.error("Accept request error:", err);
        alert("Failed to accept connection: " + err.message);
        btnElement.disabled = false;
        btnElement.innerHTML = `<i class="fa-solid fa-check"></i> Accept`;
    }
}

async function handleDeclineRequest(req, btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

    try {
        await updateDoc(doc(db, "connection_requests", req.id), {
            status: "declined",
            declinedAt: new Date().toISOString()
        });

        receivedPendingRequests = receivedPendingRequests.filter(r => r.id !== req.id);
        renderIncomingRequests();
        renderStudentCards();
    } catch (err) {
        console.error("Decline request error:", err);
        alert("Failed to decline request: " + err.message);
        btnElement.disabled = false;
        btnElement.innerHTML = `<i class="fa-solid fa-xmark"></i> Decline`;
    }
}

// LOAD & RENDER STUDENTS (SEARCH BY REG ID)
let currentRegIdSearchTerm = "";

async function loadAllStudents() {
    const grid = document.getElementById("studentGrid");
    if (!grid) return;

    grid.innerHTML = `<div style="color: #7db7ff; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading registered students...</div>`;

    try {
        let snap = await getDocs(collection(db, "registrations"));
        if (snap.empty) snap = await getDocs(collection(db, "students"));
        if (snap.empty) snap = await getDocs(collection(db, "users"));

        cachedStudents = [];
        const myEmail = (currentUser?.email || "").toLowerCase();

        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const email = (data.email || "").toLowerCase();

            // Do not show current user in list
            if (email && email === myEmail) return;

            const regId = data.studentRegId || data.regId || data.regid || data.registerNo || data.regNumber || data.studentId || "";
            const name = data.fullName || data.full_name || data.name || (email ? email.split("@")[0] : "Student");
            const college = data.collegeName || data.qualification || "Registered Student";

            cachedStudents.push({
                id: docSnap.id,
                email: email,
                name: name,
                regId: regId,
                college: college,
                avatar: data.avatar || data.profilePhotoUrl || ""
            });
        });

        renderStudentCards();

    } catch (err) {
        console.error("Error loading students:", err);
        grid.innerHTML = `<div style="color: #ef4444; padding: 20px;">Failed to load students directory.</div>`;
    }
}

function renderStudentCards() {
    const grid = document.getElementById("studentGrid");
    if (!grid) return;

    const term = currentRegIdSearchTerm.trim().toLowerCase();

    const filtered = cachedStudents.filter((student) => {
        if (!term) return true;
        const studentRegId = (student.regId || "").toLowerCase();
        const studentName = (student.name || "").toLowerCase();
        return studentRegId.includes(term) || studentName.includes(term);
    });

    if (filtered.length === 0) {
        grid.innerHTML = term
            ? `<div style="color: #7db7ff; padding: 30px; text-align: center; grid-column: 1 / -1;">No registered student found with Registration ID matching "${escapeHtml(currentRegIdSearchTerm)}".</div>`
            : `<div style="color: #7db7ff; padding: 30px; text-align: center; grid-column: 1 / -1;">No other registered students found.</div>`;
        return;
    }

    grid.innerHTML = "";

    filtered.forEach((student) => {
        const studentEmail = (student.email || "").toLowerCase();
        const isConnected = userConnections.has(student.id.toLowerCase()) || (studentEmail && userConnections.has(studentEmail));
        const isPendingSent = studentEmail && sentPendingRequests.has(studentEmail);
        const isPendingReceived = studentEmail && receivedPendingRequests.some(r => (r.fromEmail || "").toLowerCase() === studentEmail);

        const card = document.createElement("div");
        card.className = "student-card";
        card.id = `card-${student.id}`;

        let actionButtonHTML = "";

        if (isConnected) {
            actionButtonHTML = `
                <button class="connect-btn connected" disabled>
                    <i class="fa-solid fa-user-check"></i> Connected
                </button>
            `;
        } else if (isPendingSent) {
            actionButtonHTML = `
                <button class="connect-btn pending" disabled>
                    <i class="fa-solid fa-clock"></i> Request Sent
                </button>
            `;
        } else if (isPendingReceived) {
            actionButtonHTML = `
                <button class="connect-btn" style="background: #38bdf8;" id="btn-respond-${student.id}">
                    <i class="fa-solid fa-inbox"></i> View in Requests
                </button>
            `;
        } else {
            actionButtonHTML = `
                <button class="connect-btn" id="btn-connect-${student.id}">
                    <i class="fa-solid fa-user-plus"></i> Connect
                </button>
            `;
        }

        card.innerHTML = `
            <div class="student-avatar">${escapeHtml(student.name.charAt(0).toUpperCase())}</div>
            <h3>${escapeHtml(student.name)}</h3>
            <div class="student-regid-tag">
                <i class="fa-solid fa-id-card"></i> Reg ID: ${escapeHtml(student.regId || "Not Registered")}
            </div>
            <p>${escapeHtml(student.college)}</p>
            ${actionButtonHTML}
        `;

        // Connect button handler (Sends connection request for mutual approval)
        const connectBtn = card.querySelector(`#btn-connect-${student.id}`);
        if (connectBtn) {
            connectBtn.addEventListener("click", async () => {
                if (!currentUser || !currentUser.email) {
                    alert("Please log in to connect.");
                    return;
                }

                connectBtn.disabled = true;
                connectBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending Request...`;

                try {
                    const myEmail = currentUser.email.toLowerCase();
                    const targetEmail = studentEmail;

                    const requestPayload = {
                        fromEmail: myEmail,
                        fromName: myFullName,
                        fromUid: currentUser.uid || "",
                        fromRegId: myRegId || "",
                        toEmail: targetEmail,
                        toName: student.name,
                        toUid: student.id,
                        toRegId: student.regId || "",
                        status: "pending",
                        createdAt: new Date().toISOString()
                    };

                    const docRef = await addDoc(collection(db, "connection_requests"), requestPayload);
                    sentPendingRequests.set(targetEmail, docRef.id);

                    connectBtn.className = "connect-btn pending";
                    connectBtn.innerHTML = `<i class="fa-solid fa-clock"></i> Request Sent`;
                    alert(`Connection request sent to ${student.name}! They will be notified to accept.`);
                } catch (err) {
                    console.error("Send request error:", err);
                    alert("Failed to send request: " + err.message);
                    connectBtn.disabled = false;
                    connectBtn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Connect`;
                }
            });
        }

        // View in requests handler
        const respondBtn = card.querySelector(`#btn-respond-${student.id}`);
        if (respondBtn) {
            respondBtn.addEventListener("click", () => {
                const reqSec = document.getElementById("incomingRequestsSection");
                if (reqSec) {
                    reqSec.scrollIntoView({ behavior: "smooth" });
                }
            });
        }

        grid.appendChild(card);
    });
}

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sanitizeUrl(url) {
    if (!url) return "";
    const clean = String(url).trim();
    if (/^(https?:\/\/|data:image\/(jpeg|png|gif|webp);base64,)/i.test(clean)) {
        return clean;
    }
    return "";
}

// REGISTRATION ID SEARCH EVENT LISTENERS
document.addEventListener("DOMContentLoaded", () => {
    const searchBtn = document.getElementById("searchRegIdBtn");
    const searchInput = document.getElementById("regIdSearchInput");

    searchBtn?.addEventListener("click", () => {
        currentRegIdSearchTerm = searchInput ? searchInput.value.trim() : "";
        renderStudentCards();
    });

    searchInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            currentRegIdSearchTerm = searchInput.value.trim();
            renderStudentCards();
        }
    });

    searchInput?.addEventListener("input", (e) => {
        if (e.target.value.trim() === "") {
            currentRegIdSearchTerm = "";
            renderStudentCards();
        }
    });
});


// USER PROFILE & POSTS MODAL (PUBLIC & COLLEGE POSTS)
async function openUserProfileModal(user) {
    const modal = document.getElementById("userProfileModal");
    if (!modal) return;

    const avatarEl = document.getElementById("profileModalAvatar");
    const nameEl = document.getElementById("profileModalName");
    const collegeEl = document.getElementById("profileModalCollege");
    const regIdEl = document.getElementById("profileModalRegId");
    const container = document.getElementById("profilePostsContainer");

    const name = user.name || user.fullName || user.full_name || (user.email ? user.email.split("@")[0] : "Student");
    const college = user.college || user.collegeName || user.qualification || "Registered Student";
    const regId = user.regId || user.studentRegId || user.registerNo || "";
    const avatar = user.avatar || user.profilePhotoUrl || "";

    if (nameEl) nameEl.textContent = name;
    if (collegeEl) collegeEl.innerHTML = `<i class="fa-solid fa-building-columns"></i> ${escapeHtml(college)}`;
    if (regIdEl) {
        if (regId) {
            regIdEl.style.display = "inline-flex";
            regIdEl.innerHTML = `<i class="fa-solid fa-id-card"></i> Reg ID: ${escapeHtml(regId)}`;
        } else {
            regIdEl.style.display = "none";
        }
    }
    if (avatarEl) {
        const safeAv = sanitizeUrl(avatar);
        if (safeAv) {
            avatarEl.innerHTML = `<img src="${safeAv}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="${escapeHtml(name)}"/>`;
        } else {
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }
    }

    modal.style.display = "flex";
    if (container) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:#f59e0b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading ${escapeHtml(name)}'s posts...</div>`;
    }

    try {
        const targetEmail = (user.email || "").toLowerCase().trim();
        const targetUid = user.id || user.uid || "";

        const postsRef = collection(db, "posts");
        const snap = await getDocs(postsRef);

        let userPosts = [];
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const postEmail = (data.authorEmail || "").toLowerCase().trim();
            const postUid = data.uid || "";

            if ((targetEmail && postEmail === targetEmail) || (targetUid && postUid === targetUid)) {
                userPosts.push({ id: docSnap.id, ...data });
            }
        });

        // Sort posts newest first
        userPosts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        let currentModalTab = "all";

        function renderModalPosts() {
            const filtered = userPosts.filter(p => {
                if (currentModalTab === "all") return true;
                const isComm = p.postType === "community" || p.audience === "community";
                if (currentModalTab === "public") return !isComm;
                if (currentModalTab === "community") return isComm;
                return true;
            });

            const countAll = document.getElementById("countAllPosts");
            const countPub = document.getElementById("countPublicPosts");
            const countComm = document.getElementById("countCommPosts");
            if (countAll) countAll.textContent = userPosts.length;
            if (countPub) countPub.textContent = userPosts.filter(p => p.postType !== "community" && p.audience !== "community").length;
            if (countComm) countComm.textContent = userPosts.filter(p => p.postType === "community" || p.audience === "community").length;

            if (filtered.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:40px; color:#94a3b8; font-size:14px;"><i class="fa-regular fa-folder-open" style="font-size:26px; display:block; margin-bottom:8px; color:#f59e0b;"></i>No ${currentModalTab === "all" ? "" : currentModalTab} posts found by ${escapeHtml(name)}.</div>`;
                return;
            }

            container.innerHTML = "";
            filtered.forEach(p => {
                const isComm = p.postType === "community" || p.audience === "community";
                const collegeTag = p.targetCollege || p.authorCollege || p.collegeName || college;
                const safeMedia = sanitizeUrl(p.mediaUrl);
                const safeDoc = sanitizeUrl(p.docUrl);
                const postDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : "Recently";
                const likesCount = Array.isArray(p.likes) ? p.likes.length : 0;
                const commentsCount = Array.isArray(p.comments) ? p.comments.length : 0;

                const card = document.createElement("div");
                card.className = "profile-post-card";
                card.innerHTML = `
                    <div class="profile-post-header">
                        <div>
                            <span class="post-type-badge ${isComm ? 'badge-community' : 'badge-public'}">
                                <i class="fa-solid ${isComm ? 'fa-building-columns' : 'fa-globe'}"></i>
                                ${isComm ? escapeHtml(collegeTag) : "Public Post"}
                            </span>
                            <span style="font-size:12px; color:#94a3b8; margin-left:8px;">${escapeHtml(postDate)}</span>
                        </div>
                    </div>
                    <div class="profile-post-content">${escapeHtml(p.content || "")}</div>
                    ${safeMedia ? `<img src="${safeMedia}" class="profile-post-media" alt="Post Image" />` : ""}
                    ${safeDoc ? `
                        <a href="${safeDoc}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(p.docName || 'document.pdf')}" class="msg-doc-card" style="margin-top:8px;">
                            <i class="fa-solid fa-file-pdf"></i>
                            <div>
                                <strong style="display:block; font-size:13px; color:#fff;">${escapeHtml(p.docName || "Attachment Document")}</strong>
                                <span style="font-size:11px; color:#7db7ff;">Click to view / download</span>
                            </div>
                        </a>
                    ` : ""}
                    <div class="profile-post-footer">
                        <span><i class="fa-solid fa-heart" style="color:#ef4444;"></i> ${likesCount} ${likesCount === 1 ? 'Like' : 'Likes'}</span>
                        <span><i class="fa-regular fa-comment" style="color:#f59e0b;"></i> ${commentsCount} ${commentsCount === 1 ? 'Comment' : 'Comments'}</span>
                    </div>
                `;

                const imgEl = card.querySelector(".profile-post-media");
                if (imgEl && safeMedia) {
                    imgEl.addEventListener("click", () => openLightbox(safeMedia));
                }

                container.appendChild(card);
            });
        }

        document.querySelectorAll(".profile-tab-btn").forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll(".profile-tab-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                currentModalTab = btn.getAttribute("data-tab") || "all";
                renderModalPosts();
            };
        });

        renderModalPosts();

    } catch (err) {
        console.error("Error fetching user posts:", err);
        if (container) {
            container.innerHTML = `<div style="text-align:center; padding:30px; color:#ef4444;">Failed to load posts: ${escapeHtml(err.message)}</div>`;
        }
    }
}

// Lightbox modal handlers
function openLightbox(src) {
    const modal = document.getElementById("imageLightboxModal");
    const img = document.getElementById("lightboxImg");
    if (!modal || !img) return;
    img.src = src;
    modal.style.display = "flex";
}

document.addEventListener("DOMContentLoaded", () => {
    const closeProfileBtn = document.getElementById("closeProfileModalBtn");
    if (closeProfileBtn) {
        closeProfileBtn.addEventListener("click", () => {
            const modal = document.getElementById("userProfileModal");
            if (modal) modal.style.display = "none";
        });
    }

    const userProfileModalEl = document.getElementById("userProfileModal");
    if (userProfileModalEl) {
        userProfileModalEl.addEventListener("click", (e) => {
            if (e.target === userProfileModalEl) userProfileModalEl.style.display = "none";
        });
    }

    const closeLightboxBtn = document.getElementById("closeLightboxBtn");
    if (closeLightboxBtn) {
        closeLightboxBtn.addEventListener("click", () => {
            const modal = document.getElementById("imageLightboxModal");
            if (modal) modal.style.display = "none";
        });
    }

    const imageLightboxModal = document.getElementById("imageLightboxModal");
    if (imageLightboxModal) {
        imageLightboxModal.addEventListener("click", (e) => {
            if (e.target === imageLightboxModal) imageLightboxModal.style.display = "none";
        });
    }
});

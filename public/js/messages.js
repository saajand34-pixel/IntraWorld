import { auth, db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    addDoc, 
    doc,
    updateDoc,
    arrayUnion,
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuthenticatedUser } from "./auth-check.js";

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

document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = getAuthenticatedUser();
    if (!currentUser) return;

    const userListEl = document.getElementById("userList");
    const noChatEl = document.getElementById("noChatPlaceholder");
    const activeChatEl = document.getElementById("activeChatContent");
    const activeAvatarEl = document.getElementById("activeUserAvatar");
    const activeNameEl = document.getElementById("activeUserName");
    const activeEmailEl = document.getElementById("activeUserEmail");
    const messagesBox = document.getElementById("messagesBox");
    const chatForm = document.getElementById("chatForm");
    const messageInput = document.getElementById("messageInput");

    // Chat Attachment Elements
    const chatFileInput = document.getElementById("chatFileInput");
    const chatAttachmentPreview = document.getElementById("chatAttachmentPreview");
    const chatAttachmentThumb = document.getElementById("chatAttachmentThumb");
    const chatAttachmentName = document.getElementById("chatAttachmentName");
    const chatAttachmentSize = document.getElementById("chatAttachmentSize");
    const cancelAttachmentBtn = document.getElementById("cancelAttachmentBtn");

    let selectedChatFile = null;
    let selectedChatFileType = null; // 'image' or 'doc'

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    function clearChatAttachment() {
        selectedChatFile = null;
        selectedChatFileType = null;
        if (chatFileInput) chatFileInput.value = "";
        if (chatAttachmentPreview) chatAttachmentPreview.style.display = "none";
        if (chatAttachmentThumb) chatAttachmentThumb.innerHTML = "";
    }

    if (cancelAttachmentBtn) {
        cancelAttachmentBtn.addEventListener("click", clearChatAttachment);
    }

    if (chatFileInput) {
        chatFileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            if (file.type.startsWith("image/")) {
                selectedChatFile = file;
                selectedChatFileType = "image";
                const reader = new FileReader();
                reader.onload = (evt) => {
                    if (chatAttachmentThumb) {
                        chatAttachmentThumb.innerHTML = `<img src="${evt.target.result}" style="width:100%;height:100%;object-fit:cover;" />`;
                    }
                };
                reader.readAsDataURL(file);
            } else {
                selectedChatFile = file;
                selectedChatFileType = "doc";
                if (chatAttachmentThumb) {
                    chatAttachmentThumb.innerHTML = `<i class="fa-solid fa-file-pdf fa-2x" style="color:#ef4444;"></i>`;
                }
            }

            if (chatAttachmentName) chatAttachmentName.textContent = file.name;
            if (chatAttachmentSize) chatAttachmentSize.textContent = formatFileSize(file.size);
            if (chatAttachmentPreview) chatAttachmentPreview.style.display = "flex";
            if (messageInput) messageInput.focus();
        });
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    }

    function compressImageToBase64(file, maxWidth = 1000, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL("image/jpeg", quality));
                };
                img.onerror = (e) => reject(e);
            };
            reader.onerror = (e) => reject(e);
        });
    }

    // Reply preview elements
    const replyPreviewBar = document.getElementById("replyPreviewBar");
    const replyPreviewAuthor = document.getElementById("replyPreviewAuthor");
    const replyPreviewSnippet = document.getElementById("replyPreviewSnippet");
    const cancelReplyBtn = document.getElementById("cancelReplyBtn");

    // Delete modal elements
    const deleteModal = document.getElementById("deleteModal");
    const deleteModalDesc = document.getElementById("deleteModalDesc");
    const btnDeleteForEveryone = document.getElementById("btnDeleteForEveryone");
    const btnDeleteForMe = document.getElementById("btnDeleteForMe");
    const btnCancelDelete = document.getElementById("btnCancelDelete");

    let selectedPeer = null;
    let unsubscribeMessages = null;
    let replyingTo = null; // { id, senderName, text }
    let activeDeleteTarget = null; // { msgId, chatId, isMe }

    // Reply State Management
    function startReply(msgId, senderName, text) {
        replyingTo = { id: msgId, senderName: senderName || "Student", text: text || "" };
        if (replyPreviewBar && replyPreviewAuthor && replyPreviewSnippet) {
            replyPreviewAuthor.textContent = `Replying to ${replyingTo.senderName}`;
            replyPreviewSnippet.textContent = replyingTo.text;
            replyPreviewBar.style.display = "flex";
        }
        if (messageInput) {
            messageInput.focus();
        }
    }

    function cancelReply() {
        replyingTo = null;
        if (replyPreviewBar) {
            replyPreviewBar.style.display = "none";
        }
    }

    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener("click", cancelReply);
    }

    // Delete Confirmation Modal Management
    function openDeleteModal(msgId, chatId, isMe) {
        activeDeleteTarget = { msgId, chatId, isMe };
        if (!deleteModal) return;
        if (btnDeleteForEveryone) {
            btnDeleteForEveryone.style.display = isMe ? "block" : "none";
        }
        if (deleteModalDesc) {
            deleteModalDesc.textContent = isMe 
                ? "You can delete this message for yourself or for everyone in the chat."
                : "This will remove the message from your chat history only.";
        }
        deleteModal.style.display = "flex";
    }

    function closeDeleteModal() {
        activeDeleteTarget = null;
        if (deleteModal) deleteModal.style.display = "none";
    }

    if (btnDeleteForMe) {
        btnDeleteForMe.addEventListener("click", async () => {
            if (!activeDeleteTarget || !currentUser) return;
            const { msgId, chatId } = activeDeleteTarget;
            const myEmail = currentUser.email.toLowerCase();
            closeDeleteModal();
            try {
                const msgDocRef = doc(db, "chats", chatId, "messages", msgId);
                await updateDoc(msgDocRef, {
                    deletedFor: arrayUnion(myEmail)
                });
            } catch (err) {
                console.error("Delete for me error:", err);
            }
        });
    }

    if (btnDeleteForEveryone) {
        btnDeleteForEveryone.addEventListener("click", async () => {
            if (!activeDeleteTarget || !currentUser) return;
            const { msgId, chatId, isMe } = activeDeleteTarget;
            if (!isMe) return;
            closeDeleteModal();
            try {
                const msgDocRef = doc(db, "chats", chatId, "messages", msgId);
                await updateDoc(msgDocRef, {
                    deletedForEveryone: true,
                    text: "This message was deleted"
                });
            } catch (err) {
                console.error("Delete for everyone error:", err);
            }
        });
    }

    if (btnCancelDelete) {
        btnCancelDelete.addEventListener("click", closeDeleteModal);
    }
    if (deleteModal) {
        deleteModal.addEventListener("click", (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
    }

    // Fullscreen Image Lightbox Modal Handlers
    const imageLightboxModal = document.getElementById("imageLightboxModal");
    const lightboxImg = document.getElementById("lightboxImg");
    const closeLightboxBtn = document.getElementById("closeLightboxBtn");
    const downloadLightboxBtn = document.getElementById("downloadLightboxBtn");

    function openLightbox(src) {
        if (!imageLightboxModal || !lightboxImg) return;
        lightboxImg.src = src;
        if (downloadLightboxBtn) downloadLightboxBtn.href = src;
        imageLightboxModal.style.display = "flex";
    }

    function closeLightbox() {
        if (!imageLightboxModal) return;
        imageLightboxModal.style.display = "none";
        if (lightboxImg) lightboxImg.src = "";
    }

    if (closeLightboxBtn) closeLightboxBtn.addEventListener("click", closeLightbox);
    if (imageLightboxModal) {
        imageLightboxModal.addEventListener("click", (e) => {
            if (e.target === imageLightboxModal) closeLightbox();
        });
    }

    // 1. Load Registered Students Across All Collections (Deduplicated)
    async function loadRegisteredStudents() {
        if (!userListEl) return;
        userListEl.innerHTML = '<div style="padding: 20px; color: #f59e0b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading registered peers...</div>';

        try {
            const myEmail = (currentUser.email || "").toLowerCase().trim();
            const peerMap = new Map();

            // Collect peers from registrations, students, and users safely
            const collectionsToScan = ["registrations", "students", "users"];
            for (const colName of collectionsToScan) {
                try {
                    const snap = await getDocs(collection(db, colName));
                    snap.forEach(docSnap => {
                        const data = docSnap.data();
                        const email = (data.email || "").toLowerCase().trim();
                        if (email && email !== myEmail && !peerMap.has(email)) {
                            peerMap.set(email, {
                                id: docSnap.id,
                                ...data,
                                email: email
                            });
                        }
                    });
                } catch (colErr) {
                    console.warn(`Scan collection ${colName} note:`, colErr.message);
                }
            }

            const peers = Array.from(peerMap.values());

            if (peers.length === 0) {
                userListEl.innerHTML = '<div style="padding: 20px; color: #8fa8bf; font-size: 13px; text-align: center;">No other student peers found.</div>';
                return;
            }

            userListEl.innerHTML = "";
            peers.forEach(peer => {
                const name = peer.fullName || peer.full_name || peer.name || "Student Peer";
                const college = peer.collegeName || peer.collegeOrUniversity || peer.college || peer.qualification || "";
                const avatar = peer.avatar || peer.profilePhotoUrl;
                const safeAvatarUrl = sanitizeUrl(avatar);
                
                const item = document.createElement("div");
                item.className = "user-item";
                item.style.cssText = "display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(245, 158, 11, 0.12); cursor: pointer; transition: background 0.2s;";
                item.innerHTML = `
                    <div style="width: 42px; height: 42px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg, #c41226, #4d000a); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; flex-shrink: 0; border: 1.5px solid rgba(245, 158, 11, 0.45);">
                        ${safeAvatarUrl ? `<img src="${safeAvatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="${escapeHtml(name)}" onerror="this.onerror=null; this.parentElement.innerHTML='${escapeHtml(name.charAt(0).toUpperCase())}';" />` : escapeHtml(name.charAt(0).toUpperCase())}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 14px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(name)}</div>
                        <div style="font-size: 12px; color: #f59e0b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(college || peer.email)}</div>
                    </div>
                `;

                item.addEventListener("click", () => {
                    document.querySelectorAll(".user-item").forEach(el => el.style.background = "transparent");
                    item.style.background = "#220308";
                    selectPeer(peer);
                });

                userListEl.appendChild(item);
            });
        } catch (err) {
            console.error("Load peers error:", err);
            userListEl.innerHTML = '<div style="padding: 20px; color: #ef4444; font-size: 13px;">Failed to load student profiles. Please check connection.</div>';
        }
    }

    // 2. Select Peer & Listen for Chat Messages
    function selectPeer(peer) {
        selectedPeer = peer;
        cancelReply();
        if (noChatEl) noChatEl.style.display = "none";
        if (activeChatEl) activeChatEl.style.display = "flex";

        const name = peer.fullName || peer.full_name || "Student";
        const email = peer.email || "";
        const avatar = peer.avatar || peer.profilePhotoUrl;

        if (activeNameEl) activeNameEl.textContent = name;
        if (activeEmailEl) activeEmailEl.textContent = email;
        if (activeAvatarEl) {
            if (avatar) {
                const safeAv = sanitizeUrl(avatar); if (safeAv) { activeAvatarEl.innerHTML = `<img src="${safeAv}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" alt="${escapeHtml(name)}" />`; } else { activeAvatarEl.textContent = name.charAt(0).toUpperCase(); }
            } else {
                activeAvatarEl.textContent = name.charAt(0).toUpperCase();
            }
        }

        if (unsubscribeMessages) {
            unsubscribeMessages();
        }

        listenToMessages(currentUser.email.toLowerCase(), email.toLowerCase(), name);
    }

    // 3. Firestore Realtime Messages Listener
    function listenToMessages(myEmail, peerEmail, peerName) {
        if (!messagesBox) return;
        messagesBox.innerHTML = '<div style="text-align: center; padding: 20px; color: #8fa8bf;"><i class="fa-solid fa-spinner fa-spin"></i> Loading messages...</div>';

        const chatId = [myEmail, peerEmail].sort().join("___");

        const q = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("timestamp", "asc")
        );

        unsubscribeMessages = onSnapshot(q, (snapshot) => {
            // Update unviewed incoming messages to 'viewed: true'
            snapshot.docChanges().forEach(change => {
                if (change.type === "added" || change.type === "modified") {
                    const data = change.doc.data();
                    if ((data.receiverEmail || "").toLowerCase() === myEmail && !data.viewed && !data.deletedForEveryone) {
                        updateDoc(doc(db, "chats", chatId, "messages", change.doc.id), {
                            viewed: true,
                            status: "viewed"
                        }).catch(e => console.warn("Update viewed error:", e.message));
                    }
                }
            });

            messagesBox.innerHTML = "";
            let renderedCount = 0;

            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                const msgId = docSnap.id;

                // Check if message was deleted for the current user ("Delete for me")
                if (msg.deletedFor && Array.isArray(msg.deletedFor) && msg.deletedFor.includes(myEmail)) {
                    return; // Skip rendering
                }

                renderedCount++;
                const isMe = (msg.senderEmail || "").toLowerCase() === myEmail;
                const isDeleted = msg.deletedForEveryone === true;

                const row = document.createElement("div");
                row.className = `msg-row ${isMe ? 'sent' : 'received'}`;
                row.id = `msg-${msgId}`;

                let bubbleHtml = "";

                if (isDeleted) {
                    bubbleHtml = `
                        <div class="msg-bubble is-deleted">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-ban" style="font-size: 11px;"></i>
                                <span>${isMe ? "You deleted this message" : "This message was deleted"}</span>
                            </div>
                            <div class="msg-meta">
                                <span>${msg.timeStr || ''}</span>
                            </div>
                        </div>
                    `;
                } else {
                    // Render quoted reply if attached
                    let quoteHtml = "";
                    if (msg.replyTo && msg.replyTo.text) {
                        quoteHtml = `
                            <div class="msg-quote" data-target-id="${msg.replyTo.id || ''}" title="Click to view quoted message">
                                <div class="msg-quote-author"><i class="fa-solid fa-reply" style="font-size: 10px; margin-right: 4px;"></i>${escapeHtml(msg.replyTo.senderName || 'Student')}</div>
                                <div class="msg-quote-text">${escapeHtml(msg.replyTo.text)}</div>
                            </div>
                        `;
                    }

                    // Render status tick: Sky blue for sent, Green for viewed
                    let tickHtml = "";
                    if (isMe) {
                        if (msg.viewed === true || msg.status === "viewed") {
                            // Green tick for viewed
                            tickHtml = `<i class="fa-solid fa-check-double tick-viewed" title="Viewed"></i>`;
                        } else {
                            // Sky blue tick for sent
                            tickHtml = `<i class="fa-solid fa-check tick-sent" title="Sent"></i>`;
                        }
                    }

                    let mediaHtml = "";
                    if (msg.mediaUrl) {
                        const safeMedia = sanitizeUrl(msg.mediaUrl);
                        if (safeMedia) {
                            mediaHtml = `
                                <div class="msg-media-container" data-full-src="${safeMedia}" title="Click to view full photo">
                                    <img src="${safeMedia}" class="msg-media-img" alt="Shared media" />
                                </div>
                            `;
                        }
                    }

                    let docHtml = "";
                    if (msg.docUrl) {
                        const safeDoc = sanitizeUrl(msg.docUrl);
                        if (safeDoc) {
                            docHtml = `
                                <a href="${safeDoc}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(msg.docName || 'document.pdf')}" class="msg-doc-card">
                                    <i class="fa-solid fa-file-pdf"></i>
                                    <div>
                                        <strong style="display: block; font-size: 13px; color: #fff;">${escapeHtml(msg.docName || "Attachment Document")}</strong>
                                        <span style="font-size: 11px; color: #7db7ff;">Click to view / download</span>
                                    </div>
                                </a>
                            `;
                        }
                    }

                    bubbleHtml = `
                        <div class="msg-bubble">
                            ${quoteHtml}
                            ${mediaHtml}
                            ${docHtml}
                            ${msg.text ? `<div class="msg-content">${escapeHtml(msg.text || "")}</div>` : ""}
                            <div class="msg-meta">
                                <span>${msg.timeStr || ''}</span>
                                ${tickHtml}
                            </div>
                        </div>
                        <div class="msg-actions">
                            <button type="button" class="msg-action-btn btn-reply" title="Reply">
                                <i class="fa-solid fa-reply"></i>
                            </button>
                            <button type="button" class="msg-action-btn btn-delete" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `;
                }

                row.innerHTML = bubbleHtml;

                // Attach event handlers for interactive features
                if (!isDeleted) {
                    const btnReply = row.querySelector(".btn-reply");
                    if (btnReply) {
                        btnReply.addEventListener("click", () => {
                            const authorName = isMe ? "You" : (peerName || "Student");
                            startReply(msgId, authorName, msg.text);
                        });
                    }

                    const btnDelete = row.querySelector(".btn-delete");
                    if (btnDelete) {
                        btnDelete.addEventListener("click", () => {
                            openDeleteModal(msgId, chatId, isMe);
                        });
                    }

                    // Click on photo opens WhatsApp-style lightbox modal
                    const mediaEl = row.querySelector(".msg-media-container");
                    if (mediaEl) {
                        mediaEl.addEventListener("click", () => {
                            const fullSrc = mediaEl.getAttribute("data-full-src");
                            if (fullSrc) openLightbox(fullSrc);
                        });
                    }

                    // Click on quoted reply smoothly scrolls to original message
                    const quoteEl = row.querySelector(".msg-quote");
                    if (quoteEl) {
                        quoteEl.addEventListener("click", () => {
                            const targetId = quoteEl.getAttribute("data-target-id");
                            if (!targetId) return;
                            const targetRow = document.getElementById(`msg-${targetId}`);
                            if (targetRow) {
                                targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
                                const bubbleEl = targetRow.querySelector(".msg-bubble");
                                if (bubbleEl) {
                                    bubbleEl.classList.remove("highlight-pulse");
                                    void bubbleEl.offsetWidth; // Force CSS reflow
                                    bubbleEl.classList.add("highlight-pulse");
                                    setTimeout(() => bubbleEl.classList.remove("highlight-pulse"), 1300);
                                }
                            }
                        });
                    }
                }

                messagesBox.appendChild(row);
            });

            if (renderedCount === 0) {
                messagesBox.innerHTML = '<div style="text-align: center; padding: 40px; color: #8fa8bf; font-size: 13px;">No messages yet. Say hello! 👋</div>';
            } else {
                messagesBox.scrollTop = messagesBox.scrollHeight;
            }
        }, (err) => {
            console.error("Messages stream error:", err);
            messagesBox.innerHTML = '<div style="text-align: center; padding: 20px; color: #8fa8bf;">Direct message channel ready.</div>';
        });
    }

    // 4. Send Message Handler
    if (chatForm) {
        chatForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!selectedPeer || !messageInput) return;

            const text = messageInput.value.trim();
            if (text.length > 2000) {
                alert("⚠️ Message is too long (maximum 2,000 characters).");
                return;
            }
            if (!text && !selectedChatFile) return;

            const sendBtn = chatForm.querySelector("button[type='submit']");
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            }

            try {
                let mediaUrl = null;
                let docUrl = null;
                let docName = null;

                if (selectedChatFile) {
                    if (selectedChatFileType === "image") {
                        mediaUrl = await compressImageToBase64(selectedChatFile);
                    } else if (selectedChatFileType === "doc") {
                        if (selectedChatFile.size > 800 * 1024) {
                            alert("⚠️ Document is larger than 800 KB limit for instant direct messaging.");
                            if (sendBtn) {
                                sendBtn.disabled = false;
                                sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
                            }
                            return;
                        }
                        docUrl = await fileToDataUrl(selectedChatFile);
                        docName = selectedChatFile.name;
                    }
                }

                messageInput.value = "";
                const myEmail = currentUser.email.toLowerCase();
                const peerEmail = selectedPeer.email.toLowerCase();
                const chatId = [myEmail, peerEmail].sort().join("___");

                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const payload = {
                    senderEmail: myEmail,
                    receiverEmail: peerEmail,
                    senderName: currentUser.fullName || currentUser.full_name || "Student",
                    text: text,
                    timestamp: serverTimestamp(),
                    timeStr: timeStr,
                    status: "sent",
                    viewed: false,
                    deletedFor: [],
                    deletedForEveryone: false,
                    replyTo: replyingTo ? {
                        id: replyingTo.id,
                        senderName: replyingTo.senderName,
                        text: replyingTo.text
                    } : null
                };

                if (mediaUrl) payload.mediaUrl = mediaUrl;
                if (docUrl) {
                    payload.docUrl = docUrl;
                    payload.docName = docName || "Attachment";
                }

                // Clear attachments & reply preview
                clearChatAttachment();
                cancelReply();

                await addDoc(collection(db, "chats", chatId, "messages"), payload);
            } catch (err) {
                console.error("Send message error:", err);
                alert("Failed to send message: " + err.message);
            } finally {
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
                }
            }
        });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace("index.html");
        });
    }

    loadRegisteredStudents();
});

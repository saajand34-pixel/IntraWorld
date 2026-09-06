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

    // 1. Load Registered Students
    async function loadRegisteredStudents() {
        if (!userListEl) return;
        userListEl.innerHTML = '<div style="padding: 20px; color: #7db7ff;"><i class="fa-solid fa-spinner fa-spin"></i> Loading students...</div>';

        try {
            const peers = [];
            const myEmail = (currentUser.email || "").toLowerCase();

            let snap = await getDocs(collection(db, "registrations"));
            if (snap.empty) snap = await getDocs(collection(db, "students"));
            if (snap.empty) snap = await getDocs(collection(db, "users"));

            snap.forEach(docSnap => {
                const data = docSnap.data();
                const email = (data.email || "").toLowerCase();
                if (email && email !== myEmail) {
                    peers.push({ id: docSnap.id, ...data });
                }
            });

            if (peers.length === 0) {
                userListEl.innerHTML = '<div style="padding: 20px; color: #94a3b8; font-size: 13px;">No other registered students yet.</div>';
                return;
            }

            userListEl.innerHTML = "";
            peers.forEach(peer => {
                const name = peer.fullName || peer.full_name || peer.name || "Student";
                const college = peer.collegeName || peer.college || "";
                const avatar = peer.avatar || peer.profilePhotoUrl;
                
                const item = document.createElement("div");
                item.className = "user-item";
                item.style.cssText = "display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.2s;";
                item.innerHTML = `
                    <div style="width: 42px; height: 42px; border-radius: 50%; overflow: hidden; background: #0066ff; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; border: 1.5px solid rgba(56,189,248,0.4);">
                        ${avatar ? `<img src="${avatar}" style="width: 100%; height: 100%; object-fit: cover;" />` : name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                        <div style="font-size: 12px; color: #8fa8bf; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${college || peer.email}</div>
                    </div>
                `;

                item.addEventListener("click", () => {
                    document.querySelectorAll(".user-item").forEach(el => el.style.background = "transparent");
                    item.style.background = "rgba(0, 102, 255, 0.15)";
                    selectPeer(peer);
                });

                userListEl.appendChild(item);
            });
        } catch (err) {
            console.error("Load peers error:", err);
            userListEl.innerHTML = '<div style="padding: 20px; color: #f87171; font-size: 13px;">Failed to load student profiles.</div>';
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
                activeAvatarEl.innerHTML = `<img src="${avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
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

                    bubbleHtml = `
                        <div class="msg-bubble">
                            ${quoteHtml}
                            <div class="msg-content">${escapeHtml(msg.text || "")}</div>
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
            if (!text) return;

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

            // Clear reply preview bar
            cancelReply();

            try {
                await addDoc(collection(db, "chats", chatId, "messages"), payload);
            } catch (err) {
                console.error("Send message error:", err);
            }
        });
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    loadRegisteredStudents();
});

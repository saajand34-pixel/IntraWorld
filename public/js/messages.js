import { auth, db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    addDoc, 
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

    let selectedPeer = null;
    let unsubscribeMessages = null;

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

        listenToMessages(currentUser.email.toLowerCase(), email.toLowerCase());
    }

    // 3. Firestore Realtime Messages Listener
    function listenToMessages(myEmail, peerEmail) {
        if (!messagesBox) return;
        messagesBox.innerHTML = '<div style="text-align: center; padding: 20px; color: #8fa8bf;"><i class="fa-solid fa-spinner fa-spin"></i> Loading messages...</div>';

        const chatId = [myEmail, peerEmail].sort().join("___");

        const q = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("timestamp", "asc")
        );

        unsubscribeMessages = onSnapshot(q, (snapshot) => {
            messagesBox.innerHTML = "";
            if (snapshot.empty) {
                messagesBox.innerHTML = '<div style="text-align: center; padding: 40px; color: #8fa8bf; font-size: 13px;">No messages yet. Say hello! 👋</div>';
                return;
            }

            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                const isMe = (msg.senderEmail || "").toLowerCase() === myEmail;

                const bubble = document.createElement("div");
                bubble.style.cssText = `display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'}; margin-bottom: 12px;`;
                bubble.innerHTML = `
                    <div style="max-width: 70%; padding: 10px 16px; border-radius: 16px; font-size: 14px; line-height: 1.4; background: ${isMe ? '#0066ff' : '#0e294b'}; color: #fff; border: 1px solid ${isMe ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.08)'}; word-break: break-word;">
                        ${escapeHtml(msg.text || "")}
                    </div>
                    <span style="font-size: 10px; color: #64748b; margin-top: 4px; padding: 0 4px;">${msg.timeStr || ''}</span>
                `;
                messagesBox.appendChild(bubble);
            });

            messagesBox.scrollTop = messagesBox.scrollHeight;
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

            try {
                await addDoc(collection(db, "chats", chatId, "messages"), {
                    senderEmail: myEmail,
                    receiverEmail: peerEmail,
                    senderName: currentUser.fullName || "Student",
                    text: text,
                    timestamp: serverTimestamp(),
                    timeStr: timeStr
                });
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

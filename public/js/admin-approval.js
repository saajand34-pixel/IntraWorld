import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    if (/^(https?:\/\/|data:image\/(jpeg|png|gif|webp);base64,)/i.test(clean)) return clean;
    return "";
}

function verifyAdminSession() {
    try {
        const raw = localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser");
        if (!raw) return false;
        const u = JSON.parse(raw);
        return u && (u.role === "admin" || u.email === "admin@intraworld.com" || u.email === "saajand34@gmail.com");
    } catch {
        return false;
    }
}

let pendingUsers = [];
let activeFilter = "pending";

const pendingCount  = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");
const rejectedCount = document.getElementById("rejectedCount");
const totalCount    = document.getElementById("totalCount");
const cardGrid      = document.getElementById("approvalCardGrid");
const searchInput   = document.getElementById("approvalSearch");

onAuthStateChanged(auth, (user) => {
    const isLocalAdmin  = verifyAdminSession();
    const isAuthAdmin   = user && (user.email === "admin@intraworld.com" || user.email === "saajand34@gmail.com");

    if (!isLocalAdmin && !isAuthAdmin) {
        window.location.replace("login.html");
        return;
    }

    loadAllRegistrations();
});

async function loadAllRegistrations() {
    if (cardGrid) cardGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#f59e0b;padding:40px;font-size:15px;">Loading registrations...</div>`;
    pendingUsers = [];

    try {
        const snap = await getDocs(collection(db, "registrations"));
        snap.forEach((d) => {
            const data = d.data();
            data._docId = d.id;
            data._collection = "registrations";
            pendingUsers.push(data);
        });
    } catch (err) {
        console.warn("Load registrations note:", err.message);
    }

    updateCounts();
    renderCards();
}

function updateCounts() {
    const pending  = pendingUsers.filter(u => (u.accountStatus || "") === "PENDING_APPROVAL");
    const approved = pendingUsers.filter(u => u.adminApproved === true);
    const rejected = pendingUsers.filter(u => (u.accountStatus || "") === "REJECTED");

    if (pendingCount)  pendingCount.textContent  = pending.length;
    if (approvedCount) approvedCount.textContent = approved.length;
    if (rejectedCount) rejectedCount.textContent = rejected.length;
    if (totalCount)    totalCount.textContent    = pendingUsers.length;
}

function renderCards() {
    if (!cardGrid) return;
    cardGrid.innerHTML = "";

    const searchVal = (searchInput?.value || "").toLowerCase().trim();

    let list = pendingUsers.filter(u => {
        const status = u.accountStatus || "";
        if (activeFilter === "pending")  return status === "PENDING_APPROVAL";
        if (activeFilter === "approved") return u.adminApproved === true && status !== "REJECTED";
        if (activeFilter === "rejected") return status === "REJECTED";
        return true;
    });

    if (searchVal) {
        list = list.filter(u => {
            const name    = (u.fullName || u.full_name || "").toLowerCase();
            const email   = (u.email || "").toLowerCase();
            const college = (u.collegeName || u.college || "").toLowerCase();
            return name.includes(searchVal) || email.includes(searchVal) || college.includes(searchVal);
        });
    }

    if (list.length === 0) {
        cardGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:60px;font-size:14px;">No registrations found in this category.</div>`;
        return;
    }

    list.forEach(user => {
        const name    = escapeHtml(user.fullName || user.full_name || "Unknown");
        const email   = escapeHtml(user.email || "");
        const college = escapeHtml(user.collegeName || user.college || "Not Provided");
        const course  = escapeHtml(user.qualification || user.course || "Not Provided");
        const batch   = escapeHtml(user.passoutYear || user.passedOutYear || "");
        const regId   = escapeHtml(user.studentRegId || user.regId || "");
        const gender  = escapeHtml(user.gender || "Not Specified");
        const phone   = escapeHtml(user.mobile || user.phone || "");
        const score   = user.trustScore || 0;
        const ocrOk   = user.documentVerifiedByOCR === true || user.isFeeReceiptVerified === true;
        const avatar  = sanitizeUrl(user.avatar || user.profilePhotoUrl);
        const status  = user.accountStatus || "PENDING_APPROVAL";
        const isApproved = user.adminApproved === true && status !== "REJECTED";
        const isRejected = status === "REJECTED";

        let regDate = "N/A";
        if (user.createdAt) {
            try { regDate = new Date(user.createdAt).toLocaleDateString("en-IN"); } catch {}
        }

        const statusBadge = isApproved
            ? `<span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.4);padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">✅ Approved</span>`
            : isRejected
                ? `<span style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.4);padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">❌ Rejected</span>`
                : `<span style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">⏳ Pending</span>`;

        const actionBtns = isApproved || isRejected ? `
            <button onclick="undoDecision('${user._docId}','${user.email}')" style="width:100%;margin-top:8px;padding:9px;border-radius:9px;border:1px solid rgba(148,163,184,0.3);background:rgba(255,255,255,0.07);color:#cbd5e1;font-size:13px;font-weight:600;cursor:pointer;">
                ↩ Undo Decision
            </button>` : `
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button onclick="approveUser('${user._docId}','${user.email}')" style="flex:1;padding:10px;border-radius:9px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">
                    ✅ Approve
                </button>
                <button onclick="rejectUser('${user._docId}','${user.email}')" style="flex:1;padding:10px;border-radius:9px;border:none;background:rgba(239,68,68,0.85);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">
                    ❌ Reject
                </button>
            </div>`;

        const avatarHtml = avatar
            ? `<img src="${avatar}" alt="${name}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid rgba(245,158,11,0.4);" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div style="display:none;width:60px;height:60px;border-radius:50%;background:rgba(245,158,11,0.25);align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#f59e0b;border:2px solid rgba(245,158,11,0.4);">${name.charAt(0)}</div>`
            : `<div style="width:60px;height:60px;border-radius:50%;background:rgba(245,158,11,0.25);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#f59e0b;border:2px solid rgba(245,158,11,0.4);">${name.charAt(0)}</div>`;

        const card = document.createElement("div");
        card.className = "approval-card";
        card.dataset.docId = user._docId;
        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <div style="flex-shrink:0;">${avatarHtml}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:15px;font-weight:700;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
                    <div style="font-size:11.5px;color:#94a3b8;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${email}</div>
                    <div style="margin-top:5px;">${statusBadge}</div>
                </div>
            </div>

            <div style="background:rgba(0,0,0,0.25);border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px;margin-bottom:12px;">
                <div><span style="color:#64748b;">Gender</span><br><span style="color:#e2e8f0;font-weight:600;">${gender}</span></div>
                <div><span style="color:#64748b;">Phone</span><br><span style="color:#e2e8f0;font-weight:600;">${phone || "N/A"}</span></div>
                <div><span style="color:#64748b;">Course</span><br><span style="color:#e2e8f0;font-weight:600;">${course}</span></div>
                <div><span style="color:#64748b;">Batch</span><br><span style="color:#e2e8f0;font-weight:600;">${batch || "N/A"}</span></div>
                <div style="grid-column:1/-1;"><span style="color:#64748b;">College</span><br><span style="color:#e2e8f0;font-weight:600;">${college}</span></div>
                <div><span style="color:#64748b;">Reg ID</span><br><span style="color:#e2e8f0;font-weight:600;">${regId || "N/A"}</span></div>
                <div><span style="color:#64748b;">Registered</span><br><span style="color:#e2e8f0;font-weight:600;">${regDate}</span></div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                <span style="font-size:11px;padding:3px 9px;border-radius:10px;font-weight:600;${ocrOk ? 'background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.3);' : 'background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.25);'}">
                    ${ocrOk ? "🧾 Receipt Scanned" : "📄 No Receipt"}
                </span>
                <span style="font-size:11px;padding:3px 9px;border-radius:10px;font-weight:600;background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.25);">
                    Trust: ${score}%
                </span>
            </div>

            ${actionBtns}
        `;

        cardGrid.appendChild(card);
    });
}

// Approve a user
window.approveUser = async function(docId, userEmail) {
    if (!confirm(`Approve ${userEmail}? They will be able to login immediately.`)) return;

    const card = document.querySelector(`[data-doc-id="${docId}"]`);
    if (card) {
        card.style.opacity = "0.6";
        card.style.pointerEvents = "none";
    }

    const approvalData = {
        accountStatus: "ACTIVE_STUDENT",
        adminApproved: true,
        approvedAt: new Date().toISOString()
    };

    try {
        // Update registrations
        await updateDoc(doc(db, "registrations", docId), approvalData);

        // Update students collection
        try {
            const studSnap = await getDocs(query(collection(db, "students"), where("email", "==", userEmail)));
            for (const d of studSnap.docs) await updateDoc(doc(db, "students", d.id), approvalData);
        } catch (e) { console.warn("Students update note:", e.message); }

        // Update users collection
        try {
            await updateDoc(doc(db, "users", userEmail.toLowerCase()), approvalData);
        } catch (e) { console.warn("Users update note:", e.message); }

        // Update local list
        const u = pendingUsers.find(x => x._docId === docId);
        if (u) { u.accountStatus = "ACTIVE_STUDENT"; u.adminApproved = true; }

        updateCounts();
        renderCards();
    } catch (err) {
        console.error("Approval error:", err);
        alert("Could not approve: " + err.message);
        if (card) { card.style.opacity = "1"; card.style.pointerEvents = ""; }
    }
};

// Reject a user
window.rejectUser = async function(docId, userEmail) {
    const reason = prompt(`Reason for rejecting ${userEmail} (optional):`);
    if (reason === null) return; // user cancelled

    const card = document.querySelector(`[data-doc-id="${docId}"]`);
    if (card) {
        card.style.opacity = "0.6";
        card.style.pointerEvents = "none";
    }

    const rejectData = {
        accountStatus: "REJECTED",
        adminApproved: false,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason || "Did not meet verification criteria"
    };

    try {
        await updateDoc(doc(db, "registrations", docId), rejectData);

        try {
            const studSnap = await getDocs(query(collection(db, "students"), where("email", "==", userEmail)));
            for (const d of studSnap.docs) await updateDoc(doc(db, "students", d.id), rejectData);
        } catch (e) { console.warn("Students reject note:", e.message); }

        try {
            await updateDoc(doc(db, "users", userEmail.toLowerCase()), rejectData);
        } catch (e) { console.warn("Users reject note:", e.message); }

        const u = pendingUsers.find(x => x._docId === docId);
        if (u) { u.accountStatus = "REJECTED"; u.adminApproved = false; }

        updateCounts();
        renderCards();
    } catch (err) {
        console.error("Rejection error:", err);
        alert("Could not reject: " + err.message);
        if (card) { card.style.opacity = "1"; card.style.pointerEvents = ""; }
    }
};

// Undo a decision — sets back to pending
window.undoDecision = async function(docId, userEmail) {
    if (!confirm(`Reset ${userEmail} back to Pending Approval?`)) return;

    const undoData = {
        accountStatus: "PENDING_APPROVAL",
        adminApproved: false,
        approvedAt: null,
        rejectedAt: null
    };

    try {
        await updateDoc(doc(db, "registrations", docId), undoData);
        try {
            const studSnap = await getDocs(query(collection(db, "students"), where("email", "==", userEmail)));
            for (const d of studSnap.docs) await updateDoc(doc(db, "students", d.id), undoData);
        } catch (e) {}
        try { await updateDoc(doc(db, "users", userEmail.toLowerCase()), undoData); } catch (e) {}

        const u = pendingUsers.find(x => x._docId === docId);
        if (u) { u.accountStatus = "PENDING_APPROVAL"; u.adminApproved = false; }

        updateCounts();
        renderCards();
    } catch (err) {
        alert("Could not undo: " + err.message);
    }
};

// Filter tab clicks
document.querySelectorAll(".filter-tab").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        renderCards();
    });
});

if (searchInput) {
    searchInput.addEventListener("input", renderCards);
}

// Refresh button
const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) {
    refreshBtn.addEventListener("click", loadAllRegistrations);
}

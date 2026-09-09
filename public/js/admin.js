import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const table = document.getElementById("userTable");
const totalUsers = document.getElementById("totalUsers");
const ocrVerifiedUsers = document.getElementById("ocrVerifiedUsers");
const verifiedUsers = document.getElementById("verifiedUsers");
const search = document.getElementById("search");

let users = [];

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
    if (!url) return "https://via.placeholder.com/50";
    const clean = String(url).trim();
    if (/^(https?:\/\/|data:image\/(jpeg|png|gif|webp);base64,)/i.test(clean)) {
        return clean;
    }
    return "https://via.placeholder.com/50";
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

onAuthStateChanged(auth, (user) => {
    const isLocalAdmin = verifyAdminSession();
    const isAuthAdmin = user && (user.email === "admin@intraworld.com" || user.email === "saajand34@gmail.com");

    if (!isLocalAdmin && !isAuthAdmin) {
        window.location.replace("login.html");
        return;
    }

    loadUsers();
});

async function loadUsers() {
    if (table) {
        table.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 20px; color: #d4af37;">Loading student directory...</td></tr>`;
    }
    users = [];

    try {
        let snapshot = await getDocs(collection(db, "registrations"));
        if (snapshot.empty) {
            snapshot = await getDocs(collection(db, "users"));
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            data.collectionSource = "registrations";
            users.push(data);
        });

        updateStats();
        displayUsers();
    } catch (error) {
        console.error("Database query error:", error.message);
        if (table) {
            table.innerHTML = `<tr><td colspan="12" style="text-align: center; color: #ef4444; padding: 20px;">Failed to load records. Check database permissions.</td></tr>`;
        }
    }
}

function updateStats() {
    if (totalUsers) totalUsers.textContent = users.length;
    if (ocrVerifiedUsers) {
        ocrVerifiedUsers.textContent = users.filter((u) => u.documentVerifiedByOCR === true || u.isDocVerified === true).length;
    }
    if (verifiedUsers) {
        verifiedUsers.textContent = users.filter((u) => u.verificationStatus === "verified" || u.isVerified === true).length;
    }
}

function displayUsers() {
    if (!table) return;
    table.innerHTML = "";

    const filter = search ? search.value.toLowerCase().trim() : "";

    const filteredUsers = users.filter((user) => {
        const name = (user.fullName || user.full_name || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        const college = (user.collegeOrUniversity || user.collegeName || user.college || "").toLowerCase();
        const state = (user.state || "").toLowerCase();
        const qualification = (user.qualification || "").toLowerCase();

        return (
            name.includes(filter) ||
            email.includes(filter) ||
            college.includes(filter) ||
            qualification.includes(filter)
        );
    });

    if (filteredUsers.length === 0) {
        table.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 20px; color: #d6d3d1;">No matching student records found.</td></tr>`;
        return;
    }

    filteredUsers.forEach((user) => {
        const photo = sanitizeUrl(user.avatar || user.profilePhotoUrl);
        const fullName = escapeHtml(user.fullName || user.full_name || "N/A");
        const email = escapeHtml(user.email || "N/A");
        const mobile = escapeHtml(user.mobileNumber || user.mobile || user.phone || "N/A");
        const qualification = escapeHtml(user.qualification || "N/A");
        const college = escapeHtml(user.collegeOrUniversity || user.collegeName || user.college || "N/A");
        const passout = escapeHtml(user.passoutYear || user.passedOutYear || user.passout_year || "N/A");
        const isOCR = user.documentVerifiedByOCR === true || user.isDocVerified === true;

        let regDate = "N/A";
        if (user.createdAt) {
            try {
                regDate = user.createdAt.toDate ? user.createdAt.toDate().toLocaleDateString() : new Date(user.createdAt).toLocaleDateString();
            } catch {
                regDate = "Recently";
            }
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><img class="profile" src="${photo}" alt="Student" onerror="this.src='https://via.placeholder.com/50'"></td>
            <td><strong>${fullName}</strong></td>
            <td>${email}</td>
            <td>${mobile}</td>
            <td>${qualification}</td>
            <td>${college}</td>
            <td>${passout}</td>
            <td>${escapeHtml(regDate)}</td>
            <td>
                <span class="status-badge status-verified">
                    ${isOCR ? "Verified (OCR)" : "Verified"}
                </span>
            </td>
            <td>
                <button class="delete" type="button">Delete</button>
            </td>
        `;

        const deleteBtn = tr.querySelector(".delete");
        deleteBtn.addEventListener("click", async () => {
            const ok = confirm(`Delete student record for ${user.fullName || user.email}? This cannot be undone.`);
            if (!ok) return;

            deleteBtn.disabled = true;
            deleteBtn.textContent = "...";

            try {
                await deleteDoc(doc(db, user.collectionSource || "registrations", user.id));
                tr.remove();
                users = users.filter((u) => u.id !== user.id);
                updateStats();
            } catch (err) {
                console.error("Delete failure:", err);
                alert("Could not remove record: " + err.message);
                deleteBtn.disabled = false;
                deleteBtn.textContent = "Delete";
            }
        });

        table.appendChild(tr);
    });
}

if (search) {
    search.addEventListener("input", displayUsers);
}
import { auth, db } from "./firebase-config.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    getDocs,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const table = document.getElementById("userTable");
const totalUsers = document.getElementById("totalUsers");
const verifiedUsers = document.getElementById("verifiedUsers");
const search = document.getElementById("search");
let users = [];

// 1. Protect Admin Page
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    if (user.email !== "admin@intraworld.com") {
        alert("Access Denied: Admin privileges required.");
        window.location.href = "dashboard.html";
        return;
    }

    loadUsers();
});

// 2. Load Firestore Users
async function loadUsers() {
    table.innerHTML = `<tr><td colspan="8">Loading members...</td></tr>`;
    users = [];
    let verifiedCount = 0;

    try {
        const snapshot = await getDocs(collection(db, "users"));
        
        snapshot.forEach((document) => {
            const data = document.data();
            data.id = document.id;
            users.push(data);

            // Check liveness verification from map structure or top-level field
            if (data.verifications?.livenessVerified || data.livenessVerified) {
                verifiedCount++;
            }
        });

        totalUsers.innerHTML = users.length;
        verifiedUsers.innerHTML = verifiedCount;

        displayUsers(users);
    } catch (error) {
        console.error("Error loading users:", error);
        table.innerHTML = `<tr><td colspan="8">Error loading data: ${error.message}</td></tr>`;
    }
}

// 3. Format Date Helper
function formatDate(createdAt) {
    if (!createdAt) return "N/A";
    if (createdAt.toDate) {
        return createdAt.toDate().toLocaleDateString();
    }
    return new Date(createdAt).toLocaleDateString();
}

// 4. Render Table Records
function displayUsers(list) {
    table.innerHTML = "";

    if (list.length === 0) {
        table.innerHTML = `<tr><td colspan="8">No members found.</td></tr>`;
        return;
    }

    list.forEach((user) => {
        // Read either updated field name or fallback legacy field name
        const college = user.collegeOrUniversity || user.collegeUniversity || "N/A";
        const regDate = formatDate(user.createdAt);
        const photo = user.profilePhotoUrl || "https://via.placeholder.com/60";

        table.innerHTML += `
            <tr>
                <td>
                    <img class="profile" src="${photo}" alt="Profile Photo" onerror="this.src='https://via.placeholder.com/60'">
                </td>
                <td>${user.fullName || "N/A"}</td>
                <td>${user.email || "N/A"}</td>
                <td>${user.mobileNumber || "N/A"}</td>
                <td>${college}</td>
                <td>${user.qualification || "N/A"}</td>
                <td>${regDate}</td>
                <td>
                    <button class="delete" onclick="deleteUser('${user.id}')">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

// 5. Search Filter
if (search) {
    search.addEventListener("keyup", () => {
        const keyword = search.value.toLowerCase().trim();
        const filtered = users.filter((user) => {
            const name = (user.fullName || "").toLowerCase();
            const email = (user.email || "").toLowerCase();
            const college = (user.collegeOrUniversity || user.collegeUniversity || "").toLowerCase();
            return name.includes(keyword) || email.includes(keyword) || college.includes(keyword);
        });
        displayUsers(filtered);
    });
}

// 6. Delete User Document
window.deleteUser = async function (id) {
    const ok = confirm("Are you sure you want to delete this member document?");
    if (!ok) return;

    try {
        await deleteDoc(doc(db, "users", id));
        alert("Member document deleted from database.");
        loadUsers();
    } catch (e) {
        console.error("Delete error:", e);
        alert("Delete failed: " + e.message);
    }
};

// 7. Logout Action
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await signOut(auth);
        window.location.href = "index.html";
    };
}
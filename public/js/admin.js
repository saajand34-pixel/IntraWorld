import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    getDocs,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const table = document.getElementById("userTable");
const totalUsers = document.getElementById("totalUsers");
const ocrVerifiedUsers = document.getElementById("ocrVerifiedUsers");
const verifiedUsers = document.getElementById("verifiedUsers");
const search = document.getElementById("search");

let users = [];

onAuthStateChanged(auth, async (user) => {
    loadUsers();
});

// Load All Users from Firestore Database
async function loadUsers() {
    if (table) table.innerHTML = `<tr><td colspan="12">Loading members...</td></tr>`;
    users = [];

    try {
        let snapshot = await getDocs(collection(db, "registrations"));
        if (snapshot.empty) {
            snapshot = await getDocs(collection(db, "users"));
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            data.collectionSource = snapshot.query.path?.segments?.[0] || "registrations";
            users.push(data);
        });

        updateStats();
        displayUsers();
    } catch (error) {
        console.error("Error loading database:", error);
    }
}

// Update Dashboard Statistics Counters
function updateStats() {
    if (totalUsers) totalUsers.innerText = users.length;
    if (ocrVerifiedUsers) ocrVerifiedUsers.innerText = users.filter(u => u.documentVerifiedByOCR === true).length;
    if (verifiedUsers) verifiedUsers.innerText = users.filter(u => u.verificationStatus === 'verified' || u.isVerified === true).length;
}

// Render Main Database Members Table
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
            state.includes(filter) ||
            qualification.includes(filter)
        );
    });

    if (filteredUsers.length === 0) {
        table.innerHTML = `<tr><td colspan="12">No users found</td></tr>`;
        return;
    }

    filteredUsers.forEach((user) => {
        const photo = user.avatar || user.profilePhotoUrl || "https://via.placeholder.com/50";
        const fullName = user.fullName || user.full_name || "N/A";
        const email = user.email || "N/A";
        const mobile = user.mobileNumber || user.mobile || user.phone || "N/A";
        const gender = user.gender || "N/A";
        const state = user.state || "N/A";
        const qualification = user.qualification || "N/A";
        const college = user.collegeOrUniversity || user.collegeName || user.college || "N/A";
        const passout = user.passoutYear || user.passout_year || "N/A";
        const regDate = user.createdAt ? (user.createdAt.toDate ? user.createdAt.toDate().toLocaleDateString() : new Date(user.createdAt).toLocaleDateString()) : "N/A";
        const isOCR = user.documentVerifiedByOCR === true;

        table.innerHTML += `
            <tr>
                <td><img class="profile" src="${photo}" alt="Photo" onerror="this.src='https://via.placeholder.com/50'"></td>
                <td><strong>${fullName}</strong></td>
                <td>${email}</td>
                <td>${mobile}</td>
                <td>${gender}</td>
                <td>${state}</td>
                <td>${qualification}</td>
                <td>${college}</td>
                <td>${passout}</td>
                <td>${regDate}</td>
                <td>
                    <span class="status-badge status-verified">
                        ${isOCR ? 'Verified (OCR)' : 'Verified'}
                    </span>
                </td>
                <td>
                    <button class="delete" onclick="deleteUser('${user.id}', '${user.collectionSource}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

// REMOVE DECISION: Deletes record from Firestore database
window.deleteUser = async function(id, collectionSource) {
    const ok = confirm("Are you sure you want to remove this user from the database?");
    if (!ok) return;

    try {
        await deleteDoc(doc(db, collectionSource || "registrations", id));
        alert("User removed successfully.");
        loadUsers();
    } catch (e) {
        console.error("Delete error:", e);
        alert("Failed to remove user: " + e.message);
    }
};

if (search) {
    search.addEventListener("keyup", displayUsers);
}
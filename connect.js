import { auth, db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    doc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let userConnections = new Set();

// Check localStorage FIRST - this is our source of truth
const localUser = localStorage.getItem("currentUser");
if (!localUser) {
    alert("Please log in first.");
    window.location.href = "login.html";
} else {
    // If localStorage has user, proceed - Firebase will sync in background
    const storedUserData = JSON.parse(localUser);
    
    // Wait for Firebase auth to sync
    onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            // Firebase authenticated user
            currentUser = firebaseUser;
        } else {
            // Firebase not authenticated, but we have localStorage session
            // Create a fake user object from localStorage for Firebase operations
            currentUser = {
                uid: storedUserData.uid || "localStorage-user",
                email: storedUserData.email,
                displayName: storedUserData.fullName
            };
        }

        // NOW load data
        await loadUserConnections();
        await loadAllStudents();
    });
}

// Load existing connected user IDs for current user
async function loadUserConnections() {
    if (!currentUser || !currentUser.uid) return;
    try {
        const connSnap = await getDocs(collection(db, "users", currentUser.uid, "connections"));
        userConnections.clear();
        connSnap.forEach((docSnap) => {
            userConnections.add(docSnap.id);
        });
    } catch (err) {
        console.error("Error loading connections:", err);
        // Don't redirect on error - user can still use app with localStorage
    }
}

// Load all registered profiles
async function loadAllStudents(phoneFilter = "") {
    const grid = document.getElementById("studentGrid");
    if (!grid) return;

    grid.innerHTML = `<div style="color: #7db7ff;">Searching directory...</div>`;

    try {
        const querySnapshot = await getDocs(collection(db, "registrations"));
        grid.innerHTML = "";

        if (querySnapshot.empty) {
            grid.innerHTML = `<div style="color: #7db7ff;">No registered student profiles found.</div>`;
            return;
        }

        let matchCount = 0;

        querySnapshot.forEach((docSnap) => {
            const student = docSnap.data();
            const studentId = docSnap.id;
            const studentPhone = student.phone || student.mobile || "";
            const studentName = student.fullName || "Student User";
            const studentEmail = student.email || "";

            // Hide logged-in user from self-listing
            const localUserData = localStorage.getItem("currentUser");
            if (localUserData) {
                const parsedLocalUser = JSON.parse(localUserData);
                if (studentEmail.toLowerCase() === parsedLocalUser.email?.toLowerCase()) {
                    return;
                }
            }

            // Filter by phone number if a search term is provided
            if (phoneFilter && !studentPhone.toLowerCase().includes(phoneFilter.toLowerCase())) {
                return;
            }

            matchCount++;

            const isAlreadyConnected = userConnections.has(studentId);

            const card = document.createElement("div");
            card.className = "student-card";
            card.innerHTML = `
                <div class="student-avatar">${studentName.charAt(0).toUpperCase()}</div>
                <h3>${studentName}</h3>
                <p><i class="fa-solid fa-phone"></i> ${studentPhone || "No Phone Saved"}</p>
                <button class="connect-btn ${isAlreadyConnected ? "connected" : ""}" id="btn-${studentId}">
                    <i class="fa-solid ${isAlreadyConnected ? "fa-user-check" : "fa-user-plus"}"></i>
                    ${isAlreadyConnected ? "Connected" : "Connect Contact"}
                </button>
            `;

            const btn = card.querySelector(`#btn-${studentId}`);
            btn.addEventListener("click", () => {
                if (!userConnections.has(studentId)) {
                    connectWithStudent(studentId, studentName, btn);
                }
            });

            grid.appendChild(card);
        });

        if (matchCount === 0) {
            grid.innerHTML = `<div style="color: #7db7ff;">No registered students matched that contact number.</div>`;
        }

    } catch (err) {
        console.error("Error fetching students:", err);
        grid.innerHTML = `<div style="color: #ef4444;">Failed to load contacts list.</div>`;
    }
}

// Save connection into Firestore
async function connectWithStudent(targetUserId, targetUserName, buttonElement) {
    if (!currentUser || !currentUser.uid) return;

    try {
        buttonElement.disabled = true;
        await setDoc(doc(db, "users", currentUser.uid, "connections", targetUserId), {
            connectedAt: new Date().toISOString(),
            name: targetUserName
        });

        userConnections.add(targetUserId);
        buttonElement.classList.add("connected");
        buttonElement.innerHTML = `<i class="fa-solid fa-user-check"></i> Connected`;
        alert(`Successfully connected with ${targetUserName}!`);
    } catch (err) {
        console.error("Error connecting with student:", err);
        alert("Failed to save connection: " + err.message);
    } finally {
        buttonElement.disabled = false;
    }
}

// Event Listeners for Searching
document.addEventListener("DOMContentLoaded", () => {
    const searchBtn = document.getElementById("searchPhoneBtn");
    const searchInput = document.getElementById("phoneSearchInput");

    searchBtn?.addEventListener("click", () => {
        const filterValue = searchInput ? searchInput.value.trim() : "";
        loadAllStudents(filterValue);
    });

    // Auto refresh when input is cleared
    searchInput?.addEventListener("input", (e) => {
        if (e.target.value.trim() === "") {
            loadAllStudents();
        }
    });
});

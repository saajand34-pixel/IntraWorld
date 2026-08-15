import { auth, db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    doc, 
    setDoc, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let userConnections = new Set();

// Authenticate user
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserConnections();
        loadAllStudents();
    } else {
        alert("Please log in first.");
        window.location.href = "login.html";
    }
});

// Load existing connected user IDs for current user
async function loadUserConnections() {
    try {
        const connSnap = await getDocs(collection(db, "users", currentUser.uid, "connections"));
        connSnap.forEach((docSnap) => {
            userConnections.add(docSnap.id);
        });
    } catch (err) {
        console.error("Error loading connections:", err);
    }
}

// Load all registered profiles
async function loadAllStudents(phoneFilter = "") {
    const grid = document.getElementById("studentGrid");
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

            // Hide self
            if (currentUser && studentEmail.toLowerCase() === currentUser.email?.toLowerCase()) {
                return;
            }

            // Filter by phone number if provided
            if (phoneFilter && !studentPhone.includes(phoneFilter)) {
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
                if (!isAlreadyConnected) {
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
    try {
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
    }
}

// Search by Phone Contact
document.getElementById("searchPhoneBtn")?.addEventListener("click", () => {
    const filterValue = document.getElementById("phoneSearchInput").value.trim();
    loadAllStudents(filterValue);
});
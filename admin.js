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



// Protect Admin Page

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "index.html";
        return;

    }

    if (user.email !== "admin@intraworld.com") {

        alert("Access Denied");

        window.location.href = "dashboard.html";

        return;

    }

    loadUsers();

});



// Load Firestore Users

async function loadUsers() {

    table.innerHTML = "";

    users = [];

    let verified = 0;

    const snapshot = await getDocs(collection(db, "users"));

    snapshot.forEach((document) => {

        const data = document.data();

        data.id = document.id;

        users.push(data);

        if (data.livenessVerified)
            verified++;

    });

    totalUsers.innerHTML = users.length;

    verifiedUsers.innerHTML = verified;

    displayUsers(users);

}



// Display Users

function displayUsers(list) {

    table.innerHTML = "";

    list.forEach(user => {

        table.innerHTML += `

<tr>

<td>

<img class="profile"

src="${user.profilePhotoUrl || 'https://via.placeholder.com/60'}">

</td>

<td>${user.fullName || ""}</td>

<td>${user.email || ""}</td>

<td>${user.mobileNumber || ""}</td>

<td>${user.collegeUniversity || ""}</td>

<td>${user.qualification || ""}</td>

<td>${user.createdAt || ""}</td>

<td>

<button class="delete"

onclick="deleteUser('${user.id}')">

Delete

</button>

</td>

</tr>

`;

    });

}



// Search Users

search.addEventListener("keyup", () => {

    const keyword = search.value.toLowerCase();

    const filtered = users.filter(user =>

        (user.fullName || "").toLowerCase().includes(keyword) ||

        (user.email || "").toLowerCase().includes(keyword) ||

        (user.collegeUniversity || "").toLowerCase().includes(keyword)

    );

    displayUsers(filtered);

});



// Delete User

window.deleteUser = async function(id) {

    const ok = confirm("Delete this member?");

    if (!ok) return;

    try {

        await deleteDoc(doc(db, "users", id));

        alert("Member Deleted");

        loadUsers();

    }

    catch (e) {

        alert(e.message);

    }

}



// Logout

document.getElementById("logoutBtn").onclick = async () => {

    await signOut(auth);

    window.location.href = "index.html";

};
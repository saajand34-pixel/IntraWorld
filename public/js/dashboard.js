import { getAuthenticatedUser } from './auth-check.js';
import { db } from './firebase-config.js';
import { collection, getDocs, query } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
    const user = getAuthenticatedUser();
    if (!user) return;

    const nameSpan = document.getElementById('welcomeStudentName');
    const collegeSpan = document.getElementById('welcomeStudentCollege');
    if (nameSpan && user.fullName) nameSpan.textContent = user.fullName;
    if (collegeSpan && (user.collegeName || user.college)) collegeSpan.textContent = '• ' + (user.collegeName || user.college);

    // Dynamic connection counters
    try {
        if (db) {
            const connEl = document.getElementById('connections');
            if (connEl) {
                const q = query(collection(db, 'registrations'));
                const snap = await getDocs(q);
                connEl.textContent = Math.max(0, snap.size - 1);
            }
        }
    } catch (e) {}
});

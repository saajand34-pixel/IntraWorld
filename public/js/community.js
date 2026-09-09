import { db } from "../firebase-config.js";
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("college-search-input");
    const clearBtn = document.getElementById("clear-search-btn");
    const collegesWrapper = document.getElementById("colleges-wrapper");
    const pillsHeaderTitle = document.getElementById("pills-header-title");
    const pillsContainer = document.getElementById("college-pills-container");
    const feedContainer = document.getElementById("feed-container");

    const PRESET_COLLEGES = [
        {
            name: "Seshadripuram First Grade College (SFGC)",
            shortName: "SFGC",
            posts: [
                {
                    author: "Council Department",
                    role: "Staff Secretary",
                    tag: "Election",
                    time: "On 9th September",
                    title: "Council and CR Elections",
                    content: "SFGC announces that elections are going to starts for CR and Council members like President, Vice-President & Secretary",
                    image: "https://sjicpuc.schoolphins.com/staff/assets/sjicpuc_site/cr_election%20(4).jpg"
                },
                {
                    author: "Department of Computer Science",
                    role: "Official News",
                    tag: "News",
                    time: "2 days ago",
                    title: "Tech Parisara Organizes IT Fest",
                    content: "Syed Ayan and Bhargav Sai, V Semester BCA students, have officially taken charge of leadership for this year's upcoming Tech Parisara IT fest.",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQRPl0C7qqoAGKZKPDZir9_uLpF_Tc3axNjf9L25NlnJl1UUvOHSKwrMdv&s=10"
                }
            ]
        },
        {
            name: "Jnana Jyothi Degree College",
            shortName: "Jnana Jyothi",
            posts: [
                {
                    author: "Sports Lead",
                    role: "Student Representative",
                    tag: "Event",
                    time: "4 hours ago",
                    title: "🏆 Annual Sports Meet 2026 Selections",
                    content: "Selection trials for Athletics, Badminton, and Volleyball starting tomorrow morning at 8:00 AM. Show up in full sports gear!",
                    image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80"
                },
                {
                    author: "Principal Office",
                    role: "Notice Board",
                    tag: "News",
                    time: "2 days ago",
                    title: "📚 Extension of Central Library Timings",
                    content: "In view of upcoming semester exams, the library will stay open until 8 PM starting Monday.",
                    image: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80"
                }
            ]
        },
        {
            name: "Bishop Cotton Women's Christian College",
            shortName: "Bishop Cotton",
            posts: [
                {
                    author: "Student Council",
                    role: "Fest Convener",
                    tag: "Fest",
                    time: "1 hour ago",
                    title: "✨ Cottonian Utsav 2026 - Music & Fine Arts Fest",
                    content: "Join us for an exciting 2-day extravaganza featuring live band performances, art exhibitions, and food stalls!",
                    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80"
                },
                {
                    author: "Womens Cell",
                    role: "Event Organiser",
                    tag: "Event",
                    time: "5 hours ago",
                    title: "💡 Leadership & Entrepreneurship Workshop",
                    content: "Guest lecture by alumni entrepreneurs sharing insights on starting tech and creative ventures.",
                    image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80"
                }
            ]
        },
        {
            name: "East West College",
            shortName: "East West",
            posts: [
                {
                    author: "Tech Forum EWGI",
                    role: "Club Lead",
                    tag: "Event",
                    time: "1 hour ago",
                    title: "🤖 AI & Web3 Innovators Hackathon",
                    content: "Build prototype apps in 24 hours. Free food, certificates, and exciting gadgets for winning teams!",
                    image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80"
                },
                {
                    author: "Campus Beat",
                    role: "News Channel",
                    tag: "News",
                    time: "1 day ago",
                    title: "🌱 Green Campus Plantation Drive Initiated",
                    content: "Over 500 saplings planted by NSS volunteers across the campus ground today.",
                    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80"
                }
            ]
        },
        {
            name: "Government First Grade College Yelahanka",
            shortName: "GFGC Yelahanka",
            posts: [
                {
                    author: "Cultural Committee",
                    role: "Event Coordinator",
                    tag: "Fest",
                    time: "Recently",
                    title: "🍱 Grand Food Fest 2026 - A Huge Success!",
                    content: "The annual campus Food Fest was conducted with great enthusiasm and participation! Students showcased incredible homemade delicacies and food stalls, making the event a grand success.",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRI7VxEYzzznDiWT9WAV5NNz8B8TeA8Wr9kSWBxejiJRQ&s=10"
                }
            ]
        },
        {
            name: "BMSIT College",
            shortName: "BMSIT",
            posts: [
                {
                    author: "Rohan M.",
                    role: "Cultural Secretary",
                    tag: "Fest",
                    time: "2 hours ago",
                    title: "🎉 Utsav '26 - Annual Cultural Fest Announcement!",
                    content: "Get ready BMSITians! Registrations for Battle of the Bands, Group Dance, and Fashion Show are now open. Cash prizes worth ₹1.5 Lakhs!",
                    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80"
                },
                {
                    author: "Robotics Club",
                    role: "Technical Team",
                    tag: "Event",
                    time: "6 hours ago",
                    title: "🚀 Autonomous Drone Building Workshop",
                    content: "Learn flight controller design and sensor calibration. Open for CSE, ECE, and Mech branches.",
                    image: "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=800&q=80"
                }
            ]
        },
        {
            name: "Nitte Meenakshi (NMIT)",
            shortName: "NMIT",
            posts: [
                {
                    author: "Tech Club NMIT",
                    role: "Event Host",
                    tag: "Event",
                    time: "1 day ago",
                    title: "⚡ HackNMIT 2026 - National Level Hackathon",
                    content: "Build solutions for real-world cloud & AI problems. Free food, schwag bags, and mentorship for top 15 teams!",
                    image: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=800&q=80"
                },
                {
                    author: "NMIT Media Cell",
                    role: "News",
                    tag: "News",
                    time: "3 days ago",
                    title: "🏆 NMIT Teams Win National Smart India Hackathon",
                    content: "Congratulations to team CyberKnights for bagging first place in the AI category!",
                    image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80"
                }
            ]
        },
        {
            name: "Nagarjuna College",
            shortName: "Nagarjuna (NCET)",
            posts: [
                {
                    author: "NCET Cultural Crew",
                    role: "Event Lead",
                    tag: "Fest",
                    time: "3 hours ago",
                    title: "🔥 NCET Synergy '26 Fest Night",
                    content: "Celebrity DJ night passes are now available at the campus admin desk. Grab yours before stocks run out!",
                    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80"
                },
                {
                    author: "Department of CSE",
                    role: "Event",
                    tag: "Event",
                    time: "1 day ago",
                    title: "💻 Masterclass on Cloud Native Architecture",
                    content: "Special guest lecture on Docker, Kubernetes, and DevOps pipelines by industry experts.",
                    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80"
                }
            ]
        }
    ];

    // Load any user-created custom communities from localStorage
    function getStoredCustomCommunities() {
        try {
            const raw = localStorage.getItem("intra_custom_communities");
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveCustomCommunity(community) {
        try {
            const current = getStoredCustomCommunities();
            // Avoid duplicates
            const exists = current.some(c => c.name.toLowerCase() === community.name.toLowerCase());
            if (!exists) {
                current.push(community);
                localStorage.setItem("intra_custom_communities", JSON.stringify(current));
            }
        } catch (e) {
            console.warn("Could not persist custom community:", e);
        }
    }

    // Merge preset and custom communities
    let collegesData = [...PRESET_COLLEGES, ...getStoredCustomCommunities()];

    // HTML and URL sanitizers
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
        if (/^(https?:\/\/|data:image\/(jpeg|png|gif|webp);base64,|data:application\/pdf;base64,)/i.test(clean)) {
            return clean;
        }
        return "";
    }

    function sanitizeExternalUrl(url) {
        if (!url) return "";
        const clean = String(url).trim();
        if (/^https?:\/\//i.test(clean)) {
            return clean;
        }
        return "";
    }

    // Retrieve active logged in student details
    function getLoggedInStudent() {
        try {
            const rawUser = localStorage.getItem("currentUser") || localStorage.getItem("intraWorldUser");
            if (!rawUser) return null;
            const user = JSON.parse(rawUser);
            const userCollege = (user.collegeName || user.college || user.collegeOrUniversity || user.institution || "").trim();
            const fullName = (user.fullName || user.full_name || "Student").trim();
            const email = (user.email || "").trim();
            return {
                isLoggedIn: Boolean(email || fullName),
                userCollege,
                fullName,
                email
            };
        } catch (e) {
            return null;
        }
    }

    // Acronym generator helper
    function getAcronym(str) {
        return (str || "")
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .split(/\s+/)
            .filter(w => !["of", "and", "the", "in", "for", "to", "&"].includes(w.toLowerCase()))
            .map(w => w[0])
            .join("")
            .toLowerCase();
    }

    // College string normalizer helper
    function cleanCollegeStr(str) {
        return (str || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function checkSingleCollegeMatch(searched, userCollege) {
        if (!searched || !userCollege) return false;

        const sClean = cleanCollegeStr(searched);
        const uClean = cleanCollegeStr(userCollege);

        if (!sClean || !uClean) return false;

        // Exact match
        if (sClean === uClean) return true;

        // Substring containment
        if (sClean.length >= 3 && uClean.includes(sClean)) return true;
        if (uClean.length >= 3 && sClean.includes(uClean)) return true;

        // Acronym match
        const sAcr = getAcronym(searched);
        const uAcr = getAcronym(userCollege);

        if (sClean === uAcr || sAcr === uClean) return true;
        if (sAcr.length >= 2 && uAcr.length >= 2 && sAcr === uAcr) return true;

        // Token overlap excluding generic filler words
        const fillerWords = new Set([
            "college", "degree", "university", "institute", "institution", 
            "of", "technology", "first", "grade", "the", "engineering", 
            "management", "science", "arts", "commerce", "campus"
        ]);
        const sTokens = sClean.split(" ").filter(w => !fillerWords.has(w) && w.length > 2);
        const uTokens = uClean.split(" ").filter(w => !fillerWords.has(w) && w.length > 2);

        if (sTokens.length > 0 && uTokens.length > 0) {
            const matchingTokens = sTokens.filter(t => uTokens.some(ut => ut.includes(t) || t.includes(ut)));
            if (matchingTokens.length > 0) return true;
        }

        return false;
    }

    // Compare searched college with the student's registered college (supporting multi-course records)
    function isSameCollege(searched, userCollege) {
        if (!searched || !userCollege) return false;
        if (checkSingleCollegeMatch(searched, userCollege)) return true;

        // Extract sub-tokens from comma-separated or parenthesis notation e.g. "BCA(SFGC), MCA(BMSIT)"
        function extractParts(str) {
            const parts = [];
            const rawParts = String(str).split(/[,&/]/);
            for (const p of rawParts) {
                const trimmed = p.trim();
                if (trimmed) {
                    parts.push(trimmed);
                    const parenMatch = trimmed.match(/\(([^)]+)\)/);
                    if (parenMatch && parenMatch[1]) {
                        parts.push(parenMatch[1].trim());
                    }
                }
            }
            return parts;
        }

        const sList = extractParts(searched);
        const uList = extractParts(userCollege);

        for (const s of sList) {
            for (const u of uList) {
                if (checkSingleCollegeMatch(s, u)) return true;
            }
        }

        return false;
    }

    let activeCollege = collegesData[0];

    function renderCollegePills(colleges, selectedCollege = null) {
        pillsContainer.innerHTML = "";
        collegesWrapper.style.display = "block";

        const currentSelection = selectedCollege || colleges[0];

        colleges.forEach((college) => {
            const pill = document.createElement("button");
            pill.className = `college-pill ${college.name === currentSelection?.name ? "active" : ""}`;
            pill.innerHTML = `<i class="fa-solid fa-building-columns"></i> ${escapeHtml(college.name)}`;

            pill.addEventListener("click", () => {
                document.querySelectorAll(".college-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                activeCollege = college;
                renderPosts(college);
            });

            pillsContainer.appendChild(pill);
        });

        if (colleges.length > 0) {
            activeCollege = currentSelection;
            renderPosts(currentSelection);
        }
    }

    async function renderPosts(college, alertBannerHtml = "") {
        let banner = alertBannerHtml ? alertBannerHtml : "";

        const currentStudent = getLoggedInStudent();
        let statusNotice = "";

        if (currentStudent && currentStudent.isLoggedIn) {
            if (currentStudent.userCollege && isSameCollege(college.name, currentStudent.userCollege)) {
                statusNotice = `
                    <div class="card" style="background: linear-gradient(135deg, rgba(0, 102, 255, 0.15), rgba(56, 189, 248, 0.08)); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 14px; padding: 18px 22px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 42px; height: 42px; border-radius: 50%; background: #0066ff; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
                                <i class="fa-solid fa-graduation-cap"></i>
                            </div>
                            <div>
                                <strong style="color: #fff; font-size: 1rem;">Enrolled Student of ${escapeHtml(college.name)}</strong>
                                <p style="color: #94a3b8; font-size: 0.85rem; margin: 2px 0 0 0;">You have verified posting privileges in this community feed.</p>
                            </div>
                        </div>
                        <a href="posts.html?audience=community" class="btn" style="background: #0066ff; color: #fff; text-decoration: none; padding: 9px 18px; font-size: 0.88rem; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-pen-to-square"></i> Post Announcement
                        </a>
                    </div>
                `;
            } else if (currentStudent.userCollege) {
                statusNotice = `
                    <div class="card" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(234, 179, 8, 0.15); color: #eab308; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                        <div>
                            <strong style="color: #e2e8f0; font-size: 0.92rem;">Guest College View (Enrolled at: ${escapeHtml(currentStudent.userCollege)})</strong>
                            <p style="color: #94a3b8; font-size: 0.82rem; margin: 2px 0 0 0;">Community posting is restricted to enrolled students of ${escapeHtml(college.shortName || college.name)}. You can post in your own college community feed.</p>
                        </div>
                    </div>
                `;
            }
        }

        feedContainer.innerHTML = banner + statusNotice + '<div style="text-align: center; padding: 30px; color: #7db7ff;"><i class="fa-solid fa-spinner fa-spin"></i> Loading community feed...</div>';

        // Fetch live community posts from Firestore safely (no compound index required)
        let livePosts = [];
        try {
            let snap;
            try {
                const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
                snap = await getDocs(q);
            } catch (queryErr) {
                console.warn("Ordered query fallback note:", queryErr.message);
                snap = await getDocs(collection(db, "posts"));
            }

            snap.forEach(d => {
                const data = d.data();
                const isComm = (data.postType === "community" || data.audience === "community");
                const targetCol = data.targetCollege || data.authorCollege || data.collegeName || "";

                if (isComm && (isSameCollege(targetCol, college.name) || (college.shortName && isSameCollege(targetCol, college.shortName)) || isSameCollege(data.authorCollege, college.name) || isSameCollege(data.collegeName, college.name))) {
                    livePosts.push({
                        author: data.authorName || (data.authorEmail ? data.authorEmail.split("@")[0] : "Student"),
                        role: "Enrolled Student",
                        tag: data.aiLabel ? `${data.aiLabel}` : "Community Post",
                        time: data.createdAt ? new Date(data.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recently",
                        title: data.content && data.content.length > 60 ? data.content.substring(0, 60) + "..." : (data.content || "Student Community Post"),
                        content: data.content || "",
                        image: data.mediaUrl || null,
                        docUrl: data.docUrl || null,
                        docName: data.docName || null,
                        githubUrl: data.githubUrl || null,
                        aiPercentage: data.aiPercentage,
                        createdAt: data.createdAt || ""
                    });
                }
            });

            livePosts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } catch (err) {
            console.warn("Could not fetch live Firestore community posts:", err);
        }

        const allPosts = [...livePosts, ...(college.posts || [])];

        if (allPosts.length === 0) {
            feedContainer.innerHTML = `
                ${banner}
                ${statusNotice}
                <div class="card empty-feed">
                    <i class="fa-solid fa-bullhorn fa-2x" style="margin-bottom: 12px; color: #7db7ff; display: block;"></i>
                    No announcements posted for <strong>${escapeHtml(college?.name || "this college")}</strong> yet.
                </div>
            `;
            return;
        }

        const postsHtml = allPosts.map(post => `
            <div class="card post-card" style="margin-bottom: 20px; padding: 22px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 38px; height: 38px; border-radius: 50%; background: #0066ff; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff;">
                            ${escapeHtml(post.author ? post.author.charAt(0).toUpperCase() : "S")}
                        </div>
                        <div>
                            <strong style="color: #fff; font-size: 1.02rem;">${escapeHtml(post.author)}</strong>
                            <div style="color: #8fa8bf; font-size: 0.8rem;">${escapeHtml(post.role || "Member")} • <span style="color: #38bdf8;">${escapeHtml(college.shortName || college.name)}</span></div>
                        </div>
                    </div>
                    <span style="background: rgba(0, 102, 255, 0.2); color: #38bdf8; font-size: 0.75rem; padding: 4px 12px; border-radius: 20px; font-weight: 600; border: 1px solid rgba(56, 189, 248, 0.3);">
                        #${escapeHtml(post.tag || "Community Post")}
                    </span>
                </div>

                <h4 style="color: #fff; margin: 10px 0 8px 0; font-size: 1.15rem; font-weight: 600;">${escapeHtml(post.title)}</h4>
                <p style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; margin-bottom: 14px;">${escapeHtml(post.content)}</p>
                
                ${post.image && sanitizeUrl(post.image) ? `
                <div style="margin-bottom: 16px; border-radius: 12px; overflow: hidden; max-height: 480px; border: 1px solid rgba(245, 158, 11, 0.2); background: rgba(16, 2, 5, 0.6);">
                    <img src="${sanitizeUrl(post.image)}" alt="${escapeHtml(post.title || 'Community Attachment')}" style="width: 100%; max-height: 480px; height: auto; object-fit: contain; display: block;" onerror="this.style.display='none'" />
                </div>
                ` : ''}

                ${post.docUrl && sanitizeUrl(post.docUrl) ? `
                <a href="${sanitizeUrl(post.docUrl)}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(post.docName || 'document.pdf')}" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; margin-bottom: 16px; border-radius: 10px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); color: #fff; text-decoration: none;">
                    <i class="fa-solid fa-file-pdf fa-2x" style="color: #ef4444;"></i>
                    <div>
                        <strong style="display: block; font-size: 13px;">${escapeHtml(post.docName || "Download Document Attachment")}</strong>
                        <span style="font-size: 11px; color: #7db7ff;">Click to view / download</span>
                    </div>
                </a>
                ` : ''}

                ${post.githubUrl && sanitizeExternalUrl(post.githubUrl) ? `
                <a href="${sanitizeExternalUrl(post.githubUrl)}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; margin-bottom: 16px; border-radius: 10px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); color: #fff; text-decoration: none;">
                    <i class="fa-brands fa-github fa-2x" style="color: #fff;"></i>
                    <div>
                        <strong style="display: block; font-size: 13px;">GitHub Repository Project</strong>
                        <span style="font-size: 11px; color: #7db7ff;">${escapeHtml(post.githubUrl)}</span>
                    </div>
                </a>
                ` : ''}

                <div style="color: #8fa8bf; font-size: 0.82rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 12px; margin-top: 6px;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <i class="fa-regular fa-clock"></i> ${escapeHtml(post.time || "Recently")}
                    </span>
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <span style="cursor: pointer; color: #38bdf8;"><i class="fa-regular fa-thumbs-up"></i> Helpful</span>
                        <span style="cursor: pointer; color: #7db7ff;"><i class="fa-regular fa-comment"></i> Discussion Active</span>
                    </div>
                </div>
            </div>
        `).join("");

        feedContainer.innerHTML = banner + statusNotice + postsHtml;
    }

    // Render when no matching community is found
    function renderEmptyCommunity(searchedName) {
        collegesWrapper.style.display = "none";

        const student = getLoggedInStudent();
        const registeredCollegeText = student && student.userCollege 
            ? escapeHtml(student.userCollege) 
            : "No verified college in session";

        feedContainer.innerHTML = `
            <div class="card" style="text-align: center; padding: 45px 25px; border: 1px dashed rgba(255, 255, 255, 0.18); border-radius: 16px;">
                <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 28px; color: #38bdf8;">
                    <i class="fa-solid fa-building-columns"></i>
                </div>
                <h3 style="color: #fff; font-size: 1.35rem; margin-bottom: 8px; font-weight: 600;">Community Not Created Yet</h3>
                <p style="color: #cbd5e1; font-size: 0.95rem; max-width: 540px; margin: 0 auto 14px auto; line-height: 1.6;">
                    The community page for "<strong>${escapeHtml(searchedName)}</strong>" has not been created yet on IntraWorld.
                </p>
                <div style="font-size: 12.5px; color: #94a3b8; margin-bottom: 20px; background: rgba(255, 255, 255, 0.04); display: inline-block; padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08);">
                    <i class="fa-solid fa-id-badge" style="color: #38bdf8; margin-right: 5px;"></i> Your Pursuing College: <strong style="color: #38bdf8;">${registeredCollegeText}</strong>
                </div>
                
                <div>
                    <button class="btn" id="request-community-btn" style="background: #0066ff;">
                        <i class="fa-solid fa-plus"></i> Request / Create Community for "${escapeHtml(searchedName)}"
                    </button>
                </div>

                <div id="verification-result-container" style="margin-top: 20px; max-width: 580px; margin-left: auto; margin-right: auto;"></div>
            </div>
        `;

        const requestBtn = document.getElementById("request-community-btn");
        const resultContainer = document.getElementById("verification-result-container");

        if (requestBtn && resultContainer) {
            requestBtn.addEventListener("click", () => {
                const currentStudent = getLoggedInStudent();

                if (!currentStudent || !currentStudent.isLoggedIn) {
                    resultContainer.innerHTML = `
                        <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 18px; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 8px; color: #ef4444; font-weight: 600; font-size: 0.95rem; margin-bottom: 6px;">
                                <i class="fa-solid fa-circle-exclamation"></i> Authentication Required
                            </div>
                            <p style="color: #cbd5e1; font-size: 0.88rem; line-height: 1.5;">
                                Please <a href="login.html" style="color: #38bdf8; font-weight: 600;">log in with your verified student account</a> to create or lead a campus community.
                            </p>
                        </div>
                    `;
                    return;
                }

                if (!currentStudent.userCollege) {
                    resultContainer.innerHTML = `
                        <div style="background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.35); border-radius: 12px; padding: 18px; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 8px; color: #eab308; font-weight: 600; font-size: 0.95rem; margin-bottom: 6px;">
                                <i class="fa-solid fa-triangle-exclamation"></i> College Details Missing
                            </div>
                            <p style="color: #cbd5e1; font-size: 0.88rem; line-height: 1.5;">
                                We could not find a registered college in your profile. Please complete your registration or update your college in <a href="settings.html" style="color: #38bdf8; font-weight: 600;">Settings</a>.
                            </p>
                        </div>
                    `;
                    return;
                }

                // Verify college match
                const isMatch = isSameCollege(searchedName, currentStudent.userCollege);

                if (isMatch) {
                    // Match! Create community
                    requestBtn.disabled = true;
                    requestBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying Student College Enrollment...`;

                    setTimeout(() => {
                        const newCommunity = {
                            name: searchedName,
                            shortName: searchedName.length > 25 ? (getAcronym(searchedName).toUpperCase() || searchedName.slice(0, 12)) : searchedName,
                            posts: [
                                {
                                    author: currentStudent.fullName || "Student Lead",
                                    role: "Community Founder",
                                    tag: "Welcome",
                                    time: "Just now",
                                    title: `🏛️ Official Community Hub Founded for ${searchedName}`,
                                    content: `Welcome to the official ${searchedName} campus hub on IntraWorld! Founded and verified by ${currentStudent.fullName || "an enrolled student"}. You can now share campus notices, club events, sports meetups, and academic discussions with your peers.`,
                                    image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80"
                                }
                            ]
                        };

                        saveCustomCommunity(newCommunity);
                        collegesData.push(newCommunity);

                        if (searchInput) searchInput.value = "";
                        if (clearBtn) clearBtn.style.display = "none";
                        if (pillsHeaderTitle) pillsHeaderTitle.textContent = "Campus Communities:";

                        const celebrationBanner = `
                            <div class="card" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.4); border-radius: 14px; padding: 18px 22px; margin-bottom: 22px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 42px; height: 42px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                                        <i class="fa-solid fa-circle-check"></i>
                                    </div>
                                    <div>
                                        <strong style="color: #4ade80; font-size: 1.05rem;">🎉 Community Successfully Verified & Created!</strong>
                                        <p style="color: #cbd5e1; font-size: 0.88rem; margin-top: 2px;">
                                            You have established the official hub for <strong>${escapeHtml(searchedName)}</strong>. As an actively enrolled student, you are recognized as the founding moderator!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        `;

                        renderCollegePills(collegesData, newCommunity);
                        renderPosts(newCommunity, celebrationBanner);
                    }, 500);

                } else {
                    // Mismatch! Reject creation
                    resultContainer.innerHTML = `
                        <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 20px; text-align: left; animation: fadeIn 0.3s ease;">
                            <div style="display: flex; align-items: center; gap: 10px; color: #ef4444; font-weight: 600; font-size: 1rem; margin-bottom: 8px;">
                                <i class="fa-solid fa-triangle-exclamation fa-lg"></i> Creation Rejected: College Mismatch
                            </div>
                            <p style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.5; margin-bottom: 10px;">
                                You are registered as pursuing at: <strong style="color: #38bdf8;">"${escapeHtml(currentStudent.userCollege)}"</strong>.
                            </p>
                            <p style="color: #94a3b8; font-size: 0.84rem; line-height: 1.5; margin-bottom: 14px;">
                                To maintain genuine campus moderation and prevent unauthorized hubs, IntraWorld security rules require that a student can only create and lead a community for the college they are currently pursuing.
                            </p>
                            <div>
                                <button id="switch-to-my-college-btn" class="btn" style="background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 13px; padding: 8px 16px;">
                                    <i class="fa-solid fa-magnifying-glass"></i> Search for my college: "${escapeHtml(currentStudent.userCollege)}"
                                </button>
                            </div>
                        </div>
                    `;

                    const switchBtn = document.getElementById("switch-to-my-college-btn");
                    if (switchBtn) {
                        switchBtn.addEventListener("click", () => {
                            if (searchInput) {
                                searchInput.value = currentStudent.userCollege;
                                searchInput.focus();
                            }
                            handleSearch(currentStudent.userCollege);
                        });
                    }
                }
            });
        }
    }

    function handleSearch(query) {
        const trimmed = query.trim().toLowerCase();

        if (!trimmed) {
            if (clearBtn) clearBtn.style.display = "none";
            if (pillsHeaderTitle) pillsHeaderTitle.textContent = "Campus Communities:";
            renderCollegePills(collegesData, activeCollege);
            return;
        }

        if (clearBtn) clearBtn.style.display = "block";

        const matches = collegesData.filter(c => 
            c.name.toLowerCase().includes(trimmed) || 
            (c.shortName && c.shortName.toLowerCase().includes(trimmed)) ||
            cleanCollegeStr(c.name).includes(cleanCollegeStr(trimmed)) ||
            (c.shortName && cleanCollegeStr(c.shortName).includes(cleanCollegeStr(trimmed)))
        );

        if (matches.length > 0) {
            if (pillsHeaderTitle) pillsHeaderTitle.textContent = `Matching Communities (${matches.length}):`;
            renderCollegePills(matches, matches[0]);
        } else {
            renderEmptyCommunity(query.trim());
        }
    }

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            handleSearch(e.target.value);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (searchInput) {
                searchInput.value = "";
                searchInput.focus();
            }
            handleSearch("");
        });
    }

    // Initial render on page load: automatically select student's enrolled college community
    const currentStudent = getLoggedInStudent();
    if (currentStudent && currentStudent.userCollege) {
        let myCollege = collegesData.find(c => isSameCollege(c.name, currentStudent.userCollege) || (c.shortName && isSameCollege(c.shortName, currentStudent.userCollege)));
        if (!myCollege) {
            myCollege = {
                name: currentStudent.userCollege,
                shortName: currentStudent.userCollege.split(/[(,]/)[0].trim(),
                posts: []
            };
            saveCustomCommunity(myCollege);
            collegesData.unshift(myCollege);
        }
        activeCollege = myCollege;
        renderCollegePills(collegesData, myCollege);
    } else {
        renderCollegePills(collegesData, collegesData[0]);
    }
});

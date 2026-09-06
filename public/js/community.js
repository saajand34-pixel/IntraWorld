import { db } from "../firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("college-search-input");
    const clearBtn = document.getElementById("clear-search-btn");
    const collegesWrapper = document.getElementById("colleges-wrapper");
    const pillsHeaderTitle = document.getElementById("pills-header-title");
    const pillsContainer = document.getElementById("college-pills-container");
    const feedContainer = document.getElementById("feed-container");

    const collegesData = [
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

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    let activeCollege = collegesData[0];

    function renderCollegePills(colleges, selectedCollege = null) {
        pillsContainer.innerHTML = "";
        collegesWrapper.style.display = "block";

        const currentSelection = selectedCollege || colleges[0];

        colleges.forEach((college) => {
            const pill = document.createElement("button");
            pill.className = `college-pill ${college.name === currentSelection.name ? "active" : ""}`;
            pill.innerHTML = `<i class="fa-solid fa-building-columns"></i> ${college.name}`;

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

    function renderPosts(college) {
        if (!college.posts || college.posts.length === 0) {
            feedContainer.innerHTML = `
                <div class="card empty-feed">
                    <i class="fa-solid fa-bullhorn fa-2x" style="margin-bottom: 12px; color: #7db7ff; display: block;"></i>
                    No announcements posted for <strong>${escapeHtml(college.name)}</strong> yet.
                </div>
            `;
            return;
        }

        feedContainer.innerHTML = college.posts.map(post => `
            <div class="card post-card" style="margin-bottom: 20px; padding: 22px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 38px; height: 38px; border-radius: 50%; background: #0066ff; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff;">
                            ${post.author.charAt(0)}
                        </div>
                        <div>
                            <strong style="color: #fff; font-size: 1.02rem;">${escapeHtml(post.author)}</strong>
                            <div style="color: #8fa8bf; font-size: 0.8rem;">${escapeHtml(post.role)} • <span style="color: #38bdf8;">${escapeHtml(college.shortName || college.name)}</span></div>
                        </div>
                    </div>
                    <span style="background: rgba(0, 102, 255, 0.2); color: #38bdf8; font-size: 0.75rem; padding: 4px 12px; border-radius: 20px; font-weight: 600; border: 1px solid rgba(56, 189, 248, 0.3);">
                        #${escapeHtml(post.tag)}
                    </span>
                </div>

                <h4 style="color: #fff; margin: 10px 0 8px 0; font-size: 1.15rem; font-weight: 600;">${escapeHtml(post.title)}</h4>
                <p style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; margin-bottom: 14px;">${escapeHtml(post.content)}</p>
                
                ${post.image ? `
                <div style="margin-bottom: 16px; border-radius: 10px; overflow: hidden; max-height: 320px; border: 1px solid rgba(255, 255, 255, 0.08);">
                    <img src="${post.image}" alt="${escapeHtml(post.title)}" style="width: 100%; height: 260px; object-fit: cover; display: block;" onerror="this.style.display='none'" />
                </div>
                ` : ''}

                <div style="color: #8fa8bf; font-size: 0.82rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 12px; margin-top: 6px;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <i class="fa-regular fa-clock"></i> ${escapeHtml(post.time)}
                    </span>
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <span style="cursor: pointer; color: #38bdf8;"><i class="fa-regular fa-thumbs-up"></i> Helpful</span>
                        <span style="cursor: pointer; color: #7db7ff;"><i class="fa-regular fa-comment"></i> Discussion Active</span>
                    </div>
                </div>
            </div>
        `).join("");
    }

    function renderEmptyCommunity(searchedName) {
        collegesWrapper.style.display = "none";
        feedContainer.innerHTML = `
            <div class="card" style="text-align: center; padding: 45px 25px; border: 1px dashed rgba(255, 255, 255, 0.18); border-radius: 16px;">
                <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 28px; color: #ef4444;">
                    <i class="fa-solid fa-building-circle-exclamation"></i>
                </div>
                <h3 style="color: #fff; font-size: 1.35rem; margin-bottom: 8px; font-weight: 600;">Community Not Created Yet</h3>
                <p style="color: #cbd5e1; font-size: 0.95rem; max-width: 520px; margin: 0 auto 20px auto; line-height: 1.6;">
                    The community page for "<strong>${escapeHtml(searchedName)}</strong>" has not been created yet on IntraWorld.
                </p>
                <button class="btn" id="request-community-btn" style="background: #0066ff;">
                    <i class="fa-solid fa-plus"></i> Request / Create Community for "${escapeHtml(searchedName)}"
                </button>
                <div id="request-success-msg" style="display: none; color: #22c55e; margin-top: 15px; font-size: 14px; font-weight: 500;">
                    <i class="fa-solid fa-circle-check"></i> Request submitted! Our team will activate the <strong>${escapeHtml(searchedName)}</strong> community hub shortly.
                </div>
            </div>
        `;

        const requestBtn = document.getElementById("request-community-btn");
        const successMsg = document.getElementById("request-success-msg");
        if (requestBtn && successMsg) {
            requestBtn.addEventListener("click", () => {
                requestBtn.disabled = true;
                requestBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;
                setTimeout(() => {
                    requestBtn.style.display = "none";
                    successMsg.style.display = "block";
                }, 400);
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
            (c.shortName && c.shortName.toLowerCase().includes(trimmed))
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

    // Initial render on page load
    renderCollegePills(collegesData, collegesData[0]);
});
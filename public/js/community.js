import { db } from "../firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const detectBtn = document.getElementById("enable-location-btn");
    const statusText = document.getElementById("location-status-text");
    const collegesWrapper = document.getElementById("colleges-wrapper");
    const pillsContainer = document.getElementById("college-pills-container");
    const feedContainer = document.getElementById("feed-container");

    const collegesData = [
        {
            name: "Seshadripuram First Grade College (SFGC)",
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

    if (!detectBtn) return;

    detectBtn.addEventListener("click", () => {
        statusText.textContent = "Scanning nearby campuses...";
        detectBtn.disabled = true;

        setTimeout(() => {
            statusText.textContent = `Found ${collegesData.length} colleges nearby.`;
            detectBtn.disabled = false;
            renderCollegePills(collegesData);
        }, 400);
    });

    function renderCollegePills(colleges) {
        pillsContainer.innerHTML = "";
        collegesWrapper.style.display = "block";

        colleges.forEach((college, index) => {
            const pill = document.createElement("button");
            pill.className = `college-pill ${index === 0 ? "active" : ""}`;
            pill.textContent = college.name;

            pill.addEventListener("click", () => {
                document.querySelectorAll(".college-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                renderPosts(college.posts);
            });

            pillsContainer.appendChild(pill);
        });

        if (colleges.length > 0) {
            renderPosts(colleges[0].posts);
        }
    }

    function renderPosts(posts) {
        feedContainer.innerHTML = posts.map(post => `
            <div class="card post-card" style="margin-bottom: 20px; padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <strong style="color: #fff; font-size: 1.05rem;">${post.author}</strong>
                        <span style="color: #888; font-size: 0.85rem; margin-left: 8px;">• ${post.role}</span>
                    </div>
                    <span style="background: rgba(0, 132, 255, 0.2); color: #4da6ff; font-size: 0.75rem; padding: 4px 10px; border-radius: 20px; font-weight: 600;">
                        ${post.tag}
                    </span>
                </div>
                <h4 style="color: #fff; margin: 6px 0 10px 0; font-size: 1.15rem;">${post.title}</h4>
                <p style="color: #ccc; font-size: 0.95rem; line-height: 1.5; margin-bottom: 14px;">${post.content}</p>
                
                <div style="margin-bottom: 14px; border-radius: 8px; overflow: hidden; max-height: 320px;">
                    <img src="${post.image}" alt="${post.title}" style="width: 100%; height: 260px; object-fit: cover; border-radius: 8px; display: block;" />
                </div>

                <div style="color: #666; font-size: 0.8rem; display: flex; gap: 15px; align-items: center;">
                    <span><i class="fa-regular fa-clock"></i> ${post.time}</span>
                    <span><i class="fa-regular fa-comment"></i> Discussion Active</span>
                </div>
            </div>
        `).join("");
    }
});
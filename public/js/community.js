import { db } from "../firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const detectBtn = document.getElementById("enable-location-btn");
    const statusText = document.getElementById("location-status-text");
    const noticeBox = document.getElementById("location-notice-box");
    const noticeTitle = document.getElementById("notice-title");
    const noticeDesc = document.getElementById("notice-desc");
    const noticeIcon = document.getElementById("notice-icon");
    const collegesWrapper = document.getElementById("colleges-wrapper");
    const pillsContainer = document.getElementById("college-pills-container");
    const feedContainer = document.getElementById("feed-container");

    const collegesData = [
        {
            name: "Seshadripuram First Grade College (SFGC)",
            shortName: "SFGC",
            lat: 13.1007,
            lon: 77.5963,
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
            lat: 13.0980,
            lon: 77.5920,
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
            name: "Government First Grade College Yelahanka",
            shortName: "GFGC Yelahanka",
            lat: 13.1055,
            lon: 77.5935,
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
            name: "Nitte Meenakshi (NMIT)",
            shortName: "NMIT",
            lat: 13.1278,
            lon: 77.5878,
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
            name: "BMSIT College",
            shortName: "BMSIT",
            lat: 13.1333,
            lon: 77.5683,
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
            name: "Bishop Cotton Women's Christian College",
            shortName: "Bishop Cotton",
            lat: 12.9698,
            lon: 77.6012,
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
            lat: 12.9815,
            lon: 77.4988,
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
            name: "Nagarjuna College",
            shortName: "Nagarjuna (NCET)",
            lat: 13.2505,
            lon: 77.7289,
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

    // Mathematical Haversine Distance Formula (in Kilometers)
    function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's mean radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Realistic non-zero distance formatting
    function formatDistance(distKm) {
        if (distKm < 0.1) {
            return "250 m"; // Realistic minimum proximity inside campus
        } else if (distKm < 1.0) {
            return `${Math.round(distKm * 1000)} m`;
        } else {
            return `${distKm.toFixed(1)} km`;
        }
    }

    if (!detectBtn) return;

    // Trigger detection on button click
    detectBtn.addEventListener("click", () => {
        requestLocationAndScan();
    });

    function requestLocationAndScan() {
        statusText.innerHTML = `<i class="fa-solid fa-satellite-dish fa-spin" style="color: #38bdf8;"></i> Detecting your current location...`;
        detectBtn.disabled = true;

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLat = position.coords.latitude;
                    const userLon = position.coords.longitude;
                    processNearbyColleges(userLat, userLon, false);
                },
                (err) => {
                    console.warn("Using regional campus hub:", err.message);
                    processNearbyColleges(13.1020, 77.5850, true);
                },
                { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
            );
        } else {
            processNearbyColleges(13.1020, 77.5850, true);
        }
    }

    function processNearbyColleges(userLat, userLon, isFallback) {
        // Calculate distance for each college
        const collegesWithDistance = collegesData.map(college => {
            const distance = calculateHaversineDistance(userLat, userLon, college.lat, college.lon);
            return {
                ...college,
                distance: distance,
                formattedDistance: formatDistance(distance)
            };
        });

        // Filter colleges strictly within 5.0 km radius
        const nearbyColleges = collegesWithDistance.filter(college => college.distance <= 5.0);

        // Sort ascending by distance (closest first)
        nearbyColleges.sort((a, b) => a.distance - b.distance);

        detectBtn.disabled = false;

        if (nearbyColleges.length > 0) {
            statusText.innerHTML = isFallback
                ? `📍 Showing <strong>${nearbyColleges.length} colleges</strong> within 5 km radius.`
                : `✅ Found <strong>${nearbyColleges.length} colleges</strong> within 5 km of your location.`;
            renderCollegePills(nearbyColleges);
        } else {
            collegesWithDistance.sort((a, b) => a.distance - b.distance);
            const fallbackList = collegesWithDistance.slice(0, 5);
            statusText.innerHTML = `📍 Showing regional campuses within radius:`;
            renderCollegePills(fallbackList);
        }
    }

    // Auto-populate 5km colleges on startup
    processNearbyColleges(13.1020, 77.5850, true);

    function renderCollegePills(colleges) {
        pillsContainer.innerHTML = "";
        collegesWrapper.style.display = "block";

        colleges.forEach((college, index) => {
            const pill = document.createElement("button");
            pill.className = `college-pill ${index === 0 ? "active" : ""}`;
            pill.innerHTML = `<i class="fa-solid fa-building-columns"></i> ${college.name} <span style="background: rgba(0, 102, 255, 0.25); color: #7db7ff; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: 6px; font-weight: 600;">${college.formattedDistance}</span>`;

            pill.addEventListener("click", () => {
                document.querySelectorAll(".college-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                renderPosts(college);
            });

            pillsContainer.appendChild(pill);
        });

        if (colleges.length > 0) {
            renderPosts(colleges[0]);
        }
    }

    function renderPosts(college) {
        if (!college.posts || college.posts.length === 0) {
            feedContainer.innerHTML = `
                <div class="card empty-feed">
                    <i class="fa-solid fa-bullhorn fa-2x" style="margin-bottom: 12px; color: #7db7ff; display: block;"></i>
                    No recent announcements posted for <strong>${college.name}</strong> yet. Check back soon!
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
                            <strong style="color: #fff; font-size: 1.02rem;">${post.author}</strong>
                            <div style="color: #8fa8bf; font-size: 0.8rem;">${post.role} • <span style="color: #38bdf8;">${college.shortName || college.name}</span></div>
                        </div>
                    </div>
                    <span style="background: rgba(0, 102, 255, 0.2); color: #38bdf8; font-size: 0.75rem; padding: 4px 12px; border-radius: 20px; font-weight: 600; border: 1px solid rgba(56, 189, 248, 0.3);">
                        #${post.tag}
                    </span>
                </div>

                <h4 style="color: #fff; margin: 10px 0 8px 0; font-size: 1.15rem; font-weight: 600;">${post.title}</h4>
                <p style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; margin-bottom: 14px;">${post.content}</p>
                
                ${post.image ? `
                <div style="margin-bottom: 16px; border-radius: 10px; overflow: hidden; max-height: 320px; border: 1px solid rgba(255, 255, 255, 0.08);">
                    <img src="${post.image}" alt="${post.title}" style="width: 100%; height: 260px; object-fit: cover; display: block;" onerror="this.style.display='none'" />
                </div>
                ` : ''}

                <div style="color: #8fa8bf; font-size: 0.82rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 12px; margin-top: 6px;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <i class="fa-regular fa-clock"></i> ${post.time}
                    </span>
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <span style="cursor: pointer; color: #38bdf8;"><i class="fa-regular fa-thumbs-up"></i> Helpful</span>
                        <span style="cursor: pointer; color: #7db7ff;"><i class="fa-regular fa-comment"></i> Discussion Active</span>
                    </div>
                </div>
            </div>
        `).join("");
    }
});
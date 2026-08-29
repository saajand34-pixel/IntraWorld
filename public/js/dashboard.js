<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Intra World Dashboard</title>

    <!-- Google Font -->
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Font Awesome -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" rel="stylesheet">

    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Poppins', sans-serif; }
        body { display: flex; min-height: 100vh; background-color: #030712; color: #ffffff; }

        /* SIDEBAR / DRAWER STYLES */
        .sidebar { 
            width: 280px; 
            background: #040c18; 
            display: flex; 
            flex-direction: column; 
            justify-content: space-between; 
            border-right: 1px solid rgba(255,255,255,0.08); 
            transition: left 0.3s ease; 
            z-index: 1000;
        }

        .sidebar-header { 
            position: relative; 
            padding: 30px 20px 10px 20px; 
            text-align: center; 
        }

        .close-btn { 
            position: absolute; 
            top: 15px; 
            right: 15px; 
            width: 36px; 
            height: 36px; 
            background: rgba(255, 255, 255, 0.08); 
            border: none; 
            border-radius: 8px; 
            color: #8fa8bf; 
            font-size: 16px; 
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            transition: 0.2s; 
        }

        .close-btn:hover { background: rgba(255, 255, 255, 0.15); color: #ffffff; }

        .logo { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .logo img { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; }
        .logo h2 { font-size: 18px; font-weight: 700; color: #fff; letter-spacing: 1.5px; }

        .sidebar-divider { border: 0; height: 1px; background: rgba(255, 255, 255, 0.08); margin: 15px 20px; }

        .menu-container { flex: 1; padding: 10px 15px; }
        .menu { display: flex; flex-direction: column; gap: 8px; }
        .menu a { 
            display: flex; 
            align-items: center; 
            gap: 16px; 
            padding: 12px 20px; 
            color: #8fa8bf; 
            text-decoration: none; 
            font-size: 15px; 
            font-weight: 500; 
            border-radius: 12px; 
            transition: all 0.2s ease; 
        }
        .menu a i { font-size: 18px; width: 20px; text-align: center; }
        .menu a:hover { color: #ffffff; background: rgba(255, 255, 255, 0.05); }

        /* Active Pill Button Styling */
        .menu a.active { 
            color: #ffffff; 
            background: #0075ff; 
            box-shadow: 0 4px 15px rgba(0, 117, 255, 0.35); 
            font-weight: 600;
        }

        .bottom { padding: 15px; border-top: 1px solid rgba(255,255,255,0.08); }
        .logout { color: #ef4444 !important; }

        /* OVERLAY FOR MOBILE */
        .overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 999;
        }
        .overlay.show { display: block; }

        /* MAIN APP CONTENT */
        .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 15px 30px; background: #081b2e; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .menu-btn { display: none; background: none; border: none; color: white; font-size: 20px; cursor: pointer; }
        .search input { padding: 10px 16px; background: #102b45; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; outline: none; width: 280px; }
        .user { display: flex; align-items: center; gap: 12px; }
        .user img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }

        .content { padding: 30px; overflow-y: auto; flex: 1; }
        .banner { margin-bottom: 45px; }
        .banner h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .banner p { font-size: 14px; color: #8fa8bf; font-weight: 500; }

        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
        .card { background: linear-gradient(135deg, rgba(6, 21, 36, 0.8), rgba(16, 43, 69, 0.6)); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 28px; }
        .card h3 { font-size: 12px; color: #8fa8bf; text-transform: uppercase; margin-bottom: 12px; }
        .card h2 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }

        /* MOBILE RESPONSIVE BEHAVIOR */
        @media (max-width: 768px) {
            .sidebar {
                position: fixed;
                top: 0;
                left: -280px;
                height: 100vh;
            }
            .sidebar.open { left: 0; }
            .menu-btn { display: block; }
        }
    </style>
</head>

<body>

    <!-- SIDEBAR NAV (VERTICAL DRAWER) -->
    <header class="sidebar" id="navbar" role="navigation" aria-label="Main navigation">
        <div class="sidebar-header">
            <button class="close-btn" id="closeMenu" aria-label="Close menu">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="logo">
                <img src="logo.png" alt="Intra World Logo">
                <h2>INTRA WORLD</h2>
            </div>
        </div>

        <hr class="sidebar-divider">

        <div class="menu-container">
            <nav class="menu">
                <a href="dashboard.html" class="active">
                    <i class="fa-solid fa-house"></i>
                    <span>Home</span>
                </a>
                <a href="connect.html">
                    <i class="fa-solid fa-user-group"></i>
                    <span>Student Connect</span>
                </a>
                <a href="posts.html">
                    <i class="fa-solid fa-newspaper"></i>
                    <span>Posts</span>
                </a>
                <a href="messages.html">
                    <i class="fa-solid fa-comments"></i>
                    <span>Messages</span>
                </a>
                <a href="settings.html">
                    <i class="fa-solid fa-gear"></i>
                    <span>Settings</span>
                </a>
            </nav>
        </div>

        <div class="bottom">
            <nav class="menu">
                <a class="logout" id="logoutBtn" href="index.html">
                    <i class="fa-solid fa-right-from-bracket"></i>
                    <span>Logout</span>
                </a>
            </nav>
        </div>
    </header>

    <!-- Overlay Backdrop -->
    <div class="overlay" id="overlay"></div>

    <!-- MAIN DASHBOARD CONTENT AREA -->
    <main class="main">
        <header class="topbar">
            <!-- Open Menu Button -->
            <button class="menu-btn" id="openMenu" aria-label="Open navigation">
                <i class="fa-solid fa-bars"></i>
            </button>

            <div class="search">
                <input type="text" placeholder="Search Students, Research, Communities...">
            </div>

            <div class="user">
                <span id="welcomeName">Loading...</span>
                <img id="profileImage" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/></svg>" alt="Profile">
            </div>
        </header>

        <section class="content">
            <div class="banner">
                <h1>Welcome to INTRA WORLD</h1>
                <p>Academic • Professional • Student Networking Platform</p>
            </div>

            <div class="cards">
                <div class="card">
                    <h3>Student Connections</h3>
                    <h2 id="connections">0</h2>
                    <p>Trusted academic connections.</p>
                </div>
                <div class="card">
                    <h3>Projects</h3>
                    <h2 id="projects">0</h2>
                    <p>Project collaborations.</p>
                </div>
                <div class="card">
                    <h3>Research</h3>
                    <h2 id="research">0</h2>
                    <p>Research opportunities.</p>
                </div>
                <div class="card">
                    <h3>Notifications</h3>
                    <h2 id="notifications">0</h2>
                    <p>Unread notifications.</p>
                </div>
            </div>
        </section>
    </main>

    <!-- TOGGLE FUNCTIONALITY LOGIC -->
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            const sidebar = document.getElementById("navbar");
            const overlay = document.getElementById("overlay");
            const openBtn = document.getElementById("openMenu");
            const closeBtn = document.getElementById("closeMenu");

            function openSidebar() {
                sidebar.classList.add("open");
                if (overlay) overlay.classList.add("show");
                document.body.style.overflow = "hidden";
            }

            function closeSidebar() {
                sidebar.classList.remove("open");
                if (overlay) overlay.classList.remove("show");
                document.body.style.overflow = "";
            }

            if (openBtn) openBtn.addEventListener("click", openSidebar);
            if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
            if (overlay) overlay.addEventListener("click", closeSidebar);

            // Close menu when pressing Escape key
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") closeSidebar();
            });
        });
    </script>
    <script src="js/dashboard.js"></script>
</body>
</html>
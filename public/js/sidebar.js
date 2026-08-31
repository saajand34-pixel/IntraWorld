// ==========================================
// SIDEBAR / HAMBURGER MENU TOGGLE
// Shared across all app pages (dashboard, connect, posts, messages, settings)
// Wires up #openMenu, #closeMenu, #overlay to show/hide #sidebar
// ==========================================

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openBtn = document.getElementById("openMenu");
const closeBtn = document.getElementById("closeMenu");

if (!sidebar) console.error("🔴 sidebar.js: #sidebar not found on this page");
if (!overlay) console.error("🔴 sidebar.js: #overlay not found on this page");
if (!openBtn) console.error("🔴 sidebar.js: #openMenu not found on this page");

// Fallback styling so the toggle works visually even if app-shell.css
// doesn't already define .open behavior for #sidebar / #overlay.
// If app-shell.css already handles this, these rules are harmless —
// they just define the same open/closed states explicitly.
const fallbackStyle = document.createElement("style");
fallbackStyle.textContent = `
    #sidebar { position: fixed; top: 0; left: 0; height: 100vh; z-index: 999; transition: transform 0.3s ease; }
    #sidebar:not(.open) { transform: translateX(-100%); }
    #sidebar.open { transform: translateX(0); }
    #overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 998; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
    #overlay.open { opacity: 1; pointer-events: auto; }
`;
document.head.appendChild(fallbackStyle);

function openSidebar() {
    if (sidebar) sidebar.classList.add("open");
    if (overlay) overlay.classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    document.body.style.overflow = "";
}

if (openBtn) openBtn.addEventListener("click", openSidebar);
if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
if (overlay) overlay.addEventListener("click", closeSidebar);

console.log("✅ sidebar.js loaded — hamburger menu wired up");
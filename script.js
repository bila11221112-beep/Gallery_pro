/* ============================================
   PRIVATE GALLERY PRO - COMPLETE JAVASCRIPT
   ============================================ */

// ==================== GLOBAL VARIABLES ====================
const APP_VERSION = "2.0.0";
const DB_NAME = "PrivateGalleryProDB";
const DB_VERSION = 3;
const STORE_USERS = "users";
const STORE_MEDIA = "media";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_PASSWORD = "1234";

let db = null;
let currentUser = null;
let currentAlbum = "all";
let currentView = "grid";
let currentMediaIndex = 0;
let currentMediaList = [];
let cropper = null;
let autoLockTimer = null;
let autoLockMinutes = 5;

// ==================== DOM ELEMENTS ====================
const DOM = {
    splashScreen: document.getElementById("splashScreen"),
    mainContainer: document.getElementById("mainContainer"),
    authScreen: document.getElementById("authScreen"),
    galleryScreen: document.getElementById("galleryScreen"),
    usernameInput: document.getElementById("usernameInput"),
    passwordInput: document.getElementById("passwordInput"),
    authError: document.getElementById("authError"),
    authSuccess: document.getElementById("authSuccess"),
    authActionBtn: document.getElementById("authActionBtn"),
    togglePassword: document.getElementById("togglePassword"),
    fingerprintSection: document.getElementById("fingerprintSection"),
    fingerprintBtn: document.getElementById("fingerprintBtn"),
    currentUsername: document.getElementById("currentUsername"),
    userAvatar: document.getElementById("userAvatar"),
    storageInfo: document.getElementById("storageInfo"),
    galleryGrid: document.getElementById("galleryGrid"),
    galleryList: document.getElementById("galleryList"),
    searchBar: document.getElementById("searchBar"),
    searchInput: document.getElementById("searchInput"),
    uploadMenu: document.getElementById("uploadMenu"),
    fabUpload: document.getElementById("fabUpload"),
    photoInput: document.getElementById("photoInput"),
    videoInput: document.getElementById("videoInput"),
    cameraInput: document.getElementById("cameraInput"),
    videoCameraInput: document.getElementById("videoCameraInput"),
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebarOverlay"),
    albumScroll: document.getElementById("albumScroll"),
    albumList: document.getElementById("albumList"),
    lightbox: document.getElementById("lightbox"),
    lightboxImg: document.getElementById("lightboxImg"),
    videoPlayer: document.getElementById("videoPlayer"),
    videoElement: document.getElementById("videoElement"),
    editorScreen: document.getElementById("editorScreen"),
    editorImage: document.getElementById("editorImage"),
    settingsModal: document.getElementById("settingsModal"),
    albumModal: document.getElementById("albumModal"),
    toast: document.getElementById("toast"),
    imageCount: document.getElementById("imageCount")
};

// ==================== DATABASE OPERATIONS ====================
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_USERS)) {
                const userStore = db.createObjectStore(STORE_USERS, { keyPath: "username" });
                userStore.createIndex("username", "username", { unique: true });
            }
            if (!db.objectStoreNames.contains(STORE_MEDIA)) {
                const mediaStore = db.createObjectStore(STORE_MEDIA, { keyPath: "id" });
                mediaStore.createIndex("username", "username", { unique: false });
                mediaStore.createIndex("album", "album", { unique: false });
                mediaStore.createIndex("type", "type", { unique: false });
                mediaStore.createIndex("date", "date", { unique: false });
            }
        };
        
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getUserData(username) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_USERS], "readonly");
        const store = tx.objectStore(STORE_USERS);
        const request = store.get(username);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveUserData(userData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_USERS], "readwrite");
        const store = tx.objectStore(STORE_USERS);
        const request = store.put(userData);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getAllUserMedia(username) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_MEDIA], "readonly");
        const store = tx.objectStore(STORE_MEDIA);
        const index = store.index("username");
        const request = index.getAll(username);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveMedia(mediaData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_MEDIA], "readwrite");
        const store = tx.objectStore(STORE_MEDIA);
        const request = store.add(mediaData);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

async function updateMedia(mediaData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_MEDIA], "readwrite");
        const store = tx.objectStore(STORE_MEDIA);
        const request = store.put(mediaData);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

async function deleteMedia(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_MEDIA], "readwrite");
        const store = tx.objectStore(STORE_MEDIA);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

// ==================== PASSWORD HASHING ====================
function hashPassword(password) {
    let hash = 0;
    const salt = "GalleryProSalt2024Secure";
    const str = password + salt;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = "success", duration = 3000) {
    const toast = DOM.toast;
    const icon = toast.querySelector("i");
    const messageEl = toast.querySelector(".toast-message");
    
    icon.className = type === "success" ? "fas fa-check-circle" :
                   type === "error" ? "fas fa-exclamation-circle" :
                   "fas fa-info-circle";
    
    messageEl.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove("hide");
    
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.add("hide");
    }, duration);
}

// ==================== SPLASH SCREEN ====================
async function initApp() {
    try {
        await openDB();
        console.log("✅ Database initialized");
        
        // Load settings
        const theme = localStorage.getItem("galleryTheme") || "purple";
        document.documentElement.setAttribute("data-theme", theme);
        autoLockMinutes = parseInt(localStorage.getItem("autoLockMinutes") || "5");
        
        // Check for saved session
        const savedSession = localStorage.getItem("gallerySession");
        if (savedSession) {
            const session = JSON.parse(savedSession);
            const userData = await getUserData(session.username);
            if (userData && userData.password === session.passwordHash) {
                currentUser = userData;
                showGallery();
                return;
            }
        }
        
        // Hide splash and show auth
        setTimeout(() => {
            DOM.splashScreen.classList.add("hide");
            DOM.mainContainer.style.display = "block";
            DOM.authScreen.classList.add("active");
            checkFingerprintSupport();
        }, 2000);
        
    } catch (error) {
        console.error("Init error:", error);
        DOM.splashScreen.classList.add("hide");
        DOM.mainContainer.style.display = "block";
        DOM.authScreen.classList.add("active");
        showToast("Storage initialization failed", "error");
    }
}

// ==================== AUTHENTICATION ====================
let isLoginMode = true;

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.querySelectorAll(".auth-tab").forEach(tab => tab.classList.remove("active"));
    document.querySelector(isLoginMode ? '[data-tab="login"]' : '[data-tab="signup"]').classList.add("active");
    DOM.authActionBtn.innerHTML = isLoginMode ? '<i class="fas fa-sign-in-alt"></i> Login' : '<i class="fas fa-user-plus"></i> Sign Up';
    DOM.authError.classList.remove("show");
    DOM.authSuccess.classList.remove("show");
    DOM.authError.textContent = "";
    DOM.authSuccess.textContent = "";
}

async function handleAuth() {
    const username = DOM.usernameInput.value.trim().toLowerCase();
    const password = DOM.passwordInput.value.trim();
    
    DOM.authError.classList.remove("show");
    DOM.authSuccess.classList.remove("show");
    
    if (!username || !password) {
        showAuthError("Please fill all fields");
        return;
    }
    
    if (username.length < 3) {
        showAuthError("Username must be at least 3 characters");
        return;
    }
    
    if (password.length < 4) {
        showAuthError("Password must be at least 4 characters");
        return;
    }
    
    if (!/^[a-z0-9_]+$/.test(username)) {
        showAuthError("Username: only letters, numbers, underscore");
        return;
    }
    
    try {
        if (isLoginMode) {
            // Login
            const userData = await getUserData(username);
            if (!userData) {
                showAuthError("User not found! Please sign up.");
                return;
            }
            if (userData.password !== hashPassword(password)) {
                showAuthError("Wrong password!");
                return;
            }
            currentUser = userData;
            saveSession();
            showGallery();
            showToast(`Welcome back, ${username}!`);
        } else {
            // Signup
            const exists = await getUserData(username);
            if (exists) {
                showAuthError("Username already taken!");
                return;
            }
            const newUser = {
                username: username,
                password: hashPassword(password),
                albums: [],
                settings: { theme: "purple", autoLock: 5 },
                createdAt: new Date().toISOString()
            };
            await saveUserData(newUser);
            showAuthSuccess("Account created! Please login.");
            toggleAuthMode();
            DOM.passwordInput.value = "";
            DOM.passwordInput.focus();
        }
    } catch (error) {
        console.error("Auth error:", error);
        showAuthError("Authentication failed. Try again.");
    }
}

function showAuthError(msg) {
    DOM.authError.textContent = msg;
    DOM.authError.classList.add("show");
    DOM.authSuccess.classList.remove("show");
}

function showAuthSuccess(msg) {
    DOM.authSuccess.textContent = msg;
    DOM.authSuccess.classList.add("show");
    DOM.authError.classList.remove("show");
}

function saveSession() {
    if (currentUser) {
        localStorage.setItem("gallerySession", JSON.stringify({
            username: currentUser.username,
            passwordHash: currentUser.password
        }));
    }
}

function clearSession() {
    localStorage.removeItem("gallerySession");
}

// ==================== FINGERPRINT SUPPORT ====================
function checkFingerprintSupport() {
    if (window.PublicKeyCredential && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            .then(available => {
                if (available) {
                    DOM.fingerprintSection.style.display = "block";
                }
            })
            .catch(() => {
                DOM.fingerprintSection.style.display = "none";
            });
    }
}

async function authenticateWithFingerprint() {
    try {
        const credential = await navigator.credentials.get({
            publicKey: {
                challenge: new Uint8Array(32),
                rpId: window.location.hostname || "localhost",
                allowCredentials: [],
                userVerification: "required",
                timeout: 60000
            }
        });
        
        if (credential) {
            const savedSession = localStorage.getItem("gallerySession");
            if (savedSession) {
                const session = JSON.parse(savedSession);
                const userData = await getUserData(session.username);
                if (userData) {
                    currentUser = userData;
                    showGallery();
                    showToast("Biometric login successful!");
                }
            }
        }
    } catch (error) {
        console.log("Fingerprint auth failed:", error);
        showToast("Fingerprint authentication failed", "error");
    }
}

// ==================== GALLERY DISPLAY ====================
function showGallery() {
    DOM.authScreen.classList.remove("active");
    DOM.galleryScreen.classList.add("active");
    DOM.currentUsername.textContent = currentUser.username;
    DOM.userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
    updateStorageInfo();
    loadAlbums();
    renderGallery();
    startAutoLock();
}

function lockGallery() {
    DOM.galleryScreen.classList.remove("active");
    DOM.authScreen.classList.add("active");
    DOM.usernameInput.value = currentUser ? currentUser.username : "";
    DOM.passwordInput.value = "";
    DOM.passwordInput.focus();
    clearAutoLock();
}

function logout() {
    if (confirm("Are you sure you want to logout?")) {
        clearSession();
        currentUser = null;
        DOM.galleryScreen.classList.remove("active");
        DOM.authScreen.classList.add("active");
        DOM.usernameInput.value = "";
        DOM.passwordInput.value = "";
        DOM.passwordInput.focus();
        clearAutoLock();
        showToast("Logged out successfully");
    }
}

// ==================== AUTO LOCK ====================
function startAutoLock() {
    clearAutoLock();
    if (autoLockMinutes > 0) {
        autoLockTimer = setTimeout(() => {
            lockGallery();
            showToast("Gallery auto-locked for security", "warning");
        }, autoLockMinutes * 60 * 1000);
    }
}

function clearAutoLock() {
    if (autoLockTimer) {
        clearTimeout(autoLockTimer);
        autoLockTimer = null;
    }
}

// Reset timer on user activity
["click", "touchstart", "scroll"].forEach(event => {
    document.addEventListener(event, () => {
        if (currentUser && DOM.galleryScreen.classList.contains("active")) {
            clearAutoLock();
            startAutoLock();
        }
    });
});

// ==================== MEDIA UPLOAD ====================
function handleFileUpload(files, type = "photo") {
    if (!files || files.length === 0 || !currentUser) return;
    
    const maxSize = type === "video" ? MAX_FILE_SIZE * 2 : MAX_FILE_SIZE;
    const validFiles = Array.from(files).filter(file => {
        if (type === "photo" && !file.type.startsWith("image/")) {
            showToast(`"${file.name}" is not an image!`, "error");
            return false;
        }
        if (type === "video" && !file.type.startsWith("video/")) {
            showToast(`"${file.name}" is not a video!`, "error");
            return false;
        }
        if (file.size > maxSize) {
            showToast(`"${file.name}" is too large!`, "error");
            return false;
        }
        return true;
    });
    
    if (validFiles.length === 0) return;
    
    showToast(`Processing ${validFiles.length} file(s)...`, "info");
    
    let processed = 0;
    
    validFiles.forEach(file => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const mediaData = {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
                    username: currentUser.username,
                    data: e.target.result,
                    name: file.name,
                    size: file.size,
                    type: type,
                    mimeType: file.type,
                    album: currentAlbum === "all" ? "default" : currentAlbum,
                    favorite: false,
                    date: new Date().toISOString()
                };
                
                await saveMedia(mediaData);
                processed++;
                
                if (processed === validFiles.length) {
                    updateStorageInfo();
                    renderGallery();
                    showToast(`${processed} file(s) uploaded!`);
                }
            } catch (error) {
                console.error("Upload error:", error);
                showToast("Upload failed! Storage may be full.", "error");
            }
        };
        
        reader.onerror = () => {
            showToast(`Failed to read: ${file.name}`, "error");
            processed++;
        };
        
        reader.readAsDataURL(file);
    });
    
    // Reset inputs
    DOM.photoInput.value = "";
    DOM.videoInput.value = "";
    DOM.cameraInput.value = "";
    DOM.videoCameraInput.value = "";
    DOM.uploadMenu.style.display = "none";
}

// ==================== RENDER GALLERY ====================
async function renderGallery(filter = "") {
    if (!currentUser) return;
    
    try {
        let media = await getAllUserMedia(currentUser.username);
        
        // Filter by album
        if (currentAlbum !== "all") {
            if (currentAlbum === "videos") {
                media = media.filter(m => m.type === "video");
            } else if (currentAlbum === "favorites") {
                media = media.filter(m => m.favorite);
            } else {
                media = media.filter(m => m.album === currentAlbum);
            }
        }
        
        // Filter by type from sidebar
        // Search filter
        if (filter) {
            media = media.filter(m => m.name.toLowerCase().includes(filter.toLowerCase()));
        }
        
        // Sort by date (newest first)
        media.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        currentMediaList = media;
        
        // Render grid view
        DOM.galleryGrid.innerHTML = "";
        DOM.galleryList.innerHTML = "";
        
        if (media.length === 0) {
            const emptyHTML = `
                <div class="empty-state">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h3>No ${currentAlbum === "videos" ? "videos" : "media"} yet</h3>
                    <p>Tap + to add ${currentAlbum === "videos" ? "videos" : "photos and videos"}</p>
                </div>`;
            DOM.galleryGrid.innerHTML = emptyHTML;
            DOM.galleryList.innerHTML = emptyHTML;
            DOM.imageCount.textContent = "0 files";
            return;
        }
        
        DOM.imageCount.textContent = `${media.length} file(s)`;
        
        media.forEach((item, index) => {
            // Grid item
            const gridItem = createGridItem(item, index);
            DOM.galleryGrid.appendChild(gridItem);
            
            // List item
            const listItem = createListItem(item, index);
            DOM.galleryList.appendChild(listItem);
        });
        
    } catch (error) {
        console.error("Render error:", error);
        showToast("Failed to load gallery", "error");
    }
}

function createGridItem(item, index) {
    const div = document.createElement("div");
    div.className = "gallery-item";
    if (item.favorite) div.classList.add("favorite");
    
    if (item.type === "video") {
        div.innerHTML = `
            <video src="${item.data}" muted preload="metadata"></video>
            <div class="video-icon"><i class="fas fa-play-circle"></i></div>
            <div class="favorite-icon"><i class="fas fa-heart"></i></div>
        `;
    } else {
        div.innerHTML = `
            <img src="${item.data}" alt="${item.name}" loading="lazy">
            <div class="favorite-icon"><i class="fas fa-heart"></i></div>
        `;
    }
    
    div.addEventListener("click", (e) => {
        if (div.classList.contains("select-mode")) {
            div.classList.toggle("selected");
            return;
        }
        openMediaViewer(index);
    });
    
    div.addEventListener("long-press", () => {
        div.classList.add("select-mode");
    });
    
    return div;
}

function createListItem(item, index) {
    const div = document.createElement("div");
    div.className = "gallery-list-item";
    
    const thumbnail = item.type === "video" 
        ? `<div style="width:60px;height:60px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;">
             <i class="fas fa-video" style="font-size:24px;color:#667eea;"></i>
           </div>`
        : `<img src="${item.data}" alt="${item.name}">`;
    
    div.innerHTML = `
        ${thumbnail}
        <div class="item-info">
            <div class="item-name">${item.name}</div>
            <div class="item-meta">${formatFileSize(item.size)} • ${new Date(item.date).toLocaleDateString()}</div>
        </div>
        <div style="color:var(--text-secondary);">${item.type === "video" ? '🎬' : '📷'}</div>
    `;
    
    div.addEventListener("click", () => openMediaViewer(index));
    
    return div;
}

// ==================== MEDIA VIEWER ====================
function openMediaViewer(index) {
    if (index < 0 || index >= currentMediaList.length) return;
    
    currentMediaIndex = index;
    const item = currentMediaList[index];
    
    if (item.type === "video") {
        openVideoPlayer(item);
    } else {
        openLightbox(item);
    }
}

function openLightbox(item) {
    DOM.lightboxImg.src = item.data;
    DOM.lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
    
    // Update favorite button
    const favBtn = document.getElementById("lightboxFavorite");
    favBtn.innerHTML = item.favorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
}

function closeLightbox() {
    DOM.lightbox.classList.remove("active");
    document.body.style.overflow = "";
}

function openVideoPlayer(item) {
    DOM.videoElement.src = item.data;
    DOM.videoPlayer.style.display = "flex";
    document.getElementById("videoName").textContent = item.name;
    document.getElementById("videoSize").textContent = formatFileSize(item.size);
    document.body.style.overflow = "hidden";
}

function closeVideoPlayer() {
    DOM.videoElement.pause();
    DOM.videoElement.src = "";
    DOM.videoPlayer.style.display = "none";
    document.body.style.overflow = "";
}

function navigateMedia(direction) {
    currentMediaIndex += direction;
    if (currentMediaIndex < 0) currentMediaIndex = currentMediaList.length - 1;
    if (currentMediaIndex >= currentMediaList.length) currentMediaIndex = 0;
    
    const item = currentMediaList[currentMediaIndex];
    
    if (item.type === "video") {
        closeLightbox();
        openVideoPlayer(item);
    } else {
        closeVideoPlayer();
        openLightbox(item);
    }
}

// ==================== PHOTO EDITOR ====================
let currentEditingMedia = null;

function openEditor(mediaItem) {
    currentEditingMedia = mediaItem;
    DOM.editorImage.src = mediaItem.data;
    DOM.editorScreen.style.display = "flex";
    document.body.style.overflow = "hidden";
    
    // Initialize cropper after image loads
    DOM.editorImage.onload = () => {
        if (cropper) cropper.destroy();
        cropper = new Cropper(DOM.editorImage, {
            viewMode: 2,
            dragMode: "move",
            autoCropArea: 1,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false
        });
    };
}

function closeEditor() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    DOM.editorScreen.style.display = "none";
    document.body.style.overflow = "";
    currentEditingMedia = null;
}

async function saveEditedImage() {
    if (!cropper || !currentEditingMedia) return;
    
    try {
        const canvas = cropper.getCroppedCanvas({
            maxWidth: 4096,
            maxHeight: 4096
        });
        
        const editedData = canvas.toDataURL(currentEditingMedia.mimeType || "image/jpeg", 0.9);
        
        // Update media
        currentEditingMedia.data = editedData;
        currentEditingMedia.size = Math.round(editedData.length * 3 / 4);
        currentEditingMedia.date = new Date().toISOString();
        
        await updateMedia(currentEditingMedia);
        
        closeEditor();
        renderGallery();
        showToast("Photo saved successfully!");
    } catch (error) {
        console.error("Save error:", error);
        showToast("Failed to save photo", "error");
    }
}

// Editor tools
function applyFilter(filter) {
    if (!DOM.editorImage) return;
    
    DOM.editorImage.className = "";
    if (filter !== "none") {
        DOM.editorImage.classList.add(`filter-${filter}`);
    }
}

function applyAdjustments() {
    if (!DOM.editorImage) return;
    
    const brightness = document.getElementById("brightnessSlider")?.value || 100;
    const contrast = document.getElementById("contrastSlider")?.value || 100;
    const saturation = document.getElementById("saturationSlider")?.value || 100;
    const blur = document.getElementById("blurSlider")?.value || 0;
    
    DOM.editorImage.style.filter = `
        brightness(${brightness}%)
        contrast(${contrast}%)
        saturate(${saturation}%)
        blur(${blur}px)
    `;
}

function rotateImage() {
    if (cropper) {
        cropper.rotate(90);
    }
}

function flipImage() {
    if (cropper) {
        const scaleX = DOM.editorImage.style.transform.includes("scaleX(-1)") ? 1 : -1;
        DOM.editorImage.style.transform = `scaleX(${scaleX})`;
    }
}

// ==================== ALBUMS ====================
function loadAlbums() {
    if (!currentUser) return;
    
    DOM.albumScroll.innerHTML = `
        <button class="album-chip active" data-album="all">
            <i class="fas fa-images"></i> All
        </button>
        <button class="album-chip" data-album="videos">
            <i class="fas fa-video"></i> Videos
        </button>
        <button class="album-chip" data-album="favorites">
            <i class="fas fa-heart"></i> Favorites
        </button>
    `;
    
    if (currentUser.albums) {
        currentUser.albums.forEach(album => {
            const chip = document.createElement("button");
            chip.className = "album-chip";
            chip.dataset.album = album.id;
            chip.innerHTML = `<i class="fas fa-folder"></i> ${album.name}`;
            DOM.albumScroll.appendChild(chip);
        });
    }
    
    // Album click handlers
    DOM.albumScroll.querySelectorAll(".album-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            DOM.albumScroll.querySelectorAll(".album-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            currentAlbum = chip.dataset.album;
            renderGallery();
        });
    });
    
    // Sidebar album list
    updateSidebarAlbums();
}

function updateSidebarAlbums() {
    DOM.albumList.innerHTML = "";
    if (currentUser.albums) {
        currentUser.albums.forEach(album => {
            const li = document.createElement("li");
            li.innerHTML = `<i class="fas fa-folder" style="color:${album.color || '#667eea'};"></i> ${album.name}`;
            li.addEventListener("click", () => {
                currentAlbum = album.id;
                DOM.sidebar.classList.remove("active");
                DOM.sidebarOverlay.classList.remove("active");
                renderGallery();
            });
            DOM.albumList.appendChild(li);
        });
    }
}

function showCreateAlbumModal() {
    DOM.albumModal.classList.add("active");
    document.getElementById("albumNameInput").value = "";
    document.getElementById("albumNameInput").focus();
}

function createAlbum() {
    const name = document.getElementById("albumNameInput").value.trim();
    if (!name) {
        showToast("Please enter album name", "error");
        return;
    }
    
    const selectedColor = document.querySelector(".color-option.active")?.dataset.color || "#667eea";
    
    if (!currentUser.albums) currentUser.albums = [];
    
    const newAlbum = {
        id: "album_" + Date.now(),
        name: name,
        color: selectedColor,
        createdAt: new Date().toISOString()
    };
    
    currentUser.albums.push(newAlbum);
    saveUserData(currentUser).then(() => {
        DOM.albumModal.classList.remove("active");
        loadAlbums();
        showToast("Album created!");
    });
}

// ==================== FAVORITES ====================
async function toggleFavorite() {
    if (currentMediaIndex < 0 || currentMediaIndex >= currentMediaList.length) return;
    
    const item = currentMediaList[currentMediaIndex];
    item.favorite = !item.favorite;
    
    await updateMedia(item);
    
    if (DOM.lightbox.classList.contains("active")) {
        document.getElementById("lightboxFavorite").innerHTML = 
            item.favorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
    }
    
    showToast(item.favorite ? "Added to favorites!" : "Removed from favorites");
    renderGallery();
}

// ==================== DELETE ====================
async function deleteCurrentMedia() {
    if (currentMediaIndex < 0 || currentMediaIndex >= currentMediaList.length) return;
    
    if (!confirm("Delete this media permanently?")) return;
    
    const item = currentMediaList[currentMediaIndex];
    
    try {
        await deleteMedia(item.id);
        showToast("Deleted successfully");
        
        closeLightbox();
        closeVideoPlayer();
        updateStorageInfo();
        renderGallery();
    } catch (error) {
        showToast("Delete failed", "error");
    }
}

// ==================== SEARCH ====================
function toggleSearch() {
    const isVisible = DOM.searchBar.style.display !== "none";
    DOM.searchBar.style.display = isVisible ? "none" : "flex";
    if (!isVisible) {
        DOM.searchInput.focus();
    } else {
        DOM.searchInput.value = "";
        renderGallery();
    }
}

DOM.searchInput?.addEventListener("input", (e) => {
    renderGallery(e.target.value);
});

// ==================== VIEW TOGGLE ====================
function toggleView(view) {
    currentView = view;
    DOM.galleryGrid.style.display = view === "grid" ? "grid" : "none";
    DOM.galleryList.style.display = view === "list" ? "block" : "none";
}

// ==================== STORAGE INFO ====================
function updateStorageInfo() {
    if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(estimate => {
            const used = Math.round(estimate.usage / (1024 * 1024));
            DOM.storageInfo.textContent = `${used} MB used`;
        });
    }
}

// ==================== GOOGLE DRIVE BACKUP ====================
async function backupToGoogleDrive() {
    showToast("Google Drive backup requires API setup. Feature coming soon!", "info");
    // This would require Google OAuth integration
}

async function restoreFromGoogleDrive() {
    showToast("Google Drive restore requires API setup. Feature coming soon!", "info");
}

// ==================== SETTINGS ====================
function showSettings() {
    DOM.settingsModal.classList.add("active");
    document.getElementById("autoLockTime").value = autoLockMinutes;
}

function saveSettings() {
    autoLockMinutes = parseInt(document.getElementById("autoLockTime").value);
    localStorage.setItem("autoLockMinutes", autoLockMinutes);
    
    const notificationsEnabled = document.getElementById("notificationsToggle").checked;
    localStorage.setItem("notificationsEnabled", notificationsEnabled);
    
    DOM.settingsModal.classList.remove("active");
    showToast("Settings saved!");
    
    if (currentUser) {
        clearAutoLock();
        startAutoLock();
    }
}

// ==================== THEME ====================
function changeTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("galleryTheme", theme);
    
    document.querySelectorAll(".theme-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`.theme-btn[data-theme="${theme}"]`)?.classList.add("active");
}

// ==================== UTILITY FUNCTIONS ====================
function formatFileSize(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    return (bytes / 1073741824).toFixed(1) + " GB";
}

function generateThumbnail(file, maxWidth = 200) {
    return new Promise((resolve) => {
        if (file.type.startsWith("video/")) {
            resolve(null); // Return null for videos
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ratio = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * ratio;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ==================== EVENT LISTENERS ====================
document.addEventListener("DOMContentLoaded", initApp);

// Auth
DOM.authActionBtn?.addEventListener("click", handleAuth);
DOM.togglePassword?.addEventListener("click", () => {
    const type = DOM.passwordInput.type === "password" ? "text" : "password";
    DOM.passwordInput.type = type;
    DOM.togglePassword.className = type === "text" ? "fas fa-eye-slash" : "fas fa-eye";
});
DOM.fingerprintBtn?.addEventListener("click", authenticateWithFingerprint);

document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        if ((tab.dataset.tab === "login") !== isLoginMode) {
            toggleAuthMode();
        }
    });
});

// Menu
DOM.menuBtn?.addEventListener("click", () => {
    DOM.sidebar.classList.add("active");
    DOM.sidebarOverlay.classList.add("active");
});
DOM.closeSidebar?.addEventListener("click", () => {
    DOM.sidebar.classList.remove("active");
    DOM.sidebarOverlay.classList.remove("active");
});
DOM.sidebarOverlay?.addEventListener("click", () => {
    DOM.sidebar.classList.remove("active");
    DOM.sidebarOverlay.classList.remove("active");
});

// Upload
DOM.fabUpload?.addEventListener("click", () => {
    DOM.uploadMenu.style.display = DOM.uploadMenu.style.display === "none" ? "block" : "none";
});
document.getElementById("uploadPhotosBtn")?.addEventListener("click", () => DOM.photoInput.click());
document.getElementById("uploadVideosBtn")?.addEventListener("click", () => DOM.videoInput.click());
document.getElementById("takePhotoBtn")?.addEventListener("click", () => DOM.cameraInput.click());
document.getElementById("recordVideoBtn")?.addEventListener("click", () => DOM.videoCameraInput.click());

DOM.photoInput?.addEventListener("change", (e) => handleFileUpload(e.target.files, "photo"));
DOM.videoInput?.addEventListener("change", (e) => handleFileUpload(e.target.files, "video"));
DOM.cameraInput?.addEventListener("change", (e) => handleFileUpload(e.target.files, "photo"));
DOM.videoCameraInput?.addEventListener("change", (e) => handleFileUpload(e.target.files, "video"));

// Close upload menu when clicking outside
document.addEventListener("click", (e) => {
    if (!DOM.fabUpload?.contains(e.target) && !DOM.uploadMenu?.contains(e.target)) {
        DOM.uploadMenu.style.display = "none";
    }
});

// Lightbox
DOM.lightboxClose?.addEventListener("click", closeLightbox);
DOM.lightbox?.addEventListener("click", (e) => {
    if (e.target === DOM.lightbox) closeLightbox();
});
DOM.lightboxEdit?.addEventListener("click", () => {
    const item = currentMediaList[currentMediaIndex];
    closeLightbox();
    openEditor(item);
});
DOM.lightboxFavorite?.addEventListener("click", toggleFavorite);
DOM.lightboxDelete?.addEventListener("click", deleteCurrentMedia);
document.getElementById("prevBtn")?.addEventListener("click", () => navigateMedia(-1));
document.getElementById("nextBtn")?.addEventListener("click", () => navigateMedia(1));

// Video player
document.getElementById("videoBackBtn")?.addEventListener("click", closeVideoPlayer);

// Editor
document.getElementById("editorBackBtn")?.addEventListener("click", closeEditor);
document.getElementById("saveEditedBtn")?.addEventListener("click", saveEditedImage);

document.querySelectorAll(".tool-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        const tool = btn.dataset.tool;
        document.getElementById("filterOptions").style.display = tool === "filter" ? "block" : "none";
        document.getElementById("adjustmentSliders").style.display = tool === "brightness" ? "block" : "none";
        
        if (tool === "rotate") rotateImage();
        if (tool === "flip") flipImage();
    });
});

document.querySelectorAll(".filter-item").forEach(item => {
    item.addEventListener("click", () => {
        document.querySelectorAll(".filter-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        applyFilter(item.dataset.filter);
    });
});

["brightnessSlider", "contrastSlider", "saturationSlider", "blurSlider"].forEach(id => {
    const slider = document.getElementById(id);
    if (slider) {
        slider.addEventListener("input", () => {
            applyAdjustments();
            const valueSpan = document.getElementById(id.replace("Slider", "Value"));
            if (valueSpan) {
                valueSpan.textContent = id.includes("blur") ? slider.value + "px" : slider.value + "%";
            }
        });
    }
});

// Settings
DOM.settingsBtn?.addEventListener("click", () => {
    DOM.sidebar.classList.remove("active");
    DOM.sidebarOverlay.classList.remove("active");
    showSettings();
});
document.getElementById("closeSettingsModal")?.addEventListener("click", () => {
    DOM.settingsModal.classList.remove("active");
});
document.getElementById("clearCacheBtn")?.addEventListener("click", async () => {
    if (confirm("Clear all cached data?")) {
        localStorage.clear();
        showToast("Cache cleared!");
    }
});

// Album
DOM.createAlbumBtn?.addEventListener("click", () => {
    DOM.sidebar.classList.remove("active");
    DOM.sidebarOverlay.classList.remove("active");
    showCreateAlbumModal();
});
document.getElementById("closeAlbumModal")?.addEventListener("click", () => {
    DOM.albumModal.classList.remove("active");
});
document.getElementById("saveAlbumBtn")?.addEventListener("click", createAlbum);

document.querySelectorAll(".color-option").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".color-option").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    });
});

// Search
DOM.searchBtn?.addEventListener("click", toggleSearch);
document.getElementById("closeSearch")?.addEventListener("click", () => {
    DOM.searchBar.style.display = "none";
    DOM.searchInput.value = "";
    renderGallery();
});

// View toggle
DOM.gridViewBtn?.addEventListener("click", () => toggleView("grid"));
DOM.listViewBtn?.addEventListener("click", () => toggleView("list"));

// Sidebar menu items
DOM.logoutBtn?.addEventListener("click", () => {
    DOM.sidebar.classList.remove("active");
    DOM.sidebarOverlay.classList.remove("active");
    logout();
});
DOM.backupBtn?.addEventListener("click", () => {
    DOM.sidebar.classList.remove("active");
    DOM.sidebarOverlay.classList.remove("active");
    backupToGoogleDrive();
});
DOM.restoreBtn?.addEventListener("click", () => {
    DOM.sidebar.classList.remove("active");
    DOM.sidebarOverlay.classList.remove("active");
    restoreFromGoogleDrive();
});

// Sidebar view filters
document.querySelectorAll('.sidebar-menu li[data-view]').forEach(li => {
    li.addEventListener("click", () => {
        document.querySelectorAll('.sidebar-menu li[data-view]').forEach(l => l.classList.remove("active"));
        li.classList.add("active");
        
        currentAlbum = li.dataset.view === "all" ? "all" : li.dataset.view;
        
        // Update album bar
        DOM.albumScroll.querySelectorAll(".album-chip").forEach(c => c.classList.remove("active"));
        const matchingChip = DOM.albumScroll.querySelector(`[data-album="${currentAlbum}"]`);
        if (matchingChip) matchingChip.classList.add("active");
        
        DOM.sidebar.classList.remove("active");
        DOM.sidebarOverlay.classList.remove("active");
        renderGallery();
    });
});

// Theme buttons
document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => changeTheme(btn.dataset.theme));
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
    if (DOM.lightbox.classList.contains("active")) {
        if (e.key === "ArrowLeft") navigateMedia(-1);
        if (e.key === "ArrowRight") navigateMedia(1);
        if (e.key === "Escape") closeLightbox();
        if (e.key === "Delete") deleteCurrentMedia();
        if (e.key === "f") toggleFavorite();
    }
    if (e.key === "Escape" && DOM.videoPlayer.style.display === "flex") {
        closeVideoPlayer();
    }
    if (e.key === "Escape" && DOM.sidebar.classList.contains("active")) {
        DOM.sidebar.classList.remove("active");
        DOM.sidebarOverlay.classList.remove("active");
    }
});

// Drag and drop
const dropZone = document.querySelector(".content-area");
if (dropZone) {
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            const isVideo = Array.from(files).some(f => f.type.startsWith("video/"));
            handleFileUpload(files, isVideo ? "video" : "photo");
        }
    });
}

// Long press for multi-select
let longPressTimer;
document.addEventListener("touchstart", (e) => {
    longPressTimer = setTimeout(() => {
        // Enable select mode
    }, 500);
});
document.addEventListener("touchend", () => clearTimeout(longPressTimer));
document.addEventListener("touchmove", () => clearTimeout(longPressTimer));

// ==================== PWA SERVICE WORKER ====================
if ("serviceWorker" in navigator) {
    // Service worker registration would go here
    console.log("PWA: Service Worker ready for registration");
}

// ==================== EXPORT ====================
console.log("✅ Private Gallery Pro v" + APP_VERSION + " loaded successfully!");
console.log("Features: Multi-user, Photo Editor, Video Support, Albums, Themes, Fingerprint");
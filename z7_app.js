if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

// ==================== 1. CẤU HÌNH FIREBASE & AUTH (GÓI FREE - KHÔNG DÙNG STORAGE) ====================
const firebaseConfig = {
apiKey: "AIzaSyDUXz9T2XINIr6qOjByydHybTa6beAp6VQ",
authDomain: "f30n-d8bbb.firebaseapp.com",
projectId: "f30n-d8bbb",
databaseURL: "https://f30n-d8bbb-default-rtdb.asia-southeast1.firebasedatabase.app",
storageBucket: "f30n-d8bbb.firebasestorage.app",
messagingSenderId: "621913206924",
appId: "1:621913206924:web:2693c873d3c41607988ba9",
measurementId: "G-2MMY8X3CPX"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const auth = firebase.auth();

// Tối ưu cho quy mô 500-600 người trên Firebase Spark (Free) không dùng Storage
const MAX_AVATAR_RAW_BYTES = 5 * 1024 * 1024;  // File ảnh gốc tối đa 5MB
const AVATAR_TARGET_SIZE = 240;                // Nén vuông 240x240px để nhẹ dung lượng & băng thông
const AVATAR_TARGET_QUALITY = 0.68;            // Chất lượng nén ~12-20KB/ảnh
const MAX_AVATAR_DATAURL_CHARS = 120000;       // Giới hạn an toàn ~88KB sau nén

// ==================== 2. BIẾN TRẠNG THÁI TOÀN CỤC ====================
let allDelegatesData = [];
let currentFilter = 'all';
let currentSearchQuery = '';
let isAdminLoggedIn = false;
let currentAdminUser = null;
let currentPageView = 'home';
let currentDetailedDay = 1;
let lastCreatedCode = '';
let pendingAvatarData = {
    'p-reg': '',
    'edit': ''
};

// Trạng thái Tab Thể thao
const SPORTS_LIST = ['Pickleball', 'Bóng đá', 'Cầu lông', 'Bơi lội', 'Chạy bộ'];
let currentSportTab = 'Pickleball';
let currentSportBranch = 'ALL';
let currentSportSearch = '';
const SPORTS_PAGE_SIZE = 20;
let currentSportPage = 1;

// Trạng thái Lucky Draw
let currentDrawGroup = 'all';
let isDrawing = false;
let winningHistory = [];
const prizeConfig = {
    'Giải Bảy': { max: 7 },
    'Giải Sáu': { max: 6 },
    'Giải Năm': { max: 5 },
    'Giải Tư': { max: 4 },
    'Giải Ba': { max: 3 },
    'Giải Nhì': { max: 2 },
    'Giải Nhất': { max: 1 }
};
let currentPrize = 'Giải Bảy';
let prizeCounts = {
    'Giải Bảy': 0,
    'Giải Sáu': 0,
    'Giải Năm': 0,
    'Giải Tư': 0,
    'Giải Ba': 0,
    'Giải Nhì': 0,
    'Giải Nhất': 0
};

// Trạng thái Clip Chào Mừng
let reelBranchFilter = 'ALL';
let reelList = [];
let reelIndex = 0;
let reelPlaying = false;
let reelIntervalId = null;
let reelProgressRafId = null;
let reelSlideStartTime = 0;
let reelDurationMs = 3500;

// ==================== 3. LẮNG NGHE FIREBASE AUTH & DATABASE ====================
auth.onAuthStateChanged((user) => {
    currentAdminUser = user || null;
    isAdminLoggedIn = Boolean(user);

    const statusBadge = document.getElementById('ld-auth-status-badge');
    const authIndicator = document.getElementById('admin-auth-indicator');
    const loggedInBox = document.getElementById('admin-logged-in-actions');
    const currentEmailEl = document.getElementById('admin-current-email');
    const headerAdminBtn = document.getElementById('header-admin-btn');

    if (isAdminLoggedIn) {
        if (statusBadge) {
            statusBadge.textContent = `🔓 BTC: ${user.email || 'Đã xác thực'}`;
            statusBadge.className = 'px-3.5 py-1 rounded-full bg-emerald-500/25 border border-emerald-300/60 text-[11px] font-bold text-emerald-100';
        }
        if (authIndicator) {
            authIndicator.textContent = 'Đã xác thực';
            authIndicator.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
        }
        if (loggedInBox) loggedInBox.classList.remove('hidden');
        if (currentEmailEl) currentEmailEl.textContent = user.email || '';
        if (headerAdminBtn) {
            headerAdminBtn.classList.remove('text-fast-textMuted');
            headerAdminBtn.classList.add('text-emerald-600', 'bg-emerald-50');
            headerAdminBtn.title = `BTC đã đăng nhập (${user.email})`;
        }
    } else {
        if (statusBadge) {
            statusBadge.textContent = '🔒 Chế độ xem (Đăng nhập BTC để quay số)';
            statusBadge.className = 'px-3.5 py-1 rounded-full bg-fast-deeper/70 border border-fast-gold/60 text-[11px] font-bold text-amber-200';
        }
        if (authIndicator) {
            authIndicator.textContent = 'Chưa đăng nhập';
            authIndicator.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500';
        }
        if (loggedInBox) loggedInBox.classList.add('hidden');
        if (currentEmailEl) currentEmailEl.textContent = '';
        if (headerAdminBtn) {
            headerAdminBtn.classList.add('text-fast-textMuted');
            headerAdminBtn.classList.remove('text-emerald-600', 'bg-emerald-50');
            headerAdminBtn.title = 'Quản trị BTC';
        }
    }

    updateDelegatesUI();
    updateWinnerHistoryUI();
    if (currentPageView === 'sports') {
        renderSportsView();
    }
});

db.ref('delegates').on('value', (snapshot) => {
    const data = snapshot.val();
    allDelegatesData = [];

    if (data) {
        Object.keys(data).forEach(key => {
            allDelegatesData.push({ id: key, firebaseKey: key, ...data[key] });
        });
        allDelegatesData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    updateDelegatesUI();
    if (currentPageView === 'sports') {
        renderSportsView();
    }
    if (reelPlaying) {
        renderCurrentReelSlide(false);
    }
}, (error) => {
    console.error("Lỗi đọc dữ liệu từ Firebase:", error);
});

db.ref('luckyDrawWinners').on('value', (snapshot) => {
    const val = snapshot.val();
    const list = [];
    const counts = {
        'Giải Bảy': 0,
        'Giải Sáu': 0,
        'Giải Năm': 0,
        'Giải Tư': 0,
        'Giải Ba': 0,
        'Giải Nhì': 0,
        'Giải Nhất': 0
    };

    if (val) {
        Object.keys(val).forEach(k => {
            const item = { firebaseKey: k, ...val[k] };
            list.push(item);
            if (item.prizeWon && Object.prototype.hasOwnProperty.call(counts, item.prizeWon)) {
                counts[item.prizeWon]++;
            }
        });
        list.sort((a, b) => (b.drawnAt || 0) - (a.drawnAt || 0));
    }

    winningHistory = list;
    prizeCounts = counts;
    updatePrizeCardsUI();
    updateWinnerHistoryUI();
}, () => {});

// ==================== 4. CHUẨN HÓA & KIỂM TRA CHẶT DỮ LIỆU ĐẦU VÀO ====================
const ALLOWED_BRANCH_CODES = new Set(['FHN', 'FDN', 'FSG']);
const ALLOWED_GROUPS = new Set([
    'CBNV FAST Hà Nội (FHN)',
    'CBNV FAST Đà Nẵng (FDN)',
    'CBNV FAST TP.HCM (FSG)'
]);

function normalizePersonName(rawName) {
    return String(rawName || '')
        .normalize('NFC')
        .replace(/[\u0000-\u001F\u007F<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function isValidPersonName(name) {
    if (!name || name.length < 2 || name.length > 80) return false;
    return /^[\p{L}\s'.-]+$/u.test(name);
}

function normalizeVietnamPhone(rawPhone) {
    let digits = String(rawPhone || '').replace(/[^\d+]/g, '').trim();
    if (digits.startsWith('+84')) {
        digits = '0' + digits.slice(3);
    } else if (digits.startsWith('84') && digits.length === 11) {
        digits = '0' + digits.slice(2);
    }
    return digits.replace(/\D/g, '');
}

function isValidVietnamPhone(phone) {
    return /^0(2\d{8,9}|[35789]\d{8})$/.test(phone);
}

function normalizeEmailAddress(rawEmail) {
    return String(rawEmail || '')
        .normalize('NFC')
        .trim()
        .toLowerCase();
}

function isValidEmailAddress(email) {
    if (!email || email.length > 120) return false;
    return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email);
}

function normalizeShortText(rawText, maxLen = 100) {
    return String(rawText || '')
        .normalize('NFC')
        .replace(/[\u0000-\u001F\u007F<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
}

function extractBranchCode(groupOrCompany) {
    const text = String(groupOrCompany || '').normalize('NFC').toUpperCase();
    if (text.includes('FHN') || text.includes('HÀ NỘI') || text.includes('HA NOI')) return 'FHN';
    if (text.includes('FDN') || text.includes('FĐN') || text.includes('ĐÀ NẴNG') || text.includes('DA NANG')) return 'FDN';
    if (text.includes('FSG') || text.includes('TP.HCM') || text.includes('HỒ CHÍ MINH') || text.includes('HO CHI MINH') || text.includes('SÀI GÒN')) return 'FSG';
    return '';
}

function normalizeAndValidateDelegateInput(rawInput) {
    const name = normalizePersonName(rawInput.name);
    if (!isValidPersonName(name)) {
        return { error: "Họ và tên không hợp lệ (2–80 ký tự, chỉ gồm chữ cái và khoảng trắng)." };
    }

    const group = normalizeShortText(rawInput.group, 100);
    const branch = extractBranchCode(`${rawInput.branch || ''} ${group} ${rawInput.company || ''}`);
    if (!ALLOWED_GROUPS.has(group) || !ALLOWED_BRANCH_CODES.has(branch)) {
        return { error: "Vui lòng chọn đúng Chi nhánh hợp lệ (FHN, FDN hoặc FSG)." };
    }

    const phone = normalizeVietnamPhone(rawInput.phone);
    if (!isValidVietnamPhone(phone)) {
        return { error: "Số điện thoại không hợp lệ (cần đúng định dạng SĐT Việt Nam 10–11 số, bắt đầu bằng 0 hoặc +84)." };
    }

    const email = normalizeEmailAddress(rawInput.email);
    if (!isValidEmailAddress(email)) {
        return { error: "Địa chỉ Email không hợp lệ (ví dụ: tenban@fast.com.vn)." };
    }

    const role = normalizeShortText(rawInput.role, 80) || 'CBNV FAST';
    const company = normalizeShortText(rawInput.company, 100) || group;
    const travel = normalizeShortText(rawInput.travel, 100) || 'Đi cùng đoàn FAST';
    const activity = normalizeShortText(rawInput.activity, 100) || 'Tham dự trọn gói';

    const validSports = Array.isArray(rawInput.sports)
        ? Array.from(new Set(rawInput.sports.filter(s => SPORTS_LIST.includes(s))))
        : [];

    const allowedRelations = new Set(['Vợ/Chồng', 'Con cái', 'Bố/Mẹ']);
    const allowedRelTypes = new Set(['Người lớn', 'Trẻ em (> 6 tuổi)', 'Trẻ em (< 6 tuổi)']);
    const validRelatives = [];

    if (Array.isArray(rawInput.relatives)) {
        for (const rel of rawInput.relatives) {
            const rawRelName = String(rel?.name || '').trim();
            if (!rawRelName) continue;
            const cleanRelName = normalizePersonName(rawRelName);
            if (!isValidPersonName(cleanRelName)) {
                return { error: `Tên người thân "${rawRelName}" không hợp lệ (2–80 ký tự chữ).` };
            }
            const relation = allowedRelations.has(rel.relation) ? rel.relation : 'Vợ/Chồng';
            const type = allowedRelTypes.has(rel.type) ? rel.type : 'Người lớn';
            validRelatives.push({ name: cleanRelName, relation, type });
        }
    }

    return {
        data: {
            name,
            group,
            branch,
            company,
            role,
            phone,
            email,
            travel,
            activity,
            sports: validSports,
            relatives: validRelatives.length > 0 ? validRelatives : null
        }
    };
}

// ==================== 5. ĐIỀU HƯỚNG VIEW & MENU ====================
function switchPageView(view) {
    currentPageView = view;

    const views = {
        home: document.getElementById('home-view'),
        program: document.getElementById('program-view'),
        register: document.getElementById('register-view'),
        sports: document.getElementById('sports-view'),
        luckydraw: document.getElementById('luckydraw-view')
    };

    Object.keys(views).forEach(key => {
        if (!views[key]) return;
        if (key === view) {
            views[key].classList.remove('hidden');
        } else {
            views[key].classList.add('hidden');
        }
    });

    const navMap = {
        program: document.getElementById('nav-link-program'),
        sports: document.getElementById('nav-link-sports'),
        luckydraw: document.getElementById('nav-link-luckydraw')
    };
    Object.keys(navMap).forEach(k => {
        if (navMap[k]) {
            if (k === view) navMap[k].classList.add('nav-link-active');
            else navMap[k].classList.remove('nav-link-active');
        }
    });

    if (view === 'register') {
        resetPageRegisterForm();
    } else if (view === 'sports') {
        selectSportTab(currentSportTab);
    } else if (view === 'luckydraw') {
        selectPrizeCard(currentPrize);
        updatePrizeCardsUI();
        updateWinnerHistoryUI();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function navigateToHomeSection(sectionId) {
    if (currentPageView !== 'home') {
        switchPageView('home');
    }
    setTimeout(() => {
        const targetElement = document.getElementById(sectionId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 60);
}

let isMobileMenuOpen = false;
function toggleMobileMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-toggle-icon');

    if (isMobileMenuOpen) {
        if (mobileMenu) mobileMenu.classList.remove('hidden');
        if (menuIcon) menuIcon.classList.add('rotate-90');
    } else {
        closeMobileMenu();
    }
}

function closeMobileMenu() {
    isMobileMenuOpen = false;
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-toggle-icon');
    if (mobileMenu) mobileMenu.classList.add('hidden');
    if (menuIcon) menuIcon.classList.remove('rotate-90');
}

// ==================== 6. NÉN ẢNH NHỎ GỌN CHO REALTIME DATABASE (GÓI FREE) ====================
function compressAvatarToSquareDataUrl(file, maxSize = AVATAR_TARGET_SIZE, quality = AVATAR_TARGET_QUALITY) {
    return new Promise((resolve, reject) => {
        const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
        if (!file || !allowedMimes.has(file.type)) {
            reject(new Error("Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP."));
            return;
        }
        if (file.size > MAX_AVATAR_RAW_BYTES) {
            reject(new Error("Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhẹ hơn."));
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const side = Math.min(img.width, img.height);
                const sx = Math.floor((img.width - side) / 2);
                const sy = Math.floor((img.height - side) / 2);

                const canvas = document.createElement('canvas');
                canvas.width = maxSize;
                canvas.height = maxSize;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);

                let compressed = canvas.toDataURL('image/jpeg', quality);
                if (compressed.length > MAX_AVATAR_DATAURL_CHARS) {
                    compressed = canvas.toDataURL('image/jpeg', 0.52);
                }
                if (compressed.length > MAX_AVATAR_DATAURL_CHARS) {
                    reject(new Error("Ảnh sau nén vẫn vượt ngưỡng dung lượng cho phép. Vui lòng chọn ảnh khác."));
                    return;
                }
                resolve(compressed);
            };
            img.onerror = () => reject(new Error("Không thể đọc ảnh đã chọn."));
            img.src = ev.target.result;
        };
        reader.onerror = () => reject(new Error("Lỗi khi tải file ảnh."));
        reader.readAsDataURL(file);
    });
}

function resolveAvatarForDatabase(avatarValue) {
    if (!avatarValue || typeof avatarValue !== 'string') return null;
    if (avatarValue.startsWith('data:image/') && avatarValue.length <= MAX_AVATAR_DATAURL_CHARS) {
        return avatarValue;
    }
    return null;
}

function setAvatarPreviewUI(prefix, dataUrl) {
    pendingAvatarData[prefix] = dataUrl || '';
    const imgEl = document.getElementById(`${prefix}-avatar-preview`);
    const phEl = document.getElementById(`${prefix}-avatar-placeholder`);
    const clearBtn = document.getElementById(`${prefix}-avatar-clear`);

    if (dataUrl) {
        if (imgEl) {
            imgEl.src = dataUrl;
            imgEl.classList.remove('hidden');
        }
        if (phEl) phEl.classList.add('hidden');
        if (clearBtn) clearBtn.classList.remove('hidden');
    } else {
        if (imgEl) {
            imgEl.src = '';
            imgEl.classList.add('hidden');
        }
        if (phEl) phEl.classList.remove('hidden');
        if (clearBtn) clearBtn.classList.add('hidden');
    }
}

function handleAvatarFileChange(event, prefix) {
    const file = event.target?.files?.[0];
    if (!file) return;

    compressAvatarToSquareDataUrl(file, AVATAR_TARGET_SIZE, AVATAR_TARGET_QUALITY)
        .then((dataUrl) => {
            const approxKb = Math.round((dataUrl.length * 3) / 4 / 1024);
            setAvatarPreviewUI(prefix, dataUrl);
            showToast(`Đã nén ảnh chân dung (~${approxKb} KB) cho thẻ đại biểu!`);
        })
        .catch((err) => {
            alert(err.message || "Không thể xử lý ảnh.");
            event.target.value = '';
        });
}

function clearAvatarSelection(prefix) {
    const fileInput = document.getElementById(`${prefix}-avatar-file`);
    if (fileInput) fileInput.value = '';
    setAvatarPreviewUI(prefix, '');
}

function getDelegateAvatarSrc(item) {
    if (item && typeof item.avatar === 'string' && item.avatar.startsWith('data:image/')) {
        return item.avatar;
    }
    const initials = encodeURIComponent((item?.name || 'FAST 30').trim().slice(0, 2).toUpperCase());
    return `https://ui-avatars.com/api/?name=${initials}&background=00686B&color=FDE047&size=256&bold=true`;
}

function buildDelegateBadgeCardHtml(item) {
    const avatarSrc = getDelegateAvatarSrc(item);
    const branch = getMemberBranch(item);
    const sportsList = Array.isArray(item.sports) && item.sports.length ? item.sports.join(', ') : 'Chưa chọn';
    const rels = getRelativesArray(item);

    const relativesBlock = rels.length > 0
        ? `
            <div class="pt-3.5 border-t border-white/15 text-xs sm:text-sm">
                <div class="font-bold text-[#FDE047] mb-2">👨‍👩‍👧 Người thân đi kèm (${rels.length})</div>
                <div class="flex flex-wrap gap-2">
                    ${rels.map(r => `
                        <span class="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-white/95 font-medium">
                            ${escapeHTML(r.name || 'Người đi kèm')}${r.relation ? ` · ${escapeHTML(r.relation)}` : ''}
                        </span>
                    `).join('')}
                </div>
            </div>
        `
        : '';

    return `
        <div class="relative rounded-[32px] overflow-hidden border-2 border-[#E5C158] shadow-[0_24px_65px_rgba(0,0,0,0.6)] text-white"
             style="background: radial-gradient(circle at 90% 12%, rgba(253, 224, 71, 0.24), transparent 42%), radial-gradient(circle at 12% 88%, rgba(255, 107, 53, 0.22), transparent 45%), linear-gradient(145deg, #003E41 0%, #00686B 55%, #00898E 100%);">

            <!-- Dải đầu thẻ -->
            <div class="px-4 sm:px-8 py-3 sm:py-3.5 bg-[#00282A]/80 border-b border-[#E5C158]/35 flex items-center justify-between gap-2 pr-12 sm:pr-14">
                <div class="flex items-center gap-2 min-w-0">
					${buildFast30CardLogoHtml()}
					<span class="text-[11px] sm:text-sm font-extrabold uppercase tracking-wider sm:tracking-[0.14em] text-[#FDE047] truncate">
						FAST 30 NĂM<br>1997–2027
					</span>
				</div>			
                <span class="px-3 py-1 rounded-full bg-[#FF6B35] text-white font-mono text-xs sm:text-sm font-extrabold shadow whitespace-nowrap shrink-0">
                    ${escapeHTML(item.code || 'FAST30-XXXX')}
                </span>
            </div>

            <!-- Thân thẻ lớn -->
            <div class="p-5 sm:p-8 space-y-5">
                <div class="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
                    <div class="relative shrink-0">
                        <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-1.5 bg-gradient-to-br from-[#FDE047] via-amber-300 to-[#FF6B35] shadow-xl">
                            <img src="${avatarSrc}" alt="${escapeHTML(item.name || 'CBNV')}" class="w-full h-full object-cover rounded-[20px] bg-white">
                        </div>
                    </div>

                    <div class="min-w-0 flex-1 w-full text-center sm:text-left space-y-1.5">
                        <span class="inline-block px-3 py-1 rounded-xl bg-white/15 border border-[#FDE047]/40 text-[11px] font-extrabold uppercase tracking-wider text-[#FDE047]">
                            CHI NHÁNH ${escapeHTML(branch)}
                        </span>

                        <div class="flex items-center justify-center sm:justify-between gap-2.5 flex-wrap">
                            <h4 class="font-display font-extrabold text-2xl sm:text-3xl text-white leading-snug break-words">
                                ${escapeHTML(item.name || '')}
                            </h4>
                        </div>

                        <p class="text-sm text-teal-100 font-semibold">
                            ${escapeHTML(item.role || item.group || 'CBNV FAST')}
                        </p>
                        <p class="text-xs sm:text-sm text-amber-200/95 font-medium">
                            FLC Quảng Bình · 10–13/07/2027 (4N3Đ)
                        </p>
                    </div>
                </div>

                <!-- Thông tin tham dự -->
                <div class="grid grid-cols-1 gap-2.5 pt-4 border-t border-white/15 text-xs sm:text-sm">
                    <div class="px-4 py-3 rounded-2xl bg-black/20 border border-white/10 flex items-center justify-between gap-3">
                        <span class="text-teal-100/80 shrink-0">Chương trình</span>
                        <strong class="text-white text-right">${escapeHTML(item.activity || '—')}</strong>
                    </div>
                    <div class="px-4 py-3 rounded-2xl bg-black/20 border border-white/10 flex items-center justify-between gap-3">
                        <span class="text-teal-100/80 shrink-0">Môn thể thao</span>
                        <strong class="text-[#FDE047] text-right">${escapeHTML(sportsList)}</strong>
                    </div>
                </div>

                ${relativesBlock}

                <!-- Chân thẻ -->
                <div class="pt-3 border-t border-white/15 text-center text-xs sm:text-sm text-amber-100/95 italic">
                    “Am hiểu nghiệp vụ, Tận tâm đồng hành”
                </div>
            </div>
        </div>
    `;
}

function openDelegateCardModal(codeOrId) {
    const found = allDelegatesData.find(d => d.code === codeOrId || d.id === codeOrId || d.firebaseKey === codeOrId)
        || winningHistory.find(w => w.code === codeOrId || w.id === codeOrId);
    if (!found) return;
    const bodyEl = document.getElementById('delegate-card-modal-body');
    if (bodyEl) bodyEl.innerHTML = buildDelegateBadgeCardHtml(found);
    document.getElementById('delegate-card-modal')?.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeDelegateCardModal() {
    document.getElementById('delegate-card-modal')?.classList.add('hidden');
}

// ==================== 7. ĐĂNG KÝ (TRANG RIÊNG & MODAL) ====================
function addPageRelativeRow(name = '', relation = 'Vợ/Chồng', type = 'Người lớn') {
    const container = document.getElementById('p-relatives-container');
    if (!container) return;

    const rowId = 'p-rel-row-' + Date.now() + Math.floor(Math.random() * 1000);
    container.insertAdjacentHTML('beforeend', `
        <div id="${rowId}" class="p-3.5 rounded-2xl bg-fast-body border border-fast-border space-y-2.5 text-xs">
            <div class="flex items-center justify-between">
                <span class="font-extrabold text-fast-dark">Người thân đi kèm</span>
                <button type="button" onclick="document.getElementById('${rowId}').remove()" class="text-red-500 hover:text-red-600 font-bold">Xóa dòng</button>
            </div>
            <input type="text" value="${escapeHTML(name)}" maxlength="80" placeholder="Họ và tên người thân..." class="p-rel-name-input w-full px-3 py-2 rounded-xl border border-fast-border bg-white outline-none">
            <div class="grid grid-cols-2 gap-2">
                <select class="p-rel-relation-input px-3 py-2 rounded-xl border border-fast-border bg-white outline-none">
                    <option value="Vợ/Chồng" ${relation === 'Vợ/Chồng' ? 'selected' : ''}>Vợ / Chồng</option>
                    <option value="Con cái" ${relation === 'Con cái' ? 'selected' : ''}>Con cái</option>
                    <option value="Bố/Mẹ" ${relation === 'Bố/Mẹ' ? 'selected' : ''}>Bố / Mẹ</option>
                </select>
                <select class="p-rel-type-input px-3 py-2 rounded-xl border border-fast-border bg-white outline-none">
                    <option value="Người lớn" ${type === 'Người lớn' ? 'selected' : ''}>Người lớn</option>
                    <option value="Trẻ em (> 6 tuổi)" ${type === 'Trẻ em (> 6 tuổi)' ? 'selected' : ''}>Trẻ em (&gt; 6 tuổi)</option>
                    <option value="Trẻ em (< 6 tuổi)" ${type === 'Trẻ em (< 6 tuổi)' ? 'selected' : ''}>Trẻ em (&lt; 6 tuổi)</option>
                </select>
            </div>
        </div>
    `);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handlePageRegistrationSubmit(event) {
    event.preventDefault();

    const selectedSports = Array.from(
        document.querySelectorAll('input[name="p-reg-sports"]:checked')
    ).map(cb => cb.value);

    const rawRelatives = [];
    document.querySelectorAll('#p-relatives-container > div').forEach(row => {
        const relNameInput = row.querySelector('.p-rel-name-input');
        rawRelatives.push({
            name: relNameInput ? relNameInput.value : '',
            relation: row.querySelector('.p-rel-relation-input')?.value,
            type: row.querySelector('.p-rel-type-input')?.value
        });
    });

    const validation = normalizeAndValidateDelegateInput({
        name: document.getElementById('p-reg-name').value,
        group: document.getElementById('p-reg-group').value,
        role: document.getElementById('p-reg-role').value,
        phone: document.getElementById('p-reg-phone').value,
        email: document.getElementById('p-reg-email').value,
        travel: document.getElementById('p-reg-travel').value,
        activity: document.getElementById('p-reg-activity').value,
        sports: selectedSports,
        relatives: rawRelatives
    });

    if (validation.error) {
        alert(validation.error);
        return;
    }

    const clean = validation.data;

    const duplicate = allDelegatesData.find(d =>
        normalizeVietnamPhone(d.phone) === clean.phone ||
        normalizeEmailAddress(d.email) === clean.email
    );
    if (duplicate) {
        const proceed = confirm(
            `SĐT hoặc Email này đã tồn tại trong danh sách (${duplicate.name} - ${duplicate.code}). Bạn vẫn muốn tạo đăng ký mới chứ?`
        );
        if (!proceed) return;
    }

    const submitBtn = document.getElementById('btn-p-reg-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang lưu đăng ký...';
    }

    try {
        const usedCodes = new Set(allDelegatesData.map(d => String(d.code || '').toUpperCase()));
        let regCode = '';
        let guard = 0;
        do {
            regCode = `FAST30-${Math.floor(1000 + Math.random() * 9000)}`;
            guard++;
        } while (usedCodes.has(regCode) && guard < 10000);

        lastCreatedCode = regCode;
        const resolvedAvatar = resolveAvatarForDatabase(pendingAvatarData['p-reg']);

        const record = {
            code: regCode,
            name: clean.name,
            company: clean.company,
            group: clean.group,
            branch: clean.branch,
            role: clean.role,
            phone: clean.phone,
            email: clean.email,
            travel: clean.travel,
            activity: clean.activity,
            avatar: resolvedAvatar,
            sports: clean.sports.length > 0 ? clean.sports : null,
            relatives: clean.relatives,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        await db.ref('delegates').push(record);

        document.getElementById('p-succ-name').textContent = clean.name;
        document.getElementById('p-succ-code').textContent = regCode;
        const badgeEl = document.getElementById('p-succ-badge-card');
        if (badgeEl) badgeEl.innerHTML = buildDelegateBadgeCardHtml(record);
        document.getElementById('page-register-form-view').classList.add('hidden');
        document.getElementById('page-register-success-view').classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        showToast(`Đăng ký thành công! Mã: ${regCode}`);
    } catch (error) {
        console.error("Lỗi lưu đăng ký trang riêng:", error);
        alert("Có lỗi xảy ra khi lưu thông tin lên Firebase, vui lòng kiểm tra lại.");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Xác nhận đăng ký';
        }
    }
}

function resetPageRegisterForm() {
    const form = document.getElementById('page-registration-form');
    if (form) form.reset();
    clearAvatarSelection('p-reg');
    const relContainer = document.getElementById('p-relatives-container');
    if (relContainer) relContainer.innerHTML = '';
    const succView = document.getElementById('page-register-success-view');
    const formView = document.getElementById('page-register-form-view');
    if (succView) succView.classList.add('hidden');
    if (formView) formView.classList.remove('hidden');
}

function openRegisterModal() {
    const formView = document.getElementById('register-form-view');
    const succView = document.getElementById('register-success-view');
    const modal = document.getElementById('register-modal');
    if (formView) formView.classList.remove('hidden');
    if (succView) succView.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeRegisterModal() {
    document.getElementById('register-modal')?.classList.add('hidden');
}

function copyRegCode() {
    if (lastCreatedCode) {
        copyTextFallback(lastCreatedCode);
        showToast(`Đã sao chép mã: ${lastCreatedCode}`);
    }
}

function switchToLookupFromSuccess() {
    closeRegisterModal();
    openLookupModal();
    if (lastCreatedCode) {
        document.getElementById('lookup-query').value = lastCreatedCode;
        performLookup(lastCreatedCode);
    }
}

// ==================== 8. TAB THỂ THAO THEO MÔN & CHI NHÁNH ====================
function getMemberBranch(item) {
    const code = extractBranchCode(`${item.branch || ''} ${item.group || ''} ${item.company || ''}`);
    return code || 'KHÁC';
}

function selectSportTab(sportName) {
    currentSportTab = sportName;
    currentSportPage = 1;
    SPORTS_LIST.forEach(s => {
        const btn = document.getElementById(`sport-tab-${s}`);
        if (!btn) return;
        if (s === sportName) {
            btn.className = 'sport-tab-btn px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-fast-dark text-white shadow transition';
        } else {
            btn.className = 'sport-tab-btn px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-fast-card text-fast-textMain border border-fast-border hover:border-fast-primary transition';
        }
    });
    renderSportsView();
}

function setSportBranchFilter(branch) {
    currentSportBranch = branch;
    currentSportPage = 1;
    ['ALL', 'FHN', 'FDN', 'FSG'].forEach(b => {
        const btn = document.getElementById(`sport-branch-${b}`);
        if (!btn) return;
        btn.className = (b === branch)
            ? 'px-3.5 py-2 rounded-xl text-xs font-bold bg-fast-primary text-white'
            : 'px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200';
    });
    renderSportsView();
}

function handleSportSearchInput(event) {
    currentSportSearch = String(event.target.value || '').trim();
    currentSportPage = 1;
    renderSportsView();
}

function goToSportPage(pageNum) {
    currentSportPage = pageNum;
    renderSportsView();
    const sec = document.getElementById('sports-view');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSportsPagination(totalItems) {
    const paginationBox = document.getElementById('sports-pagination');
    const infoEl = document.getElementById('sports-page-info');
    const buttonsEl = document.getElementById('sports-page-buttons');
    if (!paginationBox || !infoEl || !buttonsEl) return;

    if (totalItems <= SPORTS_PAGE_SIZE) {
        paginationBox.classList.add('hidden');
        buttonsEl.innerHTML = '';
        infoEl.textContent = '';
        return;
    }

    const totalPages = Math.ceil(totalItems / SPORTS_PAGE_SIZE);
    if (currentSportPage > totalPages) currentSportPage = totalPages;
    if (currentSportPage < 1) currentSportPage = 1;

    const startIdx = (currentSportPage - 1) * SPORTS_PAGE_SIZE + 1;
    const endIdx = Math.min(currentSportPage * SPORTS_PAGE_SIZE, totalItems);

    paginationBox.classList.remove('hidden');
    infoEl.innerHTML = `Hiển thị <b>${startIdx}–${endIdx}</b> / <b>${totalItems}</b> bản ghi (Trang ${currentSportPage}/${totalPages})`;

    let btnsHtml = `
        <button type="button" onclick="goToSportPage(${currentSportPage - 1})" ${currentSportPage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border border-fast-border font-bold text-xs ${currentSportPage === 1 ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' : 'bg-white hover:bg-slate-50 text-fast-dark cursor-pointer'}">
            ← Trước
        </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
        const isActive = p === currentSportPage;
        btnsHtml += `
            <button type="button" onclick="goToSportPage(${p})" class="w-8 h-8 rounded-xl font-bold text-xs transition cursor-pointer ${isActive ? 'bg-fast-dark text-white shadow-xs' : 'bg-white border border-fast-border text-slate-600 hover:bg-slate-50'}">
                ${p}
            </button>
        `;
    }

    btnsHtml += `
        <button type="button" onclick="goToSportPage(${currentSportPage + 1})" ${currentSportPage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border border-fast-border font-bold text-xs ${currentSportPage === totalPages ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' : 'bg-white hover:bg-slate-50 text-fast-dark cursor-pointer'}">
            Sau →
        </button>
    `;

    buttonsEl.innerHTML = btnsHtml;
}

function renderSportsView() {
    SPORTS_LIST.forEach(sport => {
        const countEl = document.getElementById(`sport-count-${sport}`);
        if (!countEl) return;
        const count = allDelegatesData.filter(d => Array.isArray(d.sports) && d.sports.includes(sport)).length;
        countEl.textContent = count;
    });
	
	const exportSportBtn = document.getElementById('admin-export-sport-btn');
	if (exportSportBtn) {
		if (isAdminLoggedIn) exportSportBtn.classList.remove('hidden');
		else exportSportBtn.classList.add('hidden');
	}

    const titleEl = document.getElementById('sport-current-title');
    if (titleEl) {
        const branchLabel = currentSportBranch === 'ALL' ? 'Tất cả chi nhánh' : `Chi nhánh ${currentSportBranch}`;
        titleEl.textContent = `Môn: ${currentSportTab} · ${branchLabel}`;
    }

    let list = allDelegatesData.filter(d => Array.isArray(d.sports) && d.sports.includes(currentSportTab));

    if (currentSportBranch !== 'ALL') {
        list = list.filter(d => getMemberBranch(d) === currentSportBranch);
    }

    if (currentSportSearch) {
        list = list.filter(d => {
            const searchable = [
                d.name,
                d.code,
                getMemberBranch(d),
                d.group,
                d.role,
                d.company
            ].join(' ');
            return matchesSearch(searchable, currentSportSearch);
        });
    }

    const totalEl = document.getElementById('sport-filtered-total');
    if (totalEl) totalEl.textContent = `${list.length} CBNV`;

    const tbody = document.getElementById('sports-table-body');
    const mobileList = document.getElementById('sports-mobile-list');

    if (list.length === 0) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 italic text-sm">Chưa có CBNV nào phù hợp với bộ lọc ở môn ${escapeHTML(currentSportTab)}.</td></tr>`;
        }
        if (mobileList) {
            mobileList.innerHTML = `<div class="p-6 text-center text-slate-400 italic text-sm">Chưa có CBNV nào phù hợp với bộ lọc ở môn ${escapeHTML(currentSportTab)}.</div>`;
        }
        renderSportsPagination(0);
        return;
    }

    const totalFiltered = list.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / SPORTS_PAGE_SIZE));
    if (currentSportPage > totalPages) currentSportPage = totalPages;
    const startOffset = (currentSportPage - 1) * SPORTS_PAGE_SIZE;
    const pagedList = list.slice(startOffset, startOffset + SPORTS_PAGE_SIZE);

    if (tbody) {
        tbody.innerHTML = pagedList.map(item => {
            const sportsBadge = Array.isArray(item.sports) && item.sports.length > 0
                ? `<div class="text-[11px] text-fast-primary font-semibold mt-0.5">🏅 ${escapeHTML(item.sports.join(', '))}</div>`
                : '';
            const cardBtn = `<button type="button" onclick="openDelegateCardModal('${escapeHTML(item.code || item.id)}')" class="px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs">Thẻ</button>`;

            return `
                <tr class="hover:bg-fast-body transition-colors border-b border-slate-100 last:border-none align-top">
                    <td class="p-4 pl-6 font-mono font-extrabold text-fast-primary whitespace-nowrap">${escapeHTML(item.code || '—')}</td>
                    <td class="p-4">
                        <div class="flex items-center gap-2.5">
                            <img src="${getDelegateAvatarSrc(item)}" alt="${escapeHTML(item.name)}" class="w-9 h-9 rounded-xl object-cover border border-fast-border shrink-0">
                            <div>
                                <div class="font-bold text-fast-textMain">${escapeHTML(item.name)}</div>
                                <div class="text-[11px] text-slate-400">${escapeHTML(item.role || '')}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-4 text-xs text-slate-600">${escapeHTML(item.company || getMemberBranch(item) || '—')}</td>
                    <td class="p-4"><span class="px-3 py-1 rounded-full text-[11px] font-extrabold bg-fast-dark/10 text-fast-dark">${escapeHTML(item.group || getMemberBranch(item) || '—')}</span></td>
                    <td class="p-4 text-xs">
                        <div class="font-semibold text-fast-textMain">${escapeHTML(item.activity || '—')}</div>
                        ${sportsBadge}
                    </td>
                    <td class="p-4 pr-6 text-right whitespace-nowrap">${cardBtn}</td>
                </tr>
            `;
        }).join('');
    }

    if (mobileList) {
        mobileList.innerHTML = pagedList.map(item => {
            const sportsBadge = Array.isArray(item.sports) && item.sports.length > 0
                ? `<div class="text-[11px] text-fast-primary font-semibold">🏅 ${escapeHTML(item.sports.join(', '))}</div>`
                : '';

            return `
                <div class="bg-fast-card rounded-2xl p-4 border border-fast-border shadow-xs space-y-2">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <img src="${getDelegateAvatarSrc(item)}" alt="${escapeHTML(item.name)}" class="w-9 h-9 rounded-xl object-cover border border-fast-border shrink-0">
                            <span class="font-bold text-sm text-fast-textMain truncate">${escapeHTML(item.name)}</span>
                        </div>
                        <button type="button" onclick="openDelegateCardModal('${escapeHTML(item.code || item.id)}')" class="px-2.5 py-0.5 rounded-lg bg-fast-primary/10 text-fast-primary font-mono font-bold text-xs shrink-0">${escapeHTML(item.code || '—')}</button>
                    </div>
                    <div class="text-xs text-slate-600">${escapeHTML(item.group || getMemberBranch(item) || '—')}</div>
                    <div class="text-xs text-slate-500">${escapeHTML(item.activity || '')}</div>
                    ${sportsBadge}
                </div>
            `;
        }).join('');
    }

    renderSportsPagination(totalFiltered);
}

// ==================== 9. DANH SÁCH ĐẠI BIỂU, NGƯỜI ĐI KÈM & PHÂN TRANG ====================
const DELEGATES_PAGE_SIZE = 20;
let currentDelegatePage = 1;

function getRelativesArray(item) {
    if (Array.isArray(item.relatives)) {
        return item.relatives.filter(r => r && (r.name || r.relation || r.type));
    }
    if (item.relative && typeof item.relative === 'object' && (item.relative.name || item.relative.relation || item.relative.type)) {
        return [item.relative];
    }
    return [];
}

function renderRelativesDetailHtml(item) {
    const rels = getRelativesArray(item);
    if (rels.length === 0) return '';

    const itemsHtml = rels.map(r => {
        const relName = escapeHTML(r.name || 'Người đi kèm');
        const metaParts = [r.relation, r.type].filter(Boolean).map(escapeHTML);
        const metaText = metaParts.length > 0 ? ` (${metaParts.join(' · ')})` : '';
        return `<li>• <strong class="text-slate-700">${relName}</strong>${metaText}</li>`;
    }).join('');

    return `
        <div class="mt-2 pt-2 border-t border-slate-100 text-[11px]">
            <span class="font-bold text-amber-800 inline-flex items-center gap-1">
                <span>👨‍👩‍👧 Người thân đi kèm (${rels.length}):</span>
            </span>
            <ul class="mt-1 space-y-0.5 text-slate-600">${itemsHtml}</ul>
        </div>
    `;
}

function setFilter(filterType) {
    currentFilter = filterType;
    currentDelegatePage = 1;
    const buttons = ['all', 'khach', 'fhn', 'fdn', 'fsg'];
    buttons.forEach(btn => {
        const el = document.getElementById(`btn-${btn}`);
        if (el) {
            el.className = (btn === filterType)
                ? "px-4 py-2 rounded-2xl text-xs font-bold transition bg-fast-dark text-white shadow"
                : "px-4 py-2 rounded-2xl text-xs font-bold transition bg-fast-card text-slate-600 border border-fast-border hover:bg-slate-100";
        }
    });
    updateDelegatesUI();
}

function handleSearchInput(event) {
    currentSearchQuery = String(event.target.value || '').trim();
    currentDelegatePage = 1;
    updateDelegatesUI();
}

function goToDelegatePage(pageNum) {
    currentDelegatePage = pageNum;
    updateDelegatesUI();
    const sec = document.getElementById('danh-sach');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDelegatesPagination(totalItems) {
    const paginationBox = document.getElementById('delegates-pagination');
    const infoEl = document.getElementById('delegates-page-info');
    const buttonsEl = document.getElementById('delegates-page-buttons');
    if (!paginationBox || !infoEl || !buttonsEl) return;

    if (totalItems <= DELEGATES_PAGE_SIZE) {
        paginationBox.classList.add('hidden');
        buttonsEl.innerHTML = '';
        infoEl.textContent = '';
        return;
    }

    const totalPages = Math.ceil(totalItems / DELEGATES_PAGE_SIZE);
    if (currentDelegatePage > totalPages) currentDelegatePage = totalPages;
    if (currentDelegatePage < 1) currentDelegatePage = 1;

    const startIdx = (currentDelegatePage - 1) * DELEGATES_PAGE_SIZE + 1;
    const endIdx = Math.min(currentDelegatePage * DELEGATES_PAGE_SIZE, totalItems);

    paginationBox.classList.remove('hidden');
    infoEl.innerHTML = `Hiển thị <b>${startIdx}–${endIdx}</b> / <b>${totalItems}</b> bản ghi (Trang ${currentDelegatePage}/${totalPages})`;

    let btnsHtml = `
        <button type="button" onclick="goToDelegatePage(${currentDelegatePage - 1})" ${currentDelegatePage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border border-fast-border font-bold text-xs ${currentDelegatePage === 1 ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' : 'bg-white hover:bg-slate-50 text-fast-dark cursor-pointer'}">
            ← Trước
        </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
        const isActive = p === currentDelegatePage;
        btnsHtml += `
            <button type="button" onclick="goToDelegatePage(${p})" class="w-8 h-8 rounded-xl font-bold text-xs transition cursor-pointer ${isActive ? 'bg-fast-dark text-white shadow-xs' : 'bg-white border border-fast-border text-slate-600 hover:bg-slate-50'}">
                ${p}
            </button>
        `;
    }

    btnsHtml += `
        <button type="button" onclick="goToDelegatePage(${currentDelegatePage + 1})" ${currentDelegatePage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border border-fast-border font-bold text-xs ${currentDelegatePage === totalPages ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' : 'bg-white hover:bg-slate-50 text-fast-dark cursor-pointer'}">
            Sau →
        </button>
    `;

    buttonsEl.innerHTML = btnsHtml;
}

function updateDelegatesUI() {
    const khachList = allDelegatesData.filter(item => item.group && (item.group.toLowerCase().includes('khách') || item.group.toLowerCase().includes('đối tác')));
    const fhnList = allDelegatesData.filter(item => getMemberBranch(item) === 'FHN');
    const fdnList = allDelegatesData.filter(item => getMemberBranch(item) === 'FDN');
    const fsgList = allDelegatesData.filter(item => getMemberBranch(item) === 'FSG');

    const countAll = document.getElementById('count-all');
    const countKhach = document.getElementById('count-khach');
    const countFhn = document.getElementById('count-fhn');
    const countFdn = document.getElementById('count-fdn');
    const countFsg = document.getElementById('count-fsg');
	
	const exportDelBar = document.getElementById('admin-export-delegates-bar');
	if (exportDelBar) {
		if (isAdminLoggedIn) exportDelBar.classList.remove('hidden');
		else exportDelBar.classList.add('hidden');
	}

    if (countAll) countAll.textContent = allDelegatesData.length;
    if (countKhach) countKhach.textContent = khachList.length;
    if (countFhn) countFhn.textContent = fhnList.length;
    if (countFdn) countFdn.textContent = fdnList.length;
    if (countFsg) countFsg.textContent = fsgList.length;

    let displayList = allDelegatesData;
    if (currentFilter === 'khach') displayList = khachList;
    if (currentFilter === 'fhn') displayList = fhnList;
    if (currentFilter === 'fdn') displayList = fdnList;
    if (currentFilter === 'fsg') displayList = fsgList;

    if (currentSearchQuery) {
        displayList = displayList.filter(item => {
            const relNames = getRelativesArray(item).map(r => r.name || '').join(' ');
            const searchable = [
                item.name,
                item.code,
                item.phone,
                item.company,
                item.group,
                item.role,
                relNames
            ].join(' ');
            return matchesSearch(searchable, currentSearchQuery);
        });
    }

    let totalRelativesCount = 0;
    allDelegatesData.forEach(item => {
        totalRelativesCount += getRelativesArray(item).length;
    });

    const statsTextEl = document.getElementById('stats-text');
    const statsDetailEl = document.getElementById('stats-detail');
    if (statsTextEl) statsTextEl.innerHTML = `Tổng số lượng tham dự thực tế: <b>${allDelegatesData.length + totalRelativesCount} người</b>`;
    if (statsDetailEl) statsDetailEl.innerHTML = `(Gồm <b>${allDelegatesData.length}</b> đại biểu chính thức và <b>${totalRelativesCount}</b> người thân đi kèm)`;

    const tbody = document.getElementById('delegates-table-body');
    const mobileContainer = document.getElementById('delegates-mobile-list');

    if (displayList.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 italic">Không tìm thấy kết quả phù hợp.</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="p-8 text-center text-slate-400 italic text-sm">Không tìm thấy kết quả phù hợp.</div>`;
        renderDelegatesPagination(0);
        return;
    }

    const totalFiltered = displayList.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / DELEGATES_PAGE_SIZE));
    if (currentDelegatePage > totalPages) currentDelegatePage = totalPages;
    const startOffset = (currentDelegatePage - 1) * DELEGATES_PAGE_SIZE;
    const pagedList = displayList.slice(startOffset, startOffset + DELEGATES_PAGE_SIZE);

    if (tbody) {
        tbody.innerHTML = pagedList.map(item => {
            const sportsBadge = Array.isArray(item.sports) && item.sports.length > 0
                ? `<div class="text-[11px] text-fast-primary font-semibold mt-0.5">🏅 ${escapeHTML(item.sports.join(', '))}</div>`
                : '';
            const relDetailHtml = renderRelativesDetailHtml(item);
            const cardBtn = `<button type="button" onclick="openDelegateCardModal('${escapeHTML(item.code || item.id)}')" class="px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs mr-1">Thẻ</button>`;
            const adminActions = isAdminLoggedIn ? `
                <button type="button" onclick="openEditModal('${item.firebaseKey || item.id}')" class="px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs mr-1">Sửa</button>
                <button type="button" onclick="deleteDelegateRecord('${item.firebaseKey || item.id}')" class="px-2.5 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs">Xóa</button>
            ` : '';

            return `
                <tr class="hover:bg-fast-body transition-colors border-b border-slate-100 last:border-none align-top">
                    <td class="p-4 pl-6 font-mono font-extrabold text-fast-primary whitespace-nowrap">${escapeHTML(item.code)}</td>
                    <td class="p-4">
                        <div class="flex items-center gap-2.5">
                            <img src="${getDelegateAvatarSrc(item)}" alt="${escapeHTML(item.name)}" class="w-9 h-9 rounded-xl object-cover border border-fast-border shrink-0">
                            <div>
                                <div class="font-bold text-fast-textMain">${escapeHTML(item.name)}</div>
                                <div class="text-[11px] text-slate-400">${escapeHTML(item.role || '')}</div>
                            </div>
                        </div>
                        ${relDetailHtml}
                    </td>
                    <td class="p-4 text-xs text-slate-600">${escapeHTML(item.company || '—')}</td>
                    <td class="p-4"><span class="px-3 py-1 rounded-full text-[11px] font-extrabold bg-fast-dark/10 text-fast-dark">${escapeHTML(item.group)}</span></td>
                    <td class="p-4 text-xs">
                        <div class="font-semibold text-fast-textMain">${escapeHTML(item.activity || '—')}</div>
                        ${sportsBadge}
                    </td>
                    <td class="p-4 pr-6 text-right whitespace-nowrap">${cardBtn}${adminActions}</td>
                </tr>
            `;
        }).join('');
    }

    if (mobileContainer) {
        mobileContainer.innerHTML = pagedList.map(item => {
            const sportsBadge = Array.isArray(item.sports) && item.sports.length > 0
                ? `<div class="text-[11px] text-fast-primary font-semibold">🏅 ${escapeHTML(item.sports.join(', '))}</div>`
                : '';
            const relDetailHtml = renderRelativesDetailHtml(item);

            return `
                <div class="bg-fast-card rounded-2xl p-4 border border-fast-border shadow-xs space-y-2">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <img src="${getDelegateAvatarSrc(item)}" alt="${escapeHTML(item.name)}" class="w-9 h-9 rounded-xl object-cover border border-fast-border shrink-0">
                            <span class="font-bold text-sm text-fast-textMain truncate">${escapeHTML(item.name)}</span>
                        </div>
                        <button type="button" onclick="openDelegateCardModal('${escapeHTML(item.code || item.id)}')" class="px-2.5 py-0.5 rounded-lg bg-fast-primary/10 text-fast-primary font-mono font-bold text-xs shrink-0">${escapeHTML(item.code)}</button>
                    </div>
                    <div class="text-xs text-slate-600">${escapeHTML(item.group)}</div>
                    <div class="text-xs text-slate-500">${escapeHTML(item.activity || '')}</div>
                    ${sportsBadge}
                    ${relDetailHtml}
                </div>
            `;
        }).join('');
    }

    renderDelegatesPagination(totalFiltered);
}

// ==================== 10. TRA CỨU, FIREBASE AUTH ADMIN & CHỈNH SỬA ====================
function openLookupModal() {
    document.getElementById('lookup-modal').classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeLookupModal() {
    document.getElementById('lookup-modal').classList.add('hidden');
}

function handleLookupSubmit(event) {
    event.preventDefault();
    performLookup(document.getElementById('lookup-query').value.trim());
}

function performLookup(query) {
    const resultDiv = document.getElementById('lookup-result');
    const cleanQuery = query.trim().toUpperCase();
    const digitsQuery = normalizeVietnamPhone(query);
    resultDiv.classList.remove('hidden');

    const found = allDelegatesData.find(item => {
        const code = (item.code || '').trim().toUpperCase();
        const phone = normalizeVietnamPhone(item.phone);
        return code === cleanQuery || (digitsQuery.length >= 4 && phone.includes(digitsQuery));
    });

    if (found) {
        resultDiv.innerHTML = buildDelegateBadgeCardHtml(found);
    } else {
        resultDiv.innerHTML = `<div class="p-4 rounded-2xl bg-fast-body border border-fast-border text-center text-xs text-slate-600">Không tìm thấy thông tin đăng ký.</div>`;
    }
}

function requireAdminAuth(actionLabel = 'thực hiện thao tác này') {
    if (isAdminLoggedIn && auth.currentUser) return true;
    showToast(`Vui lòng đăng nhập tài khoản BTC để ${actionLabel}.`);
    openAdminModal();
    return false;
}

function openAdminModal() {
    const modal = document.getElementById('admin-login-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const passInput = document.getElementById('admin-password-input');
    if (passInput) passInput.value = '';
    const emailInput = document.getElementById('admin-email-input');
    if (emailInput && !emailInput.value) {
        emailInput.focus();
    }
}

function closeAdminModal() {
    const modal = document.getElementById('admin-login-modal');
    if (modal) modal.classList.add('hidden');
}

function handleAdminAuthLogin(event) {
    event.preventDefault();
    const email = normalizeEmailAddress(document.getElementById('admin-email-input')?.value);
    const password = document.getElementById('admin-password-input')?.value || '';
    const submitBtn = document.getElementById('btn-admin-auth-submit');

    if (!isValidEmailAddress(email) || !password) {
        alert("Vui lòng nhập đúng định dạng Email và Mật khẩu BTC.");
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            closeAdminModal();
            showToast("Đăng nhập BTC thành công!");
        })
        .catch((err) => {
            console.error("Firebase Auth signIn error:", err);
            alert("Đăng nhập thất bại: vui lòng kiểm tra lại Email và Mật khẩu BTC.");
        })
        .finally(() => {
            if (submitBtn) submitBtn.disabled = false;
        });
}

function handleAdminAuthLogout() {
    auth.signOut()
        .then(() => {
            closeAdminModal();
            showToast("Đã đăng xuất quyền BTC.");
        })
        .catch((err) => {
            console.error("Firebase Auth signOut error:", err);
        });
}

function deleteDelegateRecord(firebaseKey) {
    if (!requireAdminAuth('xóa đại biểu')) return;
    if (confirm("Bạn có chắc chắn muốn xóa đại biểu này không?")) {
        db.ref('delegates/' + firebaseKey).remove()
            .then(() => showToast("Đã xóa đại biểu thành công!"))
            .catch(err => {
                console.error(err);
                alert("Không thể xóa bản ghi. Vui lòng kiểm tra quyền BTC.");
            });
    }
}

function openEditModal(firebaseKey) {
    if (!requireAdminAuth('chỉnh sửa thông tin đại biểu')) return;
    const delegate = allDelegatesData.find(item => (item.firebaseKey === firebaseKey || item.id === firebaseKey));
    if (!delegate) return;

    document.getElementById('edit-firebase-key').value = firebaseKey;
    document.getElementById('edit-name').value = delegate.name || '';
    document.getElementById('edit-company').value = delegate.company || '';
    document.getElementById('edit-group').value = delegate.group || 'CBNV FAST Hà Nội (FHN)';
    document.getElementById('edit-role').value = delegate.role || '';
    document.getElementById('edit-phone').value = delegate.phone || '';
    document.getElementById('edit-email').value = delegate.email || '';
    document.getElementById('edit-travel').value = delegate.travel || '';
    document.getElementById('edit-activity').value = delegate.activity || '';

    setAvatarPreviewUI('edit', delegate.avatar || '');

    const currentSports = Array.isArray(delegate.sports) ? delegate.sports : [];
    document.querySelectorAll('input[name="edit-sports"]').forEach(cb => {
        cb.checked = currentSports.includes(cb.value);
    });

    const container = document.getElementById('edit-relatives-container');
    container.innerHTML = '';
    const rels = getRelativesArray(delegate);
    rels.forEach(r => addEditRelativeRow(r.name, r.relation, r.type));

    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => {
        modal.classList.add('opacity-100');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);
}

function addEditRelativeRow(name = '', relation = 'Vợ/Chồng', type = 'Người lớn') {
    const container = document.getElementById('edit-relatives-container');
    const rowId = 'edit-rel-' + Date.now() + Math.floor(Math.random() * 1000);
    container.insertAdjacentHTML('beforeend', `
        <div id="${rowId}" class="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div class="flex justify-between items-center">
                <span class="font-bold text-fast-dark">Người thân đi kèm</span>
                <button type="button" onclick="document.getElementById('${rowId}').remove()" class="text-red-500 font-bold">Xóa</button>
            </div>
            <input type="text" value="${escapeHTML(name)}" maxlength="80" placeholder="Họ và tên..." class="edit-rel-name w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white">
            <div class="grid grid-cols-2 gap-2">
                <select class="edit-rel-relation px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white">
                    <option value="Vợ/Chồng" ${relation === 'Vợ/Chồng' ? 'selected' : ''}>Vợ / Chồng</option>
                    <option value="Con cái" ${relation === 'Con cái' ? 'selected' : ''}>Con cái</option>
                    <option value="Bố/Mẹ" ${relation === 'Bố/Mẹ' ? 'selected' : ''}>Bố / Mẹ</option>
                </select>
                <select class="edit-rel-type px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white">
                    <option value="Người lớn" ${type === 'Người lớn' ? 'selected' : ''}>Người lớn</option>
                    <option value="Trẻ em (> 6 tuổi)" ${type === 'Trẻ em (> 6 tuổi)' ? 'selected' : ''}>Trẻ em (&gt; 6 tuổi)</option>
                    <option value="Trẻ em (< 6 tuổi)" ${type === 'Trẻ em (< 6 tuổi)' ? 'selected' : ''}>Trẻ em (&lt; 6 tuổi)</option>
                </select>
            </div>
        </div>
    `);
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    if (!modal || !content) return;
    modal.classList.remove('opacity-100');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 250);
}

async function handleEditSubmit(event) {
    event.preventDefault();
    if (!requireAdminAuth('lưu chỉnh sửa')) return;

    const firebaseKey = document.getElementById('edit-firebase-key').value;
    if (!firebaseKey) return;

    const selectedSports = Array.from(
        document.querySelectorAll('input[name="edit-sports"]:checked')
    ).map(cb => cb.value);

    const rawRelatives = [];
    document.querySelectorAll('#edit-relatives-container > div').forEach(row => {
        rawRelatives.push({
            name: row.querySelector('.edit-rel-name')?.value || '',
            relation: row.querySelector('.edit-rel-relation')?.value,
            type: row.querySelector('.edit-rel-type')?.value
        });
    });

    const validation = normalizeAndValidateDelegateInput({
        name: document.getElementById('edit-name').value,
        group: document.getElementById('edit-group').value,
        company: document.getElementById('edit-company').value,
        role: document.getElementById('edit-role').value,
        phone: document.getElementById('edit-phone').value,
        email: document.getElementById('edit-email').value,
        travel: document.getElementById('edit-travel').value,
        activity: document.getElementById('edit-activity').value,
        sports: selectedSports,
        relatives: rawRelatives
    });

    if (validation.error) {
        alert(validation.error);
        return;
    }

    const clean = validation.data;
    const submitBtn = document.getElementById('btn-edit-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang lưu...';
    }

    try {
        const resolvedAvatar = resolveAvatarForDatabase(pendingAvatarData['edit']);

        const updatedFields = {
            name: clean.name,
            company: clean.company,
            group: clean.group,
            branch: clean.branch,
            role: clean.role,
            phone: clean.phone,
            email: clean.email,
            travel: clean.travel,
            activity: clean.activity,
            avatar: resolvedAvatar,
            sports: clean.sports.length > 0 ? clean.sports : null,
            relatives: clean.relatives,
            updatedAt: firebase.database.ServerValue.TIMESTAMP,
            updatedBy: auth.currentUser?.email || ''
        };

        await db.ref('delegates/' + firebaseKey).update(updatedFields);
        closeEditModal();
        showToast("Cập nhật thông tin thành công!");
    } catch (err) {
        console.error(err);
        alert("Không thể cập nhật dữ liệu. Vui lòng kiểm tra quyền BTC.");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Lưu thay đổi';
        }
    }
}

function addRelativeRow() {
    const container = document.getElementById('relatives-container');
    if (!container) return;
    const rowId = 'rel-row-' + Date.now() + Math.floor(Math.random() * 1000);
    container.insertAdjacentHTML('beforeend', `
        <div id="${rowId}" class="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
            <div class="flex items-center justify-between">
                <span class="font-extrabold text-fast-dark">Người thân đi kèm</span>
                <button type="button" onclick="document.getElementById('${rowId}').remove()" class="text-red-500 font-bold">Xóa dòng</button>
            </div>
            <input type="text" maxlength="80" placeholder="Họ và tên người thân..." class="rel-name-input w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none">
            <div class="grid grid-cols-2 gap-2">
                <select class="rel-relation-input px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none">
                    <option value="Vợ/Chồng">Vợ / Chồng</option>
                    <option value="Con cái">Con cái</option>
                    <option value="Bố/Mẹ">Bố / Mẹ</option>
                </select>
                <select class="rel-type-input px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none">
                    <option value="Người lớn">Người lớn</option>
                    <option value="Trẻ em (> 6 tuổi)">Trẻ em (&gt; 6 tuổi)</option>
                    <option value="Trẻ em (< 6 tuổi)">Trẻ em (&lt; 6 tuổi)</option>
                </select>
            </div>
        </div>
    `);
}

// ==================== 11. CLIP CHÀO MỪNG CHẠY LẦN LƯỢT TỪNG CBNV ====================
let reelMusicEnabled = true;
let reelAudioCtx = null;
let reelSynthTimer = null;
let reelCustomAudio = null;
let reelCustomObjectUrl = '';

const DEFAULT_REEL_MUSIC_URL = './welcome-music.mp3';

const NCS_MUSIC_CREDIT_TEXT = [
    "Song: Jim Yosef - Firefly",
    "Music provided by NoCopyrightSounds",
    "Free Download/Stream: https://ncs.io/jyfirefly"
].join("\n");

function copyNcsMusicCredit() {
    copyTextFallback(NCS_MUSIC_CREDIT_TEXT);
    showToast("Đã sao chép ghi nguồn nhạc NCS!");
}

function ensureReelAudioElement(srcUrl) {
    if (!srcUrl) return null;
    if (!reelCustomAudio) {
        reelCustomAudio = new Audio();
        reelCustomAudio.loop = true;
        reelCustomAudio.volume = 0.65;
        reelCustomAudio.preload = 'auto';
    }
    if (reelCustomAudio.src !== new URL(srcUrl, window.location.href).href) {
        reelCustomAudio.src = srcUrl;
    }
    return reelCustomAudio;
}

function updateReelMusicUI() {
    const labelEl = document.getElementById('reel-music-label');
    if (labelEl) {
        labelEl.textContent = reelMusicEnabled ? 'Nhạc nền: Bật' : 'Nhạc nền: Tắt';
    }
}

async function playCelebrationChord() {
    if (!reelMusicEnabled || !reelPlaying) return;

    const sourceUrl = reelCustomObjectUrl || DEFAULT_REEL_MUSIC_URL;
    if (sourceUrl) {
        try {
            const audioEl = ensureReelAudioElement(sourceUrl);
            if (audioEl && audioEl.paused) {
                await audioEl.play();
            }
            return;
        } catch (_) {}
    }

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!reelAudioCtx) {
            reelAudioCtx = new AudioContextClass();
        }
        if (reelAudioCtx.state === 'suspended') {
            await reelAudioCtx.resume();
        }

        const chordProgression = [
            [523.25, 659.25, 783.99],
            [698.46, 880.00, 1046.50],
            [783.99, 987.77, 1174.66],
            [523.25, 783.99, 1046.50]
        ];
        const chord = chordProgression[Math.abs(reelIndex) % chordProgression.length];
        const now = reelAudioCtx.currentTime;

        chord.forEach((freq, idx) => {
            const osc = reelAudioCtx.createOscillator();
            const gain = reelAudioCtx.createGain();
            osc.type = idx === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.06);

            const peakGain = idx === 0 ? 0.06 : 0.035;
            gain.gain.setValueAtTime(0.0001, now + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(peakGain, now + idx * 0.06 + 0.14);
            gain.gain.exponentialRampToValueAtTime(0.0005, now + idx * 0.06 + 1.9);

            osc.connect(gain);
            gain.connect(reelAudioCtx.destination);
            osc.start(now + idx * 0.06);
            osc.stop(now + idx * 0.06 + 2.0);
        });
    } catch (_) {}
}

function startReelMusic() {
    stopReelMusic();
    if (!reelMusicEnabled || !reelPlaying) return;

    playCelebrationChord();

    if (!reelCustomObjectUrl && !DEFAULT_REEL_MUSIC_URL) {
        reelSynthTimer = setInterval(() => {
            if (reelMusicEnabled && reelPlaying) {
                playCelebrationChord();
            }
        }, 2100);
    }
}

function stopReelMusic() {
    if (reelSynthTimer) {
        clearInterval(reelSynthTimer);
        reelSynthTimer = null;
    }
    if (reelCustomAudio) {
        try {
            reelCustomAudio.pause();
        } catch (_) {}
    }
}

function toggleReelMusic() {
    reelMusicEnabled = !reelMusicEnabled;
    updateReelMusicUI();
    if (reelMusicEnabled) {
        startReelMusic();
        showToast("Đã bật nhạc nền clip chào mừng");
    } else {
        stopReelMusic();
        showToast("Đã tắt nhạc nền");
    }
}

function handleReelMusicUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    stopReelMusic();
    if (reelCustomObjectUrl) {
        URL.revokeObjectURL(reelCustomObjectUrl);
        reelCustomObjectUrl = '';
    }

    reelCustomObjectUrl = URL.createObjectURL(file);
    reelMusicEnabled = true;
    updateReelMusicUI();

    if (reelPlaying) {
        playCelebrationChord();
    }
    showToast(`Đã tải nhạc nền: ${file.name}`);
}

function syncReelFullscreenLabel() {
    const labelEl = document.getElementById('reel-fs-label');
    const isFs = Boolean(document.fullscreenElement);
    if (labelEl) {
        labelEl.textContent = isFs ? 'Thoát Full' : 'Full màn hình';
    }
}

function enterReelFullscreen() {
    const target = document.getElementById('welcome-reel-wrapper') || document.getElementById('welcome-reel-modal');
    if (target && target.requestFullscreen && !document.fullscreenElement) {
        target.requestFullscreen().catch(() => {}).finally(syncReelFullscreenLabel);
    }
}

function toggleReelFullscreen() {
    const target = document.getElementById('welcome-reel-wrapper') || document.getElementById('welcome-reel-modal');
    if (!document.fullscreenElement) {
        if (target && target.requestFullscreen) {
            target.requestFullscreen().catch(() => {}).finally(syncReelFullscreenLabel);
        }
    } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {}).finally(syncReelFullscreenLabel);
    }
}

document.addEventListener('fullscreenchange', syncReelFullscreenLabel);

function getReelEligibleDelegates() {
    return allDelegatesData.filter(d => {
        if (reelBranchFilter !== 'ALL' && getMemberBranch(d) !== reelBranchFilter) {
            return false;
        }
        return true;
    });
}

function setReelBranch(branch) {
    reelBranchFilter = branch;
    ['ALL', 'FHN', 'FDN', 'FSG'].forEach(b => {
        const btn = document.getElementById(`reel-branch-${b}`);
        if (!btn) return;
        btn.className = (b === branch)
            ? 'px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FDE047] text-fast-dark'
            : 'px-3 py-1.5 rounded-xl text-xs font-bold bg-white/15 text-white hover:bg-white/25';
    });
    reelList = getReelEligibleDelegates();
    reelIndex = 0;
    renderCurrentReelSlide(true);
}

function renderCurrentReelSlide(restartTimer = true) {
    reelList = getReelEligibleDelegates();
    const slideEl = document.getElementById('welcome-reel-slide');
    const counterEl = document.getElementById('welcome-reel-counter');
    if (!slideEl) return;

    if (reelList.length === 0) {
        if (counterEl) counterEl.textContent = '0 / 0';
        slideEl.innerHTML = `
            <div class="text-center py-12 space-y-2">
                <div class="text-2xl font-extrabold text-[#FDE047]">Chưa có CBNV nào trong danh sách chào mừng</div>
                <p class="text-sm text-white/80">Hãy đăng ký hoặc chọn chi nhánh khác để chạy clip chào mừng.</p>
            </div>
        `;
        stopReelTimers();
        return;
    }

    if (reelIndex >= reelList.length) reelIndex = 0;
    if (reelIndex < 0) reelIndex = reelList.length - 1;

    const person = reelList[reelIndex];
    const avatarSrc = getDelegateAvatarSrc(person);
    const branch = getMemberBranch(person);
    const sportsText = Array.isArray(person.sports) && person.sports.length ? person.sports.join(' · ') : '';

    if (counterEl) {
        counterEl.textContent = `${reelIndex + 1} / ${reelList.length}`;
    }

    slideEl.innerHTML = `
        <div class="flex flex-col md:flex-row items-center justify-center gap-8 sm:gap-12 transition-all duration-500">
            <div class="relative shrink-0 flex items-center justify-center">
				<div class="pointer-events-none absolute -inset-9 rounded-full blur-2xl opacity-90 animate-pulse"
					 style="background: radial-gradient(circle, rgba(253, 224, 71, 0.58) 0%, rgba(0, 181, 188, 0.30) 48%, rgba(255, 107, 53, 0.16) 70%, transparent 82%);"></div>
				<div class="pointer-events-none absolute -inset-3.5 rounded-[40px] border border-[#FDE047]/50 shadow-[0_0_40px_rgba(253,224,71,0.38)]"></div>
				<div class="relative z-10 w-72 h-72 sm:w-80 sm:h-80 lg:w-[22rem] lg:h-[22rem] rounded-[34px] p-2 bg-gradient-to-br from-[#FDE047] via-amber-300 to-[#FF6B35] shadow-[0_18px_48px_rgba(0,0,0,0.6)]">
					<img src="${avatarSrc}" alt="${escapeHTML(person.name || '')}" class="w-full h-full object-cover rounded-[26px] bg-white">
				</div>
				<span class="z-20 absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#00282A] border border-[#FDE047] text-[#FDE047] font-mono text-xs sm:text-sm font-extrabold shadow-lg whitespace-nowrap">
					${escapeHTML(person.code || 'FAST30-XXXX')}
				</span>
			</div>

            <div class="relative z-10 text-center md:text-left max-w-2xl space-y-3">
                <span class="inline-block px-4 py-1 rounded-full bg-white/15 border border-[#FDE047]/50 text-[#FDE047] text-xs font-extrabold uppercase tracking-wider">
                    CHÀO MỪNG FASTer · CHI NHÁNH ${escapeHTML(branch)}
                </span>
                <h2 class="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white leading-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)]">
                    ${escapeHTML(person.name || '')}
                </h2>
                <p class="text-sm sm:text-lg text-teal-100 font-medium">
                    ${escapeHTML(person.role || person.group || 'CBNV FAST')}
                </p>
                ${sportsText ? `<div class="inline-block px-4 py-1.5 rounded-xl bg-black/30 border border-white/15 text-xs sm:text-sm font-bold text-[#FDE047]">🏅 Tham gia: ${escapeHTML(sportsText)}</div>` : ''}                
            </div>
        </div>
    `;

    if (restartTimer && reelPlaying) {
        startReelCycle();
    }
}

function stopReelTimers() {
    if (reelIntervalId) {
        clearTimeout(reelIntervalId);
        reelIntervalId = null;
    }
    if (reelProgressRafId) {
        cancelAnimationFrame(reelProgressRafId);
        reelProgressRafId = null;
    }
}

function startReelCycle() {
    stopReelTimers();
    if (!reelPlaying || reelList.length === 0) return;

    reelSlideStartTime = performance.now();
    const progEl = document.getElementById('welcome-reel-progress');

    const stepProgress = (now) => {
        if (!reelPlaying) return;
        const elapsed = now - reelSlideStartTime;
        const pct = Math.min(100, (elapsed / reelDurationMs) * 100);
        if (progEl) progEl.style.width = `${pct}%`;
        if (elapsed < reelDurationMs) {
            reelProgressRafId = requestAnimationFrame(stepProgress);
        }
    };

    if (progEl) progEl.style.width = '0%';
    reelProgressRafId = requestAnimationFrame(stepProgress);

    reelIntervalId = setTimeout(() => {
        if (!reelPlaying) return;
        reelIndex = (reelIndex + 1) % reelList.length;
        renderCurrentReelSlide(true);
    }, reelDurationMs);
}

function toggleReelPlayPause() {
    reelPlaying = !reelPlaying;
    const btn = document.getElementById('btn-reel-toggle');
    if (btn) {
        btn.textContent = reelPlaying ? '⏸ Tạm dừng' : '▶ Tiếp tục chạy';
    }
    if (reelPlaying) {
        startReelCycle();
        startReelMusic();
    } else {
        stopReelTimers();
        stopReelMusic();
    }
}

function nextReelSlide() {
    if (reelList.length === 0) return;
    reelIndex = (reelIndex + 1) % reelList.length;
    renderCurrentReelSlide(true);
}

function prevReelSlide() {
    if (reelList.length === 0) return;
    reelIndex = (reelIndex - 1 + reelList.length) % reelList.length;
    renderCurrentReelSlide(true);
}

function changeReelSpeed(msVal) {
    reelDurationMs = Number(msVal) || 3500;
    if (reelPlaying) startReelCycle();
}

function openWelcomeReelModal() {
    reelBranchFilter = 'ALL';
    reelIndex = 0;
    reelPlaying = true;
    const toggleBtn = document.getElementById('btn-reel-toggle');
    if (toggleBtn) toggleBtn.textContent = '⏸ Tạm dừng';

    document.getElementById('welcome-reel-modal')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setReelBranch('ALL');
    updateReelMusicUI();
    startReelMusic();
    enterReelFullscreen();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeWelcomeReelModal() {
    reelPlaying = false;
    stopReelTimers();
    stopReelMusic();
    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
    document.getElementById('welcome-reel-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
    syncReelFullscreenLabel();
}

// ==================== 12. COUNTDOWN, LỊCH TRÌNH, ẤN PHẨM & LIGHTBOX ====================
const eventTargetDate = new Date('2027-07-10T08:00:00+07:00');
function updateCountdown() {
    const distance = eventTargetDate.getTime() - Date.now();
    if (distance <= 0) return;
    document.getElementById('cd-days').textContent = String(Math.floor(distance / (1000 * 60 * 60 * 24))).padStart(2, '0');
    document.getElementById('cd-hours').textContent = String(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0');
    document.getElementById('cd-minutes').textContent = String(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    document.getElementById('cd-seconds').textContent = String(Math.floor((distance % (1000 * 60)) / 1000)).padStart(2, '0');
}
updateCountdown();
setInterval(updateCountdown, 1000);

function selectDetailedDay(dayNum) {
    currentDetailedDay = dayNum;
    document.querySelectorAll('.dp-day-tab').forEach(tab => {
        tab.classList.remove('bg-[#00979C]', 'text-white', 'shadow-sm');
        tab.classList.add('bg-transparent', 'hover:bg-[#FAF9F6]', 'text-[#2D3748]');
        const titleSpan = tab.querySelector('span:first-child');
        const subSpan = tab.querySelector('span:last-child');
        if (titleSpan) { titleSpan.classList.remove('text-white'); titleSpan.classList.add('text-[#2D3748]'); }
        if (subSpan) { subSpan.classList.remove('text-white/90'); subSpan.classList.add('text-[#64748B]'); }
    });

    const activeTab = document.getElementById(`dp-tab-${dayNum}`);
    if (activeTab) {
        activeTab.classList.remove('bg-transparent', 'hover:bg-[#FAF9F6]', 'text-[#2D3748]');
        activeTab.classList.add('bg-[#00979C]', 'text-white', 'shadow-sm');
        const titleSpan = activeTab.querySelector('span:first-child');
        const subSpan = activeTab.querySelector('span:last-child');
        if (titleSpan) { titleSpan.classList.remove('text-[#2D3748]'); titleSpan.classList.add('text-white'); }
        if (subSpan) { subSpan.classList.remove('text-[#64748B]'); subSpan.classList.add('text-white/90'); }
    }

    document.querySelectorAll('.dp-day-section').forEach(sec => sec.classList.add('hidden'));
    const activeSec = document.getElementById(`dp-day-panel-${dayNum}`);
    if (activeSec) activeSec.classList.remove('hidden');
}

function downloadICS() {
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//FAST Software//FAST 30 Nam//VI',
        'BEGIN:VEVENT',
        'UID:fast30-flc-quangbinh-4n3d-2027@fast.com.vn',
        'DTSTAMP:20261126T080000Z',
        'DTSTART:20270710T010000Z',
        'DTEND:20270713T100000Z',
        'SUMMARY:FAST 30 Năm (1997–2027) — FLC Quang Binh Beach & Golf Resort (4N3Đ)',
        'LOCATION:FLC Quang Binh Beach & Golf Resort, Hải Ninh, Quảng Ninh, Quảng Bình',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'FAST-30-Nam-FLC-Quang-Binh-4N3D-2027.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Đã tải lịch sự kiện về thiết bị!');
}

const mockupDetails = {
    polo: { title: 'Áo Polo Đồng Phục FAST 30 Năm', desc: 'Áo polo xanh Teal thêu logo FAST 30 nền trắng viền vàng tại ngực trái.', specs: ['<strong>Chất liệu:</strong> Cá sấu thoáng mát', '<strong>Kích cỡ:</strong> S – 3XL'] },
    badge: { title: 'Thẻ Đại Biểu & Dây Đeo QR', desc: 'Thẻ định danh cá nhân tích hợp mã QR hỗ trợ check-in và kết nối.', specs: ['<strong>Kích thước:</strong> 9cm x 12cm'] },
    stage: { title: 'Backdrop Sân Khấu Chính Gala Dinner', desc: 'Màn hình LED trung tâm tại đêm Gala kỷ niệm 30 năm.', specs: ['<strong>Thời gian:</strong> 18:00 ngày 12/07/2027'] },
    flag: { title: 'Banner & Cờ Phướn Đón Khách', desc: 'Hệ thống cờ phướn và standee chào đón các đoàn 3 miền.', specs: ['<strong>Kích thước cờ:</strong> 0.8m x 2.2m'] }
};

function openMockupModal(key) {
    const info = mockupDetails[key];
    if (!info) return;
    document.getElementById('mockup-modal-title').textContent = info.title;
    document.getElementById('mockup-modal-desc').textContent = info.desc;
    document.getElementById('mockup-modal-specs').innerHTML = info.specs.map(s => `<p>• ${s}</p>`).join('');
    document.getElementById('mockup-modal').classList.remove('hidden');
}

function closeMockupModal() {
    document.getElementById('mockup-modal').classList.add('hidden');
}

const resortGallery = [
    { src: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=85', title: 'Hồ bơi ngoài trời & Vườn nhiệt đới', desc: 'Không gian nghỉ dưỡng và thư giãn tại FLC Quảng Bình.' },
    { src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85', title: 'Bãi biển cát trắng mịn', desc: 'Địa điểm Team Building & giao lưu.' },
    { src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=85', title: 'Hệ thống Villa & Phòng nghỉ', desc: 'Lưu trú tiện nghi cho toàn thể CBNV.' },
    { src: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=85', title: 'Trung tâm Hội nghị & Gala Dinner', desc: 'Sảnh tổ chức sự kiện chính.' }
];

let currentLightboxIndex = 0;
let isLightboxZoomed = false;

function resetLightboxZoom() {
    isLightboxZoomed = false;
    const img = document.getElementById('lightbox-img');
    const label = document.getElementById('lightbox-zoom-label');
    if (img) img.style.transform = 'scale(1)';
    if (label) label.textContent = 'Phóng to 1.8x';
}

function toggleLightboxZoom() {
    const img = document.getElementById('lightbox-img');
    const label = document.getElementById('lightbox-zoom-label');
    if (!img) return;
    isLightboxZoomed = !isLightboxZoomed;
    img.style.transform = isLightboxZoomed ? 'scale(1.8)' : 'scale(1)';
    if (label) label.textContent = isLightboxZoomed ? 'Thu nhỏ 1.0x' : 'Phóng to 1.8x';
}

function renderLightboxSlide() {
    const item = resortGallery[currentLightboxIndex];
    if (!item) return;
    resetLightboxZoom();
    document.getElementById('lightbox-img').src = item.src;
    document.getElementById('lightbox-title').textContent = item.title;
    document.getElementById('lightbox-desc').textContent = item.desc;
    document.getElementById('lightbox-counter').textContent = `${currentLightboxIndex + 1} / ${resortGallery.length}`;
}

function openResortLightbox(index) {
    currentLightboxIndex = index || 0;
    renderLightboxSlide();
    document.getElementById('resort-lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function changeLightboxSlide(step) {
    currentLightboxIndex = (currentLightboxIndex + step + resortGallery.length) % resortGallery.length;
    renderLightboxSlide();
}

function closeResortLightbox() {
    resetLightboxZoom();
    document.getElementById('resort-lightbox').classList.add('hidden');
    document.body.style.overflow = '';
}

// ==================== 13. BAN CHỈ ĐẠO F30N ====================
function formatPhone(rawPhone) {
    const clean = String(rawPhone || '').replace(/\D/g, '');
    const formatted = clean.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    return { raw: clean, formatted };
}

const bcdData = {
    leader: { badge: "TRƯỞNG BAN CHỈ ĐẠO F30N", name: "Anh Phan Quốc Khánh", desc: "Trưởng ban · Chỉ đạo chung toàn bộ chuỗi hoạt động Kỷ niệm 30 năm FAST", phone: formatPhone("0903406696") },
    deputies: [
        { role: "PHÓ BAN", name: "Anh Phạm Ngọc Hùng", sub: "Phó Ban Chỉ Đạo F30N", phone: formatPhone("0913057969") },
        { role: "PHÓ BAN", name: "Anh Lê Khắc Bình", sub: "Phó Ban Chỉ Đạo F30N", phone: formatPhone("0903432001") },
        { role: "PHÓ BAN", name: "Chị Ninh Thị Tố Uyên", sub: "Phó Ban Chỉ Đạo F30N", phone: formatPhone("0989006042") }
    ],
    members: [
        { name: "Chị Nguyễn Thị Mỹ Hồng", tag: "Mảng Marketing, PR", tagColor: "bg-[#00979C] text-white", badgeColor: "bg-[#E0F2F1] text-[#00686B]", desc: "Phụ trách truyền thông, nhận diện thương hiệu và quan hệ báo chí F30N.", shortTag: "Mktg, PR", phone: formatPhone("0332714417") },
        { name: "Anh Nguyễn Duy Hiển", tag: "Mảng Marketing, PR", tagColor: "bg-[#00979C] text-white", badgeColor: "bg-[#E0F2F1] text-[#00686B]", desc: "Phụ trách truyền thông số và ấn phẩm sự kiện F30N.", shortTag: "Mktg, PR", phone: formatPhone("0972973999") },
        { name: "Chị Nguyễn Thị Minh Nguyệt", tag: "Kỷ yếu, PR nội bộ", tagColor: "bg-[#9A6B16] text-white", badgeColor: "bg-[#FEF3C7] text-[#92400E]", desc: "Phụ trách biên tập Kỷ yếu 30 năm FAST và truyền thông nội bộ 3 miền.", shortTag: "Kỷ yếu, PR nội bộ", phone: formatPhone("0912000114") },
        { name: "Anh Nguyễn Thành Đồng", tag: "Kỷ yếu, Nghỉ mát, Văn thể", tagColor: "bg-[#FF6B35] text-white", badgeColor: "bg-[#FFEDD5] text-[#C2410C]", desc: "Phụ trách nội dung kỷ yếu, điều phối hậu cần nghỉ mát và các giải văn thể.", shortTag: "Kỷ yếu, Nghỉ mát, Văn thể", phone: formatPhone("0903400131") },
        { name: "Anh Hoàng Minh Quang", tag: "Kỷ yếu, Nghỉ mát, Văn thể", tagColor: "bg-[#FF6B35] text-white", badgeColor: "bg-[#FFEDD5] text-[#C2410C]", desc: "Phụ trách tư liệu kỷ yếu, hành trình nghỉ mát 3 miền và hội thao – văn nghệ.", shortTag: "Kỷ yếu, Nghỉ mát, Văn thể", phone: formatPhone("0903664886") },
        { name: "Anh Bùi Quang Thành", tag: "Kỷ yếu, Nghỉ mát, Văn thể", tagColor: "bg-[#FF6B35] text-white", badgeColor: "bg-[#FFEDD5] text-[#C2410C]", desc: "Phụ trách nội dung kỷ yếu, tổ chức nghỉ mát và phong trào văn thể.", shortTag: "Kỷ yếu, Nghỉ mát, Văn thể", phone: formatPhone("0913391403") }
    ]
};

function renderBCD() {
    const leaderEl = document.getElementById("bcd-leader-card");
    if (leaderEl) {
        const l = bcdData.leader;
        leaderEl.innerHTML = `
            <div class="bg-gradient-to-br from-[#00686B] via-[#00898E] to-[#00979C] text-white rounded-2xl p-6 shadow-md border border-[#E5C158]/50 space-y-4">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-[#E5C158]/60 text-[#FDE047] text-[11px] font-bold tracking-wider uppercase">${l.badge}</span>
                <div>
                    <h3 class="text-2xl md:text-3xl font-extrabold tracking-tight">${l.name}</h3>
                    <p class="text-teal-50 text-sm mt-1.5 leading-relaxed">${l.desc}</p>
                </div>
                <div class="pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2">
                    <a href="tel:${l.phone.raw}" class="text-sm font-bold text-[#FDE047] hover:underline">${l.phone.formatted}</a>
                    <a href="https://zalo.me/${l.phone.raw}" target="_blank" rel="noopener noreferrer" class="px-3.5 py-1.5 rounded-full bg-[#0068FF] text-white text-xs font-bold">Zalo</a>
                </div>
            </div>
        `;
    }

    const depEl = document.getElementById("bcd-deputies-grid");
    if (depEl) {
        depEl.innerHTML = bcdData.deputies.map(d => `
            <div class="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-xs flex flex-col justify-between space-y-3">
                <div>
                    <span class="inline-block px-2.5 py-0.5 rounded-full bg-[#E0F2F1] text-[#00686B] text-[10px] font-extrabold uppercase">${d.role}</span>
                    <h4 class="font-extrabold text-[#1E293B] text-base mt-1">${d.name}</h4>
                    <p class="text-xs text-[#64748B]">${d.sub}</p>
                </div>
                <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <a href="tel:${d.phone.raw}" class="text-xs font-bold text-[#00686B]">${d.phone.formatted}</a>
                    <a href="https://zalo.me/${d.phone.raw}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 rounded-full bg-[#0068FF] text-white text-[11px] font-bold">Zalo</a>
                </div>
            </div>
        `).join("");
    }

    const memEl = document.getElementById("bcd-members-grid");
    if (memEl) {
        memEl.innerHTML = bcdData.members.map(m => `
            <div class="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xs flex flex-col justify-between space-y-4">
                <div class="space-y-3">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${m.badgeColor}">THÀNH VIÊN BCĐ</span>
                        <span class="px-3 py-1 rounded-full text-[11px] font-bold ${m.tagColor}">${m.tag}</span>
                    </div>
                    <h4 class="text-lg font-extrabold text-[#00686B]">${m.name}</h4>
                    <p class="text-sm text-[#475569] leading-relaxed">${m.desc}</p>
                </div>
                <div class="pt-3.5 border-t border-slate-100 flex items-center justify-between bg-[#F8FAFC] px-3 py-2 rounded-xl">
                    <span class="text-xs font-extrabold text-[#00686B]">${m.phone.formatted}</span>
                    <a href="https://zalo.me/${m.phone.raw}" target="_blank" rel="noopener noreferrer" class="px-3.5 py-1 rounded-full bg-[#0068FF] text-white text-xs font-bold">Zalo</a>
                </div>
            </div>
        `).join("");
    }
}

// ==================== 14. LUCKY DRAW (HIỂN THỊ THẺ CBNV + XÓA RIÊNG TỪNG KẾT QUẢ + AUTH) ====================
function setDrawGroup(groupKey, btnEl) {
    currentDrawGroup = 'all';
    document.querySelectorAll('.draw-filter-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-[#00686B]', 'shadow-sm');
        btn.classList.add('bg-white/15', 'text-white');
    });
    if (btnEl) {
        btnEl.classList.remove('bg-white/15', 'text-white');
        btnEl.classList.add('bg-white', 'text-[#00686B]', 'shadow-sm');
    }
}

function selectPrizeCard(prizeName) {
    if (isDrawing) return;
    currentPrize = prizeName;
    document.querySelectorAll('.prize-card').forEach(card => {
        card.classList.remove('ring-4', 'ring-[#FDE047]', 'scale-105', 'shadow-2xl', 'border-white');
        card.classList.add('border-white/15');
    });
    const activeCard = document.getElementById(`prize-card-${prizeName}`);
    if (activeCard) {
        activeCard.classList.remove('border-white/15');
        activeCard.classList.add('ring-4', 'ring-[#FDE047]', 'scale-105', 'shadow-2xl', 'border-white');
    }
}

function renderLuckyDrawCardInSlot(person, prizeName, slotText, isWinner = false) {
    const slot = document.getElementById('draw-winner-card-slot');
    if (!slot) return;
    slot.innerHTML = buildLuckyDrawCardHtml(person, prizeName, slotText, isWinner);
}

function startLuckyDraw() {
    if (isDrawing) return;
    if (!requireAdminAuth('quay số Lucky Draw')) return;

    const currentDrawn = prizeCounts[currentPrize] || 0;
    const maxAllowed = prizeConfig[currentPrize].max;

    if (currentDrawn >= maxAllowed) {
        alert(`${currentPrize} đã quay đủ số lượng (${maxAllowed}/${maxAllowed} suất)!`);
        return;
    }

    const eligibleList = allDelegatesData.filter(item => {
        if (winningHistory.some(w => w.code === item.code)) return false;
        const branch = getMemberBranch(item);
        if (currentDrawGroup === 'all') return true;
        if (currentDrawGroup === 'fhn') return branch === 'FHN';
        if (currentDrawGroup === 'fdn') return branch === 'FDN';
        if (currentDrawGroup === 'fsg') return branch === 'FSG';
        if (currentDrawGroup === 'khach') return (item.group || '').toLowerCase().includes('khách') || (item.group || '').toLowerCase().includes('đối tác');
        return true;
    });

    if (eligibleList.length === 0) {
        alert("Không còn đại biểu hợp lệ chưa trúng giải trong nhóm này!");
        return;
    }

    isDrawing = true;
    const btnStart = document.getElementById('btn-start-draw');
    if (btnStart) btnStart.disabled = true;

    let counter = 0;
    const nextSlotNumber = currentDrawn + 1;

    const interval = setInterval(() => {
        const rand = eligibleList[Math.floor(Math.random() * eligibleList.length)];
        renderLuckyDrawCardInSlot(
            rand,
            currentPrize,
            `Suất ${nextSlotNumber}/${maxAllowed}`,
            false
        );
        counter++;
        if (counter > 25) {
            clearInterval(interval);
            const winner = eligibleList[Math.floor(Math.random() * eligibleList.length)];
            const slotNum = currentDrawn + 1;

            const wonRecord = {
                code: winner.code || '',
                name: winner.name || '',
                group: winner.group || '',
                company: winner.company || '',
                role: winner.role || '',
                branch: getMemberBranch(winner),
                avatar: winner.avatar || null,
                prizeWon: currentPrize,
                slotNumber: slotNum,
                quota: maxAllowed,
                drawnBy: auth.currentUser?.email || '',
                drawnAt: firebase.database.ServerValue.TIMESTAMP
            };

            db.ref('luckyDrawWinners').push(wonRecord)
                .then(() => {
                    renderLuckyDrawCardInSlot(
                        winner,
                        currentPrize,
                        `Suất ${slotNum}/${maxAllowed}`,
                        true
                    );
                    showToast(`Chúc mừng ${winner.name} trúng ${currentPrize}!`);
                })
                .catch((err) => {
                    console.error("Lỗi lưu kết quả Lucky Draw:", err);
                    prizeCounts[currentPrize] = slotNum;
                    winningHistory.unshift({ ...winner, prizeWon: currentPrize, slotNumber: slotNum, quota: maxAllowed });
                    renderLuckyDrawCardInSlot(winner, currentPrize, `Suất ${slotNum}/${maxAllowed}`, true);
                    updatePrizeCardsUI();
                    updateWinnerHistoryUI();
                })
                .finally(() => {
                    isDrawing = false;
                    if (btnStart) btnStart.disabled = false;
                });
        }
    }, 85);
}

async function deleteLuckyDrawWinner(identifier) {
    if (isDrawing) return;
    if (!requireAdminAuth('xóa kết quả quay thưởng')) return;

    const target = winningHistory.find(
        w => (w.firebaseKey && w.firebaseKey === identifier) ||
             (w.id && w.id === identifier) ||
             (w.code && w.code === identifier)
    );
    if (!target) {
        showToast("Không tìm thấy kết quả trúng giải cần xóa.");
        return;
    }

    const ok = confirm(
        `Xóa riêng kết quả trúng ${target.prizeWon || 'giải thưởng'} của "${target.name || target.code}"? (Danh sách đại biểu vẫn được giữ nguyên)`
    );
    if (!ok) return;

    try {
        if (target.firebaseKey) {
            await db.ref('luckyDrawWinners/' + target.firebaseKey).remove();
        } else {
            winningHistory = winningHistory.filter(w => w !== target);
            const counts = {
                'Giải Bảy': 0, 'Giải Sáu': 0, 'Giải Năm': 0,
                'Giải Tư': 0, 'Giải Ba': 0, 'Giải Nhì': 0, 'Giải Nhất': 0
            };
            winningHistory.forEach(w => {
                if (w.prizeWon && Object.prototype.hasOwnProperty.call(counts, w.prizeWon)) {
                    counts[w.prizeWon]++;
                }
            });
            prizeCounts = counts;
            updatePrizeCardsUI();
            updateWinnerHistoryUI();
        }
        showToast(`Đã xóa kết quả của ${target.name || target.code} (${target.prizeWon || ''}).`);
    } catch (err) {
        console.error("Lỗi xóa kết quả quay thưởng:", err);
        alert("Không thể xóa kết quả này. Vui lòng kiểm tra quyền BTC và Firebase Rules.");
    }
}

function updatePrizeCardsUI() {
    let total = 0;
    Object.keys(prizeConfig).forEach(prize => {
        const count = prizeCounts[prize] || 0;
        total += count;
        const card = document.getElementById(`prize-card-${prize}`);
        if (card) {
            const span = card.querySelector('.drawn-count');
            if (span) span.textContent = count;
        }
    });
    const totalEl = document.getElementById('total-drawn-counter');
    if (totalEl) totalEl.textContent = `Đã trao: ${total} / 28 giải`;
}

function updateWinnerHistoryUI() {
    let total = 0;
    Object.keys(prizeConfig).forEach(prizeName => {
        const winners = winningHistory.filter(w => w.prizeWon === prizeName);
        total += winners.length;
        const card = document.getElementById(`history-card-${prizeName}`);
        if (!card) return;
        const badge = card.querySelector('.slot-badge');
        const listEl = card.querySelector('.winners-list-container');
        if (badge) badge.textContent = `${winners.length}/${prizeConfig[prizeName].max} suất`;
        if (listEl) {
            listEl.innerHTML = winners.length === 0
                ? `<div class="text-xs text-teal-100/70 italic text-center py-4">Chưa có người trúng</div>`
                : winners.map(w => {
                    const keyOrCode = escapeHTML(w.firebaseKey || w.id || w.code || '');
                    const removeBtn = isAdminLoggedIn
                        ? `<button type="button" onclick="event.stopPropagation(); deleteLuckyDrawWinner('${keyOrCode}')" title="Xóa riêng kết quả này" class="px-2 py-1 rounded-lg bg-white/10 hover:bg-rose-600 text-white/80 hover:text-white text-xs font-bold shrink-0 transition">✕</button>`
                        : '';
                    return `
                        <div onclick="openDelegateCardModal('${escapeHTML(w.code || w.id || '')}')" class="cursor-pointer p-2.5 rounded-2xl bg-[#00282A]/75 hover:bg-[#00282A] border border-[#FDE047]/35 flex items-center justify-between gap-2 text-xs transition">
                            <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                <img src="${getDelegateAvatarSrc(w)}" alt="${escapeHTML(w.name)}" class="w-9 h-9 rounded-xl object-cover border border-[#FDE047]/60 bg-white shrink-0">
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold text-white truncate">${escapeHTML(w.name)}</div>
                                    <div class="font-mono text-[11px] text-[#FDE047] truncate">${escapeHTML(w.code || '—')} · ${escapeHTML(getMemberBranch(w))}</div>
                                </div>
                            </div>
                            ${removeBtn}
                        </div>
                    `;
                }).join('');
        }
    });
    const overall = document.getElementById('overall-winner-count');
    if (overall) overall.textContent = `Tổng đã trao: ${total} / 28 giải`;
}

function resetLuckyDraw() {
    if (isDrawing) return;
    if (!requireAdminAuth('làm mới khung quay')) return;

    const slot = document.getElementById('draw-winner-card-slot');
    if (slot) {
        slot.innerHTML = `
            <div class="rounded-[32px] bg-[#00282A]/75 border border-[#FDE047]/35 p-8 sm:p-10 text-center space-y-2.5 shadow-inner">
                <div id="draw-display-code" class="font-mono text-4xl sm:text-6xl font-black text-[#FDE047] tracking-widest">
                    FAST30-XXXX
                </div>
                <h3 id="draw-winner-name" class="text-xl sm:text-2xl font-bold text-white">Sẵn sàng quay số</h3>
                <p id="draw-winner-company" class="text-xs sm:text-sm text-teal-100/85">Chọn hạng giải phía trên rồi bấm "Bắt đầu quay số"</p>
            </div>
        `;
    }
}

// ==================== 15. TIỆN ÍCH CHUNG, XUẤT CSV & DỮ LIỆU MẪU ====================
let toastTimeout;
function showToast(msg) {
    const box = document.getElementById('toast-box');
    const textEl = document.getElementById('toast-message');
    if (!box || !textEl) return;
    textEl.textContent = msg;
    box.classList.remove('translate-y-20', 'opacity-0');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        box.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

function copyTextFallback(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
        return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
}

function escapeHTML(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener("DOMContentLoaded", () => {
    renderBCD();
    selectPrizeCard('Giải Bảy');
    if (typeof lucide !== 'undefined') lucide.createIcons();
});

function normalizeSearchText(str) {
    return String(str || '')
        .normalize('NFC')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchesSearch(targetText, rawQuery) {
    const qRaw = String(rawQuery || '').normalize('NFC').toLowerCase().trim();
    if (!qRaw) return true;

    const tRaw = String(targetText || '').normalize('NFC').toLowerCase();
    if (tRaw.includes(qRaw)) return true;

    const qNorm = normalizeSearchText(qRaw);
    const tNorm = normalizeSearchText(tRaw);
    return qNorm ? tNorm.includes(qNorm) : true;
}

function escapeCsvCell(val) {
    const str = String(val ?? '').replace(/\r?\n/g, ' ').trim();
    if (/[",\n;]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function downloadCsvFile(filename, headers, rows) {
    const lines = [
        headers.map(escapeCsvCell).join(','),
        ...rows.map(r => r.map(escapeCsvCell).join(','))
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
        type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function getFilteredDelegatesList() {
    const khachList = allDelegatesData.filter(item =>
        item.group && (item.group.toLowerCase().includes('khách') || item.group.toLowerCase().includes('đối tác'))
    );
    const fhnList = allDelegatesData.filter(item => getMemberBranch(item) === 'FHN');
    const fdnList = allDelegatesData.filter(item => getMemberBranch(item) === 'FDN');
    const fsgList = allDelegatesData.filter(item => getMemberBranch(item) === 'FSG');

    let list = allDelegatesData;
    if (currentFilter === 'khach') list = khachList;
    if (currentFilter === 'fhn') list = fhnList;
    if (currentFilter === 'fdn') list = fdnList;
    if (currentFilter === 'fsg') list = fsgList;

    if (currentSearchQuery) {
        list = list.filter(item => {
            const relNames = getRelativesArray(item).map(r => r.name || '').join(' ');
            const searchable = [
                item.name,
                item.code,
                item.phone,
                item.company,
                item.group,
                item.role,
                relNames
            ].join(' ');
            return matchesSearch(searchable, currentSearchQuery);
        });
    }
    return list;
}

function exportDelegatesCSV() {
    if (!requireAdminAuth('kết xuất danh sách')) return;
    const list = getFilteredDelegatesList();
    if (!list.length) {
        showToast("Không có dữ liệu đại biểu để kết xuất.");
        return;
    }

    const headers = [
        "Mã",
        "Họ và tên",
        "Chi nhánh",
        "Đơn vị / Nhóm",
        "Chức vụ",
        "Số điện thoại",
        "Email",
        "Di chuyển",
        "Hoạt động tham gia",
        "Môn thể thao",
        "Số người thân đi kèm",
        "Danh sách người thân"
    ];

    const rows = list.map(item => {
        const rels = getRelativesArray(item);
        const relText = rels
            .map(r => `${r.name || ''} (${[r.relation, r.type].filter(Boolean).join(' - ')})`)
            .join('; ');
        return [
            item.code || '',
            item.name || '',
            getMemberBranch(item),
            item.group || item.company || '',
            item.role || '',
            item.phone || '',
            item.email || '',
            item.travel || '',
            item.activity || '',
            Array.isArray(item.sports) ? item.sports.join(', ') : '',
            rels.length,
            relText
        ];
    });

    const dateTag = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`FAST30-Danh-Sach-${currentFilter}-${dateTag}.csv`, headers, rows);
    showToast(`Đã kết xuất ${list.length} đại biểu ra file CSV!`);
}

function getFilteredSportList() {
    let list = allDelegatesData.filter(d => Array.isArray(d.sports) && d.sports.includes(currentSportTab));
    if (currentSportBranch !== 'ALL') {
        list = list.filter(d => getMemberBranch(d) === currentSportBranch);
    }
    if (currentSportSearch) {
        list = list.filter(d => {
            const searchable = [
                d.name,
                d.code,
                getMemberBranch(d),
                d.group,
                d.role,
                d.company
            ].join(' ');
            return matchesSearch(searchable, currentSportSearch);
        });
    }
    return list;
}

function exportCurrentSportCSV() {
    if (!requireAdminAuth('kết xuất danh sách thể thao')) return;
    const list = getFilteredSportList();
    if (!list.length) {
        showToast(`Không có FASTer nào ở môn ${currentSportTab} để kết xuất.`);
        return;
    }

    const headers = [
        "Môn thi đấu",
        "Mã",
        "Họ và tên",
        "Chi nhánh",
        "Đơn vị / Nhóm",
        "Chức vụ",
        "Số điện thoại",
        "Tất cả môn đã đăng ký"
    ];

    const rows = list.map(item => [
        currentSportTab,
        item.code || '',
        item.name || '',
        getMemberBranch(item),
        item.group || item.company || '',
        item.role || '',
        item.phone || '',
        Array.isArray(item.sports) ? item.sports.join(', ') : ''
    ]);

    const slugSport = normalizeSearchText(currentSportTab).replace(/\s+/g, '-');
    const dateTag = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`FAST30-The-Thao-${slugSport}-${currentSportBranch}-${dateTag}.csv`, headers, rows);
    showToast(`Đã kết xuất ${list.length} VĐV môn ${currentSportTab}!`);
}

async function generateMockDelegates(totalCount = 215) {
    if (!requireAdminAuth(`tạo ${totalCount} CBNV mẫu`)) return;

    const ok = confirm(
        `Bạn có chắc muốn tạo tự động ${totalCount} CBNV mẫu cho 3 miền (FHN, FDN, FSG) lên Firebase không?`
    );
    if (!ok) return;

    const btn = document.getElementById('btn-gen-mock-delegates');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang tạo ${totalCount} CBNV...</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    try {
        const lastNames = [
            'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ',
            'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Trịnh', 'Đào'
        ];
        const middleNames = [
            'Văn', 'Thị', 'Minh', 'Hoàng', 'Thanh', 'Quốc', 'Anh', 'Đức', 'Ngọc',
            'Thu', 'Hữu', 'Gia', 'Bảo', 'Phương', 'Khánh', 'Tuấn', 'Hải', 'Kim'
        ];
        const firstNames = [
            'An', 'Bình', 'Châu', 'Cường', 'Dũng', 'Duy', 'Giang', 'Hà', 'Hải',
            'Hằng', 'Hiếu', 'Hoa', 'Hùng', 'Huy', 'Hương', 'Khang', 'Khánh', 'Khoa',
            'Lan', 'Linh', 'Long', 'Mai', 'Minh', 'My', 'Nam', 'Nga', 'Ngân', 'Nghĩa',
            'Nguyên', 'Nhung', 'Phong', 'Phúc', 'Phương', 'Quân', 'Quang', 'Quỳnh',
            'Sơn', 'Tâm', 'Tân', 'Thảo', 'Thắng', 'Thành', 'Thịnh', 'Thu', 'Thủy',
            'Trang', 'Trung', 'Tú', 'Tuấn', 'Tùng', 'Uyên', 'Vân', 'Việt', 'Vinh', 'Yến'
        ];

        const branches = [
            { code: 'FHN', group: 'CBNV FAST Hà Nội (FHN)', weight: 0.45 },
            { code: 'FSG', group: 'CBNV FAST TP.HCM (FSG)', weight: 0.35 },
            { code: 'FDN', group: 'CBNV FAST Đà Nẵng (FDN)', weight: 0.20 }
        ];

        const roles = [
            'Tư vấn ứng dụng', 'Lập trình viên', 'Kiểm thử phần mềm (QC)',
            'Phân tích nghiệp vụ (BA)', 'Chăm sóc khách hàng', 'Kinh doanh giải pháp',
            'Triển khai ERP', 'Hành chính – Nhân sự', 'Kế toán nội bộ', 'Marketing & Truyền thông'
        ];

        const travels = [
            'Đi cùng đoàn FAST',
            'Bay đến Đồng Hới (VDH)',
            'Tự túc phương tiện'
        ];

        const activities = [
            'Tham dự trọn gói',
            'Gala Dinner & Hội thao 30 Năm',
            'Gala Dinner & Team Building Bãi Biển'
        ];

        const sportsPool = ['Pickleball', 'Bóng đá', 'Cầu lông', 'Bơi lội', 'Chạy bộ'];
        const relations = ['Vợ/Chồng', 'Con cái', 'Bố/Mẹ'];
        const relTypes = ['Người lớn', 'Trẻ em (> 6 tuổi)', 'Trẻ em (< 6 tuổi)'];

        const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const pickBranch = () => {
            const r = Math.random();
            if (r < branches[0].weight) return branches[0];
            if (r < branches[0].weight + branches[1].weight) return branches[1];
            return branches[2];
        };

        const usedCodes = new Set(
            allDelegatesData.map(d => String(d.code || '').toUpperCase())
        );

        const generateUniqueCode = () => {
            let code = '';
            let guard = 0;
            do {
                code = `FAST30-${Math.floor(1000 + Math.random() * 9000)}`;
                guard++;
            } while (usedCodes.has(code) && guard < 20000);
            usedCodes.add(code);
            return code;
        };

        const updates = {};
        const baseTime = Date.now();

        for (let i = 0; i < totalCount; i++) {
            const branchObj = pickBranch();
            const fullName = normalizePersonName(`${pickRandom(lastNames)} ${pickRandom(middleNames)} ${pickRandom(firstNames)}`);
            const code = generateUniqueCode();
            const phone = `09${Math.floor(10000000 + Math.random() * 89999999)}`;
            const slugEmail = normalizeSearchText(fullName).replace(/\s+/g, '.') + `.${i + 1}@fast.com.vn`;

            const shuffledSports = [...sportsPool].sort(() => Math.random() - 0.5);
            const sportCount = Math.random() < 0.35 ? 0 : (Math.random() < 0.7 ? 1 : 2);
            const chosenSports = shuffledSports.slice(0, sportCount);

            let relatives = null;
            if (Math.random() < 0.22) {
                const relCount = Math.random() < 0.65 ? 1 : 2;
                relatives = [];
                for (let r = 0; r < relCount; r++) {
                    relatives.push({
                        name: normalizePersonName(`${pickRandom(lastNames)} ${pickRandom(middleNames)} ${pickRandom(firstNames)}`),
                        relation: pickRandom(relations),
                        type: pickRandom(relTypes)
                    });
                }
            }

            const newKey = db.ref('delegates').push().key;
            updates[newKey] = {
                code,
                name: fullName,
                company: branchObj.group,
                group: branchObj.group,
                branch: branchObj.code,
                role: pickRandom(roles),
                phone,
                email: slugEmail,
                travel: pickRandom(travels),
                activity: pickRandom(activities),
                avatar: null,
                sports: chosenSports,
                relatives,
                isMockData: true,
                createdAt: baseTime - i * 1000
            };
        }

        await db.ref('delegates').update(updates);
        showToast(`Đã tạo thành công ${totalCount} CBNV mẫu!`);
    } catch (err) {
        console.error("Lỗi tạo dữ liệu mẫu:", err);
        alert("Không thể tạo dữ liệu mẫu. Vui lòng kiểm tra quyền đăng nhập BTC và Firebase Rules.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="wand-2" class="w-4 h-4"></i><span>Tạo ${totalCount} CBNV mẫu</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

async function clearAllDelegatesData() {
    if (!requireAdminAuth('xóa toàn bộ dữ liệu')) return;

    const totalRecords = allDelegatesData.length;
    if (totalRecords === 0 && winningHistory.length === 0) {
        showToast("Danh sách hiện tại đang trống, không có dữ liệu để xóa.");
        return;
    }

    const confirmText = prompt(
        `CẢNH BÁO: Thao tác này sẽ XÓA TOÀN BỘ ${totalRecords} bản ghi đại biểu (và dữ liệu quay thưởng liên quan) trên Firebase và không thể hoàn tác.\n\nNhập chính xác chữ "XOA" để xác nhận:`
    );

    if (confirmText === null) return;
    if (confirmText.trim().toUpperCase() !== 'XOA') {
        alert('Chuỗi xác nhận không khớp. Đã hủy thao tác xóa.');
        return;
    }

    const btn = document.getElementById('btn-clear-all-delegates');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang xóa...</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    try {
        await Promise.all([
            db.ref('delegates').remove(),
            db.ref('luckyDrawWinners').remove().catch(() => {})
        ]);

        currentDelegatePage = 1;
        currentSportPage = 1;
        showToast("Đã xóa toàn bộ dữ liệu đại biểu và kết quả quay thưởng!");
    } catch (err) {
        console.error("Lỗi xóa toàn bộ dữ liệu:", err);
        alert("Không thể xóa toàn bộ dữ liệu. Vui lòng kiểm tra quyền đăng nhập BTC và Firebase Rules.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="trash-2" class="w-4 h-4"></i><span>Xóa toàn bộ dữ liệu</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

function buildLuckyDrawCardHtml(person, prizeName, slotText, isWinner = false) {
    const avatarSrc = getDelegateAvatarSrc(person);
    const branch = getMemberBranch(person);
    const frameRing = isWinner
        ? 'border-[#FDE047] ring-4 ring-[#FDE047]/45 shadow-[0_24px_65px_rgba(0,68,71,0.45)]'
        : 'border-[#E5C158] shadow-[0_18px_45px_rgba(0,68,71,0.32)]';

    return `
        <div class="relative rounded-[32px] overflow-hidden border-2 ${frameRing} text-white text-left transition-all duration-200"
             style="background: radial-gradient(circle at 88% 12%, rgba(253, 224, 71, 0.24), transparent 42%), radial-gradient(circle at 12% 88%, rgba(255, 107, 53, 0.22), transparent 45%), linear-gradient(145deg, #003E41 0%, #00686B 55%, #00898E 100%);">

            <!-- Đầu thẻ -->
            <div class="px-5 sm:px-7 py-3 sm:py-3.5 bg-[#00282A]/80 border-b border-[#E5C158]/35 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
					${buildFast30CardLogoHtml()}
					<span class="text-[9px] sm:text-sm font-extrabold uppercase tracking-wider sm:tracking-[0.14em] text-[#FDE047] truncate">
						FAST 30 NĂM<br>1997–2027
					</span>
				</div>				
                <span class="px-3.5 py-1 rounded-full bg-[#FF6B35] text-white font-mono text-xs sm:text-sm font-extrabold shadow whitespace-nowrap shrink-0">
                    ${escapeHTML(person.code || 'FAST30-XXXX')}
                </span>
            </div>

            <!-- Thân thẻ (đã bỏ Chương trình & Môn thể thao) -->
            <div class="p-5 sm:p-7 space-y-5">
                <div class="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
                    <div class="relative shrink-0">
                        <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-1.5 bg-gradient-to-br from-[#FDE047] via-amber-300 to-[#FF6B35] shadow-xl">
                            <img src="${avatarSrc}" alt="${escapeHTML(person.name || 'CBNV')}" class="w-full h-full object-cover rounded-[20px] bg-white">
                        </div>
                    </div>

                    <div class="min-w-0 flex-1 w-full text-center sm:text-left space-y-1.5">
                        <span class="inline-block px-3 py-1 rounded-xl bg-white/15 border border-[#FDE047]/40 text-[11px] font-extrabold uppercase tracking-wider text-[#FDE047]">
                            CHI NHÁNH ${escapeHTML(branch)}
                        </span>
                        <h4 class="font-display font-extrabold text-2xl sm:text-3xl text-white leading-snug break-words">
                            ${escapeHTML(person.name || '')}
                        </h4>
                        <p class="text-sm text-teal-100 font-semibold">
                            ${escapeHTML(person.role || person.group || 'CBNV FAST')}
                        </p>
                        <p class="text-xs sm:text-sm text-amber-200/95 font-medium">
                            Quảng Bình · 10–13/07/2027
                        </p>
                    </div>
                </div>

                <!-- Dải thông báo hạng giải -->
                <div class="px-4 py-2.5 rounded-2xl bg-[#00282A]/75 border border-[#FDE047]/55 flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span class="font-extrabold uppercase tracking-wider text-[#FDE047]">
                        ${isWinner ? `🏆 CHÚC MỪNG TRÚNG ${escapeHTML(prizeName)}` : `🎰 ĐANG QUAY ${escapeHTML(prizeName)}`}
                    </span>
                    <span class="font-mono font-bold text-amber-200 shrink-0">
                        ${escapeHTML(slotText)}
                    </span>
                </div>

                <!-- Chân thẻ -->
                <div class="pt-3 border-t border-white/15 text-center text-xs sm:text-sm text-amber-100/95 italic">
                    “Am hiểu nghiệp vụ, Tận tâm đồng hành”
                </div>
            </div>
        </div>
    `;
}

function buildFast30CardLogoHtml() {
    const uid = Math.random().toString(36).slice(2, 7);
    return `
        <div class="px-2 py-1 rounded-xl bg-white border border-[#D4AF37] shadow-sm inline-flex items-center justify-center shrink-0">
            <svg viewBox="0 0 320 225" class="h-8 sm:h-10 w-auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logo FAST 30 Năm">
                <defs>
                    <linearGradient id="tealCardLogo-${uid}" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#00B5BC"/>
                        <stop offset="55%" stop-color="#00898E"/>
                        <stop offset="100%" stop-color="#005F63"/>
                    </linearGradient>
                    <linearGradient id="goldCardLogo-${uid}" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#F7E08B"/>
                        <stop offset="45%" stop-color="#D4AF37"/>
                        <stop offset="100%" stop-color="#A67C1E"/>
                    </linearGradient>
                </defs>
                <text x="28" y="32" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="25" letter-spacing="4" fill="#00898E">FAST</text>
                <polygon points="54.5,19.5 57.5,25 51.5,25" fill="#E53E3E"/>
                <path d="M32,42 H126 L104,84 H114 C136,84 148,98 148,120 C148,148 126,166 90,166 C60,166 36,154 24,134 L48,118 C56,130 70,138 88,138 C106,138 118,129 118,116 C118,104 108,97 90,97 H72 L94,64 H32 Z" fill="url(#tealCardLogo-${uid})" stroke="#D4AF37" stroke-width="3.5" stroke-linejoin="round"/>
                <g transform="translate(216, 103)">
                    <ellipse cx="0" cy="0" rx="64" ry="62" fill="url(#tealCardLogo-${uid})" stroke="#D4AF37" stroke-width="3.5"/>
                    <ellipse cx="4" cy="2" rx="46" ry="45" fill="url(#goldCardLogo-${uid})"/>
                    <ellipse cx="-5" cy="0" rx="34" ry="35" fill="#FFFFFF"/>
                </g>
                <path d="M44,183 C112,163 202,155 292,158 C296,158 297,163 292,164 C206,169 118,179 50,195 C42,197 38,185 44,183 Z" fill="#00979C" stroke="#D4AF37" stroke-width="2.2"/>
                <text x="288" y="185" text-anchor="end" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="18" letter-spacing="1" fill="#E53E3E">1997 - 2027</text>
                <text x="160" y="213" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="13.2" letter-spacing="0.4" fill="#007A7E">AM HIỂU NGHIỆP VỤ, TẬN TÂM ĐỒNG HÀNH</text>
            </svg>
        </div>
    `;
}
if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

// ==================== 1. CẤU HÌNH FIREBASE ====================
const firebaseConfig = {
    apiKey: "AIzaSyBpEqXWixeZM0ecwr_yL13t9SGfseRtgEY",
    authDomain: "pickleball-tct70.firebaseapp.com",
    databaseURL: "https://pickleball-tct70-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pickleball-tct70",
    storageBucket: "pickleball-tct70.firebasestorage.app",
    messagingSenderId: "1015003889551",
    appId: "1:1015003889551:web:609af4b91d27eb7a8a55fa",
    measurementId: "G-CG8E9J8S2W"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// ==================== 2. BIẾN TRẠNG THÁI TOÀN CỤC ====================
let allDelegatesData = [];
let currentFilter = 'all';
let currentSearchQuery = '';
let isAdminLoggedIn = false;
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

// ==================== 3. LẮNG NGHE REAL-TIME FIREBASE ====================
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

// ==================== 4. ĐIỀU HƯỚNG VIEW & MENU ====================
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

// ==================== 5. UPLOAD ẢNH CÁ NHÂN & THẺ ĐẠI BIỂU ====================
function compressAvatarToSquareDataUrl(file, maxSize = 480, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error("File không phải định dạng ảnh hợp lệ."));
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
                ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error("Không thể đọc ảnh đã chọn."));
            img.src = ev.target.result;
        };
        reader.onerror = () => reject(new Error("Lỗi khi tải file ảnh."));
        reader.readAsDataURL(file);
    });
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

    compressAvatarToSquareDataUrl(file, 480, 0.82)
        .then((dataUrl) => {
            setAvatarPreviewUI(prefix, dataUrl);
            showToast("Đã gắn ảnh chân dung cho thẻ đại biểu!");
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

    return `
        <div class="rounded-3xl fast-hero-gradient text-white p-5 border-2 border-[#E5C158] shadow-xl space-y-4">
            <div class="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[#FDE047]">
                <span>THẺ ĐẠI BIỂU · FAST 30 NĂM</span>
                <span class="px-2.5 py-0.5 rounded-lg bg-fast-orange text-white font-mono">${escapeHTML(item.code || 'FAST30-XXXX')}</span>
            </div>

            <div class="flex items-center gap-4">
                <img src="${avatarSrc}" alt="${escapeHTML(item.name || 'CBNV')}" class="w-20 h-20 rounded-2xl object-cover border-2 border-[#FDE047] shadow-md shrink-0 bg-white">
                <div class="min-w-0">
                    <h4 class="font-display font-extrabold text-lg sm:text-xl text-white truncate">${escapeHTML(item.name || '')}</h4>
                    <p class="text-xs text-amber-200 font-semibold">${escapeHTML(branch)} · ${escapeHTML(item.role || 'CBNV FAST')}</p>
                    <p class="text-[11px] text-white/85 mt-1">FLC Quảng Bình · 10–13/07/2027</p>
                </div>
            </div>

            <div class="pt-3 border-t border-white/20 text-xs space-y-1 text-white/95">
                <div>Hoạt động: <b>${escapeHTML(item.activity || '—')}</b></div>
                <div>Môn thể thao: <b>${escapeHTML(sportsList)}</b></div>
                ${rels.length > 0 ? `<div>Người thân đi kèm (<b>${rels.length}</b>): <b>${rels.map(r => escapeHTML(r.name || '')).join(', ')}</b></div>` : ''}
            </div>
        </div>
    `;
}

function openDelegateCardModal(codeOrId) {
    const found = allDelegatesData.find(d => d.code === codeOrId || d.id === codeOrId || d.firebaseKey === codeOrId);
    if (!found) return;
    const bodyEl = document.getElementById('delegate-card-modal-body');
    if (bodyEl) bodyEl.innerHTML = buildDelegateBadgeCardHtml(found);
    document.getElementById('delegate-card-modal')?.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeDelegateCardModal() {
    document.getElementById('delegate-card-modal')?.classList.add('hidden');
}

// ==================== 6. ĐĂNG KÝ (TRANG RIÊNG & MODAL) ====================
function extractBranchCode(groupOrCompany) {
    const text = String(groupOrCompany || '').toUpperCase();
    if (text.includes('FHN') || text.includes('HÀ NỘI')) return 'FHN';
    if (text.includes('FDN') || text.includes('FĐN') || text.includes('ĐÀ NẴNG')) return 'FDN';
    if (text.includes('FSG') || text.includes('TP.HCM') || text.includes('HỒ CHÍ MINH')) return 'FSG';
    return '';
}

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
            <input type="text" value="${escapeHTML(name)}" placeholder="Họ và tên người thân..." class="p-rel-name-input w-full px-3 py-2 rounded-xl border border-fast-border bg-white outline-none">
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

function handlePageRegistrationSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('p-reg-name').value.trim();
    const group = document.getElementById('p-reg-group').value;
    const role = document.getElementById('p-reg-role').value.trim();
    const phone = document.getElementById('p-reg-phone').value.trim();
    const email = document.getElementById('p-reg-email').value.trim();
    const travel = document.getElementById('p-reg-travel').value;
    const activity = document.getElementById('p-reg-activity').value;
    const avatar = pendingAvatarData['p-reg'] || null;

    const selectedSports = Array.from(
        document.querySelectorAll('input[name="p-reg-sports"]:checked')
    ).map(cb => cb.value);

    const relativesList = [];
    document.querySelectorAll('#p-relatives-container > div').forEach(row => {
        const relNameInput = row.querySelector('.p-rel-name-input');
        if (relNameInput && relNameInput.value.trim()) {
            relativesList.push({
                name: relNameInput.value.trim(),
                relation: row.querySelector('.p-rel-relation-input').value,
                type: row.querySelector('.p-rel-type-input').value
            });
        }
    });

    const regCode = `FAST30-${Math.floor(1000 + Math.random() * 9000)}`;
    lastCreatedCode = regCode;
    const branchCode = extractBranchCode(group);

    const record = {
        code: regCode,
        name,
        company: group,
        group,
        branch: branchCode,
        role: role || 'CBNV FAST',
        phone,
        email,
        travel,
        activity,
        avatar,
        sports: selectedSports,
        relatives: relativesList.length > 0 ? relativesList : null,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    db.ref('delegates').push(record)
        .then(() => {
            document.getElementById('p-succ-name').textContent = name;
            document.getElementById('p-succ-code').textContent = regCode;
            const badgeEl = document.getElementById('p-succ-badge-card');
            if (badgeEl) badgeEl.innerHTML = buildDelegateBadgeCardHtml(record);
            document.getElementById('page-register-form-view').classList.add('hidden');
            document.getElementById('page-register-success-view').classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
            showToast(`Đăng ký thành công! Mã: ${regCode}`);
        })
        .catch((error) => {
            console.error("Lỗi lưu đăng ký trang riêng:", error);
            alert("Có lỗi xảy ra khi lưu thông tin, vui lòng thử lại.");
        });
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
    document.getElementById('register-form-view').classList.remove('hidden');
    document.getElementById('register-success-view').classList.add('hidden');
    document.getElementById('register-modal').classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeRegisterModal() {
    document.getElementById('register-modal').classList.add('hidden');
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

// ==================== 7. TAB THỂ THAO THEO MÔN & CHI NHÁNH ====================
function selectSportTab(sportName) {
    currentSportTab = sportName;
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
    currentSportSearch = event.target.value.toLowerCase().trim();
    renderSportsView();
}

function getMemberBranch(item) {
    const code = extractBranchCode(`${item.branch || ''} ${item.group || ''} ${item.company || ''}`);
    return code || 'KHÁC';
}

function renderSportsView() {
    SPORTS_LIST.forEach(sport => {
        const countEl = document.getElementById(`sport-count-${sport}`);
        if (!countEl) return;
        const count = allDelegatesData.filter(d => Array.isArray(d.sports) && d.sports.includes(sport)).length;
        countEl.textContent = count;
    });

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
            const name = (d.name || '').toLowerCase();
            const code = (d.code || '').toLowerCase();
            const branch = getMemberBranch(d).toLowerCase();
            const group = (d.group || '').toLowerCase();
            const role = (d.role || '').toLowerCase();
            return (
                name.includes(currentSportSearch) ||
                code.includes(currentSportSearch) ||
                branch.includes(currentSportSearch) ||
                group.includes(currentSportSearch) ||
                role.includes(currentSportSearch)
            );
        });
    }

    const totalEl = document.getElementById('sport-filtered-total');
    if (totalEl) totalEl.textContent = `${list.length} CBNV`;

    const tbody = document.getElementById('sports-table-body');
    const mobileList = document.getElementById('sports-mobile-list');

    if (list.length === 0) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 italic text-sm">Chưa có CBNV nào phù hợp với bộ lọc ở môn ${escapeHTML(currentSportTab)}.</td></tr>`;
        }
        if (mobileList) {
            mobileList.innerHTML = `<div class="p-6 text-center text-slate-400 italic text-sm">Chưa có CBNV nào phù hợp với bộ lọc ở môn ${escapeHTML(currentSportTab)}.</div>`;
        }
        return;
    }

    if (tbody) {
        tbody.innerHTML = list.map(item => {
            const branch = getMemberBranch(item);
            return `
                <tr class="hover:bg-fast-body transition-colors border-b border-slate-100 last:border-none">
                    <td class="p-4 pl-6 font-mono font-bold text-xs text-fast-primary">${escapeHTML(item.code || '—')}</td>
                    <td class="p-4 font-bold text-sm text-fast-textMain">${escapeHTML(item.name)}</td>
                    <td class="p-4">
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-fast-dark/10 text-fast-dark">
                            ${escapeHTML(branch)}
                        </span>
                    </td>
                    <td class="p-4 text-xs text-slate-600">${escapeHTML(item.role || item.group || '—')}</td>
                    <td class="p-4 pr-6 text-xs text-slate-600">${escapeHTML(item.phone || '—')}</td>
                </tr>
            `;
        }).join('');
    }

    if (mobileList) {
        mobileList.innerHTML = list.map(item => {
            const branch = getMemberBranch(item);
            return `
                <div class="bg-fast-card rounded-2xl p-4 border border-fast-border shadow-xs space-y-2">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-bold text-sm text-fast-textMain">${escapeHTML(item.name)}</span>
                        <span class="px-2.5 py-0.5 rounded-lg bg-fast-primary/10 text-fast-primary font-mono font-bold text-xs shrink-0">${escapeHTML(item.code || '—')}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-fast-dark/10 text-fast-dark">${escapeHTML(branch)}</span>
                        <span class="text-slate-500 truncate">${escapeHTML(item.role || item.group || '—')}</span>
                    </div>
                    ${item.phone ? `<div class="text-xs text-slate-600 pt-1 border-t border-slate-100">📞 ${escapeHTML(item.phone)}</div>` : ''}
                </div>
            `;
        }).join('');
    }
}

// ==================== 8. DANH SÁCH ĐẠI BIỂU, NGƯỜI ĐI KÈM & PHÂN TRANG ====================
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
    currentSearchQuery = event.target.value.toLowerCase().trim();
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
            const name = (item.name || '').toLowerCase();
            const code = (item.code || '').toLowerCase();
            const phone = (item.phone || '').toLowerCase();
            const company = (item.company || '').toLowerCase();
            const relNames = getRelativesArray(item).map(r => (r.name || '').toLowerCase()).join(' ');
            return (
                name.includes(currentSearchQuery) ||
                code.includes(currentSearchQuery) ||
                phone.includes(currentSearchQuery) ||
                company.includes(currentSearchQuery) ||
                relNames.includes(currentSearchQuery)
            );
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

// ==================== 9. TRA CỨU, ADMIN & CHỈNH SỬA ====================
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
    resultDiv.classList.remove('hidden');

    const found = allDelegatesData.find(item => {
        const code = (item.code || '').trim().toUpperCase();
        const phone = (item.phone || '').trim().replace(/\s+/g, '');
        return code === cleanQuery || (cleanQuery.length >= 4 && phone.includes(cleanQuery));
    });

    if (found) {
        resultDiv.innerHTML = buildDelegateBadgeCardHtml(found);
    } else {
        resultDiv.innerHTML = `<div class="p-4 rounded-2xl bg-fast-body border border-fast-border text-center text-xs text-slate-600">Không tìm thấy thông tin đăng ký.</div>`;
    }
}

function openAdminModal() {
    const modal = document.getElementById('admin-login-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const input = document.getElementById('admin-password-input');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function closeAdminModal() {
    const modal = document.getElementById('admin-login-modal');
    if (modal) modal.classList.add('hidden');
}

function verifyAdminPassword() {
    const pass = document.getElementById('admin-password-input')?.value;
    if (pass === "fast2027") {
        isAdminLoggedIn = true;
        closeAdminModal();
        showToast("Đã kích hoạt quyền Quản trị viên thành công!");
        updateDelegatesUI();
    } else {
        alert("Mật khẩu không chính xác!");
    }
}

function deleteDelegateRecord(firebaseKey) {
    if (confirm("Bạn có chắc chắn muốn xóa đại biểu này không?")) {
        db.ref('delegates/' + firebaseKey).remove()
            .then(() => showToast("Đã xóa đại biểu thành công!"))
            .catch(err => {
                console.error(err);
                alert("Không thể xóa bản ghi.");
            });
    }
}

function openEditModal(firebaseKey) {
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
            <input type="text" value="${escapeHTML(name)}" placeholder="Họ và tên..." class="edit-rel-name w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white">
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

function handleEditSubmit(event) {
    event.preventDefault();
    const firebaseKey = document.getElementById('edit-firebase-key').value;
    if (!firebaseKey) return;

    const selectedSports = Array.from(
        document.querySelectorAll('input[name="edit-sports"]:checked')
    ).map(cb => cb.value);

    const relRows = document.querySelectorAll('#edit-relatives-container > div');
    const relativesList = [];
    relRows.forEach(row => {
        const n = row.querySelector('.edit-rel-name').value.trim();
        if (n) {
            relativesList.push({
                name: n,
                relation: row.querySelector('.edit-rel-relation').value,
                type: row.querySelector('.edit-rel-type').value
            });
        }
    });

    const groupVal = document.getElementById('edit-group').value;
    const companyVal = document.getElementById('edit-company').value.trim();

    const updatedFields = {
        name: document.getElementById('edit-name').value.trim(),
        company: companyVal,
        group: groupVal,
        branch: extractBranchCode(`${groupVal} ${companyVal}`),
        role: document.getElementById('edit-role').value.trim(),
        phone: document.getElementById('edit-phone').value.trim(),
        email: document.getElementById('edit-email').value.trim(),
        travel: document.getElementById('edit-travel').value.trim(),
        activity: document.getElementById('edit-activity').value.trim(),
        avatar: pendingAvatarData['edit'] || null,
        sports: selectedSports.length > 0 ? selectedSports : null,
        relatives: relativesList.length > 0 ? relativesList : null
    };

    db.ref('delegates/' + firebaseKey).update(updatedFields).then(() => {
        closeEditModal();
        showToast("Cập nhật thông tin thành công!");
    });
}

function addRelativeRow() {
    const container = document.getElementById('relatives-container');
    const rowId = 'rel-row-' + Date.now() + Math.floor(Math.random() * 1000);
    container.insertAdjacentHTML('beforeend', `
        <div id="${rowId}" class="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
            <div class="flex items-center justify-between">
                <span class="font-extrabold text-fast-dark">Người thân đi kèm</span>
                <button type="button" onclick="document.getElementById('${rowId}').remove()" class="text-red-500 font-bold">Xóa dòng</button>
            </div>
            <input type="text" placeholder="Họ và tên người thân..." class="rel-name-input w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none">
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

// ==================== 10. CLIP CHÀO MỪNG CHẠY LẦN LƯỢT TỪNG CBNV ====================
// ==================== 10. CLIP CHÀO MỪNG FULLSCREEN & NHẠC NỀN ====================
let reelMusicEnabled = true;
let reelAudioCtx = null;
let reelSynthTimer = null;
let reelCustomAudio = null;
let reelCustomObjectUrl = '';

function updateReelMusicUI() {
    const labelEl = document.getElementById('reel-music-label');
    if (labelEl) {
        labelEl.textContent = reelMusicEnabled ? 'Nhạc nền: Bật' : 'Nhạc nền: Tắt';
    }
}

function playCelebrationChord() {
    if (!reelMusicEnabled || !reelPlaying) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!reelAudioCtx) {
            reelAudioCtx = new AudioContextClass();
        }
        if (reelAudioCtx.state === 'suspended') {
            reelAudioCtx.resume();
        }

        // Giai điệu nhẹ nhàng ấm áp (C5 - E5 - G5 - B5)
        const notes = [523.25, 659.25, 783.99, 987.77];
        const freq = notes[reelIndex % notes.length];
        const now = reelAudioCtx.currentTime;

        const osc = reelAudioCtx.createOscillator();
        const gain = reelAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.045, now + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.8);

        osc.connect(gain);
        gain.connect(reelAudioCtx.destination);
        osc.start(now);
        osc.stop(now + 1.85);
    } catch (_) {}
}

function startReelMusic() {
    stopReelMusic();
    if (!reelMusicEnabled) return;

    if (reelCustomAudio) {
        reelCustomAudio.play().catch(() => {});
        return;
    }

    playCelebrationChord();
    reelSynthTimer = setInterval(() => {
        if (reelMusicEnabled && reelPlaying && !reelCustomAudio) {
            playCelebrationChord();
        }
    }, 1600);
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

    if (reelCustomAudio) {
        reelCustomAudio.pause();
        reelCustomAudio = null;
    }
    if (reelCustomObjectUrl) {
        URL.revokeObjectURL(reelCustomObjectUrl);
        reelCustomObjectUrl = '';
    }

    reelCustomObjectUrl = URL.createObjectURL(file);
    reelCustomAudio = new Audio(reelCustomObjectUrl);
    reelCustomAudio.loop = true;
    reelCustomAudio.volume = 0.65;
    reelMusicEnabled = true;
    updateReelMusicUI();

    if (reelPlaying) {
        reelCustomAudio.play().catch(() => {});
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
            <!-- Cụm ảnh CBNV + Vầng hào quang tỏa phía sau -->
            <div class="relative shrink-0 flex items-center justify-center">
                <!-- Vầng hào quang tỏa mềm phía sau -->
                <div class="pointer-events-none absolute -inset-7 rounded-full blur-2xl opacity-85 animate-pulse"
                     style="background: radial-gradient(circle, rgba(253, 224, 71, 0.55) 0%, rgba(0, 181, 188, 0.28) 48%, rgba(255, 107, 53, 0.14) 70%, transparent 80%);"></div>

                <!-- Vòng sáng viền hào quang mảnh bên ngoài -->
                <div class="pointer-events-none absolute -inset-3 rounded-[34px] border border-[#FDE047]/45 shadow-[0_0_35px_rgba(253,224,71,0.35)]"></div>

                <!-- Khung ảnh chính -->
                <div class="relative z-10 w-48 h-48 sm:w-64 sm:h-64 rounded-3xl p-1.5 bg-gradient-to-br from-[#FDE047] via-amber-300 to-[#FF6B35] shadow-[0_14px_40px_rgba(0,0,0,0.55)]">
                    <img src="${avatarSrc}" alt="${escapeHTML(person.name || '')}" class="w-full h-full object-cover rounded-[20px] bg-white">
                </div>

                <!-- Badge mã đại biểu -->
                <span class="z-20 absolute -bottom-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#00282A] border border-[#FDE047] text-[#FDE047] font-mono text-xs sm:text-sm font-extrabold shadow-lg whitespace-nowrap">
                    ${escapeHTML(person.code || 'FAST30-XXXX')}
                </span>
            </div>

            <!-- Thông tin & lời chào mừng CBNV -->
            <div class="relative z-10 text-center md:text-left max-w-2xl space-y-3">
                <span class="inline-block px-4 py-1 rounded-full bg-white/15 border border-[#FDE047]/50 text-[#FDE047] text-xs font-extrabold uppercase tracking-wider">
                    CHÀO MỪNG ĐẠI BIỂU · CHI NHÁNH ${escapeHTML(branch)}
                </span>
                <h2 class="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white leading-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)]">
                    ${escapeHTML(person.name || '')}
                </h2>
                <p class="text-sm sm:text-lg text-teal-100 font-medium">
                    ${escapeHTML(person.role || person.group || 'CBNV FAST')} · FLC Quảng Bình (10–13/07/2027)
                </p>
                ${sportsText ? `<div class="inline-block px-4 py-1.5 rounded-xl bg-black/30 border border-white/15 text-xs sm:text-sm font-bold text-[#FDE047]">🏅 Tham gia: ${escapeHTML(sportsText)}</div>` : ''}
                <p class="text-sm sm:text-base text-amber-100/95 italic pt-1">
                    "Am hiểu nghiệp vụ, Tận tâm đồng hành — Chào mừng đến với dấu ấn FAST 30 Năm!"
                </p>
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

// ==================== 11. COUNTDOWN, LỊCH TRÌNH, ẤN PHẨM & LIGHTBOX ====================
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

// ==================== 12. BAN CHỈ ĐẠO F30N ====================
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

// ==================== 13. LUCKY DRAW ====================
function setDrawGroup(groupKey, btnEl) {
    currentDrawGroup = groupKey;
    document.querySelectorAll('.draw-filter-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-[#00686B]', 'shadow-sm');
        btn.classList.add('bg-white/20', 'text-white');
    });
    if (btnEl) {
        btnEl.classList.remove('bg-white/20', 'text-white');
        btnEl.classList.add('bg-white', 'text-[#00686B]', 'shadow-sm');
    }
}

function selectPrizeCard(prizeName) {
    if (isDrawing) return;
    currentPrize = prizeName;
    document.querySelectorAll('.prize-card').forEach(card => {
        card.classList.remove('ring-4', 'ring-amber-300', 'scale-105', 'shadow-2xl', 'border-white');
        card.classList.add('border-white/15');
    });
    const activeCard = document.getElementById(`prize-card-${prizeName}`);
    if (activeCard) {
        activeCard.classList.remove('border-white/15');
        activeCard.classList.add('ring-4', 'ring-amber-300', 'scale-105', 'shadow-2xl', 'border-white');
    }
}

function startLuckyDraw() {
    if (isDrawing) return;
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
    btnStart.disabled = true;

    let counter = 0;
    const codeEl = document.getElementById('draw-display-code');
    const nameEl = document.getElementById('draw-winner-name');
    const compEl = document.getElementById('draw-winner-company');

    nameEl.textContent = `Đang quay ${currentPrize}...`;
    compEl.textContent = "";

    const interval = setInterval(() => {
        const rand = eligibleList[Math.floor(Math.random() * eligibleList.length)];
        codeEl.textContent = rand.code;
        counter++;
        if (counter > 25) {
            clearInterval(interval);
            const winner = eligibleList[Math.floor(Math.random() * eligibleList.length)];
            codeEl.textContent = winner.code;
            nameEl.textContent = `🎉 Chúc mừng: ${winner.name} trúng ${currentPrize}!`;
            compEl.textContent = `${winner.group || ''} · ${winner.company || ''}`;

            prizeCounts[currentPrize]++;
            winningHistory.unshift({ ...winner, prizeWon: currentPrize });
            updatePrizeCardsUI();
            updateWinnerHistoryUI();

            isDrawing = false;
            btnStart.disabled = false;
        }
    }, 90);
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
                ? `<div class="text-xs text-slate-400 italic text-center py-4">Chưa có người trúng</div>`
                : winners.map(w => `
                    <div class="p-2 rounded-xl bg-white border border-slate-100 flex items-center justify-between gap-2 text-xs">
                        <span class="font-bold text-slate-700 truncate">${escapeHTML(w.name)}</span>
                        <span class="font-mono font-extrabold text-fast-dark shrink-0">${escapeHTML(w.code)}</span>
                    </div>
                `).join('');
        }
    });
    const overall = document.getElementById('overall-winner-count');
    if (overall) overall.textContent = `Tổng đã trao: ${total} / 28 giải`;
}

function resetLuckyDraw() {
    if (isDrawing) return;
    document.getElementById('draw-display-code').textContent = "FAST30-XXXX";
    document.getElementById('draw-winner-name').textContent = "—";
    document.getElementById('draw-winner-company').textContent = "—";
}

// ==================== 14. TIỆN ÍCH CHUNG ====================
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
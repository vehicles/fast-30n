// =========================================================================
// 1. CẤU HÌNH & KHỞI TẠO FIREBASE
// =========================================================================
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

// =========================================================================
// 2. BIẾN TRẠNG THÁI TOÀN CỤC
// =========================================================================
let allDelegatesData = [];
let currentFilter = 'all';
let currentSearchQuery = '';
let isAdminLoggedIn = false;
let lastCreatedCode = '';
let isMobileMenuOpen = false;
let currentPageView = 'home';
let currentDetailedDay = 1;

// =========================================================================
// 3. LẮNG NGHE DỮ LIỆU REAL-TIME TỪ FIREBASE
// =========================================================================
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
}, (error) => {
    console.error("Lỗi đọc dữ liệu từ Firebase:", error);
});

// =========================================================================
// 4. BỘ LỌC, TÌM KIẾM & HIỂN THỊ DANH SÁCH ĐẠI BIỂU
// =========================================================================
function setFilter(filterType) {
    currentFilter = filterType;
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
    updateDelegatesUI();
}

function updateDelegatesUI() {
    const khachList = allDelegatesData.filter(item => item.group && (
        item.group.toLowerCase().includes('khách') ||
        item.group.toLowerCase().includes('nhà cung cấp') ||
        item.group.toLowerCase().includes('đối tác')
    ));
    const fhnList = allDelegatesData.filter(item => item.group && item.group.includes('FHN'));
    const fdnList = allDelegatesData.filter(item => item.group && item.group.includes('FDN'));
    const fsgList = allDelegatesData.filter(item => item.group && item.group.includes('FSG'));

    if (document.getElementById('count-all')) document.getElementById('count-all').textContent = allDelegatesData.length;
    if (document.getElementById('count-khach')) document.getElementById('count-khach').textContent = khachList.length;
    if (document.getElementById('count-fhn')) document.getElementById('count-fhn').textContent = fhnList.length;
    if (document.getElementById('count-fdn')) document.getElementById('count-fdn').textContent = fdnList.length;
    if (document.getElementById('count-fsg')) document.getElementById('count-fsg').textContent = fsgList.length;

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
            const email = (item.email || '').toLowerCase();
            return name.includes(currentSearchQuery) ||
                   code.includes(currentSearchQuery) ||
                   phone.includes(currentSearchQuery) ||
                   company.includes(currentSearchQuery) ||
                   email.includes(currentSearchQuery);
        });
    }

    // Thống kê tổng số lượng tham dự thực tế
    let totalDelegatesCount = allDelegatesData.length;
    let totalRelativesCount = 0;
    allDelegatesData.forEach(item => {
        if (item.relatives && Array.isArray(item.relatives)) {
            totalRelativesCount += item.relatives.length;
        } else if (item.relative) {
            totalRelativesCount += 1;
        }
    });

    const statsTextEl = document.getElementById('stats-text');
    const statsDetailEl = document.getElementById('stats-detail');
    if (statsTextEl) {
        statsTextEl.innerHTML = `Tổng số lượng tham dự thực tế: <b>${totalDelegatesCount + totalRelativesCount} người</b>`;
    }
    if (statsDetailEl) {
        statsDetailEl.innerHTML = `(Gồm <b>${totalDelegatesCount}</b> đại biểu chính thức và <b>${totalRelativesCount}</b> người thân đi kèm)`;
    }

    displayList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const tbody = document.getElementById('delegates-table-body');
    const mobileContainer = document.getElementById('delegates-mobile-list');

    if (displayList.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 italic">Không tìm thấy kết quả phù hợp.</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="p-8 text-center text-slate-400 italic text-sm col-span-full">Không tìm thấy kết quả phù hợp.</div>`;
        return;
    }

    // Render Bảng Desktop
    if (tbody) {
        tbody.innerHTML = displayList.map(item => {
            const firstLetter = item.name ? item.name.charAt(0).toUpperCase() : 'F';
            let relativesHTML = '';
            if (item.relatives && Array.isArray(item.relatives) && item.relatives.length > 0) {
                const relItems = item.relatives.map(r => `• <b>${escapeHTML(r.name)}</b> (${escapeHTML(r.relation)} - ${escapeHTML(r.type)})`).join('<br>');
                relativesHTML = `
                    <div class="text-[11px] text-amber-700 font-medium mt-1.5 space-y-0.5 bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                        <div class="font-bold text-amber-800">👥 Người thân đi kèm (${item.relatives.length}):</div>
                        ${relItems}
                    </div>`;
            } else if (item.relative) {
                relativesHTML = `
                    <div class="text-[11px] text-amber-700 font-medium mt-1 bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                        👥 Người thân đi kèm: <b>${escapeHTML(item.relative.name)}</b> (${escapeHTML(item.relative.relation)} - ${escapeHTML(item.relative.type)})
                    </div>`;
            }

            const actionBtnPC = isAdminLoggedIn ? `
                <td class="p-4 pr-6 text-right whitespace-nowrap">
                    <button onclick="openEditModal('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs inline-flex items-center gap-1 transition shadow-xs mr-1" title="Sửa thông tin">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i> Sửa
                    </button>
                    <button onclick="deleteDelegateRecord('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs inline-flex items-center gap-1 transition shadow-xs" title="Xóa bản ghi">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Xóa
                    </button>
                </td>
            ` : `<td class="p-4 pr-6"></td>`;

            return `
                <tr class="hover:bg-[#FAF9F6] transition-colors border-b border-slate-100 last:border-none">
                    <td class="p-4 pl-6 font-mono font-extrabold text-[#00979C] whitespace-nowrap">
                        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#00979C]/10 border border-[#00979C]/20">
                            <span>${escapeHTML(item.code)}</span>
                            <button onclick="copyDelegateCode('${escapeHTML(item.code)}')" class="text-[#00686B] hover:text-[#00979C] transition shrink-0" title="Sao chép mã">
                                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#00686B] to-[#00979C] text-white font-extrabold flex items-center justify-center text-xs shadow-sm shrink-0">
                                ${firstLetter}
                            </div>
                            <div>
                                <span class="font-bold text-[#2D3748] block leading-snug">${escapeHTML(item.name)}</span>
                                <span class="text-[11px] text-slate-400 font-medium">${escapeHTML(item.role || 'Đại biểu tham dự')}</span>
                            </div>
                        </div>
                    </td>
                    <td class="p-4 text-[#475569] font-medium text-xs">${escapeHTML(item.company || '—')}</td>
                    <td class="p-4">
                        <span class="inline-block px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#00686B]/10 text-[#00686B] border border-[#00686B]/20">
                            ${escapeHTML(item.group)}
                        </span>
                    </td>
                    <td class="p-4 text-xs">
                        <div class="font-semibold text-[#2D3748]">${escapeHTML(item.activity)}</div>
                        <div class="text-[11px] text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                            <span>✈️</span> ${escapeHTML(item.travel || 'Chưa cập nhật')}
                        </div>
                        ${relativesHTML}
                    </td>
                    ${actionBtnPC}
                </tr>
            `;
        }).join('');
    }

    // Render Card Mobile
    if (mobileContainer) {
        mobileContainer.innerHTML = displayList.map(item => {
            const firstLetter = item.name ? item.name.charAt(0).toUpperCase() : 'F';
            let relativeCardHTML = '';
            if (item.relatives && Array.isArray(item.relatives) && item.relatives.length > 0) {
                const relItemsMobile = item.relatives.map(r => `• <b>${escapeHTML(r.name)}</b> (${escapeHTML(r.relation)} - ${escapeHTML(r.type)})`).join('<br>');
                relativeCardHTML = `
                    <div class="mt-2 pt-2 border-t border-slate-100 text-[11px] bg-amber-50/60 p-2.5 rounded-xl text-amber-900 font-medium space-y-0.5">
                        <div class="font-bold text-amber-800">👥 Người thân đi kèm (${item.relatives.length}):</div>
                        ${relItemsMobile}
                    </div>`;
            } else if (item.relative) {
                relativeCardHTML = `
                    <div class="mt-2 pt-2 border-t border-slate-100 text-[11px] bg-amber-50/60 p-2.5 rounded-xl text-amber-900 font-medium">
                        👥 Người thân: <b>${escapeHTML(item.relative.name)}</b> (${escapeHTML(item.relative.relation)} - ${escapeHTML(item.relative.type)})
                    </div>`;
            }

            const actionBtnMobile = isAdminLoggedIn ? `
                <div class="flex items-center gap-1.5">
                    <button onclick="openEditModal('${item.id}')" class="px-2 py-1 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs flex items-center gap-1 transition">
                        <i data-lucide="pencil" class="w-3 h-3"></i> Sửa
                    </button>
                    <button onclick="deleteDelegateRecord('${item.id}')" class="px-2 py-1 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs flex items-center gap-1 transition">
                        <i data-lucide="trash-2" class="w-3 h-3"></i> Xóa
                    </button>
                </div>
            ` : '';

            return `
                <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                    <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#00686B] to-[#00979C] text-white font-extrabold flex items-center justify-center text-xs shadow-sm shrink-0">
                                ${firstLetter}
                            </div>
                            <div>
                                <h4 class="font-bold text-[#2D3748] text-sm">${escapeHTML(item.name)}</h4>
                                <p class="text-[10px] text-slate-400">${escapeHTML(item.role || 'Đại biểu')}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-1 rounded-lg bg-[#00979C]/10 text-[#00979C] font-mono font-extrabold text-xs">
                                ${escapeHTML(item.code)}
                            </span>
                            ${actionBtnMobile}
                        </div>
                    </div>
                    <div class="space-y-1.5 text-xs text-slate-600">
                        <div class="flex justify-between">
                            <span class="text-slate-400">Đơn vị:</span>
                            <span class="font-semibold text-[#2D3748] text-right">${escapeHTML(item.company || '—')}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-slate-400">Nhóm:</span>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00686B]/10 text-[#00686B]">
                                ${escapeHTML(item.group)}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-400">Hoạt động:</span>
                            <span class="font-medium text-[#2D3748] text-right">${escapeHTML(item.activity)}</span>
                        </div>
                        <div class="flex justify-between items-center pt-1 border-t border-slate-50">
                            <span class="text-slate-400">Di chuyển:</span>
                            <span class="text-amber-600 font-semibold text-[11px]">✈️ ${escapeHTML(item.travel || 'Chưa cập nhật')}</span>
                        </div>
                        ${relativeCardHTML}
                    </div>
                </div>
            `;
        }).join('');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// =========================================================================
// 5. ĐĂNG KÝ THAM DỰ & NGƯỜI THÂN ĐI KÈM
// =========================================================================
function handleRegistrationSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('reg-name').value.trim();
    const company = document.getElementById('reg-company').value.trim();
    const group = document.getElementById('reg-group').value;
    const role = document.getElementById('reg-role').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const travel = document.getElementById('reg-travel').value;
    const activity = document.getElementById('reg-activity').value;

    const relativeRows = document.querySelectorAll('#relatives-container > div');
    let relativesList = [];

    relativeRows.forEach(row => {
        const nameInput = row.querySelector('.rel-name-input');
        if (nameInput && nameInput.value.trim()) {
            relativesList.push({
                name: nameInput.value.trim(),
                relation: row.querySelector('.rel-relation-input').value,
                type: row.querySelector('.rel-type-input').value
            });
        }
    });

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const regCode = `FAST30-${randomNum}`;
    lastCreatedCode = regCode;

    const record = {
        code: regCode,
        name,
        company,
        group,
        role,
        phone,
        email,
        travel,
        activity,
        relatives: relativesList.length > 0 ? relativesList : null,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    db.ref('delegates').push(record)
        .then(() => {
            const succNameEl = document.getElementById('succ-name');
            const succCodeEl = document.getElementById('succ-code');
            if (succNameEl) succNameEl.textContent = name;
            if (succCodeEl) succCodeEl.textContent = regCode;

            document.getElementById('register-form-view').classList.add('hidden');
            document.getElementById('register-success-view').classList.remove('hidden');
            document.getElementById('registration-form').reset();

            const relContainer = document.getElementById('relatives-container');
            if (relContainer) relContainer.innerHTML = '';

            if (typeof lucide !== 'undefined') lucide.createIcons();
            showToast(`Đăng ký thành công! Mã: ${regCode}`);
        })
        .catch((error) => {
            console.error("Lỗi lưu Firebase:", error);
            alert("Có lỗi xảy ra khi lưu thông tin, vui lòng thử lại.");
        });
}

function addRelativeRow() {
    const container = document.getElementById('relatives-container');
    if (!container) return;
    const rowId = 'rel-row-' + Date.now() + Math.floor(Math.random() * 1000);
    const rowHTML = `
        <div id="${rowId}" class="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 relative group-rel">
            <div class="flex items-center justify-between">
                <span class="text-[11px] font-extrabold text-[#00686B]">Người thân đi kèm</span>
                <button type="button" onclick="removeRelativeRow('${rowId}')" class="text-red-500 hover:text-red-700 text-xs font-bold p-1 inline-flex items-center gap-1">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Xóa dòng này
                </button>
            </div>
            <div>
                <input type="text" placeholder="Họ và tên người thân..." class="rel-name-input w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-[#00979C] outline-none bg-white">
            </div>
            <div class="grid grid-cols-2 gap-2">
                <select class="rel-relation-input w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-[#00979C] outline-none bg-white">
                    <option value="Vợ/Chồng">Vợ / Chồng</option>
                    <option value="Con cái">Con cái</option>
                    <option value="Bố/Mẹ">Bố / Mẹ</option>
                    <option value="Bạn bè/Khác">Bạn bè / Khác</option>
                </select>
                <select class="rel-type-input w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-[#00979C] outline-none bg-white">
                    <option value="Người lớn">Người lớn</option>
                    <option value="Trẻ em (> 6 tuổi)">Trẻ em (&gt; 6 tuổi)</option>
                    <option value="Trẻ em (< 6 tuổi)">Trẻ em (&lt; 6 tuổi)</option>
                </select>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function removeRelativeRow(rowId) {
    document.getElementById(rowId)?.remove();
}

// =========================================================================
// 6. TRA CỨU ĐẠI BIỂU
// =========================================================================
function performLookup(query) {
    const resultDiv = document.getElementById('lookup-result');
    const cleanQuery = query.trim().toUpperCase();

    if (!cleanQuery) {
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = `<p class="text-xs text-red-500 text-center py-4">Vui lòng nhập mã đại biểu hoặc số điện thoại để tra cứu.</p>`;
        return;
    }

    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">Đang tìm kiếm trên hệ thống...</p>`;

    db.ref('delegates').once('value', (snapshot) => {
        const data = snapshot.val();
        let found = null;

        if (data) {
            Object.values(data).forEach(item => {
                const itemCode = (item.code || '').trim().toUpperCase();
                const itemPhone = (item.phone || '').trim().replace(/\s+/g, '');
                const cleanInputPhone = cleanQuery.replace(/\s+/g, '');

                if (itemCode === cleanQuery || (cleanInputPhone.length >= 4 && itemPhone.includes(cleanInputPhone))) {
                    found = item;
                }
            });
        }

        if (found) {
            resultDiv.innerHTML = `
                <div class="p-5 rounded-3xl fast-hero-gradient text-white shadow-lg border border-[#D4AF37]">
                    <div class="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-white/20">
                        <div>
                            <span class="inline-block px-2.5 py-0.5 rounded-lg bg-white/15 text-amber-200 text-[10px] font-bold uppercase tracking-wider mb-1">${escapeHTML(found.group)}</span>
                            <h4 class="font-display font-extrabold text-lg text-white">${escapeHTML(found.name)}</h4>
                            <p class="text-xs text-white/90">${escapeHTML(found.role || '')}${found.company ? ' · ' + escapeHTML(found.company) : ''}</p>
                        </div>
                        <span class="px-3 py-1 rounded-xl bg-[#FF6B35] text-white font-mono font-bold text-xs shadow shrink-0">
                            ${escapeHTML(found.code)}
                        </span>
                    </div>
                    <div class="space-y-2 text-xs">
                        <div class="flex justify-between">
                            <span class="text-white/85">Phương án di chuyển:</span>
                            <span class="font-bold text-amber-200">${escapeHTML(found.travel)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-white/85">Hoạt động đăng ký:</span>
                            <span class="font-semibold text-white">${escapeHTML(found.activity)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-white/85">Liên hệ:</span>
                            <span class="font-semibold text-white">${escapeHTML(found.phone)}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="p-5 rounded-2xl bg-[#FAF9F6] border border-[#E2E8F0] text-center">
                    <p class="font-bold text-[#2D3748] text-sm mb-1">Không tìm thấy thông tin đăng ký</p>
                    <p class="text-xs text-[#64748B] mb-3">Vui lòng kiểm tra lại Mã đại biểu (VD: FAST30-6524) hoặc Số điện thoại.</p>
                    <button type="button" onclick="closeLookupModal(); openRegisterModal();" class="px-4 py-2 rounded-xl btn-fast-orange text-xs font-bold">
                        Đăng ký ngay
                    </button>
                </div>
            `;
        }
    }, (error) => {
        console.error("Lỗi tra cứu Firebase:", error);
        resultDiv.innerHTML = `<p class="text-xs text-red-500 text-center py-4">Có lỗi kết nối hệ thống, vui lòng thử lại.</p>`;
    });
}

// =========================================================================
// 7. BAN CHỈ ĐẠO F30N
// =========================================================================
function generateRandomVNPhone() {
    const prefixes = ['090', '091', '093', '094', '096', '097', '098', '086', '088', '089'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const part1 = Math.floor(1000 + Math.random() * 9000).toString();
    const part2 = Math.floor(100 + Math.random() * 900).toString();
    const raw = `${prefix}${part1}${part2}`;
    const formatted = `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
    return { raw, formatted };
}

function formatPhone(rawPhone) {
    const clean = rawPhone.replace(/\D/g, '');
    const formatted = clean.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    return { raw: clean, formatted };
}

const bcdData = {
    leader: {
        badge: "TRƯỞNG BAN CHỈ ĐẠO F30N",
        name: "Anh Phan Quốc Khánh",
        desc: "Trưởng ban · Chỉ đạo chung toàn bộ chuỗi hoạt động Kỷ niệm 30 năm FAST",
        phone: formatPhone("0903406696")
    },
    deputies: [
        { role: "PHÓ BAN", name: "Anh Phạm Ngọc Hùng", sub: "Phó Ban Chỉ Đạo F30N", phone: formatPhone("0913057969") },
        { role: "PHÓ BAN", name: "Anh Lê Khắc Bình", sub: "Phó Ban Chỉ Đạo F30N", phone: generateRandomVNPhone() },
        { role: "PHÓ BAN", name: "Chị Ninh Thị Tố Uyên", sub: "Phó Ban Chỉ Đạo F30N", phone: formatPhone("0989006042") }
    ],
    members: [
        { name: "Chị Nguyễn Thị Mỹ Hồng", tag: "Mảng Marketing, PR", tagColor: "bg-[#00979C] text-white", badgeColor: "bg-[#E0F2F1] text-[#00686B]", desc: "Phụ trách truyền thông đối ngoại, nhận diện thương hiệu và quan hệ báo chí – khách mời F30N.", shortTag: "Mktg, PR", phone: generateRandomVNPhone() },
        { name: "Anh Nguyễn Duy Hiển", tag: "Mảng Marketing, PR", tagColor: "bg-[#00979C] text-white", badgeColor: "bg-[#E0F2F1] text-[#00686B]", desc: "Phụ trách chiến dịch truyền thông số, ấn phẩm sự kiện và kết nối hệ sinh thái đối tác F30N.", shortTag: "Mktg, PR", phone: generateRandomVNPhone() },
        { name: "Chị Nguyễn Thị Minh Nguyệt", tag: "Kỷ yếu, PR nội bộ", tagColor: "bg-[#9A6B16] text-white", badgeColor: "bg-[#FEF3C7] text-[#92400E]", desc: "Phụ trách biên tập Kỷ yếu 30 năm FAST, lan tỏa văn hóa và truyền thông gắn kết nội bộ 3 miền.", shortTag: "Kỷ yếu, PR nội bộ", phone: generateRandomVNPhone() },
        { name: "Anh Nguyễn Thành Đồng", tag: "Kỷ yếu, Nghỉ mát, Văn thể", tagColor: "bg-[#FF6B35] text-white", badgeColor: "bg-[#FFEDD5] text-[#C2410C]", desc: "Phụ trách nội dung kỷ yếu, điều phối hậu cần nghỉ mát Quảng Bình và các giải thi đấu văn thể.", shortTag: "Kỷ yếu, Nghỉ mát, Văn thể", phone: generateRandomVNPhone() },
        { name: "Anh Hoàng Minh Quang", tag: "Kỷ yếu, Nghỉ mát, Văn thể", tagColor: "bg-[#FF6B35] text-white", badgeColor: "bg-[#FFEDD5] text-[#C2410C]", desc: "Phụ trách tư liệu kỷ yếu, tổ chức hành trình nghỉ mát 3 miền và điều phối hội thao – văn nghệ.", shortTag: "Kỷ yếu, Nghỉ mát, Văn thể", phone: generateRandomVNPhone() },
        { name: "Anh Bùi Quang Thành", tag: "Kỷ yếu, Nghỉ mát, Văn thể", tagColor: "bg-[#FF6B35] text-white", badgeColor: "bg-[#FFEDD5] text-[#C2410C]", desc: "Phụ trách đóng góp nội dung kỷ yếu, công tác tổ chức nghỉ mát và các hoạt động phong trào văn thể.", shortTag: "Kỷ yếu, Nghỉ mát, Văn thể", phone: generateRandomVNPhone() }
    ]
};

function renderBCD() {
    const leaderEl = document.getElementById("bcd-leader-card");
    const deputiesEl = document.getElementById("bcd-deputies-grid");
    const membersEl = document.getElementById("bcd-members-grid");
    if (!leaderEl || !deputiesEl || !membersEl) return;

    const l = bcdData.leader;
    leaderEl.innerHTML = `
        <div class="bg-gradient-to-br from-[#00686B] via-[#00898E] to-[#00979C] text-white rounded-2xl p-6 shadow-md border border-[#E5C158]/50 space-y-4">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-[#E5C158]/60 text-[#FDE047] text-[11px] font-bold tracking-wider uppercase">
                <i data-lucide="crown" class="w-3.5 h-3.5"></i> ${l.badge}
            </span>
            <div>
                <h3 class="text-2xl md:text-3xl font-extrabold tracking-tight">${l.name}</h3>
                <p class="text-teal-50 text-sm mt-1.5 leading-relaxed">${l.desc}</p>
            </div>
            <div class="pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2">
                <a href="tel:${l.phone.raw}" class="inline-flex items-center gap-2 text-sm font-bold text-[#FDE047] hover:underline">
                    <i data-lucide="phone" class="w-3.5 h-3.5"></i> ${l.phone.formatted}
                </a>
                <a href="https://zalo.me/${l.phone.raw}" target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0068FF] hover:bg-[#0055D4] text-white text-xs font-bold shadow transition">
                    Zalo
                </a>
            </div>
        </div>
    `;

    deputiesEl.innerHTML = bcdData.deputies.map(d => `
        <div class="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-xs flex flex-col justify-between space-y-3 hover:border-[#00979C] transition">
            <div class="space-y-1.5">
                <span class="inline-block px-2.5 py-0.5 rounded-full bg-[#E0F2F1] text-[#00686B] text-[10px] font-extrabold uppercase">${d.role}</span>
                <h4 class="font-extrabold text-[#1E293B] text-base leading-snug">${d.name}</h4>
                <p class="text-xs text-[#64748B]">${d.sub}</p>
            </div>
            <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <a href="tel:${d.phone.raw}" class="text-xs font-bold text-[#00686B] hover:text-[#00979C] whitespace-nowrap inline-flex items-center gap-1">
                    <i data-lucide="phone" class="w-3 h-3"></i> ${d.phone.formatted}
                </a>
                <a href="https://zalo.me/${d.phone.raw}" target="_blank" rel="noopener noreferrer"
                   class="px-2.5 py-1 rounded-full bg-[#0068FF] hover:bg-[#0055D4] text-white text-[11px] font-bold transition shrink-0">
                    Zalo
                </a>
            </div>
        </div>
    `).join("");

    membersEl.innerHTML = bcdData.members.map(m => `
        <div class="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md hover:border-[#00979C]/50 transition">
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${m.badgeColor}">THÀNH VIÊN BCĐ</span>
                    <span class="px-3 py-1 rounded-full text-[11px] font-bold ${m.tagColor}">${m.tag}</span>
                </div>
                <h4 class="text-lg font-extrabold text-[#00686B]">${m.name}</h4>
                <p class="text-sm text-[#475569] leading-relaxed">${m.desc}</p>
            </div>
            <div class="pt-3.5 border-t border-slate-100 space-y-2.5">
                <div class="text-xs text-[#64748B]">Mảng: <strong class="text-[#1E293B]">${m.shortTag}</strong></div>
                <div class="flex items-center justify-between gap-2 bg-[#F8FAFC] px-3 py-2 rounded-xl border border-slate-200/70">
                    <a href="tel:${m.phone.raw}" class="text-xs font-extrabold text-[#00686B] hover:text-[#00979C] flex items-center gap-1.5">
                        <i data-lucide="phone" class="w-3.5 h-3.5 text-[#00979C]"></i>
                        <span>${m.phone.formatted}</span>
                    </a>
                    <a href="https://zalo.me/${m.phone.raw}" target="_blank" rel="noopener noreferrer"
                       class="px-3.5 py-1 rounded-full bg-[#0068FF] hover:bg-[#0055D4] text-white text-xs font-bold shadow-xs transition">
                        Zalo
                    </a>
                </div>
            </div>
        </div>
    `).join("");

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// =========================================================================
// 8. QUẢN TRỊ ADMIN (SỬA / XÓA)
// =========================================================================
function openAdminModal() {
    const modal = document.getElementById('admin-login-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const passInput = document.getElementById('admin-password-input');
        if (passInput) {
            passInput.value = '';
            passInput.focus();
        }
    }
}

function closeAdminModal() {
    document.getElementById('admin-login-modal')?.classList.add('hidden');
}

function verifyAdminPassword() {
    const pass = document.getElementById('admin-password-input')?.value || '';
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
    if (confirm("Bạn có chắc chắn muốn xóa đại biểu này khỏi hệ thống không?")) {
        db.ref('delegates/' + firebaseKey).remove()
            .then(() => showToast("Đã xóa đại biểu thành công!"))
            .catch(err => {
                console.error("Lỗi khi xóa:", err);
                alert("Không thể xóa, vui lòng thử lại.");
            });
    }
}

function openEditModal(firebaseKey) {
    const modal = document.getElementById('edit-modal');
    const modalContent = document.getElementById('edit-modal-content');
    if (!modal || !modalContent) return;

    const delegate = allDelegatesData.find(item => item.id === firebaseKey);
    if (!delegate) return alert("Không tìm thấy thông tin đại biểu!");

    document.getElementById('edit-firebase-key').value = firebaseKey;
    document.getElementById('edit-name').value = delegate.name || '';
    document.getElementById('edit-phone').value = delegate.phone || '';
    document.getElementById('edit-email').value = delegate.email || '';
    document.getElementById('edit-company').value = delegate.company || '';
    document.getElementById('edit-group').value = delegate.group || 'CBNV FAST Hà Nội (FHN)';
    document.getElementById('edit-role').value = delegate.role || '';
    document.getElementById('edit-travel').value = delegate.travel || '';
    document.getElementById('edit-activity').value = delegate.activity || '';

    const container = document.getElementById('edit-relatives-container');
    container.innerHTML = '';
    let relativesToLoad = (delegate.relatives && Array.isArray(delegate.relatives))
        ? delegate.relatives
        : (delegate.relative ? [delegate.relative] : []);
    relativesToLoad.forEach(rel => addEditRelativeRow(rel.name, rel.relation, rel.type));

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('opacity-100');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function addEditRelativeRow(name = '', relation = 'Vợ/Chồng', type = 'Người lớn') {
    const container = document.getElementById('edit-relatives-container');
    if (!container) return;
    const rowId = 'edit-rel-' + Date.now() + Math.floor(Math.random() * 1000);
    const rowHTML = `
        <div id="${rowId}" class="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div class="flex items-center justify-between">
                <span class="text-[11px] font-extrabold text-[#00686B]">Người thân đi kèm</span>
                <button type="button" onclick="document.getElementById('${rowId}').remove()" class="text-red-500 hover:text-red-700 text-xs font-bold p-1 inline-flex items-center gap-1">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Xóa dòng
                </button>
            </div>
            <div>
                <input type="text" value="${escapeHTML(name)}" placeholder="Họ và tên người thân..." class="edit-rel-name w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-[#00979C] outline-none bg-white">
            </div>
            <div class="grid grid-cols-2 gap-2">
                <select class="edit-rel-relation w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-[#00979C] outline-none bg-white">
                    <option value="Vợ/Chồng" ${relation === 'Vợ/Chồng' ? 'selected' : ''}>Vợ / Chồng</option>
                    <option value="Con cái" ${relation === 'Con cái' ? 'selected' : ''}>Con cái</option>
                    <option value="Bố/Mẹ" ${relation === 'Bố/Mẹ' ? 'selected' : ''}>Bố / Mẹ</option>
                    <option value="Bạn bè/Khác" ${relation === 'Bạn bè/Khác' ? 'selected' : ''}>Bạn bè / Khác</option>
                </select>
                <select class="edit-rel-type w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-[#00979C] outline-none bg-white">
                    <option value="Người lớn" ${type === 'Người lớn' ? 'selected' : ''}>Người lớn</option>
                    <option value="Trẻ em (> 6 tuổi)" ${type === 'Trẻ em (> 6 tuổi)' ? 'selected' : ''}>Trẻ em (&gt; 6 tuổi)</option>
                    <option value="Trẻ em (< 6 tuổi)" ${type === 'Trẻ em (< 6 tuổi)' ? 'selected' : ''}>Trẻ em (&lt; 6 tuổi)</option>
                </select>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    const modalContent = document.getElementById('edit-modal-content');
    if (!modal || !modalContent) return;

    modal.classList.remove('opacity-100');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function handleEditSubmit(event) {
    event.preventDefault();
    const firebaseKey = document.getElementById('edit-firebase-key').value;
    if (!firebaseKey) return;

    const relativeRows = document.querySelectorAll('#edit-relatives-container > div');
    let relativesList = [];
    relativeRows.forEach(row => {
        const nameVal = row.querySelector('.edit-rel-name').value.trim();
        if (nameVal) {
            relativesList.push({
                name: nameVal,
                relation: row.querySelector('.edit-rel-relation').value,
                type: row.querySelector('.edit-rel-type').value
            });
        }
    });

    const updatedData = {
        name: document.getElementById('edit-name').value.trim(),
        phone: document.getElementById('edit-phone').value.trim(),
        email: document.getElementById('edit-email').value.trim(),
        company: document.getElementById('edit-company').value.trim(),
        group: document.getElementById('edit-group').value,
        role: document.getElementById('edit-role').value.trim(),
        travel: document.getElementById('edit-travel').value.trim(),
        activity: document.getElementById('edit-activity').value.trim(),
        relatives: relativesList.length > 0 ? relativesList : null
    };

    db.ref('delegates/' + firebaseKey).update(updatedData)
        .then(() => {
            closeEditModal();
            showToast("Cập nhật thông tin thành công!");
        })
        .catch(err => {
            console.error("Lỗi khi cập nhật:", err);
            alert("Có lỗi xảy ra khi cập nhật thông tin.");
        });
}

// =========================================================================
// 9. VÒNG QUAY MAY MẮN (LUCKY DRAW)
// =========================================================================
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
    'Giải Bảy': 0, 'Giải Sáu': 0, 'Giải Năm': 0,
    'Giải Tư': 0, 'Giải Ba': 0, 'Giải Nhì': 0, 'Giải Nhất': 0
};

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
        alert(`${currentPrize} đã quay đủ số lượng tối đa (${maxAllowed}/${maxAllowed} suất)! Vui lòng chọn giải khác.`);
        return;
    }

    let eligibleList = allDelegatesData.filter(item => {
        if (winningHistory.some(w => w.code === item.code)) return false;

        const g = (item.group || '').toLowerCase();
        if (currentDrawGroup === 'all') return true;
        if (currentDrawGroup === 'fhn') return g.includes('fhn');
        if (currentDrawGroup === 'fdn') return g.includes('fdn');
        if (currentDrawGroup === 'fsg') return g.includes('fsg');
        if (currentDrawGroup === 'khach') return g.includes('khách') || g.includes('đối tác');
        return true;
    });

    if (eligibleList.length === 0) {
        alert("Đã hết danh sách đại biểu hợp lệ chưa trúng thưởng trong mục này!");
        return;
    }

    isDrawing = true;
    const btnStart = document.getElementById('btn-start-draw');
    btnStart.disabled = true;
    btnStart.classList.add('opacity-50');

    let counter = 0;
    const codeEl = document.getElementById('draw-display-code');
    const nameEl = document.getElementById('draw-winner-name');
    const compEl = document.getElementById('draw-winner-company');

    nameEl.textContent = `Đang quay thưởng ${currentPrize} (${currentDrawn + 1}/${maxAllowed})...`;
    compEl.textContent = "";

    const interval = setInterval(() => {
        const randomItem = eligibleList[Math.floor(Math.random() * eligibleList.length)];
        codeEl.textContent = randomItem.code;
        counter++;

        if (counter > 30) {
            clearInterval(interval);
            const winner = eligibleList[Math.floor(Math.random() * eligibleList.length)];

            codeEl.textContent = winner.code;
            nameEl.textContent = `🎉 Chúc mừng: ${winner.name} đã trúng ${currentPrize}!`;
            compEl.textContent = `Đơn vị: ${winner.company || '—'} | Nhóm: ${winner.group}`;

            prizeCounts[currentPrize]++;
            winningHistory.unshift({ ...winner, prizeWon: currentPrize });

            updatePrizeCardsUI();
            updateWinnerHistoryUI();

            isDrawing = false;
            btnStart.disabled = false;
            btnStart.classList.remove('opacity-50');
        }
    }, 100);
}

function updatePrizeCardsUI() {
    let totalDrawnAll = 0;
    Object.keys(prizeConfig).forEach(prize => {
        const count = prizeCounts[prize] || 0;
        totalDrawnAll += count;
        const card = document.getElementById(`prize-card-${prize}`);
        const countSpan = card?.querySelector('.drawn-count');
        if (countSpan) countSpan.textContent = count;
    });

    const totalCounterEl = document.getElementById('total-drawn-counter');
    if (totalCounterEl) totalCounterEl.textContent = `Đã trao: ${totalDrawnAll} / 28 giải`;
}

function updateWinnerHistoryUI() {
    const prizes = ['Giải Bảy', 'Giải Sáu', 'Giải Năm', 'Giải Tư', 'Giải Ba', 'Giải Nhì', 'Giải Nhất'];
    let totalDrawnAll = 0;

    prizes.forEach(prizeName => {
        const winnersOfThisPrize = winningHistory.filter(w => w.prizeWon === prizeName);
        totalDrawnAll += winnersOfThisPrize.length;

        const card = document.getElementById(`history-card-${prizeName}`);
        if (!card) return;

        const slotBadge = card.querySelector('.slot-badge');
        const listContainer = card.querySelector('.winners-list-container');
        const maxSlots = prizeConfig[prizeName].max;

        if (slotBadge) slotBadge.textContent = `${winnersOfThisPrize.length}/${maxSlots} suất`;

        if (listContainer) {
            if (winnersOfThisPrize.length === 0) {
                listContainer.innerHTML = `<div class="text-xs text-slate-400 italic text-center py-4">Chưa có người trúng</div>`;
            } else {
                listContainer.innerHTML = winnersOfThisPrize.map(winner => `
                    <div class="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 text-xs">
                        <div class="min-w-0">
                            <div class="font-bold text-[#2D3748] truncate">${escapeHTML(winner.name)}</div>
                            <div class="text-[10px] text-slate-400 truncate">${escapeHTML(winner.company || '—')}</div>
                        </div>
                        <span class="font-mono font-extrabold text-[#00686B] bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                            ${escapeHTML(winner.code)}
                        </span>
                    </div>
                `).join('');
            }
        }
    });

    const overallCounter = document.getElementById('overall-winner-count');
    if (overallCounter) overallCounter.textContent = `Tổng đã trao: ${totalDrawnAll} / 28 giải`;
}

function resetLuckyDraw() {
    if (isDrawing) return;
    document.getElementById('draw-display-code').textContent = "FAST30-XXXX";
    document.getElementById('draw-winner-name').textContent = "—";
    document.getElementById('draw-winner-company').textContent = "—";
}

// =========================================================================
// 10. ĐIỀU HƯỚNG 3 VIEW (HOME / PROGRAM / LUCKYDRAW), COUNTDOWN & LIGHTBOX
// =========================================================================
const eventTargetDate = new Date('2027-07-10T08:00:00+07:00');
function updateCountdown() {
    const distance = eventTargetDate.getTime() - new Date().getTime();
    if (distance <= 0) return;

    const cdDays = document.getElementById('cd-days');
    if (!cdDays) return;

    cdDays.textContent = String(Math.floor(distance / (1000 * 60 * 60 * 24))).padStart(2, '0');
    document.getElementById('cd-hours').textContent = String(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0');
    document.getElementById('cd-minutes').textContent = String(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    document.getElementById('cd-seconds').textContent = String(Math.floor((distance % (1000 * 60)) / 1000)).padStart(2, '0');
}

function toggleMobileMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-toggle-icon');

    if (isMobileMenuOpen) {
        mobileMenu?.classList.remove('hidden');
        if (menuIcon) {
            menuIcon.setAttribute('data-lucide', 'x');
            menuIcon.classList.add('rotate-90');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    } else {
        closeMobileMenu();
    }
}

function closeMobileMenu() {
    isMobileMenuOpen = false;
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-toggle-icon');
    mobileMenu?.classList.add('hidden');
    if (menuIcon) {
        menuIcon.setAttribute('data-lucide', 'menu');
        menuIcon.classList.remove('rotate-90');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Hàm chuyển đổi giữa 3 màn hình chính: 'home', 'program', 'luckydraw'
function switchPageView(view) {
    currentPageView = view;
    const views = {
        home: document.getElementById('home-view'),
        program: document.getElementById('program-view'),
        luckydraw: document.getElementById('luckydraw-view')
    };

    Object.keys(views).forEach(key => {
        if (views[key]) {
            views[key].classList.toggle('hidden', key !== view);
        }
    });

    const navProgramLink = document.getElementById('nav-link-program');
    const navLuckyDrawLink = document.getElementById('nav-link-luckydraw');

    if (navProgramLink) {
        navProgramLink.classList.toggle('nav-link-active', view === 'program');
    }
    if (navLuckyDrawLink) {
        navLuckyDrawLink.classList.toggle('underline', view === 'luckydraw');
        navLuckyDrawLink.classList.toggle('underline-offset-8', view === 'luckydraw');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function navigateToHomeSection(sectionId) {
    if (currentPageView !== 'home') {
        switchPageView('home');
    }
    setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
}

function selectDetailedDay(dayNum) {
	currentDetailedDay = dayNum;
	const showAllCheckbox = document.getElementById('dp-show-all-days');
	if (showAllCheckbox && showAllCheckbox.checked) {
		showAllCheckbox.checked = false;
	}

	document.querySelectorAll('.dp-day-tab').forEach(tab => {
		tab.classList.remove('bg-[#00979C]', 'text-white', 'shadow-sm');
		tab.classList.add('bg-transparent', 'hover:bg-[#FAF9F6]', 'text-[#2D3748]');
		const titleSpan = tab.querySelector('span:first-child');
		const subSpan = tab.querySelector('span:last-child');
		if (titleSpan) {
			titleSpan.classList.remove('text-white');
			titleSpan.classList.add('text-[#2D3748]');
		}
		if (subSpan) {
			subSpan.classList.remove('text-white/90');
			subSpan.classList.add('text-[#64748B]');
		}
	});

	const activeTab = document.getElementById(`dp-tab-${dayNum}`);
	if (activeTab) {
		activeTab.classList.remove('bg-transparent', 'hover:bg-[#FAF9F6]', 'text-[#2D3748]');
		activeTab.classList.add('bg-[#00979C]', 'text-white', 'shadow-sm');
		const titleSpan = activeTab.querySelector('span:first-child');
		const subSpan = activeTab.querySelector('span:last-child');
		if (titleSpan) {
			titleSpan.classList.remove('text-[#2D3748]');
			titleSpan.classList.add('text-white');
		}
		if (subSpan) {
			subSpan.classList.remove('text-[#64748B]');
			subSpan.classList.add('text-white/90');
		}
	}

	document.querySelectorAll('.dp-day-section').forEach(sec => {
		sec.classList.add('hidden');
		sec.classList.remove('pt-12', 'mt-12', 'border-t-2', 'border-[#00686B]/20');
	});
	const activeSection = document.getElementById(`dp-day-panel-${dayNum}`);
	if (activeSection) activeSection.classList.remove('hidden');
}

function toggleShowAllDetailedDays(checked) {
	if (checked) {
		document.querySelectorAll('.dp-day-section').forEach((sec, idx) => {
			sec.classList.remove('hidden');
			if (idx > 0) {
				sec.classList.add('pt-12', 'mt-12', 'border-t-2', 'border-[#00686B]/20');
			}
		});
	} else {
		selectDetailedDay(currentDetailedDay);
	}
}

// Lightbox Resort
const resortGallery = [
    { src: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=85', title: 'Toàn cảnh không gian Sun Spa Resort Quảng Bình', desc: 'Hồ bơi ngoài trời & Vườn nhiệt đới — Không gian thư giãn xanh mát nằm giữa bán đảo Bảo Ninh.' },
    { src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85', title: 'Bãi biển Bảo Ninh cát trắng mịn', desc: 'Bãi biển riêng của Resort — Địa điểm tổ chức Team Building, Bơi biển & Sunset BBQ.' },
    { src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=85', title: 'Hệ thống Villa & Phòng hướng biển', desc: 'Tiêu chuẩn nghỉ dưỡng 5 sao tiện nghi cho toàn thể đại biểu 3 miền.' },
    { src: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=85', title: 'Trung tâm Hội nghị & Gala Dinner', desc: 'Sảnh tiệc sang trọng Grand Ballroom sức chứa hơn 600 khách mời.' }
];

let isLightboxZoomed = false;
let currentLightboxIndex = 0;

function resetLightboxZoom() {
    isLightboxZoomed = false;
    const img = document.getElementById('lightbox-img');
    const label = document.getElementById('lightbox-zoom-label');
    if (img) {
        img.style.transform = 'scale(1)';
        img.classList.replace('cursor-zoom-out', 'cursor-zoom-in');
    }
    if (label) label.textContent = 'Phóng to 1.8x';
}

function toggleLightboxZoom() {
    const img = document.getElementById('lightbox-img');
    const label = document.getElementById('lightbox-zoom-label');
    if (!img) return;
    isLightboxZoomed = !isLightboxZoomed;
    if (isLightboxZoomed) {
        img.style.transform = 'scale(1.8)';
        img.classList.replace('cursor-zoom-in', 'cursor-zoom-out');
        if (label) label.textContent = 'Thu nhỏ 1.0x';
    } else {
        resetLightboxZoom();
    }
}

function renderLightboxSlide() {
    const item = resortGallery[currentLightboxIndex];
    if (!item) return;
    resetLightboxZoom();
    document.getElementById('lightbox-img').src = item.src;
    const titleEl = document.getElementById('lightbox-title');
    const descEl = document.getElementById('lightbox-desc');
    if (titleEl) titleEl.textContent = item.title;
    if (descEl) descEl.textContent = item.desc;
    document.getElementById('lightbox-counter').textContent = `${currentLightboxIndex + 1} / ${resortGallery.length}`;
}

function openResortLightbox(index) {
    currentLightboxIndex = index || 0;
    renderLightboxSlide();
    document.getElementById('resort-lightbox')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function changeLightboxSlide(step) {
    currentLightboxIndex = (currentLightboxIndex + step + resortGallery.length) % resortGallery.length;
    renderLightboxSlide();
}

function closeResortLightbox() {
    resetLightboxZoom();
    document.getElementById('resort-lightbox')?.classList.add('hidden');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('resort-lightbox');
    if (lb && !lb.classList.contains('hidden')) {
        if (e.key === 'Escape') closeResortLightbox();
        if (e.key === 'ArrowRight') changeLightboxSlide(1);
        if (e.key === 'ArrowLeft') changeLightboxSlide(-1);
    }
});

// =========================================================================
// 11. TOAST, CLIPBOARD, ICS & MODALS
// =========================================================================
let toastTimeout;
function showToast(msg) {
    const box = document.getElementById('toast-box');
    if (!box) return;
    document.getElementById('toast-message').textContent = msg;
    box.classList.remove('translate-y-20', 'opacity-0');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => box.classList.add('translate-y-20', 'opacity-0'), 3400);
}

function copyDelegateCode(code) {
    navigator.clipboard.writeText(code).then(() => showToast(`Đã sao chép mã: ${code}`));
}

function copyRegCode() {
    if (lastCreatedCode) copyDelegateCode(lastCreatedCode);
}

function downloadICS() {
    const icsContent = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FAST Software//FAST 30 Nam//VI', 'BEGIN:VEVENT',
        'UID:fast30-quangbinh-2027@fast.com.vn', 'DTSTAMP:20261116T080000Z',
        'DTSTART:20270710T010000Z', 'DTEND:20270712T100000Z',
        'SUMMARY:FAST 30 Năm (1997–2027) — Vững Nền Tảng, Vươn Tầm Cao',
        'DESCRIPTION:Chương trình kỷ niệm 30 năm thành lập Công ty Phần mềm FAST tại Sun Spa Resort, Bán đảo Bảo Ninh, Đồng Hới, Quảng Bình (10–12/07/2027).',
        'LOCATION:Sun Spa Resort, Bán đảo Bảo Ninh, Đồng Hới, Quảng Bình',
        'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'FAST-30-Nam-Quang-Binh-2027.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Đã tải lịch sự kiện FAST 30 Năm (10–12/07/2027) về thiết bị!');
}

const mockupDetails = {
    polo: { title: 'Áo Polo Đồng Phục FAST 30 Năm', desc: 'Thiết kế riêng cho đại lễ 30 năm với tông xanh Teal chủ đạo của FAST (#00979C), chất liệu vải cá sấu thoáng mát phù hợp khí hậu biển Quảng Bình.', specs: ['<strong>Vị trí Logo:</strong> Logo FAST 30 (1997–2027) nền trắng viền vàng thêu vi tính tại ngực trái.', '<strong>Sau lưng:</strong> In slogan "Am hiểu nghiệp vụ, Tận tâm đồng hành".', '<strong>Kích cỡ:</strong> Đầy đủ từ S, M, L, XL, 2XL đến 3XL.'] },
    badge: { title: 'Thẻ Đại Biểu & Dây Đeo QR', desc: 'Mỗi đại biểu được cấp thẻ định danh cá nhân tích hợp mã QR giúp check-in nhanh và kết nối danh thiếp điện tử.', specs: ['<strong>Chất liệu:</strong> Thẻ nhựa PVC nhám cao cấp kích thước 9cm x 12cm.', '<strong>Dây đeo:</strong> Dây lụa satin xanh Teal in lặp logo FAST 30 Năm.'] },
    stage: { title: 'Backdrop Sân Khấu Chính Gala Dinner', desc: 'Sân khấu chính tại Grand Ballroom Sun Spa Resort tôn vinh hành trình 30 năm vững nền công nghệ.', specs: ['<strong>Màn hình LED:</strong> Panoramic 14m x 5m độ phân giải cao.', '<strong>Thời gian:</strong> 18:00 Chủ Nhật, ngày 11/07/2027.'] },
    flag: { title: 'Banner & Cờ Phướn Đón Khách', desc: 'Bố trí dọc trục đường dẫn vào Sun Spa Resort, sảnh lễ tân và khu vực bãi biển Bảo Ninh.', specs: ['<strong>Quy cách:</strong> Cờ phướn dọc 0.8m x 2.2m in 2 mặt chống gió biển.', '<strong>Nhận diện:</strong> Logo FAST 30 nền trắng viền vàng nổi bật trên nền xanh Teal.'] }
};

function openMockupModal(key) {
    const info = mockupDetails[key];
    if (!info) return;
    document.getElementById('mockup-modal-title').textContent = info.title;
    document.getElementById('mockup-modal-desc').textContent = info.desc;
    document.getElementById('mockup-modal-specs').innerHTML = info.specs.map(s => `<p>• ${s}</p>`).join('');
    document.getElementById('mockup-modal').classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
function closeMockupModal() { document.getElementById('mockup-modal')?.classList.add('hidden'); }

function openRegisterModal() {
    document.getElementById('register-form-view')?.classList.remove('hidden');
    document.getElementById('register-success-view')?.classList.add('hidden');
    document.getElementById('register-modal')?.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
function closeRegisterModal() { document.getElementById('register-modal')?.classList.add('hidden'); }

function openLookupModal() {
    document.getElementById('lookup-modal')?.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
function closeLookupModal() { document.getElementById('lookup-modal')?.classList.add('hidden'); }

function quickLookup(code) {
    document.getElementById('lookup-query').value = code;
    performLookup(code);
}
function handleLookupSubmit(event) {
    event.preventDefault();
    performLookup(document.getElementById('lookup-query').value.trim());
}
function switchToLookupFromSuccess() {
    closeRegisterModal();
    openLookupModal();
    if (lastCreatedCode) quickLookup(lastCreatedCode);
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// =========================================================================
// 12. AUTO SEED DỮ LIỆU MẪU & KHỞI TẠO TRANG
// =========================================================================
const mockFirstNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
const mockMiddleNames = ["Văn", "Thị", "Hữu", "Đức", "Minh", "Gia", "Thành", "Quốc", "Nhật", "Thanh", "Hoài", "Phương", "Bảo"];
const mockLastNames = ["Anh", "Bình", "Cường", "Dũng", "Đạt", "Hà", "Hải", "Hiếu", "Hòa", "Hùng", "Huy", "Khang", "Khoa", "Lâm", "Long", "Nam", "Nghĩa", "Phong", "Phúc", "Quân", "Quang", "Sơn", "Tài", "Tâm", "Thắng", "Thông", "Toàn", "Trang", "Trung", "Tú", "Tuấn", "Việt", "Vinh"];
const mockCompanies = ["Công ty CP Tập đoàn Công nghệ FAST", "Chi nhánh FAST Hà Nội (FHN)", "Chi nhánh FAST Đà Nẵng (FDN)", "Chi nhánh FAST TP.HCM (FSG)", "Ngân hàng TMCP Đầu tư số Việt Nam", "Công ty TNHH Giải pháp Doanh nghiệp Số", "Tập đoàn Bưu chính Viễn thông", "Công ty Cổ phần Thương mại Quốc tế ABC"];
const mockGroups = ["Khách hàng doanh nghiệp", "Đối tác công nghệ / Nhà cung cấp", "CBNV FAST Hà Nội (FHN)", "CBNV FAST Đà Nẵng (FDN)", "CBNV FAST TP.HCM (FSG)"];
const mockTravels = ["Đi cùng đoàn FAST", "Bay đến Đồng Hới (VDH)", "Tự túc phương tiện"];
const mockActivities = ["Gala Dinner & Pickleball 30 Năm", "Gala Dinner & Team Building Bãi Biển", "Tham dự trọn gói tất cả hoạt động", "Gala Dinner & Diễn đàn Công nghệ"];

function autoSeedMockDelegatesIfNeeded() {
    db.ref('delegates').once('value', (snapshot) => {
        const data = snapshot.val();
        const currentCount = data ? Object.keys(data).length : 0;

        if (currentCount < 10) {
            let generatedCodes = new Set();
            while (generatedCodes.size < 128) {
                generatedCodes.add(`FAST30-${Math.floor(1000 + Math.random() * 9000)}`);
            }
            const codeArray = Array.from(generatedCodes);

            for (let i = 0; i < 128; i++) {
                const fName = mockFirstNames[Math.floor(Math.random() * mockFirstNames.length)];
                const mName = mockMiddleNames[Math.floor(Math.random() * mockMiddleNames.length)];
                const lName = mockLastNames[Math.floor(Math.random() * mockLastNames.length)];
                const phone = ['090', '091', '093', '094', '096', '097', '098', '086'][Math.floor(Math.random() * 8)] + Math.floor(1000000 + Math.random() * 9000000);

                db.ref('delegates').push({
                    code: codeArray[i],
                    name: `${fName} ${mName} ${lName}`,
                    company: mockCompanies[Math.floor(Math.random() * mockCompanies.length)],
                    group: mockGroups[Math.floor(Math.random() * mockGroups.length)],
                    role: "Đại biểu tham dự",
                    phone: phone,
                    email: `daibieu.${i + 1}@fast.com.vn`,
                    travel: mockTravels[Math.floor(Math.random() * mockTravels.length)],
                    activity: mockActivities[Math.floor(Math.random() * mockActivities.length)],
                    createdAt: Date.now() - (i * 1000)
                });
            }
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    updateCountdown();
    setInterval(updateCountdown, 1000);
    renderBCD();
    selectPrizeCard('Giải Bảy');
    autoSeedMockDelegatesIfNeeded();
    if (typeof lucide !== 'undefined') lucide.createIcons();
});
// script.js

// CONFIG
const STORAGE_KEY = 'service_tracker_pro_v5';
let state = { entries: [], parties: [] };
let activeFilter = 'all'; 

// --- CONFIGURATION FOR STATUS ---
// FIX: Applied colors to 'cardStyle' so the whole background changes
const STATUS_CONFIG = {
    // 1. REPAIRING (Blue)
    'Collected for Repairing':   { 
        type: 'pending', 
        cardStyle: 'bg-blue-50 border-blue-200', 
        badgeStyle: 'bg-white text-blue-700 border-blue-200',
        icon: 'fa-tools' 
    },
    
    // 2. REFILLING (Purple/Fuchsia) - Distinct from Blue
    'Collected for Refilling':   { 
        type: 'pending', 
        cardStyle: 'bg-fuchsia-50 border-fuchsia-200', 
        badgeStyle: 'bg-white text-fuchsia-700 border-fuchsia-200',
        icon: 'fa-fill-drip' 
    },
    
    // 3. REPLACEMENT (Red/Rose)
    'Collected for Replacement': { 
        type: 'pending', 
        cardStyle: 'bg-rose-50 border-rose-200', 
        badgeStyle: 'bg-white text-rose-700 border-rose-200',
        icon: 'fa-exchange-alt' 
    },
    
    // 4. GENERIC COLLECTED (Gray)
    'Collected':                 { 
        type: 'pending', 
        cardStyle: 'bg-slate-100 border-slate-200', 
        badgeStyle: 'bg-white text-slate-600 border-slate-200',
        icon: 'fa-box' 
    },
    
    // 5. GIVEN / COMPLETED (Green)
    'Given':                     { 
        type: 'closed',  
        cardStyle: 'bg-emerald-50 border-emerald-200', 
        badgeStyle: 'bg-white text-emerald-700 border-emerald-200',
        icon: 'fa-check-circle' 
    },
    
    // 6. GIVEN FOR... (Pending Actions - Orange/Amber)
    'Given for Repairing':       { 
        type: 'pending', 
        cardStyle: 'bg-orange-50 border-orange-200', 
        badgeStyle: 'bg-white text-orange-700 border-orange-200',
        icon: 'fa-shipping-fast' 
    },
    'Given for Refilling':       { 
        type: 'pending', 
        cardStyle: 'bg-amber-50 border-amber-200', 
        badgeStyle: 'bg-white text-amber-700 border-amber-200',
        icon: 'fa-shipping-fast' 
    },
    'Given for Replacement':     { 
        type: 'pending', 
        cardStyle: 'bg-orange-50 border-orange-200', 
        badgeStyle: 'bg-white text-orange-700 border-orange-200',
        icon: 'fa-shipping-fast' 
    },
    
    // 7. STANDBY (Cyan/Teal)
    'Standby Given':             { 
        type: 'pending', 
        cardStyle: 'bg-cyan-50 border-cyan-200', 
        badgeStyle: 'bg-white text-cyan-700 border-cyan-200',
        icon: 'fa-clock' 
    },
    'Standby Collected':         { 
        type: 'closed',  
        cardStyle: 'bg-teal-50 border-teal-200', 
        badgeStyle: 'bg-white text-teal-700 border-teal-200',
        icon: 'fa-check-double' 
    }
};

// --- INIT ---
window.onload = function() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
    loadState();
    renderList();
};

// --- DATA HANDLING ---
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            state = JSON.parse(raw);
        } else {
            // Attempt migration from older versions
            const oldV4 = localStorage.getItem('service_tracker_pro_v4');
            const oldV3 = localStorage.getItem('service_tracker_fixed_v3');
            if (oldV4) state = JSON.parse(oldV4);
            else if(oldV3) migrateV3(JSON.parse(oldV3));
        }
        updatePartyDatalist();
    } catch (e) {
        console.error('Data Load Error', e);
        state = { entries: [], parties: [] };
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updatePartyDatalist();
}

function migrateV3(oldData) {
    if(!oldData.entries) return;
    state.parties = oldData.parties || [];
    state.entries = oldData.entries.map(e => {
        let newStatus = 'Collected';
        if(e.status === 'closed') newStatus = 'Given';
        else {
            if(e.jobType === 'repair') newStatus = 'Collected for Repairing';
            else if(e.jobType === 'standby') newStatus = 'Standby Given';
            else if(e.jobType === 'sale') newStatus = 'Given'; 
        }
        return {
            id: e.id,
            party: e.party,
            item: e.item,
            qty: e.qty,
            notes: e.notes,
            status: newStatus,
            timestamp: e.timestamp || Date.now()
        };
    });
    saveState();
}

// --- MODAL & FORM ---
function openModal(editId = null) {
    const modal = document.getElementById('formModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('entryForm');
    const editInput = document.getElementById('editId');
    const saveBtn = document.getElementById('saveBtn');

    modal.classList.add('open');

    if(editId) {
        const entry = state.entries.find(e => e.id === editId);
        if(!entry) return closeModal();

        title.innerText = 'Edit Entry';
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Update Record';
        
        editInput.value = entry.id;
        document.getElementById('partyInput').value = entry.party;
        document.getElementById('itemInput').value = entry.item;
        document.getElementById('qtyInput').value = entry.qty;
        document.getElementById('statusInput').value = entry.status;
        document.getElementById('notesInput').value = entry.notes || '';
    } else {
        title.innerText = 'New Entry';
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Record';
        form.reset();
        editInput.value = '';
        document.getElementById('qtyInput').value = 1;
        document.getElementById('statusInput').selectedIndex = 0;
        setTimeout(() => document.getElementById('partyInput').focus(), 100);
    }
}

function closeModal() {
    document.getElementById('formModal').classList.remove('open');
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const editId = document.getElementById('editId').value;
    const partyName = document.getElementById('partyInput').value.trim();
    const itemName = document.getElementById('itemInput').value.trim();
    
    if(!partyName || !itemName) {
        alert('Party Name and Item Name are required');
        return;
    }

    const formData = {
        party: partyName,
        item: itemName,
        qty: document.getElementById('qtyInput').value,
        status: document.getElementById('statusInput').value,
        notes: document.getElementById('notesInput').value.trim(),
        timestamp: Date.now()
    };

    if(editId) {
        const index = state.entries.findIndex(x => x.id === editId);
        if(index !== -1) {
            state.entries[index] = { ...state.entries[index], ...formData };
            state.entries[index].timestamp = Date.now(); 
        }
    } else {
        const newEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            ...formData
        };
        state.entries.unshift(newEntry);
    }

    if(!state.parties.includes(partyName)) state.parties.push(partyName);

    saveState();
    closeModal();
    renderList();
}

// --- VIEW LOGIC ---
function setFilter(filterType) {
    activeFilter = filterType;
    document.getElementById('btnFilterAll').classList.toggle('active', filterType === 'all');
    document.getElementById('btnFilterPending').classList.toggle('active', filterType === 'pending');
    document.getElementById('btnFilterClosed').classList.toggle('active', filterType === 'closed');
    renderList();
}

function renderList() {
    const list = document.getElementById('mainList');
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase();

    list.innerHTML = '';

    const filtered = state.entries.filter(e => {
        const textMatch = (e.party + ' ' + e.item + ' ' + (e.notes||'')).toLowerCase().includes(searchTerm);
        if(!textMatch) return false;

        const config = STATUS_CONFIG[e.status] || { type: 'pending' };
        if(activeFilter === 'pending') return config.type === 'pending';
        if(activeFilter === 'closed') return config.type === 'closed';
        return true; 
    });

    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if(filtered.length === 0) {
        document.getElementById('emptyState').classList.remove('hidden');
    } else {
        document.getElementById('emptyState').classList.add('hidden');
        filtered.forEach(entry => {
            list.insertAdjacentHTML('beforeend', createCard(entry));
        });
    }
}

function createCard(e) {
    // Default Fallback
    const defaultConfig = { 
        type: 'pending', 
        cardStyle: 'bg-slate-50 border-slate-200', 
        badgeStyle: 'bg-white text-slate-600', 
        icon: 'fa-circle' 
    };
    
    const config = STATUS_CONFIG[e.status] || defaultConfig;
    const dateStr = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // HTML Structure
    // 1. Outer Div: Uses config.cardStyle for full background color
    // 2. Inner Item Box: Uses bg-white/80 to stand out against the color
    return `
    <div class="card-entry ${config.cardStyle} p-5 rounded-3xl border shadow-sm mb-4 relative">
        <div class="flex justify-between items-start mb-2">
            <div>
                <h3 class="font-extrabold text-lg text-slate-800 leading-tight">${escapeHtml(e.party)}</h3>
                <div class="text-[11px] font-bold text-slate-400 uppercase mt-1 tracking-wide">${dateStr}</div>
            </div>
            
            <div class="flex flex-col items-end gap-2">
                <span class="text-xl font-black text-slate-900 mb-1">x${e.qty}</span>
                
                <div class="flex flex-col gap-2">
                    <button onclick="openModal('${e.id}')" class="text-xs font-bold text-blue-600 bg-white/80 px-3 py-1.5 rounded-lg active:scale-95 border border-blue-100 shadow-sm transition-all w-20 text-center">
                        <i class="fas fa-pen mr-1"></i> Edit
                    </button>

                    <button onclick="deleteEntry('${e.id}')" class="text-xs font-bold text-red-500 bg-white/80 px-3 py-1.5 rounded-lg active:scale-95 border border-red-100 shadow-sm transition-all w-20 text-center">
                        <i class="fas fa-trash mr-1"></i> Delete
                    </button>
                </div>
            </div>
        </div>

        <div class="bg-white p-3.5 rounded-2xl mb-3 border border-white/50 shadow-sm">
            <div class="text-sm font-bold text-slate-700 leading-snug">${escapeHtml(e.item)}</div>
            ${e.notes ? `<div class="text-xs text-slate-500 mt-1.5 italic border-t border-slate-100 pt-1.5">"${escapeHtml(e.notes)}"</div>` : ''}
        </div>

        <div class="flex items-center justify-between mt-2">
            <div class="status-badge border ${config.badgeStyle}">
                <i class="fas ${config.icon}"></i> ${e.status}
            </div>
        </div>
    </div>
    `;
}

function deleteEntry(id) {
    if(confirm('Permanently delete this record?')) {
        state.entries = state.entries.filter(e => e.id !== id);
        saveState();
        renderList();
    }
}

function updatePartyDatalist() {
    const dl = document.getElementById('partyList');
    if(!dl) return;
    dl.innerHTML = '';
    state.parties.sort().forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        dl.appendChild(opt);
    });
}

function escapeHtml(text) {
    if(!text) return '';
    return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

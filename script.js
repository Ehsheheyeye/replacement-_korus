// script.js

// CONFIG
const STORAGE_KEY = 'service_tracker_pro_v4'; // New key for fresh structure
let state = { entries: [], parties: [] };
let activeFilter = 'all'; // Default: Show everything

// --- CONFIGURATION FOR STATUS ---
// This map decides color and logic for each status
const STATUS_CONFIG = {
    'Collected for Repairing':   { type: 'pending', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'fa-tools' },
    'Collected for Refilling':   { type: 'pending', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'fa-fill-drip' },
    'Collected for Replacement': { type: 'pending', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'fa-exchange-alt' },
    'Collected':                 { type: 'pending', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'fa-box' },
    
    'Given':                     { type: 'closed',  color: 'bg-green-50 text-green-700 border-green-100', icon: 'fa-check-circle' },
    
    'Given for Repairing':       { type: 'pending', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'fa-shipping-fast' },
    'Given for Refilling':       { type: 'pending', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'fa-shipping-fast' },
    'Given for Replacement':     { type: 'pending', color: 'bg-red-50 text-red-700 border-red-100', icon: 'fa-shipping-fast' },
    
    'Standby Given':             { type: 'pending', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'fa-clock' },
    'Standby Collected':         { type: 'closed',  color: 'bg-teal-50 text-teal-700 border-teal-100', icon: 'fa-check-double' }
};

// --- INIT ---
window.onload = function() {
    // Date Header
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
            // Attempt to migrate from V3 or V1 if exists
            const oldV3 = localStorage.getItem('service_tracker_fixed_v3');
            if(oldV3) migrateV3(JSON.parse(oldV3));
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

// Migration to preserve your client's old data
function migrateV3(oldData) {
    if(!oldData.entries) return;
    state.parties = oldData.parties || [];
    
    state.entries = oldData.entries.map(e => {
        let newStatus = 'Collected'; // Default fallback
        
        // Map old logic to new dropdowns
        if(e.status === 'closed') {
            newStatus = 'Given';
        } else {
            // It is pending
            if(e.jobType === 'repair') newStatus = 'Collected for Repairing';
            else if(e.jobType === 'standby') newStatus = 'Standby Given';
            else if(e.jobType === 'sale') newStatus = 'Given'; // Should be closed
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
        // EDIT MODE
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
        // NEW MODE
        title.innerText = 'New Entry';
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Record';
        form.reset();
        editInput.value = '';
        document.getElementById('qtyInput').value = 1;
        document.getElementById('statusInput').selectedIndex = 0; // Default to first
        
        // Auto-focus logic
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
        // UPDATE EXISTING
        const index = state.entries.findIndex(x => x.id === editId);
        if(index !== -1) {
            state.entries[index] = { ...state.entries[index], ...formData }; // Keep original ID/Timestamp usually, but user might want to bump time? Let's keep original ID.
            state.entries[index].timestamp = Date.now(); // Bump to top
        }
    } else {
        // CREATE NEW
        const newEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            ...formData
        };
        state.entries.unshift(newEntry);
    }

    // Update Party List
    if(!state.parties.includes(partyName)) state.parties.push(partyName);

    saveState();
    closeModal();
    renderList();
}

// --- VIEW LOGIC ---
function setFilter(filterType) {
    activeFilter = filterType;
    
    // Update buttons
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

    // Filter Logic
    const filtered = state.entries.filter(e => {
        // 1. Text Search
        const textMatch = (e.party + ' ' + e.item + ' ' + (e.notes||'')).toLowerCase().includes(searchTerm);
        if(!textMatch) return false;

        // 2. Tab Filter
        const config = STATUS_CONFIG[e.status] || { type: 'pending' };
        if(activeFilter === 'pending') return config.type === 'pending';
        if(activeFilter === 'closed') return config.type === 'closed';
        return true; // 'all'
    });

    // Sort: Always Newest First
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Empty State
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
    const config = STATUS_CONFIG[e.status] || { type: 'pending', color: 'bg-gray-100 text-gray-600', icon: 'fa-circle' };
    
    // Format Date
    const dateStr = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
    <div class="card-entry bg-white p-5 rounded-3xl border border-slate-100 shadow-sm mb-4 relative">
        <div class="flex justify-between items-start mb-2">
            <div>
                <h3 class="font-extrabold text-lg text-slate-800 leading-tight">${escapeHtml(e.party)}</h3>
                <div class="text-[11px] font-bold text-slate-400 uppercase mt-1 tracking-wide">${dateStr}</div>
            </div>
            <div class="flex flex-col items-end gap-2">
                <span class="text-xl font-black text-slate-900">x${e.qty}</span>
                <button onclick="openModal('${e.id}')" class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg active:bg-blue-100">
                    <i class="fas fa-pen mr-1"></i> Edit
                </button>
            </div>
        </div>

        <div class="bg-slate-50 p-3.5 rounded-2xl mb-3 border border-slate-100/50">
            <div class="text-sm font-bold text-slate-700 leading-snug">${escapeHtml(e.item)}</div>
            ${e.notes ? `<div class="text-xs text-slate-500 mt-1.5 italic border-t border-slate-200 pt-1.5">"${escapeHtml(e.notes)}"</div>` : ''}
        </div>

        <div class="flex items-center justify-between mt-2">
            <div class="status-badge border ${config.color}">
                <i class="fas ${config.icon}"></i> ${e.status}
            </div>
            
            ${config.type === 'closed' 
                ? `<button onclick="deleteEntry('${e.id}')" class="text-slate-300 hover:text-red-500 transition-colors p-2"><i class="fas fa-trash"></i></button>`
                : ''
            }
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

// --- UTILS ---
function updatePartyDatalist() {
    const dl = document.getElementById('partyList');
    if(!dl) return;
    dl.innerHTML = '';
    // Sort Alphabetically
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

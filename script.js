// script.js

// CONFIG
const STORAGE_KEY = 'service_tracker_fixed_v3';
let state = { entries: [], parties: [] };
let currentFilter = 'pending';

// --- INIT ---
window.onload = function() {
    // Set Date
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
    
    // Load Data
    loadState();
    renderList();
};

// --- MODAL FUNCTIONS ---
function openModal() {
    const modal = document.getElementById('formModal');
    modal.classList.add('open');
    // Focus input after animation
    setTimeout(() => {
        const input = document.getElementById('partyInput');
        if(input) input.focus();
    }, 100);
}

function closeModal() {
    const modal = document.getElementById('formModal');
    modal.classList.remove('open');
}

// --- DATA LOGIC ---
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            state = JSON.parse(raw);
        } else {
            // Try to recover data from older versions if this is a new file
            const oldV1 = localStorage.getItem('inventory_premium_v1');
            if (oldV1) migrateData(JSON.parse(oldV1));
        }
        updatePartyDatalist();
    } catch (e) {
        console.log('Data error', e);
        state = { entries: [], parties: [] };
    }
}

function migrateData(oldState) {
    if(!oldState.entries) return;
    state.parties = oldState.parties || [];
    
    state.entries = oldState.entries.map(e => {
        let job = 'sale';
        let status = 'closed';
        let step = 'done';
        const isPending = (e.status === 'Open' || e.status === 'Pending');

        if (e.action && e.action.includes('Given')) {
            job = 'standby';
            if(isPending) { status = 'pending'; step = 'to_collect'; }
        } else if (e.action && (e.action.includes('Collected') || e.action.includes('Repair'))) {
            job = 'repair';
            if(isPending) { status = 'pending'; step = 'to_return'; }
        }
        
        return {
            id: e.id, party: e.party, item: e.item, qty: e.qty, notes: e.notes,
            jobType: job, status: status, actionStep: step, timestamp: e.timestamp || Date.now()
        };
    });
    saveState();
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updatePartyDatalist();
}

// --- FORM HANDLING ---
function handleFormSubmit(e) {
    e.preventDefault();
    
    const radio = document.querySelector('input[name="jobType"]:checked');
    if(!radio) {
        alert('Please select a Job Type');
        return;
    }

    const data = {
        party: document.getElementById('partyInput').value.trim(),
        item: document.getElementById('itemInput').value.trim(),
        qty: document.getElementById('qtyInput').value,
        notes: document.getElementById('notesInput').value.trim(),
        jobType: radio.value
    };

    if(!data.party || !data.item) {
        alert('Party Name and Item Name are required');
        return;
    }

    // SMART STATUS LOGIC
    let status = 'closed';
    let step = 'done';

    if (data.jobType === 'repair') {
        status = 'pending'; // Need to return it
        step = 'to_return';
    } else if (data.jobType === 'standby') {
        status = 'pending'; // Need to collect it
        step = 'to_collect';
    }

    const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        ...data, status, actionStep: step, timestamp: Date.now()
    };

    // Add Party to memory
    if(!state.parties.includes(data.party)) state.parties.push(data.party);

    state.entries.unshift(entry);
    saveState();
    
    // Reset & Close
    e.target.reset();
    document.getElementById('qtyInput').value = '1';
    // Default back to repair
    const repairRadio = document.querySelectorAll('input[name="jobType"]')[0];
    if(repairRadio) repairRadio.checked = true;
    
    closeModal();
    renderList();
}

// --- CARD ACTIONS ---
function markDone(id) {
    const entry = state.entries.find(e => e.id === id);
    if(entry) {
        if(confirm('Is this job fully completed?')) {
            entry.status = 'closed';
            entry.actionStep = 'done';
            saveState();
            renderList();
        }
    }
}

function deleteEntry(id) {
    if(confirm('Delete this entry permanently?')) {
        state.entries = state.entries.filter(e => e.id !== id);
        saveState();
        renderList();
    }
}

// --- VIEW LOGIC ---
function switchTab(tab) {
    currentFilter = tab;
    
    const tabP = document.getElementById('tabPending');
    const tabH = document.getElementById('tabHistory');
    
    if(tabP) tabP.classList.toggle('active', tab === 'pending');
    if(tabH) tabH.classList.toggle('active', tab === 'history');
    
    renderList();
}

function renderList() {
    const list = document.getElementById('mainList');
    const searchInput = document.getElementById('searchInput');
    
    if(!list || !searchInput) return;

    const search = searchInput.value.toLowerCase();
    list.innerHTML = '';

    const filtered = state.entries.filter(e => {
        const match = (e.party + e.item + (e.notes || '')).toLowerCase().includes(search);
        if(!match) return false;
        if(currentFilter === 'pending') return e.status === 'pending';
        if(currentFilter === 'history') return e.status === 'closed';
        return true;
    });

    // Sort (Pending: Oldest First / History: Newest First)
    filtered.sort((a, b) => currentFilter === 'pending' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);

    if(filtered.length === 0) {
        document.getElementById('emptyState').classList.remove('hidden');
    } else {
        document.getElementById('emptyState').classList.add('hidden');
        filtered.forEach(e => list.insertAdjacentHTML('beforeend', getCardHTML(e)));
    }
}

function getCardHTML(e) {
    let icon = '', badge = '', btn = '';
    
    if(e.status === 'pending') {
        if(e.actionStep === 'to_return') {
            // REPAIR CARD
            icon = `<div class="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><i class="fas fa-tools"></i></div>`;
            badge = `<span class="badge bg-blue-50 text-blue-700">Repairing</span>`;
            btn = `<button onclick="markDone('${e.id}')" class="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform flex items-center justify-center gap-2"><i class="fas fa-check"></i> Mark Returned</button>`;
        } else {
            // STANDBY CARD
            icon = `<div class="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><i class="fas fa-hand-holding"></i></div>`;
            badge = `<span class="badge bg-orange-50 text-orange-700">Standby</span>`;
            btn = `<button onclick="markDone('${e.id}')" class="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-300 active:scale-95 transition-transform flex items-center justify-center gap-2"><i class="fas fa-box-open"></i> Collected Back</button>`;
        }
    } else {
        // HISTORY CARD
        icon = `<div class="h-10 w-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center"><i class="fas fa-check"></i></div>`;
        badge = `<span class="badge bg-slate-100 text-slate-500">Done</span>`;
        btn = `<button onclick="deleteEntry('${e.id}')" class="flex-1 py-2.5 border border-red-100 text-red-500 rounded-xl font-bold hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-2"><i class="fas fa-trash"></i> Delete</button>`;
    }

    return `
    <div class="card-entry bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-3">
        <div class="flex justify-between items-start mb-3">
            <div class="flex items-center gap-3">
                ${icon}
                <div>
                    <h3 class="font-bold text-lg text-slate-800 leading-tight">${escapeHtml(e.party)}</h3>
                    <div class="text-[11px] font-bold text-slate-400 uppercase mt-0.5">${new Date(e.timestamp).toLocaleDateString()}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="text-xl font-bold text-slate-800">x${e.qty}</div>
                ${badge}
            </div>
        </div>
        <div class="bg-slate-50 p-3 rounded-xl mb-3 border border-slate-100">
            <div class="text-sm font-bold text-slate-700">${escapeHtml(e.item)}</div>
            ${e.notes ? `<div class="text-xs text-slate-500 mt-1 italic">"${escapeHtml(e.notes)}"</div>` : ''}
        </div>
        <div class="flex">${btn}</div>
    </div>`;
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
    return text ? text.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
}

/* script.js */

const STORAGE_KEY = 'tracker_pro_v1';

// --- STATE MANAGEMENT ---
let state = {
    entries: [],
    parties: [] // Auto-learned list of party names
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    
    // Set Date
    const dateOpts = { weekday: 'long', day: 'numeric', month: 'short' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', dateOpts);

    renderList();
    setupEventListeners();
});

// --- CORE LOGIC ---

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        state = JSON.parse(raw);
    }
    // Sort parties alphabetically for suggestions
    state.parties.sort();
    updatePartyDatalist();
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updatePartyDatalist();
}

function addEntry(data) {
    const id = Date.now().toString(36);
    
    let status = 'closed';
    let actionStep = 'done'; // What needs to happen next?

    // LOGIC: What is the status based on Job Type?
    if (data.jobType === 'repair') {
        // I Collected it -> Pending: I need to Return it
        status = 'pending';
        actionStep = 'to_return'; 
    } else if (data.jobType === 'standby') {
        // I Gave it -> Pending: I need to Collect it back
        status = 'pending';
        actionStep = 'to_collect';
    } else {
        // Sale/Delivery -> Done immediately
        status = 'closed';
        actionStep = 'done';
    }

    const newEntry = {
        id,
        party: data.party,
        item: data.item,
        qty: data.qty,
        notes: data.notes,
        jobType: data.jobType, // repair, standby, sale
        status: status,        // pending, closed
        actionStep: actionStep, // to_return, to_collect, done
        timestamp: Date.now(),
        history: [{ action: 'Created', date: new Date().toLocaleString() }]
    };

    // Learn Party Name
    if (!state.parties.includes(data.party)) {
        state.parties.push(data.party);
    }

    state.entries.unshift(newEntry);
    saveState();
    renderList();
    toggleModal(false);
}

function updateEntryStatus(id, newAction) {
    const entry = state.entries.find(e => e.id === id);
    if (!entry) return;

    if (newAction === 'mark_done') {
        entry.status = 'closed';
        entry.actionStep = 'done';
    } 
    else if (newAction === 'delete') {
        if(!confirm('Delete this permanently?')) return;
        state.entries = state.entries.filter(e => e.id !== id);
    }

    saveState();
    renderList();
}

// --- DOM & RENDERING ---

const mainList = document.getElementById('mainList');
const searchInput = document.getElementById('searchInput');
let currentFilter = 'pending'; // 'pending' or 'history'

function renderList() {
    const term = searchInput.value.toLowerCase();
    mainList.innerHTML = '';
    
    const filtered = state.entries.filter(e => {
        // 1. Filter by Tab
        if (currentFilter === 'pending' && e.status !== 'pending') return false;
        if (currentFilter === 'history' && e.status !== 'closed') return false;

        // 2. Filter by Search
        const text = `${e.party} ${e.item} ${e.notes}`.toLowerCase();
        return text.includes(term);
    });

    // Sort: Pending items, oldest first (urgent). History items, newest first.
    filtered.sort((a, b) => {
        if (currentFilter === 'pending') return a.timestamp - b.timestamp;
        return b.timestamp - a.timestamp;
    });

    if (filtered.length === 0) {
        document.getElementById('emptyState').classList.remove('hidden');
    } else {
        document.getElementById('emptyState').classList.add('hidden');
        filtered.forEach(entry => {
            mainList.insertAdjacentHTML('beforeend', createCard(entry));
        });
    }
}

function createCard(entry) {
    let badge = '';
    let actionBtn = '';
    let iconBg = 'bg-gray-100 text-gray-500';

    // VISUAL LOGIC
    if (entry.status === 'pending') {
        if (entry.actionStep === 'to_return') {
            // REPAIR CASE
            iconBg = 'bg-indigo-100 text-indigo-600';
            badge = `<div class="status-badge bg-indigo-50 text-indigo-700"><i class="fas fa-tools"></i> Repairing</div>`;
            actionBtn = `
                <button onclick="updateEntryStatus('${entry.id}', 'mark_done')" class="action-btn bg-indigo-600 text-white shadow-lg shadow-indigo-200 flex-1 active:scale-95">
                    <i class="fas fa-check"></i> Mark Returned
                </button>`;
        } else if (entry.actionStep === 'to_collect') {
            // STANDBY CASE
            iconBg = 'bg-orange-100 text-orange-600';
            badge = `<div class="status-badge bg-orange-50 text-orange-700"><i class="fas fa-hand-holding-hand"></i> On Standby</div>`;
            actionBtn = `
                <button onclick="updateEntryStatus('${entry.id}', 'mark_done')" class="action-btn bg-black text-white shadow-lg shadow-gray-300 flex-1 active:scale-95">
                    <i class="fas fa-box-open"></i> Collected Back
                </button>`;
        }
    } else {
        // CLOSED
        iconBg = 'bg-green-100 text-green-600';
        badge = `<div class="status-badge bg-gray-100 text-gray-500">Done</div>`;
        actionBtn = `
            <button onclick="updateEntryStatus('${entry.id}', 'delete')" class="action-btn bg-white border border-red-100 text-red-400 hover:bg-red-50 flex-1">
                <i class="fas fa-trash"></i> Delete
            </button>`;
    }

    return `
    <div class="card-entry animate-[fadeIn_0.3s_ease]">
        <div class="flex justify-between items-start mb-2">
            <div class="flex items-center gap-3">
                <div class="h-10 w-10 rounded-full ${iconBg} flex items-center justify-center text-lg">
                    <i class="fas ${entry.jobType === 'sale' ? 'fa-box' : (entry.jobType === 'repair' ? 'fa-wrench' : 'fa-clock')}"></i>
                </div>
                <div>
                    <h3 class="font-bold text-gray-900 text-lg leading-tight">${entry.party}</h3>
                    <p class="text-xs text-gray-400 font-medium">${new Date(entry.timestamp).toLocaleDateString()}</p>
                </div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <span class="text-xl font-bold text-gray-800">x${entry.qty}</span>
                ${badge}
            </div>
        </div>

        <div class="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100">
            <p class="text-sm font-semibold text-gray-700">${entry.item}</p>
            ${entry.notes ? `<p class="text-xs text-gray-500 mt-1 italic">"${entry.notes}"</p>` : ''}
        </div>

        <div class="flex gap-2">
            ${actionBtn}
        </div>
    </div>
    `;
}

// --- EVENT LISTENERS ---

function setupEventListeners() {
    // FAB
    document.getElementById('fabBtn').addEventListener('click', () => toggleModal(true));
    document.getElementById('closeForm').addEventListener('click', () => toggleModal(false));
    
    // Filter Tabs
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active'); // Use currentTarget to hit the button, not span
            currentFilter = e.currentTarget.dataset.filter;
            renderList();
        });
    });

    // Search
    searchInput.addEventListener('input', renderList);

    // Form Submit
    document.getElementById('entryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            party: document.getElementById('partyInput').value.trim(),
            item: document.getElementById('itemInput').value.trim(),
            qty: document.getElementById('qtyInput').value,
            notes: document.getElementById('notesInput').value.trim(),
            jobType: document.querySelector('input[name="jobType"]:checked').value
        };
        addEntry(data);
        e.target.reset();
        document.getElementById('qtyInput').value = 1;
    });
}

function toggleModal(show) {
    const modal = document.getElementById('formModal');
    if (show) {
        modal.classList.remove('hidden');
        // Small delay to allow display:block to apply before opacity transition
        setTimeout(() => modal.classList.add('modal-active'), 10);
        document.getElementById('partyInput').focus();
    } else {
        modal.classList.remove('modal-active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

function updatePartyDatalist() {
    const dl = document.getElementById('partyList');
    dl.innerHTML = '';
    state.parties.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        dl.appendChild(opt);
    });
}

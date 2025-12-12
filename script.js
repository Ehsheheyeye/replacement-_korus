/* script.js */

// ============ CONFIG ============
const STORAGE_KEY = 'inventory_premium_v1';

// ============ STATE ============
function getDefaultState() {
    return {
        entries: [],
        parties: [] 
    };
}

function loadState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : getDefaultState();
    } catch {
        return getDefaultState();
    }
}

function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

let state = loadState();
let currentFilter = 'all'; // 'all', 'Open', 'Closed', 'Collected', 'Given'
let showClosedHistory = false; // Toggle for history view

// ============ DOM ============
const listView = document.getElementById('listView');
const formView = document.getElementById('formView');
const entriesList = document.getElementById('entriesList');
const searchInput = document.getElementById('searchInput');
const headerDate = document.getElementById('headerDate');
const partyDatalist = document.getElementById('partyList');

// Form
const entryForm = document.getElementById('entryForm');
const formTitle = document.getElementById('formTitle');
const cancelBtn = document.getElementById('cancelBtn');

// ============ INIT ============
function init() {
    // Set Header Date
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    headerDate.textContent = new Date().toLocaleDateString('en-US', options);

    // Default Form Date
    document.getElementById('entryDate').valueAsDate = new Date();

    updatePartyDatalist();
    renderList();
    attachEvents();
}

function attachEvents() {
    // Nav Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            
            // Handle History Toggle
            if (target === 'historyView') {
                showClosedHistory = true;
                currentFilter = 'Closed'; // Force filter
                switchView('listView'); // Reuse list view but with filtered data
                updateNavState('historyView');
                renderList();
            } 
            else if (target === 'listView') {
                showClosedHistory = false;
                currentFilter = 'all';
                switchView('listView');
                updateNavState('listView');
                renderList();
            } 
            else {
                showClosedHistory = false;
                switchView(target);
                updateNavState(target);
            }
        });
    });

    // Filter Chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            showClosedHistory = false; // Reset history mode if clicking chips
            renderList();
        });
    });

    // Form
    entryForm.addEventListener('submit', handleFormSubmit);
    cancelBtn.addEventListener('click', () => {
        switchView('listView');
        updateNavState('listView');
    });

    // Search
    searchInput.addEventListener('input', renderList);

    // Card Actions (Delegation)
    entriesList.addEventListener('click', handleCardActions);
}

// ============ VIEW LOGIC ============
function switchView(viewName) {
    if (viewName === 'listView') {
        listView.classList.remove('hidden');
        formView.classList.add('hidden');
    } else {
        listView.classList.add('hidden');
        formView.classList.remove('hidden');
        document.getElementById('party').focus();
    }
}

function updateNavState(activeTarget) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.target === activeTarget) {
            btn.classList.add('active');
            // Specific styling for icons based on state
            const icon = btn.querySelector('.icon-container');
            if(icon) icon.classList.remove('text-slate-400');
        } else {
            btn.classList.remove('active');
            const icon = btn.querySelector('.icon-container');
            if(icon) icon.classList.add('text-slate-400');
        }
    });
}

// ============ CORE FUNCTIONS ============

function handleFormSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('editId').value;
    const party = document.getElementById('party').value.trim();
    
    // Status Logic: If Action is Pending/Given/Collected -> Open.
    const action = document.getElementById('action').value;
    const status = 'Open'; // Always open initially unless manually closed later

    const entry = {
        id: editId || generateId(),
        party: party,
        item: document.getElementById('item').value.trim(),
        qty: document.getElementById('qty').value,
        action: action,
        status: status,
        date: document.getElementById('entryDate').value,
        notes: document.getElementById('notes').value.trim(),
        timestamp: Date.now() // for sorting
    };

    learnParty(party);

    if (editId) {
        const idx = state.entries.findIndex(x => x.id === editId);
        if (idx > -1) state.entries[idx] = entry;
    } else {
        state.entries.unshift(entry);
    }

    saveState(state);
    resetForm();
    switchView('listView');
    updateNavState('listView');
    renderList();
}

function handleCardActions(e) {
    const btn = e.target.closest('button');
    if (!btn || !btn.dataset.action) return;
    
    const id = btn.dataset.id;
    const entry = state.entries.find(x => x.id === id);
    if (!entry) return;

    const actionType = btn.dataset.action;

    // --- SMART LOGIC ---
    if (actionType === 'return') {
        // "I collected it, now I'm returning it"
        if(confirm(`Mark "${entry.item}" as Returned to ${entry.party}?`)) {
            entry.status = 'Closed';
            entry.action = 'Returned'; // Update action history
            saveState(state);
            renderList();
        }
    } 
    else if (actionType === 'receive') {
        // "I gave it, now I'm receiving it back"
        if(confirm(`Mark "${entry.item}" as Received back from ${entry.party}?`)) {
            entry.status = 'Closed';
            entry.action = 'Received Back'; // Update action history
            saveState(state);
            renderList();
        }
    }
    else if (actionType === 'close') {
        // Just close it (keep it or done)
        entry.status = 'Closed';
        saveState(state);
        renderList();
    }
    else if (actionType === 'edit') {
        populateForm(entry);
    }
    else if (actionType === 'delete') {
        if(confirm('Delete this entry permanently?')) {
            state.entries = state.entries.filter(x => x.id !== id);
            saveState(state);
            renderList();
        }
    }
}

// ============ RENDERING ============

function renderList() {
    const term = searchInput.value.toLowerCase();
    
    // Filtering Logic
    let filtered = state.entries.filter(e => {
        // 1. Text Search
        const textMatch = (e.party + e.item + e.notes).toLowerCase().includes(term);
        if (!textMatch) return false;

        // 2. Tab/Filter Logic
        if (showClosedHistory) {
            return e.status === 'Closed';
        } else {
            // Main List: Show Open items
            if (e.status === 'Closed') return false;
            // Chip Filter
            if (currentFilter !== 'all' && currentFilter !== 'Open' && e.action !== currentFilter) return false;
            return true;
        }
    });

    // Sort by newest
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const container = entriesList;
    container.innerHTML = '';

    if (filtered.length === 0) {
        document.getElementById('noResults').classList.remove('hidden');
        return;
    }
    document.getElementById('noResults').classList.add('hidden');

    filtered.forEach(entry => {
        const html = createCardHtml(entry);
        container.insertAdjacentHTML('beforeend', html);
    });
}

function createCardHtml(entry) {
    const isClosed = entry.status === 'Closed';
    
    // Badge Colors
    let badgeClass = 'bg-slate-100 text-slate-600';
    let icon = 'fa-circle';
    
    if (entry.action === 'Given') { badgeClass = 'bg-orange-100 text-orange-700'; icon = 'fa-arrow-right'; }
    else if (entry.action === 'Collected') { badgeClass = 'bg-green-100 text-green-700'; icon = 'fa-arrow-left'; }
    else if (entry.action === 'Pending') { badgeClass = 'bg-blue-50 text-blue-600'; icon = 'fa-clock'; }
    
    if (isClosed) { badgeClass = 'bg-gray-100 text-gray-400 line-through'; }

    // Smart Buttons Logic
    let buttonsHtml = '';
    
    if (!isClosed) {
        // Scenario 1: I Gave it -> Need to Receive Back
        if (entry.action === 'Given' || entry.action === 'Sent for Repair') {
            buttonsHtml = `
                <button data-action="receive" data-id="${entry.id}" class="flex-1 py-2 px-3 bg-white border border-slate-200 shadow-sm rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                    <i class="fas fa-undo text-blue-500"></i> Receive Back
                </button>
            `;
        } 
        // Scenario 2: I Collected it -> Need to Return it
        else if (entry.action === 'Collected' || entry.action === 'Collected for Refill') {
            buttonsHtml = `
                <button data-action="return" data-id="${entry.id}" class="flex-1 py-2 px-3 bg-white border border-slate-200 shadow-sm rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                    <i class="fas fa-reply text-orange-500"></i> Return Item
                </button>
                <button data-action="close" data-id="${entry.id}" class="py-2 px-3 bg-slate-100 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-200" title="Keep it / Done">
                    Keep
                </button>
            `;
        }
        // Scenario 3: Pending / General -> Just Mark Done
        else {
            buttonsHtml = `
                <button data-action="close" data-id="${entry.id}" class="flex-1 py-2 px-3 bg-blue-600 shadow-md shadow-blue-200 rounded-xl text-xs font-bold text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                    <i class="fas fa-check"></i> Mark Done
                </button>
            `;
        }
    }

    return `
    <div class="entry-card bg-white rounded-3xl p-5 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] border border-slate-100 relative group animate-[fadeIn_0.3s_ease-out]">
        
        <div class="flex justify-between items-start mb-3">
            <div>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass} mb-2">
                    <i class="fas ${icon} text-[10px]"></i> ${entry.action}
                </span>
                <h3 class="text-lg font-bold text-slate-800 leading-tight ${isClosed ? 'text-slate-400' : ''}">
                    ${escapeHtml(entry.party)}
                </h3>
            </div>
            <div class="text-right">
                <span class="block text-2xl font-bold text-slate-800 ${isClosed ? 'text-slate-300' : ''}">${entry.qty}</span>
                <span class="text-[10px] text-slate-400 font-medium">QTY</span>
            </div>
        </div>

        <div class="mb-4">
            <p class="text-sm text-slate-600 font-medium ${isClosed ? 'text-slate-400' : ''}">
                ${escapeHtml(entry.item)}
            </p>
            ${entry.notes ? `<p class="text-xs text-slate-400 mt-1 italic">"${escapeHtml(entry.notes)}"</p>` : ''}
            <p class="text-[10px] text-slate-300 mt-2 font-medium">${entry.date}</p>
        </div>

        <div class="flex items-center gap-2 mt-2 pt-3 border-t border-slate-50">
            ${buttonsHtml}
            
            <button data-action="edit" data-id="${entry.id}" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all ml-auto">
                <i class="fas fa-pen text-xs"></i>
            </button>
            <button data-action="delete" data-id="${entry.id}" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                <i class="fas fa-trash text-xs"></i>
            </button>
        </div>
    </div>
    `;
}

// ============ UTILS ============
function resetForm() {
    document.getElementById('editId').value = '';
    document.getElementById('party').value = '';
    document.getElementById('item').value = '';
    document.getElementById('qty').value = '1';
    document.getElementById('notes').value = '';
    document.getElementById('action').value = 'Pending';
    document.getElementById('entryDate').valueAsDate = new Date();
    formTitle.textContent = 'Add Item';
}

function populateForm(entry) {
    document.getElementById('editId').value = entry.id;
    document.getElementById('party').value = entry.party;
    document.getElementById('item').value = entry.item;
    document.getElementById('qty').value = entry.qty;
    document.getElementById('action').value = entry.action;
    document.getElementById('notes').value = entry.notes;
    document.getElementById('entryDate').value = entry.date;
    formTitle.textContent = 'Edit Item';
    switchView('formView');
}

function updatePartyDatalist() {
    partyDatalist.innerHTML = '';
    state.parties.sort().forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        partyDatalist.appendChild(opt);
    });
}

function learnParty(name) {
    if (name && !state.parties.includes(name)) {
        state.parties.push(name);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.addEventListener('DOMContentLoaded', init);

/* script.js */
// ============ CONSTANTS & CONFIG ============
const STORAGE_KEY = 'inventory_app_v2'; // Updated key for new version

// ============ STATE MANAGEMENT ============

function getDefaultState() {
    const today = new Date().toISOString().split('T')[0];
    return {
        entries: [],
        parties: ['ABC Electronics', 'XYZ Supplies', 'Home Services'] // Seed data
    };
}

function loadState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.error('Error loading state:', e);
    }
    return getDefaultState();
}

function saveState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============ APPLICATION STATE ============
let state = loadState();

// ============ DOM ELEMENTS ============
// Views
const listView = document.getElementById('listView');
const formView = document.getElementById('formView');
const navBtns = document.querySelectorAll('.nav-btn');

// Form
const entryForm = document.getElementById('entryForm');
const editIdInput = document.getElementById('editId');
const partyInput = document.getElementById('party');
const partyDatalist = document.getElementById('partyList');
const itemInput = document.getElementById('item');
const qtyInput = document.getElementById('qty');
const actionSelect = document.getElementById('action');
const dateInput = document.getElementById('entryDate');
const notesInput = document.getElementById('notes');
const formTitle = document.getElementById('formTitle');
const cancelBtn = document.getElementById('cancelBtn');

// List & Controls
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const entriesList = document.getElementById('entriesList');
const noResultsMsg = document.getElementById('noResults');
const exportCsvBtn = document.getElementById('exportCsvBtn');

// ============ INITIALIZATION ============

function init() {
    // 1. Set default date to today
    dateInput.value = new Date().toISOString().split('T')[0];
    
    // 2. Load party suggestions
    updatePartyDatalist();
    
    // 3. Render initial list
    renderList();
    
    // 4. Events
    attachEventListeners();
}

function attachEventListeners() {
    // Navigation
    navBtns.forEach(btn => {
        if(btn.dataset.target) {
            btn.addEventListener('click', () => switchView(btn.dataset.target));
        }
    });

    cancelBtn.addEventListener('click', () => switchView('listView'));

    // Form
    entryForm.addEventListener('submit', handleFormSubmit);

    // Search & Filter
    searchInput.addEventListener('input', renderList);
    statusFilter.addEventListener('change', renderList);

    // List Operations (Delete/Edit/Close)
    entriesList.addEventListener('click', handleListOps);

    // Export
    exportCsvBtn.addEventListener('click', exportToCsv);
}

// ============ VIEW NAVIGATION ============

function switchView(viewName) {
    // Toggle View Visibility
    if (viewName === 'listView') {
        listView.classList.remove('hidden');
        formView.classList.add('hidden');
        resetForm(); // Clear form when going back to list
    } else if (viewName === 'formView') {
        listView.classList.add('hidden');
        formView.classList.remove('hidden');
        // Ensure date is set when opening form
        if(!dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
        partyInput.focus();
    }

    // Update Bottom Nav Styling
    navBtns.forEach(btn => {
        if (btn.dataset.target === viewName) {
            btn.classList.add('active', 'text-blue-600');
            btn.classList.remove('text-gray-400');
        } else if (btn.dataset.target) {
            btn.classList.remove('active', 'text-blue-600');
            btn.classList.add('text-gray-400');
        }
    });
}

// ============ PARTY AUTO-SUGGESTION ============

function updatePartyDatalist() {
    partyDatalist.innerHTML = '';
    // Sort parties alphabetically for easier finding
    state.parties.sort().forEach(party => {
        const option = document.createElement('option');
        option.value = party;
        partyDatalist.appendChild(option);
    });
}

function learnParty(partyName) {
    const trimmed = partyName.trim();
    if (trimmed && !state.parties.includes(trimmed)) {
        state.parties.push(trimmed);
        updatePartyDatalist(); // Refresh list immediately
        saveState(state); // Persist immediately
    }
}

// ============ FORM HANDLING ============

function handleFormSubmit(e) {
    e.preventDefault();
    
    const editId = editIdInput.value;
    const action = actionSelect.value;
    
    // Simple logic: If action is Pending, status is Open. Otherwise Closed.
    // (Auto-close feature removed as requested)
    let status = (action === 'Pending') ? 'Open' : 'Closed';
    
    const entry = {
        id: editId || generateId(),
        party: partyInput.value.trim(),
        item: itemInput.value.trim(),
        qty: parseInt(qtyInput.value, 10) || 1,
        action: action,
        status: status,
        date: dateInput.value,
        notes: notesInput.value.trim()
    };
    
    // Store new party name for future suggestions
    learnParty(entry.party);
    
    if (editId) {
        // Update existing
        const index = state.entries.findIndex(e => e.id === editId);
        if (index !== -1) state.entries[index] = entry;
    } else {
        // Add new to top
        state.entries.unshift(entry);
    }
    
    saveState(state);
    renderList();
    switchView('listView'); // Go back to list automatically
}

function resetForm() {
    editIdInput.value = '';
    partyInput.value = '';
    itemInput.value = '';
    qtyInput.value = '1';
    actionSelect.value = 'Pending';
    notesInput.value = '';
    dateInput.value = new Date().toISOString().split('T')[0];
    formTitle.textContent = 'Add New Entry';
}

function populateFormForEdit(entry) {
    editIdInput.value = entry.id;
    partyInput.value = entry.party;
    itemInput.value = entry.item;
    qtyInput.value = entry.qty;
    actionSelect.value = entry.action;
    dateInput.value = entry.date;
    notesInput.value = entry.notes;
    
    formTitle.textContent = 'Edit Entry';
    switchView('formView');
}

// ============ LIST RENDERING ============

function getFilteredEntries() {
    const term = searchInput.value.toLowerCase().trim();
    const statusVal = statusFilter.value;
    
    return state.entries.filter(entry => {
        if (statusVal !== 'all' && entry.status !== statusVal) return false;
        
        if (term) {
            const str = `${entry.party} ${entry.item} ${entry.notes}`.toLowerCase();
            if (!str.includes(term)) return false;
        }
        return true;
    });
}

function renderList() {
    const filtered = getFilteredEntries();
    
    if (filtered.length === 0) {
        entriesList.innerHTML = '';
        noResultsMsg.classList.remove('hidden');
        return;
    }
    
    noResultsMsg.classList.add('hidden');
    
    entriesList.innerHTML = filtered.map(entry => {
        // Status Colors
        const isClosed = entry.status === 'Closed';
        const statusClass = isClosed 
            ? 'bg-green-100 text-green-700 border-green-200' 
            : 'bg-yellow-100 text-yellow-700 border-yellow-200';
            
        return `
        <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative transition hover:shadow-md" data-id="${entry.id}">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h3 class="font-bold text-gray-800 text-base">${escapeHtml(entry.party)}</h3>
                    <p class="text-xs text-gray-500">${entry.date}</p>
                </div>
                <span class="px-2 py-1 text-xs font-bold rounded-full border ${statusClass}">
                    ${entry.status}
                </span>
            </div>
            
            <div class="flex justify-between items-center mb-2">
                <div class="text-sm text-gray-700">
                    <span class="font-medium">${entry.qty}x</span> ${escapeHtml(entry.item)}
                </div>
            </div>

            <div class="bg-gray-50 p-2 rounded text-xs text-gray-600 mb-3 border border-gray-100">
                <strong>Action:</strong> ${escapeHtml(entry.action)} <br>
                ${entry.notes ? `<div class="mt-1 italic text-gray-500">"${escapeHtml(entry.notes)}"</div>` : ''}
            </div>

            <div class="flex gap-2 justify-end border-t pt-2 mt-2">
                ${!isClosed ? 
                    `<button class="flex-1 py-1.5 px-3 bg-green-50 text-green-600 rounded text-xs font-medium hover:bg-green-100" data-action="close">
                        <i class="fas fa-check"></i> Close
                    </button>` : ''
                }
                <button class="py-1.5 px-3 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100" data-action="edit">
                    Edit
                </button>
                <button class="py-1.5 px-3 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100" data-action="delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}

// ============ OPS ============

function handleListOps(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const card = btn.closest('[data-id]');
    const id = card.dataset.id;
    
    if (action === 'delete') {
        if(confirm('Delete this entry?')) {
            state.entries = state.entries.filter(e => e.id !== id);
            saveState(state);
            renderList();
        }
    } else if (action === 'edit') {
        const entry = state.entries.find(e => e.id === id);
        if (entry) populateFormForEdit(entry);
    } else if (action === 'close') {
        const entry = state.entries.find(e => e.id === id);
        if (entry) {
            entry.status = 'Closed';
            saveState(state);
            renderList();
        }
    }
}

function exportToCsv() {
    const filtered = getFilteredEntries();
    if (!filtered.length) return alert('Nothing to export');
    
    const headers = ['Date', 'Party', 'Item', 'Qty', 'Action', 'Status', 'Notes'];
    const rows = filtered.map(e => [
        e.date, 
        `"${e.party}"`, 
        `"${e.item}"`, 
        e.qty, 
        e.action, 
        e.status, 
        `"${e.notes}"`
    ].join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

// Start
document.addEventListener('DOMContentLoaded', init);

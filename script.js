/* app.js */
/*
 * Inventory & Pending Manager - Application Logic
 * Purpose: Handle state management, form interactions, table rendering, and filtering.
 * 
 * BACKEND INTEGRATION NOTES:
 * --------------------------
 * To replace localStorage with Firebase/Firestore:
 * 1. Replace loadState() with an async function that fetches from Firestore
 * 2. Replace saveState() with an async function that writes to Firestore
 * 3. Add real-time listeners for live updates across clients
 * Example:
 *   async function loadState() {
 *       const doc = await firebase.firestore().collection('inventory').doc('main').get();
 *       return doc.exists ? doc.data() : getDefaultState();
 *   }
 *   async function saveState(state) {
 *       await firebase.firestore().collection('inventory').doc('main').set(state);
 *   }
 */

// ============ CONSTANTS ============
const STORAGE_KEY = 'simple_pending_v1';

// ============ STATE MANAGEMENT ============

/**
 * Returns default state with seed data for first-time users
 */
function getDefaultState() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    return {
        entries: [
            {
                id: generateId(),
                party: 'ABC Electronics',
                item: 'Laptop Charger',
                qty: 2,
                action: 'Pending',
                status: 'Open',
                date: today,
                notes: 'Awaiting repair confirmation'
            },
            {
                id: generateId(),
                party: 'XYZ Supplies',
                item: 'Printer Cartridges',
                qty: 5,
                action: 'Collected',
                status: 'Closed',
                date: yesterday,
                notes: 'Bulk order received'
            }
        ],
        parties: ['ABC Electronics', 'XYZ Supplies', 'Tech Solutions', 'Office Depot']
    };
}

/**
 * Load state from localStorage
 * REPLACE THIS FUNCTION for backend integration
 */
function loadState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error loading state:', e);
    }
    return getDefaultState();
}

/**
 * Save state to localStorage
 * REPLACE THIS FUNCTION for backend integration
 */
function saveState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

/**
 * Generate unique ID for entries
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============ APPLICATION STATE ============
let state = loadState();

// ============ DOM REFERENCES ============
const entryForm = document.getElementById('entryForm');
const editIdInput = document.getElementById('editId');
const partyInput = document.getElementById('party');
const itemInput = document.getElementById('item');
const qtyInput = document.getElementById('qty');
const actionSelect = document.getElementById('action');
const dateInput = document.getElementById('entryDate');
const notesInput = document.getElementById('notes');
const autoCloseCheckbox = document.getElementById('autoClose');
const clearBtn = document.getElementById('clearBtn');
const partyDatalist = document.getElementById('partyList');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const showPendingBtn = document.getElementById('showPendingBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const entriesBody = document.getElementById('entriesBody');
const noResultsMsg = document.getElementById('noResults');

// ============ INITIALIZATION ============

/**
 * Initialize the application
 */
function init() {
    // Set default date to today
    dateInput.value = new Date().toISOString().split('T')[0];
    
    // Populate party datalist
    updatePartyDatalist();
    
    // Render table
    renderTable();
    
    // Attach event listeners
    attachEventListeners();
}

/**
 * Attach all event listeners
 */
function attachEventListeners() {
    // Form submission
    entryForm.addEventListener('submit', handleFormSubmit);
    
    // Clear button
    clearBtn.addEventListener('click', clearForm);
    
    // Search and filters
    searchInput.addEventListener('input', renderTable);
    statusFilter.addEventListener('change', renderTable);
    
    // Show Pending button
    showPendingBtn.addEventListener('click', showPendingOnly);
    
    // Export CSV
    exportCsvBtn.addEventListener('click', exportToCsv);
    
    // Table operations (delegated)
    entriesBody.addEventListener('click', handleTableOps);
}

// ============ PARTY AUTOCOMPLETE ============

/**
 * Update the party datalist with learned names
 */
function updatePartyDatalist() {
    partyDatalist.innerHTML = '';
    state.parties.forEach(party => {
        const option = document.createElement('option');
        option.value = party;
        partyDatalist.appendChild(option);
    });
}

/**
 * Learn a new party name (add if not exists)
 */
function learnParty(partyName) {
    const trimmed = partyName.trim();
    if (trimmed && !state.parties.includes(trimmed)) {
        state.parties.push(trimmed);
        state.parties.sort();
        updatePartyDatalist();
    }
}

// ============ FORM HANDLING ============

/**
 * Handle form submission
 */
function handleFormSubmit(e) {
    e.preventDefault();
    
    const editId = editIdInput.value;
    const autoClose = autoCloseCheckbox.checked;
    const action = actionSelect.value;
    
    // Determine status
    let status = 'Open';
    if (action === 'Pending') {
        status = 'Open';
    } else if (autoClose && (action === 'Given' || action === 'Delivered')) {
        status = 'Closed';
    } else if (action !== 'Pending') {
        status = 'Closed';
    }
    
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
    
    // Learn the party name
    learnParty(entry.party);
    
    if (editId) {
        // Editing existing entry - find and update
        const index = state.entries.findIndex(e => e.id === editId);
        if (index !== -1) {
            state.entries[index] = entry;
        }
    } else {
        // New entry - add to top
        state.entries.unshift(entry);
    }
    
    // Save and re-render
    saveState(state);
    renderTable();
    clearForm();
}

/**
 * Clear the form
 */
function clearForm() {
    editIdInput.value = '';
    partyInput.value = '';
    itemInput.value = '';
    qtyInput.value = '1';
    actionSelect.value = 'Pending';
    dateInput.value = new Date().toISOString().split('T')[0];
    notesInput.value = '';
    partyInput.focus();
}

/**
 * Populate form for editing
 */
function populateFormForEdit(entry) {
    editIdInput.value = entry.id;
    partyInput.value = entry.party;
    itemInput.value = entry.item;
    qtyInput.value = entry.qty;
    actionSelect.value = entry.action;
    dateInput.value = entry.date;
    notesInput.value = entry.notes;
    partyInput.focus();
    
    // Scroll to form
    entryForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============ TABLE RENDERING ============

/**
 * Get filtered entries based on search and status filter
 */
function getFilteredEntries() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const statusValue = statusFilter.value;
    
    return state.entries.filter(entry => {
        // Status filter
        if (statusValue !== 'all' && entry.status !== statusValue) {
            return false;
        }
        
        // Search filter
        if (searchTerm) {
            const searchable = [
                entry.party,
                entry.item,
                entry.notes
            ].join(' ').toLowerCase();
            
            if (!searchable.includes(searchTerm)) {
                return false;
            }
        }
        
        return true;
    });
}

/**
 * Render the entries table
 */
function renderTable() {
    const filtered = getFilteredEntries();
    
    if (filtered.length === 0) {
        entriesBody.innerHTML = '';
        noResultsMsg.hidden = false;
        return;
    }
    
    noResultsMsg.hidden = true;
    
    entriesBody.innerHTML = filtered.map(entry => `
        <tr data-id="${entry.id}">
            <td>${escapeHtml(entry.date)}</td>
            <td>${escapeHtml(entry.party)}</td>
            <td>${escapeHtml(entry.item)}</td>
            <td>${entry.qty}</td>
            <td><span class="action-badge">${escapeHtml(entry.action)}</span></td>
            <td>
                <span class="status-badge status-${entry.status.toLowerCase()}">
                    ${entry.status}
                </span>
            </td>
            <td>${escapeHtml(entry.notes || '-')}</td>
            <td class="ops-cell">
                ${entry.status === 'Open' ? 
                    `<button class="btn btn-small btn-success" data-action="close" aria-label="Mark as closed">✓ Close</button>` 
                    : ''}
                <button class="btn btn-small btn-secondary" data-action="edit" aria-label="Edit entry">✎ Edit</button>
                <button class="btn btn-small btn-danger" data-action="delete" aria-label="Delete entry">✕</button>
            </td>
        </tr>
    `).join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ TABLE OPERATIONS ============

/**
 * Handle table button clicks (delegated)
 */
function handleTableOps(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const row = btn.closest('tr');
    const id = row.dataset.id;
    
    switch (action) {
        case 'close':
            markAsClosed(id);
            break;
        case 'edit':
            editEntry(id);
            break;
        case 'delete':
            deleteEntry(id);
            break;
    }
}

/**
 * Mark entry as closed
 */
function markAsClosed(id) {
    const entry = state.entries.find(e => e.id === id);
    if (entry) {
        entry.status = 'Closed';
        saveState(state);
        renderTable();
    }
}

/**
 * Edit entry (populate form and remove from list)
 */
function editEntry(id) {
    const entry = state.entries.find(e => e.id === id);
    if (entry) {
        populateFormForEdit(entry);
    }
}

/**
 * Delete entry
 */
function deleteEntry(id) {
    if (confirm('Are you sure you want to delete this entry?')) {
        state.entries = state.entries.filter(e => e.id !== id);
        saveState(state);
        renderTable();
    }
}

// ============ FILTERS ============

/**
 * Show only pending entries
 */
function showPendingOnly() {
    searchInput.value = '';
    statusFilter.value = 'Open';
    renderTable();
}

// ============ EXPORT ============

/**
 * Export current filtered entries to CSV
 */
function exportToCsv() {
    const filtered = getFilteredEntries();
    
    if (filtered.length === 0) {
        alert('No entries to export.');
        return;
    }
    
    // CSV headers
    const headers = ['Date', 'Party', 'Item', 'Qty', 'Action', 'Status', 'Notes'];
    
    // CSV rows
    const rows = filtered.map(entry => [
        entry.date,
        `"${entry.party.replace(/"/g, '""')}"`,
        `"${entry.item.replace(/"/g, '""')}"`,
        entry.qty,
        entry.action,
        entry.status,
        `"${(entry.notes || '').replace(/"/g, '""')}"`
    ].join(','));
    
    // Combine
    const csv = [headers.join(','), ...rows].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ============ START ============
document.addEventListener('DOMContentLoaded', init);
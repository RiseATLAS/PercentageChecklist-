// Firebase-konfigurasjon
const firebaseConfig = {
    apiKey: "AIzaSyAicCfg3-F-OSr0r38-fvS2DPMjcFj0L9o",
    authDomain: "percentagechecklist.firebaseapp.com",
    databaseURL: "https://percentagechecklist-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "percentagechecklist",
    storageBucket: "percentagechecklist.appspot.com",
    messagingSenderId: "984819040461",
    appId: "1:984819040461:web:89faf42e4cf5aec3a32984",
    measurementId: "G-RY6PR6Y95P"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const storage = firebase.storage(); // Initialize Firebase Storage

// ---------------------
// Updated debug declarations with additional events
const DEBUG_MODE = false;

// Consolidate debug counter keys into a single array
const DEBUG_EVENTS = [
    'loadTasks', 'renderTasks', 'loadCategories', 'addTask', 
    'addCategory', 'markAllComplete', 'deleteCompleted', 
    'updateCharts', 'applyFilters', 'renderCategoriesList', 
    'sortBy', 'taskInputKeydown', 'newCategoryInputKeydown', 
    'sortableOnEnd'
];

// Initialize eventCounters from array
let eventCounters = DEBUG_EVENTS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
}, {});

// Utility functions for common operations
const utils = {
    createTaskElement(type, props = {}) {
        const elem = document.createElement(type);
        Object.entries(props).forEach(([key, value]) => {
            if (key === 'className') {
                elem.className = value;
            } else if (key === 'textContent') {
                elem.textContent = value;
            } else {
                elem.setAttribute(key, value);
            }
        });
        return elem;
    },

    generateDebugPanel() {
        return DEBUG_EVENTS.map(event => 
            `<p>${event}: <span id="counter-${event}">0</span></p>`
        ).join('');
    },

    safeUpdate(ref, data) {
        return ref.update(data).catch(error => 
            console.error('Database update failed:', error)
        );
    },

    createElement(type, className, textContent) {
        const elem = document.createElement(type);
        if (className) elem.className = className;
        if (textContent) elem.textContent = textContent;
        return elem;
    },

    createOption(value, text, selected = false) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        option.selected = selected;
        return option;
    },

    createTaskElements(task) {
        try {
            // Create base container
            const container = utils.createElement('li', 'task-item');
            container.setAttribute('data-id', task.id);
            if (task.completed) {
                container.classList.add('completed-task');
            }

            // Create checkbox container and input
            const checkboxContainer = utils.createElement('div', 'checkbox-container');
            const checkbox = utils.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkboxContainer.appendChild(checkbox);

            // Create text span
            const textSpan = utils.createElement('span', 'task-text', task.text);
            
            // Create category select
            const categorySelect = utils.createElement('select', 'task-category-select');
            categorySelect.innerHTML = `<option value="">Uten kategori</option>`;
            for (let catId in categoriesCache) {
                categorySelect.appendChild(utils.createOption(catId, categoriesCache[catId].name));
            }
            categorySelect.value = task.categoryId || '';
            
            // Create priority span
            const prioritySpan = utils.createElement('span',
                `task-priority priority-${(task.priority || 'mid').toLowerCase()}`,
                task.priority || 'Mid'
            );
            
            // Create delete button
            const deleteButton = utils.createElement('button', 'delete-button', '✖');
            deleteButton.title = 'Slett Oppgave';

            // Add all elements to container
            container.appendChild(checkboxContainer);
            container.appendChild(textSpan);
            container.appendChild(categorySelect);
            container.appendChild(prioritySpan);
            container.appendChild(deleteButton);

            // Add event listeners
            checkbox.addEventListener('change', () => handleTaskToggle(task.id, checkbox, container));
            textSpan.addEventListener('dblclick', () => textSpan.setAttribute('contenteditable', 'true'));
            textSpan.addEventListener('blur', () => updateTaskText(task, textSpan));
            categorySelect.addEventListener('change', () => updateTaskCategory(task.id, categorySelect.value));
            deleteButton.addEventListener('click', () => deleteTask(task.id));

            return container;
        } catch (error) {
            console.error('Error creating task elements:', error);
            return null;
        }
    },

    handleError(error, context = '') {
        console.error(`Error ${context}:`, error);
        // Could be extended to show user-friendly error messages
        return Promise.reject(error);
    },

    updateTaskText(task, textSpan) {
        try {
            if (!task || !textSpan) return;
            
            textSpan.setAttribute('contenteditable', 'false');
            const newText = textSpan.textContent.trim();
            
            if (newText === "") {
                utils.showToast("Oppgaveteksten kan ikke være tom.", "error");
                textSpan.textContent = task.text;
                return;
            }

            if (newText !== task.text) {
                utils.dbUpdate(`tasks/${task.id}`, { text: newText })
                    .catch(error => {
                        utils.handleError(error, 'updating task text');
                        textSpan.textContent = task.text;
                    });
            }
        } catch (error) {
            utils.handleError(error, 'updating task text');
            if (textSpan && task) textSpan.textContent = task.text;
        }
    },

    updateTaskCategory(taskId, categoryId) {
        utils.dbUpdate(`tasks/${taskId}`, { 
            categoryId, 
            customCategory: null 
        }).catch(error => utils.handleError(error, 'updating task category'));
    },

    deleteTask(taskId) {
        utils.dbRemove(`tasks/${taskId}`)
            .catch(error => utils.handleError(error, 'deleting task'));
    },

    cleanup: {
        listeners: [],
        add(ref, event, callback) {
            this.listeners.push({ ref, event, callback });
            ref.on(event, callback);
        },
        removeAll() {
            this.listeners.forEach(({ ref, event, callback }) => {
                ref.off(event, callback);
            });
            this.listeners = [];
        }
    },

    dbRef(path = null) {
        return path ? database.ref(path) : database.ref();
    },

    dbSet(path, data) {
        return this.dbRef(path).set(data)
            .catch(error => this.handleError(error, `setting ${path}`));
    },

    dbUpdate(path, data) {
        return this.dbRef(path).update(data)
            .catch(error => this.handleError(error, `updating ${path}`));
    },

    dbRemove(path) {
        return this.dbRef(path).remove()
            .catch(error => this.handleError(error, `removing ${path}`));
    },

    toastQueue: [],
    activeToasts: new Set(),
    maxToasts: 3,
    
    initToastContainer() {
        const container = document.querySelector('.toast-container') || 
            document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    },

    showToast(message, type = 'info', options = {}) {
        if (this.activeToasts.size >= this.maxToasts) {
            const oldestToast = document.querySelector('.toast');
            if (oldestToast) this.hideToast(oldestToast.id);
        }

        const id = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `toast toast-${type}`;
        
        toast.innerHTML = `
            <div class="toast-content">
                ${options.icon ? `<span class="toast-icon">${options.icon}</span>` : ''}
                <div class="toast-message">${message}</div>
                ${options.actions ? `
                    <div class="toast-actions">
                        ${options.actions.map(action => `
                            <button class="toast-btn toast-btn-${action.type || 'default'}">${action.text}</button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <button class="toast-close" aria-label="Close">×</button>
        `;

        const container = this.initToastContainer();
        container.appendChild(toast);
        this.activeToasts.add(id);

        // Add close button handler
        toast.querySelector('.toast-close').onclick = () => this.hideToast(id);

        // Add action button handlers
        if (options.actions) {
            const buttons = toast.querySelectorAll('.toast-actions .toast-btn');
            options.actions.forEach((action, index) => {
                buttons[index].onclick = () => {
                    if (action.onClick) {
                        action.onClick();
                    }
                    this.hideToast(id);
                };
            });
        }

        // Auto-hide toast after delay if specified
        if (options.duration !== 0) {
            setTimeout(() => this.hideToast(id), options.duration || 3000);
        }

        return id;
    },

    hideToast(id) {
        const toast = document.getElementById(id);
        if (toast) {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                this.activeToasts.delete(id);
                
                // Process next toast in queue if any
                if (this.toastQueue.length > 0 && this.activeToasts.size < this.maxToasts) {
                    const nextToast = this.toastQueue.shift();
                    this.showToast(nextToast.message, nextToast.type, nextToast.options);
                }
            }, 300);
        }
    },

    // Search and filter utilities
    searchTasks(tasks, query) {
        const searchTerm = query.toLowerCase().trim();
        return tasks.filter(task => 
            task.text.toLowerCase().includes(searchTerm) ||
            (task.categoryId && categoriesCache[task.categoryId]?.name.toLowerCase().includes(searchTerm))
        );
    },

    // Sorting utilities
    sortTasks(tasks, criteria = 'date', direction = 'asc') {
        return [...tasks].sort((a, b) => {
            switch (criteria) {
                case 'priority':
                    const priorityMap = { high: 3, mid: 2, low: 1 };
                    return direction === 'asc' 
                        ? priorityMap[a.priority] - priorityMap[b.priority]
                        : priorityMap[b.priority] - priorityMap[a.priority];
                case 'category':
                    const catA = categoriesCache[a.categoryId]?.name || '';
                    const catB = categoriesCache[b.categoryId]?.name || '';
                    return direction === 'asc' 
                        ? catA.localeCompare(catB)
                        : catB.localeCompare(catA);
                case 'date':
                default:
                    return direction === 'asc' 
                        ? a.timestamp - b.timestamp
                        : b.timestamp - a.timestamp;
            }
        });
    },

    // Task Statistics
    getTaskStats(tasks) {
        return tasks.reduce((stats, task) => {
            stats.total++;
            if (task.completed) stats.completed++;
            if (task.priority === 'high') stats.highPriority++;
            stats.byCategory[task.categoryId || 'uncategorized'] = 
                (stats.byCategory[task.categoryId || 'uncategorized'] || 0) + 1;
            return stats;
        }, {
            total: 0,
            completed: 0,
            highPriority: 0,
            byCategory: {}
        });
    },

    // Batch Operations
    batchUpdate(tasks, updates) {
        const batch = {};
        tasks.forEach(task => {
            batch[`tasks/${task.id}`] = { ...task, ...updates };
        });
        return this.dbRef().update(batch);
    },

    // Import/Export
    exportTasks(tasks) {
        const exportData = {
            tasks,
            categories: categoriesCache,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], 
            { type: 'application/json' });
        return URL.createObjectURL(blob);
    },

    async importTasks(fileData) {
        try {
            const data = JSON.parse(fileData);
            if (!data.tasks || !Array.isArray(data.tasks)) {
                throw new Error('Invalid import format');
            }
            
            // Import categories first
            if (data.categories) {
                await this.dbRef('categories').update(data.categories);
            }
            
            // Then import tasks
            const batch = {};
            data.tasks.forEach(task => {
                const newId = this.dbRef('tasks').push().key;
                batch[`tasks/${newId}`] = { ...task, id: newId };
            });
            
            await this.dbRef().update(batch);
            return true;
        } catch (error) {
            this.handleError(error, 'importing tasks');
            return false;
        }
    },

    // Backup functionality
    async createBackup() {
        try {
            const tasksSnap = await this.dbRef('tasks').once('value');
            const categoriesSnap = await this.dbRef('categories').once('value');
            const backup = {
                timestamp: Date.now(),
                tasks: tasksSnap.val(),
                categories: categoriesSnap.val()
            };
            
            const backupRef = this.dbRef('backups').push();
            await backupRef.set(backup);
            return backupRef.key;
        } catch (error) {
            this.handleError(error, 'creating backup');
            return null;
        }
    },

    // Analytics
    getCompletionAnalytics(tasks) {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;
        
        return tasks.reduce((analytics, task) => {
            if (task.completedAt) {
                const age = now - task.completedAt;
                if (age <= dayMs) analytics.today++;
                if (age <= weekMs) analytics.thisWeek++;
                analytics.total++;
                
                if (task.categoryId) {
                    analytics.byCategory[task.categoryId] = 
                        (analytics.byCategory[task.categoryId] || 0) + 1;
                }
            }
            return analytics;
        }, {
            today: 0,
            thisWeek: 0,
            total: 0,
            byCategory: {}
        });
    },

    // Task History
    taskHistory: {
        async addEntry(taskId, action, details = {}) {
            const historyRef = utils.dbRef(`taskHistory/${taskId}`).push();
            await historyRef.set({
                timestamp: Date.now(),
                action,
                details,
                userId: currentUser?.uid || 'anonymous'
            });
        },

        async getTaskHistory(taskId, limit = 10) {
            const snapshot = await utils.dbRef(`taskHistory/${taskId}`)
                .limitToLast(limit)
                .once('value');
            return snapshot.val() || {};
        }
    },

    // Performance Metrics
    metrics: {
        timestamps: new Map(),
        
        start(operation) {
            this.timestamps.set(operation, performance.now());
        },

        end(operation) {
            const start = this.timestamps.get(operation);
            if (!start) return null;
            
            const duration = performance.now() - start;
            this.timestamps.delete(operation);
            
            if (duration > 1000) {
                console.warn(`Operation ${operation} took ${duration.toFixed(2)}ms`);
            }
            return duration;
        }
    },

    // Data Validation
    validation: {
        sanitizeText(text) {
            return text.trim()
                .replace(/[<>]/g, '')  // Remove potential HTML
                .slice(0, 500);        // Limit length
        },

        isValidPriority(priority) {
            return ['high', 'mid', 'low'].includes(priority?.toLowerCase());
        },

        validateCategory(category) {
            return {
                isValid: category?.name?.length > 0 && category.name.length <= 50,
                errors: []
            };
        }
    },

    // Task Scheduling
    scheduling: {
        async scheduleTask(taskId, date) {
            if (!(date instanceof Date) || isNaN(date)) {
                throw new Error('Invalid date');
            }

            await utils.dbUpdate(`tasks/${taskId}`, {
                scheduledFor: date.getTime(),
                reminderSet: true
            });
        },

        async getUpcomingTasks(days = 7) {
            const now = Date.now();
            const future = now + (days * 24 * 60 * 60 * 1000);
            
            const snapshot = await utils.dbRef('tasks')
                .orderByChild('scheduledFor')
                .startAt(now)
                .endAt(future)
                .once('value');
                
            return snapshot.val() || {};
        }
    },

    // Advanced Search
    advancedSearch(tasks, filters = {}) {
        return tasks.filter(task => {
            // Match text
            if (filters.text && !task.text.toLowerCase().includes(filters.text.toLowerCase())) {
                return false;
            }

            // Match priority
            if (filters.priority && task.priority !== filters.priority) {
                return false;
            }

            // Match completion status
            if (typeof filters.completed === 'boolean' && task.completed !== filters.completed) {
                return false;
            }

            // Match date range
            if (filters.dateRange) {
                const taskDate = task.timestamp || 0;
                if (taskDate < filters.dateRange.start || taskDate > filters.dateRange.end) {
                    return false;
                }
            }

            // Match categories
            if (filters.categories && filters.categories.length > 0) {
                if (!filters.categories.includes(task.categoryId)) {
                    return false;
                }
            }

            return true;
        });
    },

    // UI State Management
    ui: {
        updateProgressBar(percentage) {
            const progressBar = document.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
                progressBar.setAttribute('aria-valuenow', percentage);
            }
        },

        toggleLoader(show = true) {
            const loader = document.querySelector('.loader');
            if (loader) {
                loader.style.display = show ? 'block' : 'none';
            }
        },

        refreshTaskList() {
            utils.metrics.start('refreshTaskList');
            const taskList = document.getElementById('taskList');
            if (taskList) {
                while (taskList.firstChild) {
                    taskList.removeChild(taskList.firstChild);
                }
            }
            utils.metrics.end('refreshTaskList');
        }
    },

    // DOM Event Handlers
    handlers: {
        onImportClick() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    utils.ui.toggleLoader(true);
                    try {
                        const text = await file.text();
                        await utils.importTasks(text);
                        utils.showToast('Import successful', 'success');
                    } catch (error) {
                        utils.showToast('Import failed', 'error');
                    } finally {
                        utils.ui.toggleLoader(false);
                    }
                }
            };
            input.click();
        },

        onExportClick() {
            utils.ui.toggleLoader(true);
            try {
                const url = utils.exportTasks(tasksCache);
                const link = document.createElement('a');
                link.href = url;
                link.download = `tasks-${new Date().toISOString()}.json`;
                link.click();
                URL.revokeObjectURL(url);
            } catch (error) {
                utils.showToast('Export failed', 'error');
            } finally {
                utils.ui.toggleLoader(false);
            }
        }
    },

    // Analytics Display
    displayAnalytics() {
        const analytics = utils.getCompletionAnalytics(Object.values(tasksCache));
        const statsContainer = document.querySelector('.stats-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Today</span>
                    <span class="stat-value">${analytics.today}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">This Week</span>
                    <span class="stat-value">${analytics.thisWeek}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total</span>
                    <span class="stat-value">${analytics.total}</span>
                </div>
            `;
        }
    },

    // Search Interface
    initializeSearch() {
        const searchForm = document.querySelector('.search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const filters = {
                    text: searchForm.querySelector('#searchInput').value,
                    priority: searchForm.querySelector('#priorityFilter').value,
                    completed: searchForm.querySelector('#statusFilter').value === 'completed',
                    categories: Array.from(searchForm.querySelector('#categoryFilter').selectedOptions)
                        .map(option => option.value)
                };
                const filteredTasks = utils.advancedSearch(Object.values(tasksCache), filters);
                utils.renderTasks(filteredTasks);
            });
        }
    }
};

// Data caching
const state = {
    tasks: {},
    categories: {},
    filters: {
        search: '',
        priority: '',
        status: 'all',
        categories: []
    }
};

// Task Management
async function loadTasks() {
    utils.metrics.start('loadTasks');
    try {
        const snapshot = await utils.dbRef('tasks').once('value');
        state.tasks = snapshot.val() || {};
        renderTasks();
    } catch (error) {
        utils.handleError(error, 'loading tasks');
    } finally {
        utils.metrics.end('loadTasks');
    }
}

function renderTasks(tasksToRender = null) {
    utils.metrics.start('renderTasks');
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    const tasks = tasksToRender || Object.values(state.tasks);
    const sortedTasks = utils.sortTasks(tasks, state.filters.sortBy, state.filters.sortDirection);
    
    utils.ui.refreshTaskList();
    
    const fragment = document.createDocumentFragment();
    sortedTasks.forEach(task => {
        const elem = utils.createTaskElements(task);
        if (elem) fragment.appendChild(elem);
    });
    
    taskList.appendChild(fragment);
    updateProgress();
    utils.metrics.end('renderTasks');
}

// Category Management
async function loadCategories() {
    utils.metrics.start('loadCategories');
    try {
        const snapshot = await utils.dbRef('categories').once('value');
        state.categories = snapshot.val() || {};
        updateCategoryFilters();
    } catch (error) {
        utils.handleError(error, 'loading categories');
    } finally {
        utils.metrics.end('loadCategories');
    }
}

function updateCategoryFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;
    
    categoryFilter.innerHTML = Object.entries(state.categories)
        .map(([id, cat]) => `<option value="${id}">${cat.name}</option>`)
        .join('');
}

// Progress tracking
function updateProgress() {
    const tasks = Object.values(state.tasks);
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    
    utils.ui.updateProgressBar(percentage);
    utils.displayAnalytics();
}

// Event delegation
document.addEventListener('click', (e) => {
    const target = e.target;
    
    if (target.matches('.delete-button')) {
        const taskId = target.closest('.task-item').dataset.id;
        utils.deleteTask(taskId);
    }
});

document.addEventListener('change', (e) => {
    const target = e.target;
    
    if (target.matches('.task-category-select')) {
        const taskId = target.closest('.task-item').dataset.id;
        utils.updateTaskCategory(taskId, target.value);
    }
});

// Real-time updates
utils.cleanup.add(
    utils.dbRef('tasks'),
    'child_changed',
    snapshot => {
        const task = snapshot.val();
        state.tasks[task.id] = task;
        renderTasks();
    }
);

utils.cleanup.add(
    utils.dbRef('categories'),
    'child_changed',
    snapshot => {
        const category = snapshot.val();
        state.categories[category.id] = category;
        updateCategoryFilters();
    }
);

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components
    utils.initializeSearch();
    utils.displayAnalytics();
    
    // Set up global error handler
    window.addEventListener('error', (event) => {
        utils.showToast(
            'En feil oppstod: ' + event.message,
            'error',
            { duration: 5000 }
        );
    });

    // Start performance monitoring
    utils.metrics.start('appInit');
    
    // Load initial data
    Promise.all([
        loadTasks(),
        loadCategories()
    ]).then(() => {
        utils.metrics.end('appInit');
        utils.ui.toggleLoader(false);
    }).catch(error => {
        utils.handleError(error, 'initialization');
        utils.ui.toggleLoader(false);
    });
});
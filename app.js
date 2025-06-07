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

    toastQueue: [],
    isShowingToast: false,
    
    processToastQueue() {
        if (this.isShowingToast || this.toastQueue.length === 0) return;
        
        const { message, type, options } = this.toastQueue.shift();
        this.isShowingToast = true;
        
        this.displayToast(message, type, {
            ...options,
            onHide: () => {
                this.isShowingToast = false;
                this.processToastQueue();
            }
        });
    },
    
    showToast(message, type = 'info', options = {}) {
        this.toastQueue.push({ message, type, options });
        this.processToastQueue();
    },
    
    displayToast(message, type = 'info', options = {}) {
        const id = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `toast toast-${type}`;
        
        // Add buttons if actions provided
        if (options.actions) {
            toast.innerHTML = `
                <div class="toast-message">${message}</div>
                <div class="toast-actions">
                    ${options.actions.map(action => `
                        <button class="toast-btn toast-btn-${action.type || 'default'}">${action.text}</button>
                    `).join('')}
                </div>
            `;
            
            // Add click handlers for buttons
            const buttons = toast.querySelectorAll('.toast-btn');
            options.actions.forEach((action, index) => {
                buttons[index].addEventListener('click', () => {
                    if (action.onClick) action.onClick();
                    this.hideToast(id);
                });
            });
        } else {
            toast.textContent = message;
        }

        document.body.appendChild(toast);
        
        // Show animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
            if (!options.actions) {
                setTimeout(() => {
                    this.hideToast(id);
                    if (options.onHide) options.onHide();
                }, options.duration || 3000);
            }
        });

        return id;
    },

    hideToast(id) {
        const toast = document.getElementById(id);
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    },

    handleError(error, context = '') {
        console.error(`Error ${context}:`, error);
        this.showToast(this.getErrorMessage(error, context), 'error');
        return Promise.reject(error);
    },

    getErrorMessage(error, context) {
        const defaultMsg = 'En feil har oppstått';
        const contextMap = {
            'updating task text': 'Kunne ikke oppdatere oppgavetekst',
            'updating task category': 'Kunne ikke oppdatere kategori',
            'deleting task': 'Kunne ikke slette oppgave',
            'deleting category': 'Kunne ikke slette kategori',
            'loading tasks': 'Kunne ikke laste oppgaver',
            'loading categories': 'Kunne ikke laste kategorier'
        };

        return contextMap[context] || `${defaultMsg}${context ? ` (${context})` : ''}`;
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

    toastConfig: {
        maxVisible: 3,
        spacing: 10,
        baseDelay: 3000,
        positions: ['top-right', 'top-left', 'bottom-right', 'bottom-left'],
        animations: {
            success: 'slide-in',
            error: 'bounce',
            info: 'fade'
        }
    },

    showActionToast(message, actions) {
        return this.showToast(message, 'info', {
            actions: actions.map(a => ({
                text: a.text,
                type: a.type || 'default',
                onClick: () => {
                    if (a.action()) {
                        this.showToast(a.successMessage || 'Handlingen var vellykket', 'success');
                    }
                }
            }))
        });
    },

    confirmAction(message, action) {
        return this.showToast(message, 'info', {
            actions: [
                {
                    text: 'Ja',
                    type: 'success',
                    onClick: () => action()
                },
                {
                    text: 'Nei',
                    type: 'default'
                }
            ]
        });
    },

    getSuccessMessage(context) {
        const messages = {
            'add-task': 'Oppgave lagt til',
            'update-task': 'Oppgave oppdatert',
            'delete-task': 'Oppgave slettet',
            'add-category': 'Kategori lagt til',
            'update-category': 'Kategori oppdatert',
            'delete-category': 'Kategori slettet',
            'complete-task': 'Oppgave fullført!'
        };
        return messages[context] || 'Handling fullført';
    }
};

// Update handlers to use new toast features
function deleteTask(taskId) {
    utils.confirmAction('Er du sikker på at du vil slette denne oppgaven?', () => {
        utils.dbRemove(`tasks/${taskId}`)
            .then(() => utils.showToast(utils.getSuccessMessage('delete-task'), 'success'))
            .catch(error => utils.handleError(error, 'deleting task'));
    });
}

function handleTaskToggle(taskId, checkbox, li) {
    const newStatus = !checkbox.checked;
    database.ref(`tasks/${taskId}`).update({ completed: newStatus })
        .then(() => {
            li.classList.toggle('completed-task', newStatus);
            checkbox.checked = newStatus;
            if (newStatus) {
                celebrateWithPig();
                utils.showToast(utils.getSuccessMessage('complete-task'), 'success');
            }
        })
        .catch(error => utils.handleError(error, 'toggling task'));
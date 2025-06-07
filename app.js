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
        const elements = {
            container: utils.createElement('li', 'task-item'),
            checkbox: utils.createElement('input'),
            text: utils.createElement('span', 'task-text', task.text),
            category: utils.createElement('select', 'task-category-select'),
            priority: utils.createElement('span', `task-priority priority-${(task.priority || 'mid').toLowerCase()}`, task.priority || 'Mid'),
            delete: utils.createElement('button', 'delete-button', '✖')
        };
        
        elements.container.setAttribute('data-id', task.id);
        elements.checkbox.type = 'checkbox';
        elements.checkbox.checked = task.completed;
        elements.delete.title = 'Slett Oppgave';
        
        return elements;
    },

    handleError(error, context = '') {
        console.error(`Error ${context}:`, error);
        // Could be extended to show user-friendly error messages
    },

    dbRef(path) {
        return database.ref(path);
    },

    dbUpdate(path, data) {
        return this.dbRef(path).update(data)
            .catch(error => this.handleError(error, `updating ${path}`));
    },

    dbRemove(path) {
        return this.dbRef(path).remove()
            .catch(error => this.handleError(error, `removing ${path}`));
    },

    dbSet(path, data) {
        return this.dbRef(path).set(data)
            .catch(error => this.handleError(error, `setting ${path}`));
    },

    errorHandlers: {
        db: (error, operation) => {
            console.error(`Database ${operation} failed:`, error);
            return Promise.reject(error);
        },
        ui: (error, context) => {
            console.error(`UI Error in ${context}:`, error);
        }
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
    }
};

// Create debug panel only if debug mode is enabled
if (DEBUG_MODE) {
    const debugPanelContainer = document.getElementById('debug-panel-container');
    if (debugPanelContainer) {
        debugPanelContainer.innerHTML = `
            <div class="event-counters-section">
                <div id="debug-panel" class="debug-panel visible">
                    ${utils.generateDebugPanel()}
                </div>
            </div>
        `;
    }
}

function updateEventCounters() {
    if (!DEBUG_MODE) return;
    const ids = {
        loadTasks: "counter-loadTasks",
        renderTasks: "counter-renderTasks",
        loadCategories: "counter-loadCategories",
        addTask: "counter-addTask",
        addCategory: "counter-addCategory",
        markAllComplete: "counter-markAllComplete",
        deleteCompleted: "counter-deleteCompleted",
        updateCharts: "counter-updateCharts",
        applyFilters: "counter-applyFilters",
        renderCategoriesList: "counter-renderCategoriesList",
        sortBy: "counter-sortBy",
        taskInputKeydown: "counter-taskInputKeydown",
        newCategoryInputKeydown: "counter-newCategoryInputKeydown",
        sortableOnEnd: "counter-sortableOnEnd"
    };
    for (let key in ids) {
        const el = document.getElementById(ids[key]);
        if (el) {
            el.innerText = eventCounters[key];
        }
    }
}

// DOM-elementer
const taskInput = document.getElementById('task-input');
const categorySelect = document.getElementById('category-select');
const prioritySelect = document.getElementById('priority-select');
const dueDateInput = document.getElementById('due-date-input');
const addTaskButton = document.getElementById('add-task-button');
const taskList = document.getElementById('task-list');

const categoryList = document.getElementById('category-list');
const newCategoryInput = document.getElementById('new-category-input');
const addCategoryButton = document.getElementById('add-category-button');
const searchInput = document.getElementById('search-input');
const sortBy = document.getElementById('sort-by');

const totalTasksElem = document.getElementById('total-tasks');
const completedTasksElem = document.getElementById('completed-tasks');
const completionPercentageElem = document.getElementById('completion-percentage');
let completionChartCtx; // Initialized in DOMContentLoaded

// Global declarations
let isReordering = false;
let categoriesCache = {};

// Add global variable to hold previous tasks data
let previousTasksData = null;

// Helper function to deeply compare objects
function deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;

    if (typeof obj1 !== 'object' || obj1 === null ||
        typeof obj2 !== 'object' || obj2 === null) {
        return obj1 === obj2;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (let key of keys1) {
        if (!obj2.hasOwnProperty(key)) return false;
        if (!deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
}

// Move applyFiltersAndRender before loadTasks
function applyFiltersAndRender(tasksData) {
    if (!tasksData) return;
    
    let filteredTasks = { ...tasksData };
    
    // Apply search filter if search input exists and has value
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = searchInput.value.toLowerCase().trim();
        filteredTasks = Object.keys(filteredTasks)
            .filter(key => {
                const task = filteredTasks[key];
                return task.text.toLowerCase().includes(searchTerm);
            })
            .reduce((obj, key) => {
                obj[key] = filteredTasks[key];
                return obj;
            }, {});
    }

    // Apply sort if sort selection exists
    if (sortBy && sortBy.value) {
        const tasks = Object.keys(filteredTasks).map(key => ({
            id: key,
            ...filteredTasks[key]
        }));

        switch (sortBy.value) {
            case 'dueDate':
                tasks.sort((a, b) => (a.dueDate || '') - (b.dueDate || ''));
                break;
            case 'priority':
                const priorityOrder = { 'Høy': 0, 'Mid': 1, 'Lav': 2 };
                tasks.sort((a, b) => 
                    (priorityOrder[a.priority || 'Mid'] || 1) - 
                    (priorityOrder[b.priority || 'Mid'] || 1)
                );
                break;
            case 'category':
                tasks.sort((a, b) => 
                    (categoriesCache[a.categoryId]?.name || '') 
                    .localeCompare(categoriesCache[b.categoryId]?.name || '')
                );
                break;
            case 'createdAt':
                tasks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
                break;
        }

        filteredTasks = tasks.reduce((obj, task) => {
            obj[task.id] = task;
            return obj;
        }, {});
    }

    if (DEBUG_MODE) {
        eventCounters.applyFilters++;
        updateEventCounters();
    }

    renderTasks(filteredTasks);
    updateCategoryStats(filteredTasks);
}

// Last inn Oppgaver
function loadTasks() {
    const tasksRef = utils.dbRef('tasks').orderByChild('order');
    utils.cleanup.add(tasksRef, 'value', snapshot => {
        if (DEBUG_MODE) {
            eventCounters.loadTasks++;
            updateEventCounters();
        }
        const tasksData = snapshot.val() || {};
        if (!deepEqual(tasksData, previousTasksData)) {
            previousTasksData = tasksData;
            applyFiltersAndRender(tasksData);
        }
    });
}

// Render Oppgaver
function renderTasks(tasks) {
    if (DEBUG_MODE) {
        eventCounters.renderTasks++;
        updateEventCounters();
    }
    if (!taskList) return;

    // Ensure taskArray is defined
    const taskArray = Object.keys(tasks).map(key => ({ id: key, ...tasks[key] }));

    if (taskArray.length === 0) {
        taskList.innerHTML = ""; // Clear existing content
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = searchInput && searchInput.value ? 'Ingen oppgaver matchet søket ditt.' : 'Ingen oppgaver ennå. Legg til en!';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#888888';
        taskList.appendChild(emptyMessage);
        updateCharts(tasks);
        return;
    }

    // Create a document fragment to batch DOM updates
    const fragment = document.createDocumentFragment();
    // Track existing task IDs using a Map to store the entire element
    const existingTasksMap = new Map();

    // Iterate through existing task items to collect their IDs
    for (let i = 0; i < taskList.children.length; i++) {
        const child = taskList.children[i];
        if (child.classList.contains('task-item')) {
            existingTasksMap.set(child.getAttribute('data-id'), child);
        }
    }

    taskArray.forEach(task => {
        let li;
        if (existingTasksMap.has(task.id)) {
            // Use existing task item if it exists
            li = existingTasksMap.get(task.id);
            existingTasksMap.delete(task.id); // Remove from map, so we know what to remove later

            // Update checkbox state
            const checkbox = li.querySelector('.checkbox-container input');
            if (checkbox && checkbox.checked !== task.completed) {
                checkbox.checked = task.completed;
                li.classList.toggle('completed-task', task.completed);
            }
        } else {
            const elements = utils.createTaskElements(task);
            
            // Setup event listeners
            elements.checkbox.addEventListener('change', () => {
                utils.safeUpdate(`tasks/${task.id}`, { completed: elements.checkbox.checked });
            });
            
            elements.text.addEventListener('dblclick', () => {
                elements.text.setAttribute('contenteditable', 'true');
                elements.text.focus();
            });

            elements.text.addEventListener('blur', () => {
                elements.text.setAttribute('contenteditable', 'false');
                const newText = elements.text.textContent.trim();
                if (newText === "") {
                    alert("Oppgaveteksten kan ikke være tom.");
                    elements.text.textContent = task.text;
                    return;
                }
                if (newText !== task.text) {
                    database.ref(`tasks/${task.id}`).update({ text: newText })
                        .catch(error => {
                            console.error('Feil ved oppdatering av oppgavetekst:', error);
                            elements.text.textContent = task.text; // Revert on error
                        });
                }
            });

            // Modify category editing: always allow inline editing.
            const categorySelectElem = document.createElement('select');
            categorySelectElem.className = 'task-category-select';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "Uten kategori";
            categorySelectElem.appendChild(defaultOption);
            
            // Populate options from cached categories
            for (let catId in categoriesCache) {
                const option = document.createElement('option');
                option.value = catId;
                option.textContent = categoriesCache[catId].name;
                categorySelectElem.appendChild(option);
            }
            
            // Set the dropdown value to task.categoryId if exists
            categorySelectElem.value = task.categoryId || "";
            
            // When selection changes, update the task's categoryId (and remove any customCategory).
            categorySelectElem.addEventListener('change', () => {
                const newCategory = categorySelectElem.value;
                database.ref(`tasks/${task.id}`).update({ categoryId: newCategory, customCategory: null })
                  .then(() => { console.log("Task category updated via dropdown"); })
                  .catch(error => { console.error("Error updating task category:", error); });
            });
            
            const prioritySpan = document.createElement('span');
            prioritySpan.className = `task-priority priority-${(task.priority || 'mid').toLowerCase()}`;
            prioritySpan.textContent = task.priority || 'Mid';
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            // Re-implement x change: set symbol to a stylish "✖"
            deleteButton.textContent = '✖';
            deleteButton.title = "Slett Oppgave";
            deleteButton.addEventListener('click', () => {
                database.ref(`tasks/${task.id}`).remove()
                    .catch(error => {
                        console.error('Feil ved sletting av oppgave:', error);
                    });
            });

            // Append interactive elements:
            li.appendChild(checkboxContainer);
            li.appendChild(taskTextSpan);
            li.appendChild(categorySelectElem);
            li.appendChild(prioritySpan);
            li.appendChild(deleteButton);
        }

        if (li.classList.contains('completed-task') !== task.completed) {
            li.classList.toggle('completed-task', task.completed);
        }

        fragment.appendChild(li);
    });

    // Remove any extra task items that are no longer in the data
    existingTasksMap.forEach(li => {
        taskList.removeChild(li);
    });

    taskList.appendChild(fragment); // Append all new or updated items at once
    updateCharts(tasks);
}

// Last inn Kategorier
function loadCategories() {
    const categoriesRef = database.ref('categories');
    // Ensure this listener is only added once
    categoriesRef.off();
    categoriesRef.on('value', snapshot => {
        const categoriesData = snapshot.val() || {};
        categoriesCache = categoriesData;
        if (categorySelect) {
            populateCategorySelect(categoriesData);
        }
        if (categoryList) {
            renderCategoriesList(categoriesData);
        }
    });
}

// Populer Kategori-dropdown
function populateCategorySelect(categories) {
    if (!categorySelect) return;
    // Changed: Removed disabled attribute so that '' is a valid selection.
    categorySelect.innerHTML = `<option value="" selected>Uten kategori</option>`;
    for (let id in categories) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = categories[id].name;
        categorySelect.appendChild(option);
    }
}

// Render Kategoriliste
function renderCategoriesList(categories) {
    if (DEBUG_MODE) {
        eventCounters.renderCategoriesList++;
        updateEventCounters();
    }
    if (!categoryList) return;
    categoryList.innerHTML = "";
    for (let id in categories) {
        const li = document.createElement('li');
        li.className = 'category-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'category-name';
        nameSpan.textContent = categories[id].name;
        nameSpan.setAttribute('contenteditable', 'false');

        nameSpan.addEventListener('dblclick', () => {
            nameSpan.setAttribute('contenteditable', 'true');
            nameSpan.focus();
        });

        nameSpan.addEventListener('blur', () => {
            nameSpan.setAttribute('contenteditable', 'false');
            const newName = nameSpan.textContent.trim();
            if (newName === "") {
                alert("Kategorinavnet kan ikke være tomt.");
                nameSpan.textContent = categories[id].name; // Revert to original
                return;
            }
            if (newName !== categories[id].name) {
                database.ref(`categories`).orderByChild('name').equalTo(newName).once('value', nameSnapshot => {
                    if (nameSnapshot.exists()) {
                        alert("Kategorinavnet finnes allerede!");
                        nameSpan.textContent = categories[id].name; // Revert
                    } else {
                        database.ref(`categories/${id}`).update({ name: newName })
                            .then(() => {
                                console.log('Kategori oppdatert');
                            })
                            .catch(error => {
                                console.error('Feil ved oppdatering av kategori:', error);
                                nameSpan.textContent = categories[id].name; // Revert on error
                            });
                    }
                });
            }
        });

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        // Re-implement x change: set symbol to a stylish "✖"
        deleteButton.textContent = '✖';
        deleteButton.title = "Slett Kategori";
        deleteButton.addEventListener('click', () => {
            deleteCategory(id);
        });

        li.appendChild(nameSpan);
        li.appendChild(deleteButton);
        categoryList.appendChild(li);
    }
}

// Slett Kategori og tilknyttede Oppgaver
function deleteCategory(categoryId) {
    const updates = {};
    return utils.dbRef('tasks')
        .orderByChild('categoryId')
        .equalTo(categoryId)
        .once('value')
        .then(snapshot => {
            snapshot.forEach(child => {
                updates[`tasks/${child.key}`] = null;
            });
            return utils.dbUpdate('', updates);
        })
        .then(() => utils.dbRemove(`categories/${categoryId}`))
        .catch(error => utils.handleError(error, 'deleting category'));
}

// Initialize SortableJS for Drag-and-Drop
if (taskList) {
    const sortable = new Sortable(taskList, {
        animation: 150,
        delay: 0,                // ensure no delay on tap events
        delayOnTouchOnly: true,  // only use delay for dragging, not tapping
        touchStartThreshold: 5,  // reduce threshold so taps register easily
        fallbackTolerance: 0,
        onEnd: function(evt) {
            if (evt.oldIndex === evt.newIndex) return;
            if (isReordering) return;
            isReordering = true;
            if (DEBUG_MODE) {
                eventCounters.sortableOnEnd++;
                updateEventCounters();
            }
            const tasksRef = database.ref(`tasks`);
            tasksRef.orderByChild('order').once('value', snapshot => {
                const tasks = [];
                snapshot.forEach(child => {
                    tasks.push({ id: child.key, ...child.val() });
                });
                const movedTask = tasks.splice(evt.oldIndex, 1)[0];
                tasks.splice(evt.newIndex, 0, movedTask);
                const updates = {};
                tasks.forEach((task, index) => {
                    if (task.order !== index) {
                        updates[`tasks/${task.id}/order`] = index;
                    }
                });
                database.ref().update(updates)
                    .catch(error => {
                        console.error('Feil ved oppdatering av oppgave rekkefølge:', error);
                    })
                    .finally(() => {
                        isReordering = false;
                    });
            });
        },
    });
}

// Initialize og Oppdater Diagrammer
let completionChartInstance;

function initializeCharts() {
    const localCompletionChartCtx = document.getElementById('completion-chart');

    if (localCompletionChartCtx) {
        // Cleanup any existing chart
        if (completionChartInstance) {
            completionChartInstance.destroy();
            completionChartInstance = null;
        }

        const config = {
            type: 'doughnut',
            data: {
                labels: ['Fullført', 'Ufullført'],
                datasets: [{ 
                    data: [0, 0],
                    backgroundColor: ['#89CFF0', '#F4C2C2']
                }]
            },
            options: { 
                responsive: false,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        position: 'bottom',
                        labels: {
                            boxWidth: 15,
                            padding: 15
                        }
                    }
                }
            }
        };

        completionChartInstance = new Chart(localCompletionChartCtx, config);
    }
}

// Helper functions for common DOM operations
function updateElement(element, value) {
    if (element) element.textContent = value;
}

function toggleClass(element, className, force) {
    if (element) element.classList.toggle(className, force);
}

function addClickHandler(element, handler) {
    if (!element) return;
    element.removeEventListener('click', handler); // Prevent duplicates
    element.addEventListener('click', handler);
}

// Update the updateCharts function to use helper
function updateCharts(tasks) {
    let total = 0;
    let completedCount = 0;

    for (let id in tasks) {
        total++;
        if (tasks[id].completed) completedCount++;
    }

    const percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    updateElement(totalTasksElem, total);
    updateElement(completedTasksElem, completedCount);
    updateElement(completionPercentageElem, `${percentage}%`);

    if (completionChartInstance) {
        completionChartInstance.data.datasets[0].data = [completedCount, total - completedCount];
        completionChartInstance.update();
    }
}

// Oppdater Kategoristatistikk
function updateCategoryStats(tasks) {
    const categoriesRef = database.ref(`categories`);
    categoriesRef.once('value', catSnapshot => {
        const categories = catSnapshot.val() || {};
        const categoryStats = {};
        for (let id in categories) {
            categoryStats[id] = { name: categories[id].name, total: 0, completed: 0 };
        }
        for (let taskId in tasks) {
            const task = tasks[taskId];
            if (task.categoryId && categoryStats[task.categoryId]) {
                categoryStats[task.categoryId].total++;
                if (task.completed) categoryStats[task.categoryId].completed++;
            }
        }
        displayCategoryStats(categoryStats);
    });
}

// Vis Kategoristatistikk
function displayCategoryStats(categoryStats) {
    const statsContainer = document.querySelector('.category-stats');
    if (!statsContainer) {
        console.error("Could not find .category-stats element.");
        return;
    }
    statsContainer.innerHTML = "";
    let hasStats = false;
    for (let id in categoryStats) {
        const stat = categoryStats[id];
        if (stat.total === 0) continue;
        hasStats = true;
        const p = document.createElement('p');
        const percentage = stat.total === 0 ? 0 : Math.round((stat.completed / stat.total) * 100);
        p.textContent = `${stat.name}: ${percentage}% fullført (${stat.completed}/${stat.total})`;
        statsContainer.appendChild(p);
    }
    if (!hasStats) {
        statsContainer.innerHTML = '<p>Ingen statistikk tilgjengelig.</p>';
    }
}

// Add a simpler event handler:
function simpleTouchHandler(element, callback) {
    if (element) {
        element.addEventListener('click', callback);
        element.addEventListener('touchstart', callback);
    }
}

// Global initialization guard
if (!window.__INITIALIZED__) {
	window.__INITIALIZED__ = true;
	
	document.addEventListener('DOMContentLoaded', () => {
		// Get chart context and initialize chart
		const completionChartElement = document.getElementById('completion-chart');
		if (completionChartElement) {
			completionChartCtx = completionChartElement.getContext('2d');
		}
		// Initialize chart, load categories and tasks
		initializeCharts();
		loadCategories();
		loadTasks();

		// Setup event listeners only once:
		if (addTaskButton) {
			addTaskButton.removeEventListener('click', addTaskHandler);
			addTaskButton.addEventListener('click', addTaskHandler);
		}
		if (addCategoryButton) {
			addCategoryButton.removeEventListener('click', addCategoryHandler);
			addCategoryButton.addEventListener('click', addCategoryHandler);
		}
		const markAllCompleteButton = document.getElementById('mark-all-complete');
		const deleteCompletedButton = document.getElementById('delete-completed');
		if (markAllCompleteButton) {
			markAllCompleteButton.addEventListener('click', markAllCompleteHandler);
		}
		if (deleteCompletedButton) {
			deleteCompletedButton.addEventListener('click', deleteCompletedHandler);
		}
		if (searchInput) {
			searchInput.removeEventListener('input', searchInputHandler);
			searchInput.addEventListener('input', searchInputHandler);
		}
		if (sortBy) {
			sortBy.removeEventListener('change', sortByHandler);
			sortBy.addEventListener('change', sortByHandler);
		}
		if (taskInput) {
			taskInput.removeEventListener('keydown', taskInputKeydownHandler);
			taskInput.addEventListener('keydown', taskInputKeydownHandler);
		}
		if (newCategoryInput) {
			newCategoryInput.removeEventListener('keydown', newCategoryInputKeydownHandler);
			newCategoryInput.addEventListener('keydown', newCategoryInputKeydownHandler);
		}
		// Optional log to verify initialization happens only once.
		console.log("Initialization complete – single instance of listeners attached.");
	});
}

// Handler functions defined here (or imported from another module)
function addTaskHandler() {
    if (DEBUG_MODE) {
        eventCounters.addTask++;
        updateEventCounters();
    }
    const taskText = taskInput.value.trim();
    const categoryId = categorySelect.value;
    const priority = prioritySelect.value;
    const createdAt = new Date().getTime();
    if (taskText === "") {
        alert("Vennligst fyll ut oppgavetekst.");
        return;
    }
    const tasksRef = database.ref(`tasks`);
    tasksRef.orderByChild('order').limitToLast(1).once('value', snapshot => {
        let newOrder = 0;
        snapshot.forEach(child => {
            newOrder = (Number.isFinite(child.val().order) ? child.val().order : -1) + 1;
        });
        if (snapshot.numChildren() === 0) {
            newOrder = 0;
        }
        const newTaskRef = tasksRef.push();
        newTaskRef.set({
            text: taskText,
            categoryId: categoryId,
            completed: false,
            priority: priority,
            createdAt: createdAt,
            order: newOrder
        }).then(() => {
            if(taskInput) taskInput.value = '';
        }).catch(error => {
            console.error('Feil ved legging til oppgave:', error);
        });
    });
}

function addCategoryHandler() {
    if (DEBUG_MODE) {
        eventCounters.addCategory++;
        updateEventCounters();
    }
    const categoryName = newCategoryInput.value.trim();
    if (categoryName === "") {
        alert("Kategorinavnet kan ikke være tomt.");
        return;
    }
    database.ref(`categories`).orderByChild('name').equalTo(categoryName).once('value', nameSnapshot => {
        if (nameSnapshot.exists()) {
            alert("Kategorinavnet finnes allerede!");
        } else {
            const newCategoryRef = database.ref(`categories`).push();
            newCategoryRef.set({ name: categoryName })
                .then(() => {
                    console.log("Ny kategori lagt til.");
                    if(newCategoryInput) newCategoryInput.value = '';
                })
                .catch(error => {
                    console.error("Feil ved legging til kategori:", error);
                });
        }
    });
}

function markAllCompleteHandler() {
    if (DEBUG_MODE) {
        eventCounters.markAllComplete++;
        updateEventCounters();
    }
    if (confirm("Er du sikker på at du vil markere alle oppgaver som fullført?")) {
        const tasksRef = database.ref('tasks');
        tasksRef.once('value', snapshot => {
            const updates = {};
            snapshot.forEach(child => {
                updates[`${child.key}/completed`] = true;
            });
            tasksRef.update(updates)
                .catch(error => console.error('Feil ved bulk oppdatering av oppgaver:', error));
        });
    }
}

function deleteCompletedHandler() {
    if (DEBUG_MODE) {
        eventCounters.deleteCompleted++;
        updateEventCounters();
    }
    if (confirm("Er du sikker på at du vil slette alle fullførte oppgaver?")) {
        const tasksRef = database.ref('tasks');
        tasksRef.orderByChild('completed').equalTo(true).once('value', snapshot => {
            const updates = {};
            snapshot.forEach(child => {
                updates[child.key] = null;
            });
            tasksRef.update(updates).catch(error => console.error('Feil ved bulk sletting av oppgaver:', error));
        });
    }
}

function searchInputHandler() {
    const tasksRef = database.ref(`tasks`).orderByChild('order');
    tasksRef.once('value', snapshot => {
        const tasksData = snapshot.val() || {};
        applyFiltersAndRender(tasksData);
    });
}

function sortByHandler() {
    if (DEBUG_MODE) {
        eventCounters.sortBy++;
        updateEventCounters();
    }
    const tasksRef = database.ref(`tasks`).orderByChild('order');
    tasksRef.once('value', snapshot => {
        const tasksData = snapshot.val() || {};
        applyFiltersAndRender(tasksData);
    });
}

function taskInputKeydownHandler(e) {
    if (DEBUG_MODE) {
        eventCounters.taskInputKeydown++;
        updateEventCounters();
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        addTaskButton.click();
    }
}
function newCategoryInputKeydownHandler(e) {
    if (DEBUG_MODE) {
        eventCounters.newCategoryInputKeydown++;
        updateEventCounters();
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        addCategoryButton.click();
    }
}

// Consolidated task toggle handler
function handleTaskToggle(taskId, checkbox, li) {
    const newStatus = !checkbox.checked;
    database.ref(`tasks/${taskId}`).update({ completed: newStatus })
        .then(() => {
            li.classList.toggle('completed-task', newStatus);
            checkbox.checked = newStatus;
        })
        .catch(error => {
            console.error("Error toggling task completion:", error);
        });
}

// Replace old click handlers with this single handler
taskList.addEventListener("click", function(e) {
    // Exclude interactive elements
    const excluded = ["BUTTON", "INPUT", "SELECT", "TEXTAREA"];
    if (excluded.includes(e.target.tagName)) return;
    
    const li = e.target.closest("li.task-item");
    if (!li) return;
    
    const taskId = li.getAttribute("data-id");
    const checkbox = li.querySelector(".checkbox-container input");
    if (!checkbox) return;
    
    handleTaskToggle(taskId, checkbox, li);
});
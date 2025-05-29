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

// Initialize SortableJS for Drag-and-Drop only on non-mobile devices
if (taskList && !window.matchMedia('(pointer: coarse)').matches) {
    const sortable = new Sortable(taskList, {
        animation: 150,
        delay: 0,                // ensure no delay on tap events
        delayOnTouchOnly: true,  // only use delay for dragging, not tapping
        touchStartThreshold: 5,  // reduce threshold so taps register easily
        fallbackTolerance: 0,    // Ensures clicks register on all tasks on both mobile and PC
        onEnd: function(evt) {
            const itemEl = evt.item;
            const newIndex = evt.newIndex;
            // const taskId = itemEl.getAttribute('data-id'); // taskId not directly used here for reordering all
            // Oppdater rekkefølgen i databasen
            const tasksRef = database.ref(`tasks`);
            tasksRef.orderByChild('order').once('value', snapshot => {
                const tasks = [];
                snapshot.forEach(child => {
                    tasks.push({ id: child.key, ...child.val() });
                });
                // Fjern oppgaven som ble flyttet
                const movedTask = tasks.splice(evt.oldIndex, 1)[0];
                // Sett oppgaven inn på den nye posisjonen
                tasks.splice(newIndex, 0, movedTask);
                // Oppdater 'order' for hver oppgave
                const updates = {};
                tasks.forEach((task, index) => {
                    updates[`tasks/${task.id}/order`] = index;
                });
                database.ref().update(updates)
                    .catch(error => {
                        console.error('Feil ved oppdatering av oppgave rekkefølge:', error);
                    });
            });
        },
    });
}


let categoriesCache = {};  // new global cache for categories

// Last inn Kategorier
function loadCategories() {
    const categoriesRef = database.ref(`categories`);
    categoriesRef.on('value', snapshot => {
        const categoriesData = snapshot.val() || {};
        categoriesCache = categoriesData; // store for task dropdowns
        if (categorySelect) { // Ensure categorySelect exists
             populateCategorySelect(categoriesData);
        }
        if (categoryList) { // Ensure categoryList exists
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
    const tasksRef = database.ref(`tasks`);
    tasksRef.orderByChild('categoryId').equalTo(categoryId).once('value', snapshot => {
        const updates = {};
        snapshot.forEach(child => {
            updates[`tasks/${child.key}`] = null; // Path for multi-path update
        });
        return database.ref().update(updates); // Use multi-path update
    }).then(() => {
        return database.ref(`categories/${categoryId}`).remove();
    }).catch(error => {
        console.error("Feil ved sletting av kategori og oppgaver:", error);
    });
}

// Last inn Oppgaver
function loadTasks() {
    const tasksRef = database.ref(`tasks`).orderByChild('order');
    tasksRef.on('value', snapshot => {
        const tasksData = snapshot.val() || {};
        applyFiltersAndRender(tasksData);
    });
}

// Render Oppgaver
function renderTasks(tasks) {
    if (!taskList) return;
    taskList.innerHTML = "";
    const taskArray = Object.keys(tasks).map(key => ({ id: key, ...tasks[key] }));

    if (taskArray.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = searchInput && searchInput.value ? 'Ingen oppgaver matchet søket ditt.' : 'Ingen oppgaver ennå. Legg til en!';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#888888';
        taskList.appendChild(emptyMessage);
        updateCharts(tasks); // Update charts even if empty 
        return;
    }

    taskArray.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.setAttribute('data-id', task.id);
        if (task.completed) {
            li.classList.add('completed-task'); // Changed from 'completed'
        }

        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'checkbox-container';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => {
            database.ref(`tasks/${task.id}`).update({ completed: checkbox.checked })
                .catch(error => {
                    console.error('Feil ved oppdatering av oppgave:', error);
                });
        });
        checkboxContainer.appendChild(checkbox);

        const taskTextSpan = document.createElement('span');
        taskTextSpan.className = 'task-text';
        taskTextSpan.textContent = task.text;
        taskTextSpan.setAttribute('contenteditable', 'false');

        taskTextSpan.addEventListener('dblclick', () => {
            taskTextSpan.setAttribute('contenteditable', 'true');
            taskTextSpan.focus();
        });

        taskTextSpan.addEventListener('blur', () => {
            taskTextSpan.setAttribute('contenteditable', 'false');
            const newText = taskTextSpan.textContent.trim();
            if (newText === "") {
                alert("Oppgaveteksten kan ikke være tom.");
                taskTextSpan.textContent = task.text;
                return;
            }
            if (newText !== task.text) {
                database.ref(`tasks/${task.id}`).update({ text: newText })
                    .catch(error => {
                        console.error('Feil ved oppdatering av oppgavetekst:', error);
                        taskTextSpan.textContent = task.text; // Revert on error
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
        
        // New listener: Click anywhere on li that is NOT an interactive element toggles completion.
        li.addEventListener('click', (e) => {
            if (!e.target.closest('button') &&
                !e.target.closest('input') &&
                !e.target.closest('select') &&
                !e.target.closest('textarea')) {
                    const newStatus = !task.completed;
                    database.ref(`tasks/${task.id}`).update({ completed: newStatus })
                      .then(() => {
                          li.classList.toggle('completed-task', newStatus); // Changed from 'completed'
                          const checkbox = li.querySelector('.checkbox-container input');
                          if (checkbox) checkbox.checked = newStatus;
                          task.completed = newStatus;
                      })
                      .catch(error => {
                          console.error("Error toggling task completion:", error);
                      });
            }
        });
        
        taskList.appendChild(li);
    });

    updateCharts(tasks);
}

// Applikasjonseksempel: Render oppgaver med filtre og sortering
function applyFiltersAndRender(tasks) {
    let filteredTasks = { ...tasks }; // Start with all tasks 

    // Filtrer basert på søk 
    if (searchInput && searchInput.value) {
        const query = searchInput.value.toLowerCase();
        const tempFiltered = {};
        for (let id in filteredTasks) {
            if (filteredTasks[id].text.toLowerCase().includes(query)) {
                tempFiltered[id] = filteredTasks[id];
            }
        }
        filteredTasks = tempFiltered;
    }
    
    const taskArray = Object.keys(filteredTasks).map(key => ({ id: key, ...filteredTasks[key] }));

    // Sorter oppgaver
    if (sortBy && sortBy.value) {
        const sortCriterion = sortBy.value;
        if (sortCriterion === 'dueDate') {
            // Use createdAt instead of dueDate
            taskArray.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        } else if (sortCriterion === 'priority') {
            const priorityOrder = { 'Høy': 1, 'Mid': 2, 'Lav': 3 };
            taskArray.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));
        } else if (sortCriterion === 'category') {
            taskArray.sort((a, b) => {
                const nameA = a.customCategory ||
                    (a.categoryId && categoriesCache[a.categoryId] ? categoriesCache[a.categoryId].name : "Uten kategori");
                const nameB = b.customCategory ||
                    (b.categoryId && categoriesCache[b.categoryId] ? categoriesCache[b.categoryId].name : "Uten kategori");
                return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
            });
        } else if (sortCriterion === 'createdAt') {
            taskArray.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        }
    }


    const sortedTasksObject = {};
    taskArray.forEach(task => {
        sortedTasksObject[task.id] = task;
    });

    renderTasks(sortedTasksObject);
}

// Initialize og Oppdater Diagrammer
let completionChartInstance;

function initializeCharts() {
    const localCompletionChartCtx = document.getElementById('completion-chart');

    if (localCompletionChartCtx && !completionChartInstance) {
        completionChartInstance = new Chart(localCompletionChartCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Fullført', 'Ufullført'],
                datasets: [{ 
                    data: [0, 0],
                    backgroundColor: ['#89CFF0', '#F4C2C2'] // baby blue & baby pink
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, // Add this line
                plugins: { legend: { position: 'bottom' } } 
            }
        });
    }
}

// Oppdater Diagrammer
function updateCharts(tasks) {
    let total = 0;
    let completedCount = 0;

    for (let id in tasks) {
        total++;
        if (tasks[id].completed) completedCount++;
    }

    const percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    if (totalTasksElem) totalTasksElem.textContent = total;
    if (completedTasksElem) completedTasksElem.textContent = completedCount;
    if (completionPercentageElem) completionPercentageElem.textContent = `${percentage}%`;

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
    if (!statsContainer) return;
    statsContainer.innerHTML = "";
    for (let id in categoryStats) {
        const stat = categoryStats[id];
        if (stat.total === 0) continue;
        const p = document.createElement('p');
        const percentage = stat.total === 0 ? 0 : Math.round((stat.completed / stat.total) * 100);
        p.textContent = `${stat.name}: ${percentage}% fullført (${stat.completed}/${stat.total})`;
        statsContainer.appendChild(p);
    }
}

// Add a simpler event handler:
function simpleTouchHandler(element, callback) {
    if (element) {
        element.addEventListener('click', callback);
        element.addEventListener('touchstart', callback);
    }
}

// Initialiser og Oppdater Diagrammer ved oppstart
document.addEventListener('DOMContentLoaded', () => {
    // Get chart context and initialize chart
    const completionChartElement = document.getElementById('completion-chart');
    if (completionChartElement) {
        completionChartCtx = completionChartElement.getContext('2d');
    }
    // In order: Initialize chart, load categories, and load tasks
    initializeCharts();
    loadCategories();
    loadTasks();
    // Setup event listeners in order (e.g., task input, category input, bulk buttons, etc.)
    // Replace standard click event listeners with bindTouchClick for better mobile support:
    if (addTaskButton) {
        simpleTouchHandler(addTaskButton, () => {
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
        });
    }
    
    if (addCategoryButton) {
        simpleTouchHandler(addCategoryButton, () => {
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
        });
    }
    const markAllCompleteButton = document.getElementById('mark-all-complete');
    if (markAllCompleteButton) {
        simpleTouchHandler(markAllCompleteButton, () => {
            if (confirm("Er du sikker på at du vil markere alle oppgaver som fullført?")) {
                const tasksRef = database.ref('tasks');
                tasksRef.once('value', snapshot => {
                    const updates = {};
                    snapshot.forEach(child => {
                        updates[`${child.key}/completed`] = true;
                    });
                    tasksRef.update(updates).catch(error => console.error('Feil ved bulk oppdatering av oppgaver:', error));
                });
            }
        });
    }
    const deleteCompletedButton = document.getElementById('delete-completed');
    if (deleteCompletedButton) {
        simpleTouchHandler(deleteCompletedButton, () => {
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
        });
    }
    // Listener for search input
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            // Re-fetch or re-filter tasks. For simplicity, re-load and re-apply.
             const tasksRef = database.ref(`tasks`).orderByChild('order');
             tasksRef.once('value', snapshot => { // Use once to avoid re-registering 'on'
                const tasksData = snapshot.val() || {};
                applyFiltersAndRender(tasksData);
            });
        });
    }

    // Listener for sort select
    if (sortBy) {
        sortBy.addEventListener('change', () => {
            const tasksRef = database.ref(`tasks`).orderByChild('order');
             tasksRef.once('value', snapshot => { 
                const tasksData = snapshot.val() || {};
                applyFiltersAndRender(tasksData);
            });
        });
    }

    // Add Enter key submission for new task input
    if (taskInput) {
        taskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTaskButton.click();
            }
        });
    }

    // Add Enter key submission for new category input
    if (newCategoryInput) {
        newCategoryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCategoryButton.click();
            }
        });
    }
});
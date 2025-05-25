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
const appSection = document.getElementById('app-section');
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
let priorityChartCtx; // Initialized in DOMContentLoaded

const themeToggleButton = document.getElementById('theme-toggle');

// Initialize SortableJS for Drag-and-Drop
if (taskList) { // Ensure taskList exists before initializing Sortable
    const sortable = new Sortable(taskList, {
        animation: 150,
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


// Last inn Kategorier
function loadCategories() {
    const categoriesRef = database.ref(`categories`);
    categoriesRef.on('value', snapshot => {
        const categoriesData = snapshot.val() || {};
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
    categorySelect.innerHTML = `<option value="" disabled selected>Velg kategori</option>`;
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
        deleteButton.textContent = '🗑️';
        deleteButton.title = "Slett Kategori";
        deleteButton.addEventListener('click', () => {
            if (confirm(`Er du sikker på at du vil slette kategorien "${categories[id].name}"? Alle tilknyttede oppgaver vil bli slettet.`)) {
                deleteCategory(id);
            }
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

// REMOVED DUPLICATE addCategoryButton Event Listener from here

// REMOVED DUPLICATE addTaskButton Event Listener from here

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
            li.classList.add('completed');
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

        const categorySpan = document.createElement('span');
        categorySpan.className = 'task-category';
        if (task.categoryId) {
            database.ref(`categories/${task.categoryId}`).once('value')
                .then(catSnapshot => {
                    if (catSnapshot.exists()) {
                        categorySpan.textContent = catSnapshot.val().name;
                    } else {
                        categorySpan.textContent = "Uten Kategori";
                    }
                }).catch(() => categorySpan.textContent = "Kategori Feil");
        } else {
            categorySpan.textContent = "Uten Kategori";
        }

        const prioritySpan = document.createElement('span');
        prioritySpan.className = `task-priority priority-${(task.priority || 'middels').toLowerCase()}`;
        prioritySpan.textContent = task.priority || 'Middels';
        
        const dueDateSpan = document.createElement('span');
        dueDateSpan.className = 'task-due-date';
        if (task.dueDate) {
            const dueDateObj = new Date(task.dueDate);
            dueDateSpan.textContent = `Forfall: ${dueDateObj.toLocaleDateString('no-NO')}`;
            if (new Date() > dueDateObj && !task.completed) {
                dueDateSpan.classList.add('overdue');
            }
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '🗑️';
        deleteButton.title = "Slett Oppgave";
        deleteButton.addEventListener('click', () => {
            if (confirm("Er du sikker på at du vil slette denne oppgaven?")) {
                database.ref(`tasks/${task.id}`).remove()
                    .catch(error => {
                        console.error('Feil ved sletting av oppgave:', error);
                    });
            }
        });

        li.appendChild(checkboxContainer);
        li.appendChild(taskTextSpan);
        li.appendChild(categorySpan);
        li.appendChild(prioritySpan);
        if (task.dueDate) li.appendChild(dueDateSpan);
        li.appendChild(deleteButton);

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
            taskArray.sort((a, b) => {
                if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                if (a.dueDate) return -1; // Tasks with due dates first
                if (b.dueDate) return 1;
                return 0;
            });
        } else if (sortCriterion === 'priority') {
            const priorityOrder = { 'Høy': 1, 'Middels': 2, 'Lav': 3 };
            taskArray.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));
        } else if (sortCriterion === 'createdAt') {
            taskArray.sort((a, b) => (a.order || 0) - (b.order || 0));
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
let priorityChartInstance;

function initializeCharts() {
    const localCompletionChartCtx = document.getElementById('completion-chart');
    const localPriorityChartCtx = document.getElementById('priority-chart');

    if (localCompletionChartCtx && !completionChartInstance) {
        completionChartInstance = new Chart(localCompletionChartCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Fullført', 'Ufullført'],
                datasets: [{ data: [0, 0], backgroundColor: ['#2ecc71', '#e74c3c'] }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
    if (localPriorityChartCtx && !priorityChartInstance) {
        priorityChartInstance = new Chart(localPriorityChartCtx.getContext('2d'), {
            type: 'pie',
            data: {
                labels: ['Høy', 'Middels', 'Lav'],
                datasets: [{ data: [0, 0, 0], backgroundColor: ['#e74c3c', '#f1c40f', '#2ecc71'] }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

// Oppdater Diagrammer
function updateCharts(tasks) {
    let total = 0;
    let completedCount = 0;
    const priorityCounts = { 'Høy': 0, 'Middels': 0, 'Lav': 0 };

    for (let id in tasks) {
        total++;
        if (tasks[id].completed) completedCount++;
        priorityCounts[tasks[id].priority] = (priorityCounts[tasks[id].priority] || 0) + 1;
    }

    const percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    if (totalTasksElem) totalTasksElem.textContent = total;
    if (completedTasksElem) completedTasksElem.textContent = completedCount;
    if (completionPercentageElem) completionPercentageElem.textContent = `${percentage}%`;

    if (completionChartInstance) {
        completionChartInstance.data.datasets[0].data = [completedCount, total - completedCount];
        completionChartInstance.update();
    }
    if (priorityChartInstance) {
        priorityChartInstance.data.datasets[0].data = [priorityCounts['Høy'], priorityCounts['Middels'], priorityCounts['Lav']];
        priorityChartInstance.update();
    }
    updateCategoryStats(tasks);
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

// Tema-toggle Funksjonalitet
function updateThemeButton(theme) {
    if (themeToggleButton) {
        themeToggleButton.textContent = theme === 'dark' ? '☀️ Lys Modus' : '🌙 Mørk Modus';
    }
}

// Initialiser og Oppdater Diagrammer ved oppstart
document.addEventListener('DOMContentLoaded', () => {
    // Get chart contexts here as DOM is ready
    const completionChartElement = document.getElementById('completion-chart');
    if (completionChartElement) {
        completionChartCtx = completionChartElement.getContext('2d');
    }
    const priorityChartElement = document.getElementById('priority-chart');
    if (priorityChartElement) {
        priorityChartCtx = priorityChartElement.getContext('2d');
    }
    
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            let currentTheme = document.documentElement.getAttribute('data-theme');
            let newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeButton(newTheme);
        });
    }
    
    // Initialize charts and load data
    initializeCharts();
    loadCategories();
    loadTasks();

    // Event Listeners for adding items
    if (addTaskButton) {
        addTaskButton.addEventListener('click', () => {
            const taskText = taskInput.value.trim();
            const categoryId = categorySelect.value;
            const priority = prioritySelect.value;
            const dueDateValue = dueDateInput.value;

            if (taskText === "" || !categoryId) { // Check if categoryId is empty or null
                alert("Vennligst fyll ut oppgavetekst og velg kategori.");
                return;
            }
            const dueDate = dueDateValue ? new Date(dueDateValue).getTime() : null;

            const tasksRef = database.ref(`tasks`);
            tasksRef.orderByChild('order').limitToLast(1).once('value', snapshot => {
                let newOrder = 0; // Default for the first task
                snapshot.forEach(child => { // Runs 0 or 1 time
                    const lastKnownOrder = child.val().order;
                    newOrder = (Number.isFinite(lastKnownOrder) ? lastKnownOrder : -1) + 1;
                });
                
                if (snapshot.numChildren() === 0) {
                    newOrder = 0; // Explicitly set to 0 if no tasks exist
                }


                const newTaskRef = tasksRef.push();
                newTaskRef.set({
                    text: taskText,
                    categoryId: categoryId,
                    completed: false,
                    priority: priority,
                    dueDate: dueDate,
                    order: newOrder // Use the calculated newOrder
                }).then(() => {
                    if(taskInput) taskInput.value = '';
                    if (dueDateInput) dueDateInput.value = '';
                    // categorySelect.value = ''; // Optionally reset category
                    // prioritySelect.value = 'Middels'; // Optionally reset priority
                }).catch(error => {
                    console.error('Feil ved legging til oppgave:', error);
                });
            });
        });
    }

    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', () => {
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

    // Event listeners for bulk actions
    const markAllCompleteButton = document.getElementById('mark-all-complete');
    if (markAllCompleteButton) {
        markAllCompleteButton.addEventListener('click', () => {
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
        deleteCompletedButton.addEventListener('click', () => {
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
});



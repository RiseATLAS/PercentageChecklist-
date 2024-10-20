// app.js

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
const storage = firebase.storage();

// DOM-elementer
const appSection = document.getElementById('app-section');
const taskInput = document.getElementById('task-input');
const categorySelect = document.getElementById('category-select');
const prioritySelect = document.getElementById('priority-select');
const dueDateInput = document.getElementById('due-date-input');
const addTaskButton = document.getElementById('add-task-button');
const taskList = document.getElementById('task-list');

const categoryList = document.getElementById('category-list');

const searchInput = document.getElementById('search-input');
const sortBy = document.getElementById('sort-by');

const totalTasksElem = document.getElementById('total-tasks');
const completedTasksElem = document.getElementById('completed-tasks');
const completionPercentageElem = document.getElementById('completion-percentage');
const completionChartCtx = document.getElementById('completion-chart').getContext('2d');
const priorityChartCtx = document.getElementById('priority-chart').getContext('2d');

const themeToggleButton = document.getElementById('theme-toggle');

// Initialize SortableJS for Drag-and-Drop
const sortable = new Sortable(taskList, {
    animation: 150,
    onEnd: function(evt) {
        const itemEl = evt.item;
        const newIndex = evt.newIndex;
        const taskId = itemEl.getAttribute('data-id');
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
            tasks.forEach((task, index) => {
                database.ref(`tasks/${task.id}`).update({ order: index })
                    .catch(error => {
                        console.error('Feil ved oppdatering av oppgave rekkefølge:', error);
                    });
            });
        });
    },
});

// Last inn Kategorier
function loadCategories() {
    const categoriesRef = database.ref(`categories`);
    categoriesRef.on('value', snapshot => {
        const categories = snapshot.val() || {};
        populateCategorySelect(categories);
        renderCategoriesList(categories);
    });
}

// Populer Kategori-dropdown
function populateCategorySelect(categories) {
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
    categoryList.innerHTML = "";
    for (let id in categories) {
        const li = document.createElement('li');
        li.className = 'category-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'category-name';
        nameSpan.textContent = categories[id].name;
        nameSpan.setAttribute('contenteditable', 'false');

        // Inline redigering ved dobbeltklikk
        nameSpan.addEventListener('dblclick', () => {
            nameSpan.setAttribute('contenteditable', 'true');
            nameSpan.focus();
        });

        // Lagre redigert kategorinavn
        nameSpan.addEventListener('blur', () => {
            nameSpan.setAttribute('contenteditable', 'false');
            const newName = nameSpan.textContent.trim();
            if (newName === "") {
                alert("Kategorinavnet kan ikke være tomt.");
                nameSpan.textContent = categories[id].name;
                return;
            }
            if (newName !== categories[id].name) {
                // Sjekk for dupliserte kategorinavn
                database.ref(`categories`).orderByChild('name').equalTo(newName).once('value', snapshot => {
                    if (snapshot.exists()) {
                        alert("Kategorinavnet finnes allerede!");
                        nameSpan.textContent = categories[id].name;
                    } else {
                        // Oppdater kategorinavn
                        database.ref(`categories/${id}`).update({ name: newName })
                            .then(() => {
                                console.log('Kategori oppdatert');
                            })
                            .catch(error => {
                                console.error('Feil ved oppdatering av kategori:', error);
                            });
                    }
                });
            }
        });

        // Slett Kategori-knapp
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
    // Slett alle oppgaver med denne kategoriId
    const tasksRef = database.ref(`tasks`);
    tasksRef.orderByChild('categoryId').equalTo(categoryId).once('value', snapshot => {
        const updates = {};
        snapshot.forEach(child => {
            updates[child.key] = null;
        });
        return tasksRef.update(updates);
    }).then(() => {
        // Slett kategorien
        return database.ref(`categories/${categoryId}`).remove();
    }).catch(error => {
        console.error("Feil ved sletting av kategori og oppgaver:", error);
    });
}

// Legg til Oppgave
addTaskButton.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    const categoryId = categorySelect.value;
    const priority = prioritySelect.value;
    const dueDateValue = dueDateInput.value;

    if (taskText === "" || categoryId === "") {
        alert("Vennligst fyll ut oppgavetekst og velg kategori.");
        return;
    }

    const dueDate = dueDateValue ? new Date(dueDateValue).getTime() : null;

    // Finn høyeste 'order' for å legge til ny oppgave til slutt
    const tasksRef = database.ref(`tasks`);
    tasksRef.orderByChild('order').limitToLast(1).once('value', snapshot => {
        let order = 0;
        snapshot.forEach(child => {
            order = child.val().order + 1;
        });

        // Legg til oppgave
        const newTaskRef = tasksRef.push();
        newTaskRef.set({
            text: taskText,
            categoryId: categoryId,
            completed: false,
            priority: priority,
            dueDate: dueDate,
            order: order
        }).then(() => {
            taskInput.value = '';
            dueDateInput.value = '';
        }).catch(error => {
            console.error('Feil ved legging til oppgave:', error);
        });
    });
});

// Last inn Oppgaver
function loadTasks() {
    const tasksRef = database.ref(`tasks`).orderByChild('order');
    tasksRef.on('value', snapshot => {
        const tasks = snapshot.val() || {};
        applyFiltersAndRender(tasks);
    });
}

// Render Oppgaver
function renderTasks(tasks) {
    taskList.innerHTML = "";
    const taskArray = Object.keys(tasks).map(key => ({ id: key, ...tasks[key] }));
    if (taskArray.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'Ingen oppgaver matchet søket ditt.';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#888888';
        taskList.appendChild(emptyMessage);
        return;
    }

    taskArray.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.setAttribute('data-id', task.id);

        // Checkbox
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

        // Oppgavetekst
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;
        taskText.setAttribute('contenteditable', 'false');

        // Inline redigering ved dobbeltklikk
        taskText.addEventListener('dblclick', () => {
            taskText.setAttribute('contenteditable', 'true');
            taskText.focus();
        });

        // Lagre redigert oppgavetekst
        taskText.addEventListener('blur', () => {
            taskText.setAttribute('contenteditable', 'false');
            const newText = taskText.textContent.trim();
            if (newText === "") {
                alert("Oppgaveteksten kan ikke være tom.");
                taskText.textContent = task.text;
                return;
            }
            if (newText !== task.text) {
                database.ref(`tasks/${task.id}`).update({ text: newText })
                    .catch(error => {
                        console.error('Feil ved oppdatering av oppgavetekst:', error);
                    });
            }
        });

        // Kategorinavn
        const categorySpan = document.createElement('span');
        categorySpan.className = 'task-category';
        if (task.categoryId) {
            database.ref(`categories/${task.categoryId}`).once('value')
                .then(snapshot => {
                    if (snapshot.exists()) {
                        categorySpan.textContent = snapshot.val().name;
                    } else {
                        categorySpan.textContent = "Uten Kategori";
                    }
                });
        } else {
            categorySpan.textContent = "Uten Kategori";
        }

        // Prioritet
        const prioritySpan = document.createElement('span');
        prioritySpan.className = 'task-priority';
        prioritySpan.textContent = task.priority;
        prioritySpan.style.marginLeft = '10px';
        prioritySpan.style.fontSize = '12px';
        prioritySpan.style.padding = '2px 6px';
        prioritySpan.style.borderRadius = '4px';
        if (task.priority === 'Høy') {
            prioritySpan.style.backgroundColor = '#e74c3c';
            prioritySpan.style.color = '#ffffff';
        } else if (task.priority === 'Middels') {
            prioritySpan.style.backgroundColor = '#f1c40f';
            prioritySpan.style.color = '#ffffff';
        } else {
            prioritySpan.style.backgroundColor = '#2ecc71';
            prioritySpan.style.color = '#ffffff';
        }

        // Forfallsdato
        const dueDateSpan = document.createElement('span');
        dueDateSpan.className = 'task-due-date';
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            dueDateSpan.textContent = `Forfall: ${dueDate.toLocaleDateString('no-NO')}`;
            dueDateSpan.style.marginLeft = '10px';
            dueDateSpan.style.fontSize = '12px';
            if (new Date() > dueDate && !task.completed) {
                dueDateSpan.style.color = '#e74c3c';
            }
        }

        // Slett Oppgave-knapp
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

        // Legg til elementer i oppgave-elementet
        li.appendChild(checkboxContainer);
        li.appendChild(taskText);
        li.appendChild(categorySpan);
        li.appendChild(prioritySpan);
        li.appendChild(dueDateSpan);
        li.appendChild(deleteButton);

        taskList.appendChild(li);
    });

    // Oppdater Diagrammer
    updateCharts(tasks);
}

// Applikasjonseksempel: Render oppgaver med filtre og sortering
function applyFiltersAndRender(tasks) {
    let filteredTasks = {};

    // Filtrer basert på søk
    const query = searchInput.value.toLowerCase();
    for (let id in tasks) {
        if (tasks[id].text.toLowerCase().includes(query)) {
            filteredTasks[id] = tasks[id];
        }
    }

    // Sorter oppgaver
    const sortCriterion = sortBy.value;
    const taskArray = Object.keys(filteredTasks).map(key => ({ id: key, ...filteredTasks[key] }));
    if (sortCriterion === 'dueDate') {
        taskArray.sort((a, b) => {
            if (a.dueDate && b.dueDate) {
                return a.dueDate - b.dueDate;
            } else if (a.dueDate) {
                return -1;
            } else if (b.dueDate) {
                return 1;
            } else {
                return 0;
            }
        });
    } else if (sortCriterion === 'priority') {
        const priorityOrder = { 'Høy': 1, 'Middels': 2, 'Lav': 3 };
        taskArray.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortCriterion === 'createdAt') {
        // Anta at 'order' representerer opprettelsesrekkefølgen
        taskArray.sort((a, b) => a.order - b.order);
    }

    // Konverter tilbake til objekt
    const sortedTasks = {};
    taskArray.forEach(task => {
        sortedTasks[task.id] = task;
    });

    renderTasks(sortedTasks);
}

// Initialize og Oppdater Diagrammer
let completionChart;
let priorityChart;

function initializeCharts() {
    completionChart = new Chart(completionChartCtx, {
        type: 'doughnut',
        data: {
            labels: ['Fullført', 'Ufullført'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['#2ecc71', '#e74c3c'],
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });

    priorityChart = new Chart(priorityChartCtx, {
        type: 'pie',
        data: {
            labels: ['Høy', 'Middels', 'Lav'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#e74c3c', '#f1c40f', '#2ecc71'],
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

// Oppdater Diagrammer
function updateCharts(tasks) {
    let total = 0;
    let completed = 0;
    const priorityCounts = { 'Høy': 0, 'Middels': 0, 'Lav': 0 };

    for (let id in tasks) {
        total++;
        if (tasks[id].completed) completed++;
        if (priorityCounts[tasks[id].priority] !== undefined) {
            priorityCounts[tasks[id].priority]++;
        }
    }

    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    totalTasksElem.textContent = total;
    completedTasksElem.textContent = completed;
    completionPercentageElem.textContent = `${percentage}%`;

    // Oppdater Completion Chart
    completionChart.data.datasets[0].data = [completed, total - completed];
    completionChart.update();

    // Oppdater Priority Chart
    priorityChart.data.datasets[0].data = [priorityCounts['Høy'], priorityCounts['Middels'], priorityCounts['Lav']];
    priorityChart.update();

    // Kategoristats
    updateCategoryStats(tasks);
}

// Oppdater Kategoristatistikk
function updateCategoryStats(tasks) {
    const categoriesRef = database.ref(`categories`);
    categoriesRef.once('value', snapshot => {
        const categories = snapshot.val() || {};
        const categoryStats = {};

        for (let id in categories) {
            categoryStats[id] = { name: categories[id].name, total: 0, completed: 0 };
        }

        for (let id in tasks) {
            const task = tasks[id];
            if (task.categoryId && categoryStats[task.categoryId]) {
                categoryStats[task.categoryId].total++;
                if (task.completed) {
                    categoryStats[task.categoryId].completed++;
                }
            }
        }

        displayCategoryStats(categoryStats);
    });
}

// Vis Kategoristatistikk
function displayCategoryStats(categoryStats) {
    const statsContainer = document.querySelector('.category-stats');
    statsContainer.innerHTML = ""; // Tøm eksisterende innhold

    for (let id in categoryStats) {
        const stat = categoryStats[id];
        if (stat.total === 0) continue; // Ikke vis kategorier uten oppgaver

        const p = document.createElement('p');
        const percentage = stat.total === 0 ? 0 : Math.round((stat.completed / stat.total) * 100);
        p.textContent = `${stat.name}: ${percentage}% fullført (${stat.completed}/${stat.total})`;
        statsContainer.appendChild(p);
    }
}

// Tema-toggle Funksjonalitet
// Sjekk for lagret tema i localStorage
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeButton(savedTheme);

themeToggleButton.addEventListener('click', () => {
    let currentTheme = document.documentElement.getAttribute('data-theme');
    let newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
});

function updateThemeButton(theme) {
    if (theme === 'dark') {
        themeToggleButton.textContent = '☀️ Lys Modus';
    } else {
        themeToggleButton.textContent = '🌙 Mørk Modus';
    }
}

// Initialiser og Oppdater Diagrammer ved oppstart
document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    loadCategories();
    loadTasks();
});

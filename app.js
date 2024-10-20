// app.js

// Firebase Konfigurasjon
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

// DOM Elementer
const taskInput = document.getElementById('task-input');
const categorySelect = document.getElementById('category-select');
const prioritySelect = document.getElementById('priority-select');
const dueDateInput = document.getElementById('due-date-input');
const addTaskButton = document.getElementById('add-task-button');
const taskList = document.getElementById('task-list');

const categoryInput = document.getElementById('category-input');
const addCategoryButton = document.getElementById('add-category-button');
const categoryList = document.getElementById('category-list');

const categoryStatsList = document.getElementById('category-stats-list');

const exportButton = document.getElementById('export-button');
const importFileInput = document.getElementById('import-file');
const importButton = document.getElementById('import-button');

const themeToggleButton = document.getElementById('theme-toggle');

// Statistikk Charts
const completionChartCtx = document.getElementById('completion-chart').getContext('2d');
const priorityChartCtx = document.getElementById('priority-chart').getContext('2d');
let completionChart;
let priorityChart;

// Tema Toggle
// Sjekk for lagret tema i localStorage
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeButton(savedTheme);

// Event Listener for Tema Toggle
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

// Legg til Kategori
addCategoryButton.addEventListener('click', () => {
    const categoryName = categoryInput.value.trim();
    if (categoryName === "") return;

    // Sjekk om kategori allerede finnes
    database.ref('categories').orderByChild('name').equalTo(categoryName).once('value', snapshot => {
        if (snapshot.exists()) {
            alert('Kategori eksisterer allerede!');
        } else {
            const newCategoryRef = database.ref('categories').push();
            newCategoryRef.set({
                name: categoryName
            });
            categoryInput.value = '';
        }
    });
});

// Lytt til endringer i kategorier og oppdater select og liste
database.ref('categories').on('value', snapshot => {
    const categories = snapshot.val();
    populateCategorySelect(categories);
    renderCategoriesList(categories);
    renderCategoryStats(categories);
});

// Populer Kategori Select Dropdown
function populateCategorySelect(categories) {
    categorySelect.innerHTML = `<option value="" disabled selected>Velg kategori</option>`;
    for (let id in categories) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = categories[id].name;
        categorySelect.appendChild(option);
    }
}

// Render Kategoriliste med inline redigering og sletting
function renderCategoriesList(categories) {
    categoryList.innerHTML = "";
    for (let id in categories) {
        const li = document.createElement('li');
        li.className = 'category-stats-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'category-name';
        nameSpan.textContent = categories[id].name;
        nameSpan.setAttribute('contenteditable', 'false');

        // Inline redigering ved dobbeltklikk
        nameSpan.addEventListener('dblclick', () => {
            nameSpan.setAttribute('contenteditable', 'true');
            nameSpan.focus();
        });

        // Lagre endret kategori navn ved blur
        nameSpan.addEventListener('blur', () => {
            nameSpan.setAttribute('contenteditable', 'false');
            const newName = nameSpan.textContent.trim();
            if (newName === "") {
                alert("Kategori navn kan ikke være tomt.");
                nameSpan.textContent = categories[id].name;
                return;
            }
            if (newName !== categories[id].name) {
                // Sjekk for duplikat
                database.ref('categories').orderByChild('name').equalTo(newName).once('value', snapshot => {
                    if (snapshot.exists()) {
                        alert('Kategori navn eksisterer allerede!');
                        nameSpan.textContent = categories[id].name;
                    } else {
                        // Oppdater kategori navn
                        database.ref(`categories/${id}`).update({ name: newName })
                            .then(() => {
                                // Oppdater alle oppgaver med denne kategorien
                                database.ref('tasks').orderByChild('categoryId').equalTo(id).once('value', taskSnapshot => {
                                    const updates = {};
                                    taskSnapshot.forEach(task => {
                                        updates[`${task.key}/categoryName`] = newName;
                                    });
                                    database.ref('tasks').update(updates);
                                });
                            })
                            .catch(error => {
                                console.error('Feil ved oppdatering av kategori:', error);
                            });
                    }
                });
            }
        });

        // Slett Kategori
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '🗑️';
        deleteButton.title = "Slett Kategori";
        deleteButton.addEventListener('click', () => {
            if (confirm(`Er du sikker på at du vil slette kategorien "${categories[id].name}"? Alle tilknyttede oppgaver vil også bli slettet.`)) {
                // Slett alle oppgaver med denne kategorien
                database.ref('tasks').orderByChild('categoryId').equalTo(id).once('value', taskSnapshot => {
                    const updates = {};
                    taskSnapshot.forEach(task => {
                        updates[task.key] = null;
                    });
                    database.ref('tasks').update(updates)
                        .then(() => {
                            // Slett kategorien
                            database.ref(`categories/${id}`).remove()
                                .catch(error => {
                                    console.error('Feil ved sletting av kategori:', error);
                                });
                        })
                        .catch(error => {
                            console.error('Feil ved sletting av oppgaver:', error);
                        });
                });
            }
        });

        li.appendChild(nameSpan);
        li.appendChild(deleteButton);
        categoryList.appendChild(li);
    }
}

// Legg til Oppgave
addTaskButton.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    const categoryId = categorySelect.value;
    const priority = prioritySelect.value;
    const dueDateValue = dueDateInput.value;

    if (taskText === "" || categoryId === "") return;

    const dueDate = dueDateValue ? dueDateInput.value : null;

    const newTaskRef = database.ref('tasks').push();
    newTaskRef.set({
        text: taskText,
        categoryId: categoryId,
        categoryName: getCategoryName(categoryId),
        completed: false,
        priority: priority,
        dueDate: dueDate,
        order: 0,
        attachments: []
    })
    .then(() => {
        taskInput.value = '';
        dueDateInput.value = '';
    })
    .catch(error => {
        console.error('Feil ved legge til oppgave:', error);
    });
});

// Hent Kategori Navn (samtidig som oppgaven legges til)
function getCategoryName(categoryId) {
    const categories = categorySelect.options;
    for (let i = 0; i < categories.length; i++) {
        if (categories[i].value === categoryId) {
            return categories[i].textContent;
        }
    }
    return "Uten Kategori";
}

// Lytt til endringer i oppgaver og render dem
database.ref('tasks').on('value', snapshot => {
    const tasks = snapshot.val();
    renderTasks(tasks);
    renderCategoryStats();
    updateCharts(tasks);
    updateCalendar(tasks);
});

// Render Oppgaver med Drag-and-Drop
function renderTasks(tasks) {
    taskList.innerHTML = "";
    const sortedTasks = sortTasks(tasks);
    sortedTasks.forEach(task => {
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

        // Oppgave Tekst
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;
        taskText.setAttribute('contenteditable', 'false');

        // Inline Redigering ved Dobbeltklikk
        taskText.addEventListener('dblclick', () => {
            taskText.setAttribute('contenteditable', 'true');
            taskText.focus();
        });

        // Lagre Redigert Oppgave Tekst
        taskText.addEventListener('blur', () => {
            taskText.setAttribute('contenteditable', 'false');
            const newText = taskText.textContent.trim();
            if (newText === "") {
                alert("Oppgave tekst kan ikke være tom.");
                taskText.textContent = task.text;
                return;
            }
            if (newText !== task.text) {
                database.ref(`tasks/${task.id}`).update({ text: newText })
                    .catch(error => {
                        console.error('Feil ved oppdatering av oppgave tekst:', error);
                    });
            }
        });

        // Kategori Navn
        const categorySpan = document.createElement('span');
        categorySpan.className = 'task-category';
        categorySpan.textContent = task.categoryName;

        // Prioritet
        const prioritySpan = document.createElement('span');
        prioritySpan.className = `task-priority ${task.priority}`;
        prioritySpan.textContent = task.priority;

        // Due Date
        const dueDateSpan = document.createElement('span');
        dueDateSpan.className = 'task-due-date';
        if (task.dueDate) {
            dueDateSpan.textContent = `Frist: ${formatDate(task.dueDate)}`;
            if (new Date() > new Date(task.dueDate) && !task.completed) {
                dueDateSpan.style.color = varCSS('--danger-color');
            }
        }

        // Vedlegg
        const attachmentsDiv = document.createElement('div');
        attachmentsDiv.className = 'attachments';
        if (task.attachments && task.attachments.length > 0) {
            task.attachments.forEach(url => {
                const link = document.createElement('a');
                link.href = url;
                link.target = '_blank';
                link.textContent = '📎';
                attachmentsDiv.appendChild(link);
            });
        }

        // Slett Oppgave
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

        // Append Elementer
        li.appendChild(checkboxContainer);
        li.appendChild(taskText);
        li.appendChild(categorySpan);
        li.appendChild(prioritySpan);
        li.appendChild(dueDateSpan);
        li.appendChild(attachmentsDiv);
        li.appendChild(deleteButton);

        taskList.appendChild(li);
    });

    // Initialize SortableJS etter rendering
    Sortable.create(taskList, {
        animation: 150,
        onEnd: function (evt) {
            const items = taskList.querySelectorAll('.task-item');
            const updates = {};
            items.forEach((item, index) => {
                const taskId = item.getAttribute('data-id');
                updates[`${taskId}/order`] = index;
            });
            database.ref('tasks').update(updates)
                .catch(error => {
                    console.error('Feil ved oppdatering av oppgave rekkefølge:', error);
                });
        },
    });
}

// Formater Dato
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('no-NO', options);
}

// Sorter Oppgaver basert på 'order'
function sortTasks(tasks) {
    const taskArray = [];
    for (let id in tasks) {
        taskArray.push({
            id: id,
            ...tasks[id]
        });
    }
    taskArray.sort((a, b) => a.order - b.order);
    return taskArray;
}

// Render Kategoristatistikk
function renderCategoryStats(categories) {
    // Hent alle oppgaver
    database.ref('tasks').once('value', snapshot => {
        const tasks = snapshot.val();
        const stats = {};

        // Initialiser stats per kategori
        for (let id in categories) {
            stats[id] = {
                name: categories[id].name,
                total: 0,
                completed: 0
            };
        }

        // Beregn stats
        for (let id in tasks) {
            const task = tasks[id];
            if (stats[task.categoryId]) {
                stats[task.categoryId].total += 1;
                if (task.completed) {
                    stats[task.categoryId].completed += 1;
                }
            }
        }

        // Render stats
        categoryStatsList.innerHTML = "";
        for (let id in stats) {
            const li = document.createElement('li');
            li.className = 'category-stats-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'category-name';
            nameSpan.textContent = stats[id].name;

            const dataSpan = document.createElement('span');
            dataSpan.className = 'category-stats-data';
            const percentage = stats[id].total === 0 ? 0 : Math.round((stats[id].completed / stats[id].total) * 100);
            dataSpan.textContent = `${stats[id].completed}/${stats[id].total} (${percentage}%)`;

            li.appendChild(nameSpan);
            li.appendChild(dataSpan);
            categoryStatsList.appendChild(li);
        }
    });
}

// Oppdater Statistikk og Kalender når oppgaver endres
database.ref('tasks').on('value', snapshot => {
    const tasks = snapshot.val();
    renderCategoryStats();
    updateCharts(tasks);
    updateCalendar(tasks);
});

// Eksporter Oppgaver som JSON
exportButton.addEventListener('click', () => {
    database.ref('tasks').once('value', snapshot => {
        const tasks = snapshot.val();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "tasks_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    })
    .catch(error => {
        console.error('Feil ved eksport av oppgaver:', error);
    });
});

// Importer Oppgaver fra JSON
importButton.addEventListener('click', () => {
    const file = importFileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const tasks = JSON.parse(e.target.result);
            for (let id in tasks) {
                database.ref(`tasks/${id}`).set(tasks[id])
                    .catch(error => {
                        console.error(`Feil ved import av oppgave ${id}:`, error);
                    });
            }
            alert('Oppgaver importert suksessfullt!');
            importFileInput.value = '';
        } catch (error) {
            alert('Ugyldig filformat.');
            console.error('Feil ved parsing av JSON:', error);
        }
    };
    reader.readAsText(file);
});

// Statistikk Charts
function initializeCharts() {
    // Fullføringsdiagram
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

    // Prioritetsdiagram
    priorityChart = new Chart(priorityChartCtx, {
        type: 'pie',
        data: {
            labels: ['Høy', 'Medium', 'Lav'],
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

// Oppdater Statistikk Charts
function updateCharts(tasks) {
    // Fullføringsdiagram
    const completed = Object.values(tasks).filter(task => task.completed).length;
    const incomplete = Object.keys(tasks).length - completed;
    completionChart.data.datasets[0].data = [completed, incomplete];
    completionChart.update();

    // Prioritetsdiagram
    const priorityCounts = { 'Høy': 0, 'Medium': 0, 'Lav': 0 };
    for (let id in tasks) {
        const task = tasks[id];
        if (priorityCounts[task.priority] !== undefined) {
            priorityCounts[task.priority]++;
        }
    }
    priorityChart.data.datasets[0].data = [priorityCounts['Høy'], priorityCounts['Medium'], priorityCounts['Lav']];
    priorityChart.update();
}

// Initialize Charts ved første innlasting
initializeCharts();

// Kalender Oppdatering
function updateCalendar(tasks) {
    // Fjern eksisterende hendelser
    if (calendar) {
        calendar.getEvents().forEach(event => event.remove());
        for (let id in tasks) {
            const task = tasks[id];
            if (task.dueDate) {
                calendar.addEvent({
                    title: task.text,
                    start: task.dueDate,
                    color: task.completed ? '#2ecc71' : '#e74c3c',
                });
            }
        }
    }
}

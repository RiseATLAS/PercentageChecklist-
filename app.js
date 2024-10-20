// app.js

// Firebase Configuration
// Replace the following with your Firebase project's configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const messaging = firebase.messaging();

// Enable Firestore Offline Persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.error('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
            console.error('The current browser does not support all of the features required to enable persistence');
        }
    });

// DOM Elements
const authSection = document.getElementById('auth-section');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');

const appSection = document.getElementById('app-section');
const logoutButton = document.getElementById('logout-button');

// Task Elements
const taskInput = document.getElementById('task-input');
const categorySelect = document.getElementById('category-select');
const prioritySelect = document.getElementById('priority-select');
const dueDateInput = document.getElementById('due-date-input');
const addTaskButton = document.getElementById('add-task-button');
const taskList = document.getElementById('task-list');

// Category Elements
const categoryInput = document.getElementById('category-input');
const addCategoryButton = document.getElementById('add-category-button');
const categoryList = document.getElementById('category-list');

// Search and Filters
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const filterPriority = document.getElementById('filter-priority');
const sortBy = document.getElementById('sort-by');
const clearFiltersButton = document.getElementById('clear-filters');

// Statistics Elements
const totalTasksElem = document.getElementById('total-tasks');
const completedTasksElem = document.getElementById('completed-tasks');
const completionPercentageElem = document.getElementById('completion-percentage');
const completionChartCtx = document.getElementById('completion-chart').getContext('2d');
const priorityChartCtx = document.getElementById('priority-chart').getContext('2d');
let completionChart;
let priorityChart;

// Calendar
let calendar;

// Data Export/Import
const exportButton = document.getElementById('export-button');
const importFileInput = document.getElementById('import-file');
const importButton = document.getElementById('import-button');

// Theme Toggle
const themeToggleButton = document.getElementById('theme-toggle');

// Initialize FullCalendar
document.addEventListener('DOMContentLoaded', function() {
    calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
        initialView: 'dayGridMonth',
        events: [],
    });
    calendar.render();
});

// Initialize SortableJS for Task Ordering
const sortable = new Sortable(taskList, {
    animation: 150,
    onEnd: function(evt) {
        const itemEl = evt.item;
        const newIndex = evt.newIndex;
        const taskId = itemEl.getAttribute('data-id');
        db.collection('users').doc(currentUser.uid).collection('tasks').doc(taskId).update({ order: newIndex })
            .then(() => {
                console.log('Task order updated');
            })
            .catch(error => {
                console.error('Error updating task order:', error);
            });
    },
});

// Current User
let currentUser = null;

// Authentication State Listener
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        loadCategories();
        loadTasks();
        initializeCalendar();
        initializeCharts();
    } else {
        currentUser = null;
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
    }
});

// Show Sign Up Form
showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});

// Show Login Form
showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

// Login Functionality
loginButton.addEventListener('click', () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
        })
        .catch(error => {
            alert(error.message);
        });
});

// Sign Up Functionality
signupButton.addEventListener('click', () => {
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            document.getElementById('signup-email').value = '';
            document.getElementById('signup-password').value = '';
            // Initialize user data
            db.collection('users').doc(auth.currentUser.uid).set({
                email: email,
            });
        })
        .catch(error => {
            alert(error.message);
        });
});

// Logout Functionality
logoutButton.addEventListener('click', () => {
    auth.signOut();
});

// Load Categories
function loadCategories() {
    db.collection('users').doc(currentUser.uid).collection('categories').orderBy('name').onSnapshot(snapshot => {
        const categories = [];
        snapshot.forEach(doc => {
            categories.push({ id: doc.id, ...doc.data() });
        });
        populateCategorySelect(categories);
        renderCategoriesList(categories);
    });
}

// Populate Category Select Dropdown
function populateCategorySelect(categories) {
    categorySelect.innerHTML = `<option value="" disabled selected>Select category</option>`;
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
}

// Render Categories List
function renderCategoriesList(categories) {
    categoryList.innerHTML = "";
    categories.forEach(category => {
        const li = document.createElement('li');
        li.className = 'category-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'category-name';
        nameSpan.textContent = category.name;
        nameSpan.setAttribute('contenteditable', 'false');

        // Inline Editing on Double Click
        nameSpan.addEventListener('dblclick', () => {
            nameSpan.setAttribute('contenteditable', 'true');
            nameSpan.focus();
        });

        // Save Edited Category Name
        nameSpan.addEventListener('blur', () => {
            nameSpan.setAttribute('contenteditable', 'false');
            const newName = nameSpan.textContent.trim();
            if (newName === "") {
                alert("Category name cannot be empty.");
                nameSpan.textContent = category.name;
                return;
            }
            if (newName !== category.name) {
                // Check for duplicate category name
                db.collection('users').doc(currentUser.uid).collection('categories')
                    .where('name', '==', newName).get()
                    .then(snapshot => {
                        if (snapshot.empty) {
                            // Update category name
                            db.collection('users').doc(currentUser.uid).collection('categories').doc(category.id).update({ name: newName })
                                .then(() => {
                                    console.log('Category updated');
                                })
                                .catch(error => {
                                    console.error('Error updating category:', error);
                                });
                        } else {
                            alert("Category name already exists!");
                            nameSpan.textContent = category.name;
                        }
                    });
            }
        });

        // Delete Category Button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '🗑️';
        deleteButton.title = "Delete Category";
        deleteButton.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete the category "${category.name}"? All associated tasks will be deleted.`)) {
                deleteCategory(category.id);
            }
        });

        li.appendChild(nameSpan);
        li.appendChild(deleteButton);
        categoryList.appendChild(li);
    });
}

// Delete Category and Associated Tasks
function deleteCategory(categoryId) {
    // Delete all tasks with this categoryId
    db.collection('users').doc(currentUser.uid).collection('tasks').where('categoryId', '==', categoryId).get()
        .then(snapshot => {
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            return batch.commit();
        })
        .then(() => {
            // Delete the category
            return db.collection('users').doc(currentUser.uid).collection('categories').doc(categoryId).delete();
        })
        .catch(error => {
            console.error("Error deleting category and tasks:", error);
        });
}

// Add Category
addCategoryButton.addEventListener('click', () => {
    const categoryName = categoryInput.value.trim();
    if (categoryName === "") return;

    // Check if category already exists
    db.collection('users').doc(currentUser.uid).collection('categories').where('name', '==', categoryName).get()
        .then(snapshot => {
            if (snapshot.empty) {
                db.collection('users').doc(currentUser.uid).collection('categories').add({
                    name: categoryName
                })
                .then(() => {
                    categoryInput.value = '';
                })
                .catch(error => {
                    console.error('Error adding category:', error);
                });
            } else {
                alert("Category already exists!");
            }
        });
});

// Load Tasks
function loadTasks() {
    db.collection('users').doc(currentUser.uid).collection('tasks').orderBy('order').onSnapshot(snapshot => {
        const tasks = [];
        snapshot.forEach(doc => {
            tasks.push({ id: doc.id, ...doc.data() });
        });
        applyFiltersAndRender(tasks);
        updateCalendar(tasks);
    });
}

// Apply Filters and Render Tasks
function applyFiltersAndRender(tasks) {
    let filteredTasks = [...tasks];

    // Search Filter
    const query = searchInput.value.toLowerCase();
    if (query) {
        filteredTasks = filteredTasks.filter(task => task.text.toLowerCase().includes(query));
    }

    // Status Filter
    const status = filterStatus.value;
    if (status === 'completed') {
        filteredTasks = filteredTasks.filter(task => task.completed);
    } else if (status === 'incomplete') {
        filteredTasks = filteredTasks.filter(task => !task.completed);
    }

    // Priority Filter
    const priority = filterPriority.value;
    if (priority !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.priority === priority);
    }

    // Sorting
    const sortCriterion = sortBy.value;
    if (sortCriterion === 'dueDate') {
        filteredTasks.sort((a, b) => {
            if (a.dueDate && b.dueDate) {
                return a.dueDate.seconds - b.dueDate.seconds;
            } else if (a.dueDate) {
                return -1;
            } else if (b.dueDate) {
                return 1;
            } else {
                return 0;
            }
        });
    } else if (sortCriterion === 'priority') {
        const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
        filteredTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortCriterion === 'createdAt') {
        filteredTasks.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);
    }

    renderTasks(filteredTasks);
    updateCharts(filteredTasks);
}

// Render Tasks
function renderTasks(tasks) {
    taskList.innerHTML = "";
    if (tasks.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No tasks added yet.';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#888888';
        taskList.appendChild(emptyMessage);
        return;
    }
    tasks.forEach(task => {
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
            db.collection('users').doc(currentUser.uid).collection('tasks').doc(task.id).update({ completed: checkbox.checked })
                .catch(error => {
                    console.error('Error updating task:', error);
                });
        });
        checkboxContainer.appendChild(checkbox);

        // Task Text
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;
        taskText.setAttribute('contenteditable', 'false');

        // Inline Editing on Double Click
        taskText.addEventListener('dblclick', () => {
            taskText.setAttribute('contenteditable', 'true');
            taskText.focus();
        });

        // Save Edited Task Text
        taskText.addEventListener('blur', () => {
            taskText.setAttribute('contenteditable', 'false');
            const newText = taskText.textContent.trim();
            if (newText === "") {
                alert("Task text cannot be empty.");
                taskText.textContent = task.text;
                return;
            }
            if (newText !== task.text) {
                db.collection('users').doc(currentUser.uid).collection('tasks').doc(task.id).update({ text: newText })
                    .catch(error => {
                        console.error('Error updating task text:', error);
                    });
            }
        });

        // Category Name
        const categorySpan = document.createElement('span');
        categorySpan.className = 'task-category';
        if (task.categoryId) {
            db.collection('users').doc(currentUser.uid).collection('categories').doc(task.categoryId).get()
                .then(doc => {
                    if (doc.exists) {
                        categorySpan.textContent = doc.data().name;
                    } else {
                        categorySpan.textContent = "Uncategorized";
                    }
                });
        } else {
            categorySpan.textContent = "Uncategorized";
        }

        // Priority Indicator
        const prioritySpan = document.createElement('span');
        prioritySpan.className = 'task-priority';
        prioritySpan.textContent = task.priority;
        prioritySpan.style.marginLeft = '10px';
        prioritySpan.style.fontSize = '12px';
        prioritySpan.style.padding = '2px 6px';
        prioritySpan.style.borderRadius = '4px';
        if (task.priority === 'High') {
            prioritySpan.style.backgroundColor = '#e74c3c';
            prioritySpan.style.color = '#ffffff';
        } else if (task.priority === 'Medium') {
            prioritySpan.style.backgroundColor = '#f1c40f';
            prioritySpan.style.color = '#ffffff';
        } else {
            prioritySpan.style.backgroundColor = '#2ecc71';
            prioritySpan.style.color = '#ffffff';
        }

        // Due Date
        const dueDateSpan = document.createElement('span');
        dueDateSpan.className = 'task-due-date';
        if (task.dueDate) {
            const dueDate = task.dueDate.toDate();
            dueDateSpan.textContent = `Due: ${dueDate.toLocaleDateString()}`;
            dueDateSpan.style.marginLeft = '10px';
            dueDateSpan.style.fontSize = '12px';
            if (new Date() > dueDate && !task.completed) {
                dueDateSpan.style.color = '#e74c3c';
            }
        }

        // Attachments
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

        // Delete Task Button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '🗑️';
        deleteButton.title = "Delete Task";
        deleteButton.addEventListener('click', () => {
            if (confirm("Are you sure you want to delete this task?")) {
                db.collection('users').doc(currentUser.uid).collection('tasks').doc(task.id).delete()
                    .catch(error => {
                        console.error('Error deleting task:', error);
                    });
            }
        });

        // Append Elements
        li.appendChild(checkboxContainer);
        li.appendChild(taskText);
        li.appendChild(categorySpan);
        li.appendChild(prioritySpan);
        li.appendChild(dueDateSpan);
        li.appendChild(attachmentsDiv);
        li.appendChild(deleteButton);

        taskList.appendChild(li);
    });
}

// Add Task Functionality
addTaskButton.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    const categoryId = categorySelect.value;
    const priority = prioritySelect.value;
    const dueDateValue = dueDateInput.value;

    if (taskText === "" || categoryId === "") return;

    const dueDate = dueDateValue ? firebase.firestore.Timestamp.fromDate(new Date(dueDateValue)) : null;

    db.collection('users').doc(currentUser.uid).collection('tasks').add({
        text: taskText,
        categoryId: categoryId,
        completed: false,
        priority: priority,
        dueDate: dueDate,
        order: 0,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        attachments: []
    })
    .then(() => {
        taskInput.value = '';
        dueDateInput.value = '';
    })
    .catch(error => {
        console.error('Error adding task:', error);
    });
});

// Initialize Calendar with Tasks
function initializeCalendar() {
    db.collection('users').doc(currentUser.uid).collection('tasks').where('dueDate', '!=', null).onSnapshot(snapshot => {
        const events = [];
        snapshot.forEach(doc => {
            const task = doc.data();
            events.push({
                title: task.text,
                start: task.dueDate.toDate(),
                color: task.completed ? '#2ecc71' : '#e74c3c',
            });
        });
        calendar.removeAllEvents();
        calendar.addEventSource(events);
    });
}

// Update Calendar (optional redundancy)
function updateCalendar(tasks) {
    // Already handled by initializeCalendar via snapshot listener
}

// Initialize Charts
function initializeCharts() {
    completionChart = new Chart(completionChartCtx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Incomplete'],
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
            labels: ['High', 'Medium', 'Low'],
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

// Update Charts with Statistics
function updateCharts(tasks) {
    // Completion Chart
    const completed = tasks.filter(task => task.completed).length;
    const incomplete = tasks.length - completed;
    completionChart.data.datasets[0].data = [completed, incomplete];
    completionChart.update();

    // Priority Chart
    const priorityCounts = { 'High': 0, 'Medium': 0, 'Low': 0 };
    tasks.forEach(task => {
        if (priorityCounts[task.priority] !== undefined) {
            priorityCounts[task.priority]++;
        }
    });
    priorityChart.data.datasets[0].data = [priorityCounts['High'], priorityCounts['Medium'], priorityCounts['Low']];
    priorityChart.update();
}

// Search, Filter, and Sort Functionality
function applyFiltersAndRender(tasks) {
    // This function is already called in loadTasks via onSnapshot
}

// Export Tasks as JSON
exportButton.addEventListener('click', () => {
    db.collection('users').doc(currentUser.uid).collection('tasks').get()
        .then(snapshot => {
            const tasks = [];
            snapshot.forEach(doc => {
                tasks.push(doc.data());
            });
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "tasks_backup.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        })
        .catch(error => {
            console.error('Error exporting tasks:', error);
        });
});

// Import Tasks from JSON
importButton.addEventListener('click', () => {
    const file = importFileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const tasks = JSON.parse(e.target.result);
            tasks.forEach(task => {
                db.collection('users').doc(currentUser.uid).collection('tasks').add(task)
                    .catch(error => {
                        console.error('Error importing task:', error);
                    });
            });
            alert('Tasks imported successfully!');
            importFileInput.value = '';
        } catch (error) {
            alert('Invalid file format.');
            console.error('Error parsing JSON:', error);
        }
    };
    reader.readAsText(file);
});

// Theme Toggle Functionality
// Check for saved theme in localStorage
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
        themeToggleButton.textContent = '☀️ Light Mode';
    } else {
        themeToggleButton.textContent = '🌙 Dark Mode';
    }
}

// Data Import/Export is already handled above

// Additional Functionalities like Attachments, Subtasks, Notifications, etc., can be implemented similarly.

// Note: For advanced functionalities like push notifications, drag-and-drop ordering, and offline support, additional configurations and code are required. Ensure to handle permissions and security rules appropriately.

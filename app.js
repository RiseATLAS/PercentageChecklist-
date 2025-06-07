/**
 * Requirements:
 * 1. Basic Task Management:
 *    - Add new tasks
 *    - Mark tasks complete/incomplete
 *    - Delete tasks
 *    - Edit task text
 * 
 * 2. Simple Data Storage:
 *    - Save to Firebase
 *    - Load from Firebase
 * 
 * 3. Basic UI:
 *    - Task list display
 *    - Simple progress bar
 *    - Basic error messages
 * 
 * 4. Categories:
 *    - Add tasks to categories
 *    - Filter by category
 *    Tasks can be assigned to categories, and the UI should allow filtering tasks by category.
 *    - Categories can conttain tasks, and tasks can be assigned to categories.
 *   -  a button on the categories allows all realated tasks to be store and retrieved.
 * 
 */

// Firebase config
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
const db = firebase.database();

// Simplified utilities
const utils = {
    dbRef(path = null) {
        return path ? db.ref(path) : db.ref();
    },

    async saveTask(task) {
        try {
            await this.dbRef(`tasks/${task.id}`).set(task);
        } catch (error) {
            console.error('Error saving task:', error);
        }
    },

    async deleteTask(taskId) {
        try {
            await this.dbRef(`tasks/${taskId}`).remove();
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    },

    showError(message, type = 'error', duration = 3000) {
        const errorDiv = document.getElementById('errorMessages');
        if (errorDiv) {
            errorDiv.className = `message-box ${type}`;
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => errorDiv.style.display = 'none', duration);
        }
    },

    createTaskElement(task) {
        const li = document.createElement('li');
        li.dataset.id = task.id;
        li.className = task.completed ? 'task-item completed' : 'task-item';
        li.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''}>
            <span class="task-text" contenteditable="true">${task.text}</span>
            <select class="category-select">
                <option value="">No Category</option>
                ${Object.entries(categories.data).map(([id, cat]) => 
                    `<option value="${id}" ${task.categoryId === id ? 'selected' : ''}>${cat.name}</option>`
                ).join('')}
            </select>
            <button class="save-category" title="Save tasks in this category">💾</button>
            <button class="delete">×</button>
        `;

        // Update event listeners with better feedback
        li.querySelector('input[type="checkbox"]').onchange = (e) => {
            task.completed = e.target.checked;
            li.className = task.completed ? 'task-item completed' : 'task-item';
            utils.saveTask(task).then(() => {
                utils.showError('Task updated', 'success', 1000);
                updateProgress(getAllTasks());
            });
        };

        const textSpan = li.querySelector('.task-text');
        textSpan.addEventListener('focus', () => textSpan.dataset.original = textSpan.textContent);
        textSpan.onblur = (e) => {
            const newText = e.target.textContent.trim();
            const originalText = textSpan.dataset.original;
            if (newText && newText !== originalText) {
                task.text = newText;
                utils.saveTask(task).then(() => 
                    utils.showError('Task text updated', 'success', 1000)
                );
            }
        };

        li.querySelector('.category-select').onchange = (e) => {
            task.categoryId = e.target.value;
            utils.saveTask(task);
        };

        li.querySelector('.delete').onclick = () => {
            if (confirm('Delete this task?')) {
                utils.deleteTask(task.id);
                li.remove();
                updateProgress(getAllTasks());
            }
        };

        return li;
    },

    updateCategoryFilter(categories) {
        const filter = document.getElementById('categoryFilter');
        if (filter) {
            filter.innerHTML = `
                <option value="">All Categories</option>
                ${Object.entries(categories).map(([id, cat]) => 
                    `<option value="${id}">${cat.name}</option>`
                ).join('')}
            `;
        }
    }
};

// Category management
const categories = {
    data: {},

    async addCategory(name) {
        try {
            const id = Date.now().toString();
            const category = { id, name, timestamp: Date.now() };
            await utils.dbRef(`categories/${id}`).set(category);
            this.data[id] = category;
            utils.updateCategoryFilter(this.data);
            return id;
        } catch (error) {
            utils.showError('Error adding category');
            console.error(error);
        }
    },

    async loadCategories() {
        try {
            const snapshot = await utils.dbRef('categories').once('value');
            this.data = snapshot.val() || {};
            utils.updateCategoryFilter(this.data);
            return this.data;
        } catch (error) {
            utils.showError('Error loading categories');
            console.error(error);
            return {};
        }
    },

    async saveCategoryTasks(categoryId) {
        try {
            const tasks = Object.values(await utils.dbRef('tasks').once('value').val() || {})
                .filter(task => task.categoryId === categoryId);
            
            if (tasks.length === 0) {
                utils.showError('No tasks in this category', 'warning');
                return;
            }

            const timestamp = Date.now();
            await utils.dbRef(`categoryTasks/${categoryId}/${timestamp}`).set(tasks);
            utils.showError(`Saved ${tasks.length} tasks for category`, 'success', 2000);
        } catch (error) {
            utils.showError('Error saving category tasks');
            console.error(error);
        }
    }
};

// Get all tasks (helper function)
function getAllTasks() {
    return Array.from(document.querySelectorAll('#taskList li')).map(li => ({
        id: li.dataset.id,
        completed: li.querySelector('input[type="checkbox"]').checked
    }));
}

// Filter tasks by category
function filterTasks(categoryId) {
    utils.dbRef('tasks').once('value', snapshot => {
        const tasks = snapshot.val() || {};
        const filtered = Object.values(tasks).filter(task => 
            !categoryId || task.categoryId === categoryId
        );
        renderTasks(filtered);
    });
}

// Basic event handlers
document.addEventListener('DOMContentLoaded', async () => {
    // Load initial data
    utils.dbRef('tasks').once('value', snapshot => {
        const tasks = snapshot.val() || {};
        renderTasks(Object.values(tasks));
    });

    // Add new task
    document.getElementById('taskForm').onsubmit = (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        const text = input.value.trim();
        if (text) {
            const newTask = {
                id: Date.now().toString(),
                text,
                completed: false,
                timestamp: Date.now()
            };
            utils.saveTask(newTask);
            input.value = '';
        }
    };

    // Add category filter listener
    document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
        filterTasks(e.target.value);
    });

    // Load and display categories first
    await categories.loadCategories();
    
    // Then load tasks
    const tasksSnapshot = await utils.dbRef('tasks').once('value');
    const tasks = tasksSnapshot.val() || {};
    renderTasks(Object.values(tasks));
});

// Simplified task rendering
function renderTasks(tasks) {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    tasks.forEach(task => {
        const elem = utils.createTaskElement(task);
        fragment.appendChild(elem);
    });
    
    taskList.appendChild(fragment);
    updateProgress(tasks);
}

// Update progress calculation
function updateProgress(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.style.backgroundColor = 
            percentage === 100 ? '#4CAF50' : 
            percentage > 75 ? '#8BC34A' :
            percentage > 50 ? '#2196F3' :
            '#FFC107';
    }
    
    if (progressText) {
        progressText.textContent = `Completed: ${completed}/${total} (${percentage}%)`;
        progressText.className = percentage === 100 ? 'progress-text complete' : 'progress-text';
    }
}
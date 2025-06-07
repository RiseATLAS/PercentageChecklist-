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
 *    - categories name can be edited.
 *    - Filter by category
 *    - Tasks can be assigned to categories, and the UI should allow filtering tasks by category.
 *    - Categories can conttain tasks, and tasks can be assigned to categories.
 *   -  a button on the categories allows all realated tasks to be store and retrieved.
 *   - when a task is completed, a young pig should run across the screen.
 *   - when a full category is completed, young goats should run across the screen.
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
            <button class="delete" title="Delete task">×</button>
        `;

        // Add visual feedback for editing
        const textSpan = li.querySelector('.task-text');
        textSpan.addEventListener('focus', () => {
            textSpan.dataset.original = textSpan.textContent;
            textSpan.classList.add('editing');
        });
        textSpan.addEventListener('blur', () => {
            textSpan.classList.remove('editing');
            const newText = textSpan.textContent.trim();
            if (newText && newText !== textSpan.dataset.original) {
                task.text = newText;
                utils.saveTask(task);
                utils.showError('Task updated', 'success', 500);
            }
        });

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
        // Update dropdowns
        const filter = document.getElementById('categoryFilter');
        const select = document.getElementById('categorySelect');
        const dropdownHTML = `
            <option value="">All Categories</option>
            ${Object.entries(categories).map(([id, cat]) => 
                `<option value="${id}">${cat.name}</option>`
            ).join('')}
        `;

        if (filter) filter.innerHTML = dropdownHTML;
        if (select) select.innerHTML = dropdownHTML;

        // Update category list with editable names
        const categoryList = document.getElementById('categoryList');
        if (categoryList) {
            categoryList.innerHTML = Object.entries(categories).map(([id, cat]) => `
                <div class="category-item" data-category="${id}">
                    <div class="category-header">
                        <span class="category-name" contenteditable="true" 
                              onfocus="this.dataset.original = this.textContent"
                              onblur="categories.updateName('${id}', this)">${cat.name}</span>
                        <button class="delete-category" onclick="categories.deleteCategory('${id}')">×</button>
                    </div>
                    <div class="category-actions">
                        <button class="store-btn" onclick="categories.storeTasksForCategory('${id}')">
                            Store 📥
                        </button>
                        <button class="load-btn" onclick="categories.loadStoredTasks('${id}')">
                            Load 📤
                        </button>
                    </div>
                </div>
            `).join('');
        }
    },

    async checkCategoryCompletion(categoryId) {
        try {
            const snapshot = await this.dbRef('tasks').once('value');
            const tasks = snapshot.val() || {};
            const categoryTasks = Object.values(tasks)
                .filter(t => t.categoryId === categoryId);
            
            if (categoryTasks.length > 0 && categoryTasks.every(t => t.completed)) {
                await this.triggerCelebration('goats', categoryTasks.length);
                await this.dbRef(`categories/${categoryId}/lastCompleted`).set(Date.now());
                this.showError('Category completed! 🎈', 'success', 2000);
            }
        } catch (error) {
            console.error('Error checking category completion:', error);
        }
    },

    async triggerCelebration(type, count = 1) {
        const stage = document.querySelector('.animation-stage');
        if (!stage) return;

        const celebrationId = Date.now();
        const assetsConfig = {
            pig: { 
                image: 'assets/young-pig.svg', 
                emoji: '🐷', 
                sound: 'pigSound',
                duration: 1500,
                maxCount: 1
            },
            goats: { 
                image: 'assets/young-goat.svg', 
                emoji: '🐐', 
                sound: 'goatSound',
                duration: 2500,
                maxCount: 3
            }
        };

        try {
            const config = assetsConfig[type];
            const celebration = document.createElement('div');
            celebration.className = `celebration ${type}-celebration`;
            celebration.dataset.id = celebrationId;
            celebration.style.setProperty('--duration', `${config.duration}ms`);

            const animalCount = Math.min(count, config.maxCount);
            celebration.innerHTML = Array.from({ length: animalCount }, 
                (_, i) => `
                    <div class="young-animal" 
                         style="--index: ${i}"
                         data-celebration="${celebrationId}">
                        <div class="animal-container">
                            <span class="animal-emoji">${config.emoji}</span>
                        </div>
                        <span class="sound-text" aria-hidden="true">
                            ${type === 'pig' ? 'Oink!' : 'Baa!'}
                        </span>
                    </div>`
            ).join('');

            stage.appendChild(celebration);

            const sound = document.getElementById(config.sound);
            if (sound?.play) {
                sound.currentTime = 0;
                await sound.play().catch(() => {});
            }

            await new Promise(resolve => {
                const cleanup = () => {
                    celebration.remove();
                    resolve();
                };
                
                celebration.addEventListener('animationend', cleanup, { once: true });
                setTimeout(cleanup, config.duration + 100);
            });

        } catch (error) {
            console.error('Celebration error:', error);
            document.querySelectorAll(`[data-celebration="${celebrationId}"]`).forEach(el => el.remove());
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

    async getStoredTasks(categoryId) {
        try {
            const snapshot = await utils.dbRef(`categoryTasks/${categoryId}`).once('value');
            return snapshot.val() || {};
        } catch (error) {
            utils.showError('Error loading stored tasks');
            return {};
        }
    },

    async storeTasksForCategory(categoryId) {
        try {
            const snapshot = await utils.dbRef('tasks').once('value');
            const tasks = Object.values(snapshot.val() || {})
                .filter(t => t.categoryId === categoryId);
            
            if (tasks.length > 0) {
                await utils.dbRef(`categoryTasks/${categoryId}`).set({
                    tasks,
                    storedAt: Date.now()
                });
                utils.showError(`Stored ${tasks.length} tasks`, 'success', 1000);
            }
        } catch (error) {
            utils.showError('Error storing tasks');
        }
    },

    async loadStoredTasks(categoryId) {
        try {
            const stored = await this.getStoredTasks(categoryId);
            if (stored.tasks && stored.tasks.length > 0) {
                renderTasks(stored.tasks);
                utils.showError(`Loaded ${stored.tasks.length} tasks`, 'success', 1000);
            } else {
                utils.showError('No stored tasks found', 'warning');
            }
        } catch (error) {
            utils.showError('Error loading stored tasks');
        }
    },

    async updateName(categoryId, element) {
        const newName = element.textContent.trim();
        const originalName = element.dataset.original;
        
        if (newName && newName !== originalName) {
            try {
                await utils.dbRef(`categories/${categoryId}/name`).set(newName);
                this.data[categoryId].name = newName;
                utils.updateCategoryFilter(this.data);
                utils.showError('Category name updated', 'success', 1000);
            } catch (error) {
                element.textContent = originalName;
                utils.showError('Error updating category name');
            }
        }
    },

    // Add to categories object
    async deleteCategory(categoryId) {
        if (!confirm('Delete this category?')) return;
        
        try {
            await utils.dbRef(`categories/${categoryId}`).remove();
            delete this.data[categoryId];
            utils.updateCategoryFilter(this.data);
            utils.showError('Category deleted', 'success', 1000);
        } catch (error) {
            utils.showError('Error deleting category');
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

// Update filter function for better performance
function filterTasks(categoryId) {
    const storedTasks = categories.getStoredTasks(categoryId);
    if (storedTasks.tasks) {
        renderTasks(storedTasks.tasks);
        return;
    }

    utils.dbRef('tasks').once('value', snapshot => {
        const tasks = snapshot.val() || {};
        const filtered = Object.values(tasks)
            .filter(task => !categoryId || task.categoryId === categoryId);
        renderTasks(filtered);
        
        // Store filtered tasks if needed
        if (categoryId && filtered.length > 0) {
            categories.storeTasksForCategory(categoryId);
        }
    });
}

// Basic event handlers
document.addEventListener('DOMContentLoaded', async () => {
    // Add category form handler
    document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        const name = input.value.trim();
        if (name) {
            await categories.addCategory(name);
            input.value = '';
        }
    });

    // Add new task with category
    document.getElementById('taskForm').onsubmit = (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        const categorySelect = e.target.querySelector('select');
        const text = input.value.trim();
        if (text) {
            const newTask = {
                id: Date.now().toString(),
                text,
                completed: false,
                timestamp: Date.now(),
                categoryId: categorySelect?.value || ''
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
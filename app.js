/**
 *  * Requirements:
*  - The code should be simple and easy to understand.
 *  - Code should focus on easy to read and maintainable code.
 * Stability is important, so avoid unnecessary complexity.
 * 
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
    // Animation constants
    ANIMATION_CONFIG: {
        PIG_DURATION: 1500,
        GOAT_DURATION: 2500,
        DELAY_BETWEEN: 200,
        MIN_DURATION: 500
    },

    // Celebration configuration
    assetsConfig: {
        pig: { 
            emoji: '🐷', 
            sound: 'pigSound',
            duration: 1500,
            maxCount: 1,
            className: 'pig-celebration'
        },
        goats: { 
            emoji: '🐐', 
            sound: 'goatSound',
            duration: 2500,
            maxCount: 3,
            className: 'goats-celebration'
        }
    },

    dbRef(path = null) {
        return path ? db.ref(path) : db.ref();
    },

    // Update task storage
    async saveTask(task) {
        try {
            if (!task?.id) return;
            const taskData = {
                id: task.id,
                text: task.text,
                completed: task.completed,
                categoryId: task.categoryId || '',
                timestamp: task.timestamp || Date.now(),
                updatedAt: Date.now()
            };
            await this.dbRef(`tasks/${task.id}`).set(taskData);
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
        if (!task.id) task.id = Date.now().toString();
        
        const li = document.createElement('li');
        li.dataset.id = task.id;
        li.dataset.taskId = task.id;
        li.className = task.completed ? 'task-item completed' : 'task-item';
        li.innerHTML = `
            <input type="checkbox" 
                   ${task.completed ? 'checked' : ''} 
                   aria-label="Complete task">
            <span class="task-text" contenteditable="true">${task.text}</span>
            <select class="category-select" aria-label="Choose category">
                <option value="">No Category</option>
                ${Object.entries(categories.data).map(([id, cat]) => 
                    `<option value="${id}" ${task.categoryId === id ? 'selected' : ''}>${cat.name}</option>`
                ).join('')}
            </select>
            <button class="delete" title="Delete task" aria-label="Delete task">×</button>
        `;

        // Add checkbox handler with debounce for animations
        let celebrationTimeout;
        const checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', async () => {
            clearTimeout(celebrationTimeout);
            task.completed = checkbox.checked;
            li.classList.toggle('completed', task.completed);
            
            // Save first for better UX
            await utils.saveTask(task);
            updateProgress(getAllTasks());

            // Trigger celebrations with slight delay
            if (task.completed) {
                celebrationTimeout = setTimeout(async () => {
                    await utils.triggerCelebration('pig');
                    if (task.categoryId) {
                        await utils.checkCategoryCompletion(task.categoryId);
                    }
                }, 300);
            }
        });

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

    // Update category list generation
    updateCategoryFilter(categories) {
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

        const categoryList = document.getElementById('categoryList');
        if (categoryList) {
            categoryList.innerHTML = Object.entries(categories).map(([id, cat]) => `
                <div class="category-item" data-category-id="${id}">
                    <div class="category-header">
                        <span class="category-name" contenteditable="true" 
                              data-original="${cat.name}">${cat.name}</span>
                        <button class="delete-category" data-category-id="${id}">×</button>
                        <button class="storage-toggle" data-category-id="${id}">
                            ${cat.stored ? '📁 Normal' : '📂 Store'}
                        </button>
                    </div>
                </div>
            `).join('');

            categoryList.addEventListener('click', async (e) => {
                const button = e.target.closest('button');
                if (!button || !button.classList.contains('storage-toggle')) return;

                const categoryId = button.dataset.categoryId;
                if (!categoryId) return;

                await categories.toggleStorage(categoryId);
            });
        }
    },

    // Update category completion tracking
    async checkCategoryCompletion(categoryId) {
        const tasks = await utils.dbRef('tasks').once('value');
        const categoryTasks = Object.values(tasks.val() || {})
            .filter(t => t.categoryId === categoryId);
            
        if (categoryTasks.length && categoryTasks.every(t => t.completed)) {
            await utils.triggerCelebration('goats', categoryTasks.length);
            utils.showError('Category completed! 🎈', 'success', 2000);
        }
    },

    async playSound(soundId) {
        // Disable sound playing since files don't exist
        return Promise.resolve();
    },

    async triggerCelebration(type, count = 1) {
        const stage = document.querySelector('.animation-stage');
        if (!stage) return;

        const celebrationId = `celebration-${Date.now()}`;
        try {
            if (!this.assetsConfig[type]) {
                throw new Error(`Unknown celebration type: ${type}`);
            }

            const config = this.assetsConfig[type];
            const celebration = document.createElement('div');
            celebration.className = `celebration ${config.className}`;
            celebration.dataset.celebrationId = celebrationId;
            celebration.style.setProperty('--duration', `${config.duration}ms`);
            celebration.style.setProperty('--delay-between', `${this.ANIMATION_CONFIG.DELAY_BETWEEN}ms`);
            
            const animalCount = Math.min(count, config.maxCount);
            celebration.innerHTML = Array.from({ length: animalCount }, 
                (_, i) => `
                    <div class="young-animal" 
                         style="--index: ${i}"
                         data-celebration-id="${celebrationId}">
                        <div class="animal-container">
                            <span class="animal-emoji">${config.emoji.repeat(type === 'goats' ? 2 : 1)}</span>
                        </div>
                        <span class="sound-text" aria-hidden="true">
                            ${type === 'pig' ? 'Oink!' : 'Baa!'}
                        </span>
                    </div>`
            ).join('');

            stage.appendChild(celebration);

            // Try to play sound but don't wait for it
            this.playSound(config.sound);

            // Handle animation cleanup
            return new Promise(resolve => {
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
    },

    // Remove saveData method as it's no longer needed
};

// Category management
const categories = {
    data: {},
    
    async addCategory(name) {
        try {
            const id = Date.now().toString();
            const category = { id, name, stored: false };
            await utils.dbRef(`categories/${id}`).set(category);
            this.data[id] = category;
            utils.updateCategoryFilter(this.data);
            return id;
        } catch (error) {
            utils.showError('Error adding category');
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

    // Simplified storage
    async toggleStorage(categoryId) {
        try {
            const isStored = this.data[categoryId].stored;
            
            if (isStored) {
                // Load normal tasks
                const tasks = await utils.dbRef('tasks').once('value');
                renderTasks(Object.values(tasks.val() || {}));
                this.data[categoryId].stored = false;
            } else {
                // Store and load category tasks
                const tasks = Object.values(await utils.dbRef('tasks').once('value').val() || {})
                    .filter(t => t.categoryId === categoryId);
                
                if (tasks.length) {
                    await utils.dbRef(`categories/${categoryId}`).update({ 
                        stored: true,
                        tasks 
                    });
                    this.data[categoryId].stored = true;
                    renderTasks(tasks);
                }
            }
            
            utils.updateCategoryFilter(this.data);
        } catch (error) {
            utils.showError('Storage toggle failed');
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

// Update filter function to be simpler
function filterTasks(categoryId) {
    utils.dbRef('tasks').once('value', snapshot => {
        const tasks = Object.values(snapshot.val() || {})
            .filter(task => !categoryId || task.categoryId === categoryId);
        renderTasks(tasks);
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
/**
 * USER REQUIREMENTS:
 * 
 * 1. Basic Task Management:
 *    - Add new tasks
 *    - Mark tasks complete/incomplete
 *    - Delete tasks
 *    - Edit task text
 * 
 * 2. Categories:
 *    - Add tasks to categories
 *    - Category names can be edited
 *    - Filter tasks by category
 *    - Tasks can be assigned to categories
 *    - Categories can contain tasks
 *    - A button on categories allows all related tasks to be stored and retrieved
 *    - When a task is completed, a young pig should frolick across the screen
 *    - When a full category is completed, a herd young goats should frolick across the screen
 * 
 * 3. Progress Tracking:
 *    - Simple non intrusive progress bar showing completion percentage
 * 
 * 4. Data Persistence:
 *    - Tasks and categories are saved and can be loaded
 * 
 * TECHNICAL REQUIREMENTS:
 * 
 * 1. Code Quality:
 *    - The code should be simple and easy to understand
 *    - Code should focus on easy to read and maintainable code
 *    - Stability is important, so avoid unnecessary complexity
 * 
 * 2. Data Storage:
 *    - Save to Firebase on all changes
 *    - Load from Firebase
 * 
 * 3. UI Framework:
 *    - Basic HTML/CSS/JavaScript (no complex frameworks)
 *    - Task list display
 *    - Basic error messages
 *    - Mobile-first responsive design, touch sized buttons
 *    - Baby blue, baby pink, white color scheme
 *    - Rounded corners on all elements
 *    - Modern clean design
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
    // Simplified input sanitization - only essential security
    sanitizeInput(text) {
        if (!text) return '';
        return text.toString().trim().substring(0, 100);
    },

    // Animation constants
    ANIMATION_CONFIG: {
        DELAY_BETWEEN: 200
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
            if (!task?.id) throw new Error('Task ID required');
            
            // Sanitize input
            const sanitizedText = this.sanitizeInput(task.text);
            if (!sanitizedText) throw new Error('Task text cannot be empty');
            
            const taskData = {
                id: task.id,
                text: sanitizedText,
                completed: Boolean(task.completed),
                categoryId: (task.categoryId || '').toString(),
                timestamp: task.timestamp || Date.now(),
                updatedAt: Date.now()
            };
            
            await this.dbRef(`tasks/${task.id}`).set(taskData);
        } catch (error) {
            console.error('Error saving task:', error);
            throw error; // Re-throw for proper error handling
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
        li.className = task.completed ? 'task-item completed' : 'task-item';
        
        // Simplified - no excessive ARIA
        const sanitizedText = this.sanitizeInput(task.text);
        
        li.innerHTML = `
            <input type="checkbox" 
                   ${task.completed ? 'checked' : ''} 
                   aria-label="Fullfør oppgave">
            <span class="task-text" contenteditable="true">${sanitizedText}</span>
            <select class="category-select" aria-label="Velg kategori">
                <option value="">Ingen kategori</option>
                ${Object.entries(categories.data).map(([id, cat]) => 
                    `<option value="${id}" ${task.categoryId === id ? 'selected' : ''}>${cat.name}</option>`
                ).join('')}
            </select>
            <button class="delete" title="Slett oppgave" aria-label="Slett oppgave">×</button>
        `;

        // Simplified event handlers
        const checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', async () => {
            task.completed = checkbox.checked;
            li.classList.toggle('completed', task.completed);
            
            await utils.saveTask(task);
            updateProgress(getAllTasks());

            if (task.completed) {
                setTimeout(async () => {
                    await utils.triggerCelebration('pig');
                    if (task.categoryId) {
                        await utils.checkCategoryCompletion(task.categoryId);
                    }
                }, 300);
            }
        });

        // Simple text editing without over-engineering
        const textSpan = li.querySelector('.task-text');
        textSpan.addEventListener('blur', async () => {
            const newText = this.sanitizeInput(textSpan.textContent);
            if (newText && newText !== task.text) {
                task.text = newText;
                await utils.saveTask(task);
                utils.showError('Oppgave oppdatert', 'success', 500);
            }
        });

        li.querySelector('.category-select').onchange = (e) => {
            task.categoryId = e.target.value;
            utils.saveTask(task);
        };

        li.querySelector('.delete').onclick = () => {
            utils.deleteTask(task.id);
            li.remove();
            updateProgress(getAllTasks());
        };

        return li;
    },

    // Update category list generation
    updateCategoryFilter(categoriesData) { // Renamed parameter for clarity
        const filter = document.getElementById('categoryFilter');
        const select = document.getElementById('categorySelect');
        const dropdownHTML = `
            <option value="">Alle kategorier</option>
            ${Object.entries(categoriesData).map(([id, cat]) => 
                `<option value="${id}">${cat.name}</option>`
            ).join('')}
        `;

        if (filter) filter.innerHTML = dropdownHTML;
        if (select) {
            select.innerHTML = `
                <option value="" disabled selected>Velg kategori</option>
                ${Object.entries(categoriesData).map(([id, cat]) => 
                    `<option value="${id}">${cat.name}</option>`
                ).join('')}
            `;
        }

        const categoryList = document.getElementById('categoryList');
        if (categoryList) {
            categoryList.innerHTML = Object.entries(categoriesData).map(([id, cat]) => `
                <div class="category-item" data-category-id="${id}">
                    <div class="category-header">
                        <span class="category-name" contenteditable="true" 
                              data-original="${cat.name}">${cat.name}</span>
                        <button class="delete-category" data-category-id="${id}">×</button>
                        <button class="storage-toggle" data-category-id="${id}">
                            ${cat.stored ? '📁 Hent ut' : '📂 Lagre'}
                        </button>
                    </div>
                </div>
            `).join('');

            // Bind event handler correctly for button clicks
            categoryList.onclick = (e) => categories.handleClick(e);

            // Add event listeners for contenteditable category names
            categoryList.querySelectorAll('.category-name').forEach(span => {
                span.addEventListener('focus', () => {
                    // data-original is already set during HTML generation.
                    span.classList.add('editing'); // For visual feedback
                });

                span.addEventListener('blur', () => {
                    span.classList.remove('editing'); // Remove visual feedback
                    const categoryItem = span.closest('.category-item');
                    if (categoryItem && categoryItem.dataset.categoryId) {
                        const categoryId = categoryItem.dataset.categoryId;
                        categories.updateName(categoryId, span);
                    }
                });
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
            utils.showError('Kategori fullført! 🎈', 'success', 2000);
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
            const config = this.assetsConfig[type];
            const celebration = document.createElement('div');
            celebration.className = `celebration ${config.className}`;
            celebration.dataset.celebrationId = celebrationId;
            celebration.style.setProperty('--duration', `${config.duration}ms`);
            
            const animalCount = Math.min(count, config.maxCount);
            celebration.innerHTML = Array.from({ length: animalCount }, 
                (_, i) => `
                    <div class="young-animal" 
                         style="--delay: ${i * 200}ms"
                         data-celebration-id="${celebrationId}">
                        <div class="animal-container">
                            <span class="animal-emoji">${config.emoji}</span>
                        </div>
                        <span class="sound-text" aria-hidden="true">
                            ${type === 'pig' ? 'Oink!' : 'Baa!'}
                        </span>
                    </div>`
            ).join('');

            stage.appendChild(celebration);

            return new Promise(resolve => {
                const cleanup = () => {
                    if (celebration.parentNode) {
                        celebration.remove();
                    }
                    resolve();
                };
                
                setTimeout(cleanup, config.duration + 500);
            });

        } catch (error) {
            console.error('Celebration error:', error);
        }
    },

    // Remove saveData method as it's no longer needed
};

// Category management
const categories = {
    data: {},

    handleClick: function(e) {
        // Find the clicked button
        const button = e.target.closest('button');
        if (!button) return;
        
        // Get the category item and ID
        const categoryItem = button.closest('.category-item');
        if (!categoryItem) return;
        
        const categoryId = categoryItem.dataset.categoryId;
        if (!categoryId) return;
        
        try {
            // Dispatch to appropriate handler based on button class
            if (button.classList.contains('storage-toggle')) {
                this.toggleStorage(categoryId);
            } else if (button.classList.contains('delete-category')) {
                this.deleteCategory(categoryId);
            }
        } catch (error) {
            console.error('Category action error:', error);
            utils.showError('Handling feilet');
        }
    },
    
    async addCategory(name) {
        try {
            const id = Date.now().toString();
            const category = { id, name, stored: false };
            await utils.dbRef(`categories/${id}`).set(category);
            this.data[id] = category;
            utils.updateCategoryFilter(this.data);
            // Refresh task list to update category dropdowns in existing tasks
            filterTasks(document.getElementById('categoryFilter')?.value || '');
            return id;
        } catch (error) {
            utils.showError('Feil ved å legge til kategori');
        }
    },

    async loadCategories() {
        try {
            const snapshot = await utils.dbRef('categories').once('value');
            this.data = snapshot.val() || {};
            utils.updateCategoryFilter(this.data);
            return this.data;
        } catch (error) {
            utils.showError('Feil ved lasting av kategorier');
            console.error(error);
            return {};
        }
    },

    // Simplified storage
    async toggleStorage(categoryId) {
        if (!this.data[categoryId]) {
            utils.showError('Kategori ikke funnet');
            return;
        }

        try {
            const category = this.data[categoryId];
            const isStored = category.stored || false;

            // Load tasks from Firebase
            const tasksSnap = await utils.dbRef('tasks').once('value');
            const allTasks = tasksSnap.val() || {};
            
            // Filter tasks for this category
            const categoryTasks = Object.values(allTasks)
                .filter(t => t.categoryId === categoryId);

            if (isStored) {
                // Switch back to normal view
                await utils.dbRef(`categories/${categoryId}`).update({ stored: false });
                this.data[categoryId].stored = false;
                
                // Reset filter and show all tasks
                const categoryFilter = document.getElementById('categoryFilter');
                if (categoryFilter) {
                    categoryFilter.value = '';
                }
                renderTasks(Object.values(allTasks));
            } else {
                // Store and show only category tasks
                if (categoryTasks.length) {
                    await utils.dbRef(`categories/${categoryId}`).update({ stored: true });
                    this.data[categoryId].stored = true;
                    
                    // Show only this category's tasks
                    renderTasks(categoryTasks);
                    
                    // Update the filter dropdown to show this category is selected
                    const categoryFilter = document.getElementById('categoryFilter');
                    if (categoryFilter) {
                        categoryFilter.value = categoryId;
                    }
                } else {
                    utils.showError('Ingen oppgaver i kategorien');
                    return;
                }
            }

            // Update UI
            utils.updateCategoryFilter(this.data);
            utils.showError(
                isStored ? 'Viser alle oppgaver' : `Viser oppgaver fra ${category.name}`, 
                'success', 
                1000
            );
        } catch (error) {
            console.error('Toggle failed:', error);
            utils.showError('Kunne ikke bytte visning');
        }
    },

    async updateName(categoryId, element) {
        const newName = element.textContent.trim();
        const originalName = element.dataset.original;
        
        if (!newName) { // Prevent empty category names
            element.textContent = originalName;
            utils.showError('Kategorinavn kan ikke være tomt.', 'error');
            return;
        }

        if (newName && newName !== originalName) {
            try {
                await utils.dbRef(`categories/${categoryId}/name`).set(newName);
                this.data[categoryId].name = newName;
                // data-original will be updated in the re-render by updateCategoryFilter
                utils.updateCategoryFilter(this.data);
                // Refresh task list to update category dropdowns in existing tasks
                filterTasks(document.getElementById('categoryFilter')?.value || '');
                utils.showError('Kategorinavn oppdatert', 'success', 1000);
            } catch (error) {
                element.textContent = originalName; // Revert on error
                utils.showError('Feil ved oppdatering av kategorinavn');
            }
        }
        // If newName is the same as originalName, do nothing.
    },

    // Add to categories object
    async deleteCategory(categoryId) {
        if (!confirm('Slette denne kategorien? Dette vil også fjerne oppgaver fra kategorien.')) return;
        
        try {
            // Find tasks associated with this category and update them
            const tasksSnapshot = await utils.dbRef('tasks').once('value');
            const allTasks = tasksSnapshot.val() || {};
            const tasksToUpdatePromises = [];

            for (const taskId in allTasks) {
                if (allTasks[taskId].categoryId === categoryId) {
                    // Create a promise to update each relevant task's categoryId to empty string
                    tasksToUpdatePromises.push(
                        utils.dbRef(`tasks/${taskId}/categoryId`).set('')
                    );
                }
            }
            
            // Wait for all task updates to complete
            if (tasksToUpdatePromises.length > 0) {
                await Promise.all(tasksToUpdatePromises);
                utils.showError(`Fjernet ${tasksToUpdatePromises.length} oppgave(r) fra kategorien.`, 'info', 1500);
            }

            // Delete the category
            await utils.dbRef(`categories/${categoryId}`).remove();
            delete this.data[categoryId];
            utils.updateCategoryFilter(this.data);
            
            // Refresh task list to reflect unassigned tasks and removed category
            filterTasks(document.getElementById('categoryFilter')?.value || '');
            
            utils.showError('Kategori slettet', 'success', 1000);
        } catch (error) {
            console.error('Error deleting category:', error);
            utils.showError('Feil ved sletting av kategori');
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

// Update filter function to be more robust
function filterTasks(categoryId) {
    utils.dbRef('tasks').once('value', snapshot => {
        const allTasks = snapshot.val() || {};
        const tasks = Object.values(allTasks)
            .filter(task => !categoryId || task.categoryId === categoryId);
        renderTasks(tasks);
    }).catch(error => {
        console.error('Error filtering tasks:', error);
        utils.showError('Feil ved filtrering av oppgaver');
    });
}

// Basic event handlers
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Simple connection monitoring
        const connectedRef = db.ref('.info/connected');
        connectedRef.on('value', (snapshot) => {
            if (!snapshot.val()) {
                utils.showError('Ingen tilkobling til server', 'error', 5000);
            }
        });

        // Task form handling
        document.getElementById('taskForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('taskInput');
            const categorySelect = document.getElementById('categorySelect');
            const text = input.value.trim();
            
            if (text) {
                const newTask = {
                    id: Date.now().toString(),
                    text,
                    completed: false,
                    timestamp: Date.now(),
                    categoryId: categorySelect?.value || ''
                };
                await utils.saveTask(newTask);
                input.value = '';
                
                if (categorySelect) {
                    categorySelect.selectedIndex = 0;
                }
                
                // Reload tasks
                const tasksSnapshot = await utils.dbRef('tasks').once('value');
                const tasks = tasksSnapshot.val() || {};
                
                const currentFilter = document.getElementById('categoryFilter')?.value || '';
                if (currentFilter) {
                    filterTasks(currentFilter);
                } else {
                    renderTasks(Object.values(tasks));
                }
            }
        });

        // Category form handler
        document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('categoryInput');
            const name = input.value.trim();
            if (name) {
                await categories.addCategory(name);
                input.value = '';
            }
        });

        // Category filter listener
        document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
            filterTasks(e.target.value);
        });

        // Clear filter listener
        document.getElementById('clearFilter')?.addEventListener('click', () => {
            filterTasks('');
            const categoryFilterSelect = document.getElementById('categoryFilter');
            if (categoryFilterSelect) {
                categoryFilterSelect.value = '';
            }
        });

        // Load initial data
        await categories.loadCategories();
        const tasksSnapshot = await utils.dbRef('tasks').once('value');
        const tasks = tasksSnapshot.val() || {};
        renderTasks(Object.values(tasks));
        
    } catch (error) {
        console.error('Critical initialization error:', error);
        utils.showError('Kritisk feil ved oppstart. Kontakt support.', 'error', 15000);
    }
});

// Simplified task rendering with better error handling
function renderTasks(tasks) {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;
    
    taskList.innerHTML = '';
    
    try {
        const fragment = document.createDocumentFragment();
        tasks.forEach(task => {
            // Ensure task has required properties
            if (task && task.text) {
                const elem = utils.createTaskElement(task);
                fragment.appendChild(elem);
            }
        });
        
        taskList.appendChild(fragment);
        updateProgress(tasks);
    } catch (error) {
        console.error('Error rendering tasks:', error);
        utils.showError('Feil ved visning av oppgaver');
    }
}

// Update progress calculation with proper aria updates
function updateProgress(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
        progressBar.style.backgroundColor = 
            percentage === 100 ? '#4CAF50' : 
            percentage > 75 ? '#8BC34A' :
            percentage > 50 ? '#2196F3' :
            '#FFC107';
    }
    
    if (progressText) {
        progressText.textContent = `Fullført: ${completed}/${total} (${percentage}%)`;
        progressText.className = percentage === 100 ? 'progress-text complete' : 'progress-text';
    }
}
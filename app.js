/**
 * USER REQUIREMENTS:
 * 
 * 1. Basic Task Management:
 *    - Add new tasks
 *    - Mark tasks complete/incomplete
 *    - Delete tasks
 *    - Edit task text
 *    - sorting of tasks, category, alphabet, creation time, completed
 * 
 * 2. Categories:
 *    - Category names can be edited
 *    - Filter tasks by category
 *    - Tasks can be assigned to categories
 *    - Categories can contain tasks
 *    - A button on categories allows all related tasks to be stored and retrieved
 *    - When a task is completed, a young pig should frolick across the screen
 *    - When a full category is completed, a herd of young goats should frolick across the screen
 *    - If i have chosen a category when creating tasks, the category field should not reset, so i can easily create more with the same category
 *    - If a category is deleted, delete its tasks too
 *    - If a category is stored, hide all tasks in that category
 *    - If a category is visible, show all tasks in that category


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

    // Update task storage with data migration
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
                // Removed: utils.showError('Oppgave oppdatert', 'success', 500);
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
                            ${cat.stored ? '📁 Hent ut' : '📂 Gjem'}
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
            // Removed: utils.showError('Kategori fullført! 🎈', 'success', 2000);
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

    // Simplified storage - allow multiple categories to be stored
    async toggleStorage(categoryId) {
        if (!this.data[categoryId]) {
            utils.showError('Kategori ikke funnet');
            return;
        }

        try {
            const category = this.data[categoryId];
            const isStored = category.stored || false;

            if (isStored) {
                // Remove from storage - set stored to false
                await utils.dbRef(`categories/${categoryId}`).update({ stored: false });
                this.data[categoryId].stored = false;
            } else {
                // Add to storage - set stored to true
                await utils.dbRef(`categories/${categoryId}`).update({ stored: true });
                this.data[categoryId].stored = true;
            }

            // Update UI to reflect storage states
            utils.updateCategoryFilter(this.data);
            
            // Refresh the current view based on stored categories
            const currentFilter = document.getElementById('categoryFilter')?.value || '';
            filterTasks(currentFilter);
            
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
                // Removed: utils.showError('Kategorinavn oppdatert', 'success', 1000);
            } catch (error) {
                element.textContent = originalName; // Revert on error
                utils.showError('Feil ved oppdatering av kategorinavn');
            }
        }
        // If newName is the same as originalName, do nothing.
    },

    // Add to categories object
    async deleteCategory(categoryId) {
        if (!confirm('Slette denne kategorien? Dette vil også slette alle oppgaver i kategorien.')) return;
        
        try {
            // Find tasks associated with this category and delete them
            const tasksSnapshot = await utils.dbRef('tasks').once('value');
            const allTasks = tasksSnapshot.val() || {};
            const tasksToDeletePromises = [];

            for (const taskId in allTasks) {
                if (allTasks[taskId].categoryId === categoryId) {
                    // Create a promise to delete each task in this category
                    tasksToDeletePromises.push(
                        utils.dbRef(`tasks/${taskId}`).remove()
                    );
                }
            }
            
            // Wait for all task deletions to complete
            if (tasksToDeletePromises.length > 0) {
                await Promise.all(tasksToDeletePromises);
            }

            // Delete the category
            await utils.dbRef(`categories/${categoryId}`).remove();
            delete this.data[categoryId];
            utils.updateCategoryFilter(this.data);
            
            // Refresh task list to reflect deleted tasks and removed category
            filterTasks(document.getElementById('categoryFilter')?.value || '');
            
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

// Add sorting utility functions
const sortUtils = {
    // Sort tasks based on selected criteria
    sortTasks(tasks, sortType) {
        const tasksCopy = [...tasks];
        
        switch (sortType) {
            case 'creation':
                return tasksCopy.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            case 'creation-asc':
                return tasksCopy.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            
            case 'alphabet':
                return tasksCopy.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
            
            case 'alphabet-desc':
                return tasksCopy.sort((a, b) => b.text.toLowerCase().localeCompare(a.text.toLowerCase()));
            
            case 'category':
                return tasksCopy.sort((a, b) => {
                    const catA = a.categoryId ? (categories.data[a.categoryId]?.name || '') : '';
                    const catB = b.categoryId ? (categories.data[b.categoryId]?.name || '') : '';
                    
                    if (catA === catB) {
                        // Secondary sort by creation time if same category
                        return (b.timestamp || 0) - (a.timestamp || 0);
                    }
                    
                    // Uncategorized tasks go last
                    if (!catA) return 1;
                    if (!catB) return -1;
                    
                    return catA.localeCompare(catB);
                });
            
            case 'completed':
                return tasksCopy.sort((a, b) => {
                    if (a.completed === b.completed) {
                        // Secondary sort by creation time if same completion status
                        return (b.timestamp || 0) - (a.timestamp || 0);
                    }
                    return a.completed ? 1 : -1; // Incomplete tasks first
                });
            
            case 'completed-first':
                return tasksCopy.sort((a, b) => {
                    if (a.completed === b.completed) {
                        // Secondary sort by creation time if same completion status
                        return (b.timestamp || 0) - (a.timestamp || 0);
                    }
                    return a.completed ? -1 : 1; // Completed tasks first
                });
            
            default:
                return tasksCopy;
        }
    }
};

// Simplified filter function without migration logic
function filterTasks(categoryId) {
    utils.dbRef('tasks').once('value', snapshot => {
        const allTasks = snapshot.val() || {};
        
        // Get all stored (hidden) categories
        const storedCategories = Object.entries(categories.data)
            .filter(([id, cat]) => cat.stored)
            .map(([id]) => id);
        
        let tasks = Object.values(allTasks).filter(task => task.text); // Only include tasks with text
        
        if (categoryId) {
            // Normal filtering by selected category
            tasks = tasks.filter(task => task.categoryId === categoryId);
        } else if (storedCategories.length > 0) {
            // If categories are stored (hidden), show:
            // 1. Tasks from NON-stored categories only
            // 2. Uncategorized tasks (always visible)
            tasks = tasks.filter(task => 
                // Hide stored category tasks
                !(task.categoryId && task.categoryId !== '' && storedCategories.includes(task.categoryId)) &&
                // Show everything else (uncategorized + non-stored categories)
                true
            );
        }
        
        // Apply sorting
        const sortType = document.getElementById('taskSort')?.value || 'creation';
        tasks = sortUtils.sortTasks(tasks, sortType);
        
        renderTasks(tasks);
    }).catch(error => {
        console.error('Error filtering tasks:', error);
        utils.showError('Feil ved filtrering av oppgaver');
    });
}

// Basic event handlers
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Improved connection monitoring with retry logic
        const connectedRef = db.ref('.info/connected');
        let isOnline = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        connectedRef.on('value', (snapshot) => {
            const connected = snapshot.val();
            
            if (connected && !isOnline) {
                isOnline = true;
                retryCount = 0;
                // Removed: utils.showError('Tilkoblet til server', 'success', 2000);
                // Reload data when connection is restored
                loadInitialData();
            } else if (!connected && isOnline) {
                isOnline = false;
                utils.showError('Tilkobling tapt. Arbeider offline...', 'error', 5000);
            } else if (!connected && !isOnline && retryCount < maxRetries) {
                retryCount++;
                utils.showError(`Prøver å koble til på nytt (${retryCount}/${maxRetries})...`, 'error', 3000);
                
                // Try to reconnect after delay
                setTimeout(() => {
                    if (retryCount >= maxRetries) {
                        utils.showError('Kan ikke koble til server. Sjekk internettforbindelsen.', 'error', 10000);
                    }
                }, 2000);
            }
        });

        // Initial data loading with better error handling
        async function loadInitialData() {
            try {
                await categories.loadCategories();
                const tasksSnapshot = await utils.dbRef('tasks').once('value');
                const tasks = tasksSnapshot.val() || {};
                
                // Check if any categories are stored and filter accordingly
                filterTasks('');
            } catch (error) {
                console.error('Error loading initial data:', error);
                utils.showError('Kunne ikke laste data. Prøver igjen...', 'error', 5000);
                // Retry after 3 seconds
                setTimeout(loadInitialData, 3000);
            }
        }

        // Enhanced task form handling with offline support
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
                
                try {
                    await utils.saveTask(newTask);
                    input.value = '';
                    
                    // Don't reset category selection - keep it for easier batch creation
                    // if (categorySelect) {
                    //     categorySelect.selectedIndex = 0;
                    // }
                    
                    // Refresh the current view to respect stored categories
                    const currentFilter = document.getElementById('categoryFilter')?.value || '';
                    filterTasks(currentFilter);
                    
                    // Removed: utils.showError('Oppgave lagt til', 'success', 1000);
                    
                } catch (error) {
                    console.error('Error adding task:', error);
                    utils.showError('Kunne ikke lagre oppgave. Prøv igjen.', 'error');
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

        // Task sort listener
        document.getElementById('taskSort')?.addEventListener('change', (e) => {
            const currentFilter = document.getElementById('categoryFilter')?.value || '';
            filterTasks(currentFilter);
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
        await loadInitialData();
        
    } catch (error) {
        console.error('Critical initialization error:', error);
        utils.showError('Kritisk feil ved oppstart. Last siden på nytt.', 'error', 15000);
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
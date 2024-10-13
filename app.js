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
const db = firebase.firestore();

// References
const categoriesCollection = db.collection('categories');
const tasksCollection = db.collection('tasks');

// DOM Elements
const taskInput = document.getElementById('task-input');
const categorySelect = document.getElementById('category-select');
const addTaskButton = document.getElementById('add-task-button');
const taskList = document.getElementById('task-list');
const totalTasksElem = document.getElementById('total-tasks');
const completedTasksElem = document.getElementById('completed-tasks');
const completionPercentageElem = document.getElementById('completion-percentage');

const categoryInput = document.getElementById('category-input');
const addCategoryButton = document.getElementById('add-category-button');
const categoryList = document.getElementById('category-list');

// Utility Functions
function createElement(tag, className, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
}

// Add Task
addTaskButton.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    const categoryId = categorySelect.value;

    if (taskText === "" || categoryId === "") return;

    tasksCollection.add({
        text: taskText,
        categoryId: categoryId,
        completed: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    taskInput.value = "";
});

// Add Category
addCategoryButton.addEventListener('click', () => {
    const categoryName = categoryInput.value.trim();
    if (categoryName === "") return;

    // Check if category already exists
    categoriesCollection.where('name', '==', categoryName).get()
        .then(snapshot => {
            if (snapshot.empty) {
                categoriesCollection.add({
                    name: categoryName
                });
                categoryInput.value = "";
            } else {
                alert("Category already exists!");
            }
        });
});

// Listen for Categories
categoriesCollection.orderBy('name').onSnapshot(snapshot => {
    const categories = [];
    snapshot.forEach(doc => {
        categories.push({ id: doc.id, ...doc.data() });
    });
    populateCategorySelect(categories);
    renderCategoriesList(categories);
});

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
        const li = createElement('li', 'category-item');

        const nameSpan = createElement('span', 'category-name', category.name);
        nameSpan.setAttribute('contenteditable', 'false');

        // Toggle edit mode on double-click
        nameSpan.addEventListener('dblclick', () => {
            nameSpan.setAttribute('contenteditable', 'true');
            nameSpan.focus();
        });

        // Handle saving edited name
        nameSpan.addEventListener('blur', () => {
            nameSpan.setAttribute('contenteditable', 'false');
            const newName = nameSpan.textContent.trim();
            if (newName === "") {
                alert("Category name cannot be empty.");
                nameSpan.textContent = category.name;
                return;
            }
            if (newName !== category.name) {
                // Check if new name already exists
                categoriesCollection.where('name', '==', newName).get()
                    .then(snapshot => {
                        if (snapshot.empty) {
                            updateCategoryName(category.id, newName);
                        } else {
                            alert("Category name already exists!");
                            nameSpan.textContent = category.name;
                        }
                    });
            }
        });

        // Delete Category Button
        const deleteButton = createElement('button', 'delete-button', '🗑️');
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

// Update Category Name and Associated Tasks
function updateCategoryName(categoryId, newName) {
    categoriesCollection.doc(categoryId).update({ name: newName })
        .then(() => {
            // Update all tasks with this categoryId
            tasksCollection.where('categoryId', '==', categoryId).get()
                .then(snapshot => {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        // Since tasks reference categories by ID, no need to update tasks
                        // However, if you display category names from the categories collection, tasks will reflect the updated name automatically
                        // So no action is needed here unless you store category names in tasks
                    });
                    // Commit batch if needed
                    // In this case, no action is required
                });
        })
        .catch(error => {
            console.error("Error updating category:", error);
        });
}

// Delete Category and Associated Tasks
function deleteCategory(categoryId) {
    // Delete all tasks with this categoryId
    tasksCollection.where('categoryId', '==', categoryId).get()
        .then(snapshot => {
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            return batch.commit();
        })
        .then(() => {
            // Delete the category
            return categoriesCollection.doc(categoryId).delete();
        })
        .catch(error => {
            console.error("Error deleting category and tasks:", error);
        });
}

// Listen for Tasks
tasksCollection.orderBy('timestamp').onSnapshot(snapshot => {
    const tasks = [];
    snapshot.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() });
    });
    renderTasks(tasks);
    updateStats(tasks);
});

// Render Tasks
function renderTasks(tasks) {
    taskList.innerHTML = "";
    if (tasks.length === 0) {
        const emptyMessage = createElement('p', 'empty-message', 'No tasks added yet.');
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#888888';
        taskList.appendChild(emptyMessage);
        return;
    }
    tasks.forEach(task => {
        const li = createElement('li', 'task-item');

        // Checkbox Container
        const checkboxContainer = createElement('div', 'checkbox-container');
        const checkbox = createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => {
            tasksCollection.doc(task.id).update({ completed: checkbox.checked });
        });
        checkboxContainer.appendChild(checkbox);

        // Task Text
        const taskText = createElement('span', 'task-text', task.text);
        taskText.setAttribute('contenteditable', 'false');

        // Toggle edit mode on double-click
        taskText.addEventListener('dblclick', () => {
            taskText.setAttribute('contenteditable', 'true');
            taskText.focus();
        });

        // Handle saving edited text
        taskText.addEventListener('blur', () => {
            taskText.setAttribute('contenteditable', 'false');
            const newText = taskText.textContent.trim();
            if (newText === "") {
                alert("Task text cannot be empty.");
                taskText.textContent = task.text;
                return;
            }
            if (newText !== task.text) {
                tasksCollection.doc(task.id).update({ text: newText });
            }
        });

        // Category Name
        const categorySpan = createElement('span', 'task-category', 'Loading...');
        // Fetch category name based on categoryId
        categoriesCollection.doc(task.categoryId).get()
            .then(doc => {
                if (doc.exists) {
                    categorySpan.textContent = doc.data().name;
                } else {
                    categorySpan.textContent = "Uncategorized";
                }
            });

        // Delete Task Button
        const deleteButton = createElement('button', 'delete-button', '🗑️');
        deleteButton.title = "Delete Task";
        deleteButton.addEventListener('click', () => {
            if (confirm("Are you sure you want to delete this task?")) {
                tasksCollection.doc(task.id).delete();
            }
        });

        li.appendChild(checkboxContainer);
        li.appendChild(taskText);
        li.appendChild(categorySpan);
        li.appendChild(deleteButton);

        taskList.appendChild(li);
    });
}

// Update Statistics
function updateStats(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    totalTasksElem.textContent = total;
    completedTasksElem.textContent = completed;
    completionPercentageElem.textContent = `${percentage}%`;
}
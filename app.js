// app.js

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_DATABASE_NAME.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// References
const taskListRef = db.ref('tasks');

// DOM Elements
const taskInput = document.getElementById('task-input');
const categorySelect = document.getElementById('category-select');
const addTaskButton = document.getElementById('add-task-button');
const taskList = document.getElementById('task-list');
const totalTasksElem = document.getElementById('total-tasks');
const completedTasksElem = document.getElementById('completed-tasks');
const completionPercentageElem = document.getElementById('completion-percentage');

// Add Task
addTaskButton.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    const category = categorySelect.value;

    if (taskText === "") return;

    const newTaskRef = taskListRef.push();
    newTaskRef.set({
        text: taskText,
        category: category,
        completed: false
    });

    taskInput.value = "";
});

// Listen for tasks
taskListRef.on('value', (snapshot) => {
    const tasks = snapshot.val();
    renderTasks(tasks);
    updateStats(tasks);
});

// Render Tasks
function renderTasks(tasks) {
    taskList.innerHTML = "";
    for (let id in tasks) {
        const task = tasks[id];

        const li = document.createElement('li');
        li.className = 'task-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => {
            taskListRef.child(id).update({ completed: checkbox.checked });
        });

        const span = document.createElement('span');
        span.textContent = task.text;

        const categorySpan = document.createElement('span');
        categorySpan.className = 'task-category';
        categorySpan.textContent = task.category;

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(categorySpan);

        // Optional: Add edit and delete buttons
        /*
        const editButton = document.createElement('button');
        editButton.className = 'edit-button';
        editButton.innerHTML = '<img src="edit-icon.png" alt="Edit">';
        // Add edit functionality here

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '<img src="delete-icon.png" alt="Delete">';
        deleteButton.addEventListener('click', () => {
            taskListRef.child(id).remove();
        });

        li.appendChild(editButton);
        li.appendChild(deleteButton);
        */

        taskList.appendChild(li);
    }
}

// Update Statistics
function updateStats(tasks) {
    const total = Object.keys(tasks || {}).length;
    let completed = 0;
    let categoryCounts = {};

    for (let id in tasks) {
        const task = tasks[id];
        if (task.completed) completed++;

        if (categoryCounts[task.category]) {
            categoryCounts[task.category].total += 1;
            if (task.completed) categoryCounts[task.category].completed += 1;
        } else {
            categoryCounts[task.category] = { total: 1, completed: task.completed ? 1 : 0 };
        }
    }

    totalTasksElem.textContent = total;
    completedTasksElem.textContent = completed;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    completionPercentageElem.textContent = `${percentage}%`;

    // Optionally, display category-wise stats
    // For example:
    /*
    for (let category in categoryCounts) {
        const cat = categoryCounts[category];
        const catPercentage = Math.round((cat.completed / cat.total) * 100);
        console.log(`${category}: ${catPercentage}% complete`);
    }
    */
}

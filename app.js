// app.js - Main JavaScript for PercentageChecklist

// Initialize Firestore database
const db = firebase.firestore();
// References to collections
const tasksCollection = db.collection('tasks');
const templatesCollection = db.collection('templates');

// Get references to DOM elements
const taskForm = document.getElementById('task-form');
const taskNameInput = document.getElementById('task-name');
const taskDueInput = document.getElementById('task-due');
const taskList = document.getElementById('task-list');
const progressText = document.getElementById('progress-text');

const templateForm = document.getElementById('template-form');
const templateNameInput = document.getElementById('template-name');
const templateList = document.getElementById('template-list');

// Arrays to hold data in memory (for templates usage)
let tasksData = [];
let templatesData = [];

// Real-time listener for tasks collection
tasksCollection.orderBy('createdAt').onSnapshot(snapshot => {
  tasksData = [];
  let totalTasks = 0;
  let completedTasks = 0;
  // Build tasksData from snapshot
  snapshot.forEach(doc => {
    const task = doc.data();
    const taskItem = {
      id: doc.id,
      name: task.name,
      completed: task.completed || false,
      due: task.due || ""
    };
    totalTasks++;
    if (taskItem.completed) {
      completedTasks++;
    }
    tasksData.push(taskItem);
  });
  // Update progress text
  if (totalTasks > 0) {
    const percent = Math.round((completedTasks / totalTasks) * 100);
    progressText.textContent = `Completed ${completedTasks} of ${totalTasks} tasks (${percent}%)`;
  } else {
    progressText.textContent = "No tasks yet.";
  }
  // Render tasks list
  taskList.innerHTML = ""; // clear current list
  tasksData.forEach(task => {
    const li = document.createElement('li');
    li.dataset.id = task.id;
    if (task.completed) li.classList.add('completed');
    // Check for overdue: due date exists and is past today and not completed
    if (task.due) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      if (!task.completed && task.due < todayStr) {
        li.classList.add('overdue');
      }
    }
    // Create checkbox and label
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    label.appendChild(checkbox);
    // Task name span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'task-name';
    nameSpan.textContent = task.name;
    label.appendChild(nameSpan);
    // Due date span (if due date exists)
    if (task.due) {
      const dueSpan = document.createElement('span');
      dueSpan.className = 'due-date';
      dueSpan.textContent = `(Due: ${task.due})`;
      label.appendChild(dueSpan);
    }
    li.appendChild(label);
    // Delete button (X)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-task-btn';
    deleteBtn.setAttribute('aria-label', 'Delete task');
    deleteBtn.textContent = '✖';
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
  });
});

// Real-time listener for templates collection
templatesCollection.orderBy('name').onSnapshot(snapshot => {
  templatesData = [];
  templateList.innerHTML = ""; // clear list
  snapshot.forEach(doc => {
    const tmpl = doc.data();
    const templateItem = {
      id: doc.id,
      name: tmpl.name,
      tasks: tmpl.tasks || []
    };
    templatesData.push(templateItem);
    // Build list item
    const li = document.createElement('li');
    li.dataset.id = templateItem.id;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'template-name';
    // Display group name and number of tasks
    const taskCount = templateItem.tasks.length;
    nameSpan.textContent = `${templateItem.name} (${taskCount} tasks)`;
    li.appendChild(nameSpan);
    // Buttons container (span wrapping buttons)
    const btnContainer = document.createElement('span');
    // Use template button
    const useBtn = document.createElement('button');
    useBtn.className = 'use-template-btn btn-primary';
    useBtn.setAttribute('aria-label', 'Use template ' + templateItem.name);
    useBtn.textContent = 'Use';
    btnContainer.appendChild(useBtn);
    // Delete template button
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-template-btn btn-danger';
    delBtn.setAttribute('aria-label', 'Delete template ' + templateItem.name);
    delBtn.textContent = 'Delete';
    btnContainer.appendChild(delBtn);
    li.appendChild(btnContainer);
    templateList.appendChild(li);
  });
});

// Handle adding a new task
taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = taskNameInput.value.trim();
  const due = taskDueInput.value;
  if (name) {
    const newTask = {
      name: name,
      completed: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (due) {
      newTask.due = due;
    }
    // Add to Firestore
    tasksCollection.add(newTask)
      .catch(err => console.error("Error adding task:", err));
    // Clear form inputs
    taskNameInput.value = "";
    taskDueInput.value = "";
  }
});

// Handle saving current tasks as a template
templateForm.addEventListener('submit', e => {
  e.preventDefault();
  const templateName = templateNameInput.value.trim();
  if (!templateName) return;
  if (tasksData.length === 0) {
    alert("There are no tasks to save as a template.");
    return;
  }
  // Prepare tasks for template (name and due, completed false)
  const tasksForTemplate = tasksData.map(t => {
    return {
      name: t.name,
      due: t.due ? t.due : "",
      completed: false
    };
  });
  templatesCollection.add({
    name: templateName,
    tasks: tasksForTemplate
  })
  .catch(err => console.error("Error saving template:", err));
  // Clear template name input
  templateNameInput.value = "";
});

// Event delegation for task list (checkbox toggle and delete)
taskList.addEventListener('change', e => {
  if (e.target && e.target.type === 'checkbox') {
    const taskId = e.target.closest('li').dataset.id;
    const newStatus = e.target.checked;
    tasksCollection.doc(taskId).update({ completed: newStatus })
      .catch(err => console.error("Error updating task:", err));
  }
});
taskList.addEventListener('click', e => {
  if (e.target && e.target.classList.contains('delete-task-btn')) {
    const taskId = e.target.closest('li').dataset.id;
    const confirmDelete = confirm("Are you sure you want to delete this task?");
    if (confirmDelete) {
      tasksCollection.doc(taskId).delete().catch(err => console.error("Error deleting task:", err));
    }
  }
});

// Event delegation for template list (use and delete buttons)
templateList.addEventListener('click', e => {
  if (e.target && e.target.classList.contains('use-template-btn')) {
    const templateId = e.target.closest('li').dataset.id;
    // Find template data
    const template = templatesData.find(t => t.id === templateId);
    if (template) {
      // Add each task from template to tasks collection
      template.tasks.forEach(task => {
        const taskToAdd = {
          name: task.name,
          completed: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (task.due) {
          taskToAdd.due = task.due;
        }
        tasksCollection.add(taskToAdd).catch(err => console.error("Error adding task from template:", err));
      });
    }
  } else if (e.target && e.target.classList.contains('delete-template-btn')) {
    const templateId = e.target.closest('li').dataset.id;
    const confirmDelete = confirm("Are you sure you want to delete this task template?");
    if (confirmDelete) {
      templatesCollection.doc(templateId).delete().catch(err => console.error("Error deleting template:", err));
    }
  }
});

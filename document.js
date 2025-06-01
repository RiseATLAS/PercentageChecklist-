document.addEventListener('DOMContentLoaded', () => {
    const addTaskButton = document.getElementById('addTaskButton');
    const addCategoryButton = document.getElementById('addCategoryButton');
    const markAllCompleteButton = document.getElementById('markAllCompleteButton');
    const deleteCompletedButton = document.getElementById('deleteCompletedButton');
    const searchInput = document.getElementById('searchInput');
    const sortBy = document.getElementById('sortBy');
    const taskInput = document.getElementById('taskInput');
    const newCategoryInput = document.getElementById('newCategoryInput');

    // Remove duplicate event listeners and re-add handlers as named functions.
    if (addTaskButton) {
        addTaskButton.removeEventListener('click', addTaskHandler);
        addTaskButton.addEventListener('click', addTaskHandler);
    }
    if (addCategoryButton) {
        addCategoryButton.removeEventListener('click', addCategoryHandler);
        addCategoryButton.addEventListener('click', addCategoryHandler);
    }
    if (markAllCompleteButton) {
        markAllCompleteButton.removeEventListener('click', markAllCompleteHandler);
        markAllCompleteButton.addEventListener('click', markAllCompleteHandler);
    }
    if (deleteCompletedButton) {
        deleteCompletedButton.removeEventListener('click', deleteCompletedHandler);
        deleteCompletedButton.addEventListener('click', deleteCompletedHandler);
    }
    if (searchInput) {
        searchInput.removeEventListener('input', searchInputHandler);
        searchInput.addEventListener('input', searchInputHandler);
    }
    if (sortBy) {
        sortBy.removeEventListener('change', sortByHandler);
        sortBy.addEventListener('change', sortByHandler);
    }
    if (taskInput) {
        taskInput.removeEventListener('keydown', taskInputKeydownHandler);
        taskInput.addEventListener('keydown', taskInputKeydownHandler);
    }
    if (newCategoryInput) {
        newCategoryInput.removeEventListener('keydown', newCategoryInputKeydownHandler);
        newCategoryInput.addEventListener('keydown', newCategoryInputKeydownHandler);
    }

    // Handler functions defined here (or imported from another script)
    function addTaskHandler() {
        // ...existing code...
    }
    function addCategoryHandler() {
        // ...existing code...
    }
    function markAllCompleteHandler() {
        // ...existing code...
    }
    function deleteCompletedHandler() {
        // ...existing code...
    }
    function searchInputHandler() {
        // ...existing code...
    }
    function sortByHandler() {
        // ...existing code...
    }
    function taskInputKeydownHandler(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTaskButton.click();
        }
    }
    function newCategoryInputKeydownHandler(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCategoryButton.click();
        }
    }
});
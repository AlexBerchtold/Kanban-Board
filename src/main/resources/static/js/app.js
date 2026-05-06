document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const modal = document.getElementById('task-modal');
    const btnCreateTask = document.getElementById('btn-create-task');
    const closeBtns = document.querySelectorAll('.close-modal');
    const formCreateTask = document.getElementById('create-task-form');
    const dropZones = document.querySelectorAll('.drop-zone');

    // State
    let tasks = [];

    // Initialize
    fetchTasks();

    // Modal Logic
    btnCreateTask.addEventListener('click', () => {
        formCreateTask.removeAttribute('data-edit-id');
        document.querySelector('.modal-header h2').textContent = 'Create New Task';
        document.querySelector('.modal-actions button[type="submit"]').textContent = 'Create Task';
        formCreateTask.reset();
        modal.classList.add('active');
    });

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('active');
            formCreateTask.reset();
            formCreateTask.removeAttribute('data-edit-id');
        });
    });

    // Edit Task Logic
    function openEditModal(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        formCreateTask.setAttribute('data-edit-id', task.id);
        document.querySelector('.modal-header h2').textContent = 'Edit Task';
        document.querySelector('.modal-actions button[type="submit"]').textContent = 'Update Task';
        
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        if (task.assignedUser) {
            document.getElementById('task-assignee').value = task.assignedUser.id;
        } else {
            document.getElementById('task-assignee').value = "";
        }

        modal.classList.add('active');
    }

    // Form Logic
    formCreateTask.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('task-title').value;
        const description = document.getElementById('task-desc').value;
        const userId = document.getElementById('task-assignee').value;
        const editId = formCreateTask.getAttribute('data-edit-id');

        try {
            const isEdit = !!editId;
            const url = isEdit ? `/kanban/api/tasks/${editId}` : '/kanban/api/tasks';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title, description, userId })
            });

            if (response.ok) {
                const savedTask = await response.json();
                
                if (isEdit) {
                    const index = tasks.findIndex(t => t.id == editId);
                    if (index !== -1) tasks[index] = savedTask;
                } else {
                    tasks.push(savedTask);
                }
                
                renderAllTasks();
                modal.classList.remove('active');
                formCreateTask.reset();
                formCreateTask.removeAttribute('data-edit-id');
            } else {
                alert('Failed to save task');
            }
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Error saving task');
        }
    });

    // Drag and Drop Logic
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', async e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            const taskId = e.dataTransfer.getData('text/plain');
            const draggedCard = document.getElementById(`task-${taskId}`);
            const newStatus = zone.parentElement.dataset.status;
            
            // Only update if status changed
            const currentStatus = tasks.find(t => t.id == taskId)?.status;
            if (currentStatus === newStatus) return;

            // Move in UI temporarily
            zone.appendChild(draggedCard);

            try {
                // Update in Backend
                const response = await fetch(`/kanban/api/tasks/${taskId}/status`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: newStatus })
                });

                if (response.ok) {
                    const updatedTask = await response.json();
                    const index = tasks.findIndex(t => t.id == taskId);
                    if (index !== -1) {
                        tasks[index] = updatedTask;
                    }
                    updateCounts();
                } else {
                    throw new Error('Failed to update status');
                }
            } catch (error) {
                console.error('Error updating task:', error);
                // Revert UI if error
                fetchTasks();
            }
        });
    });

    // Fetch and Render
    async function fetchTasks() {
        try {
            const response = await fetch('/kanban/api/tasks');
            if (response.ok) {
                tasks = await response.json();
                renderAllTasks();
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    }

    function renderAllTasks() {
        // Clear all columns
        document.querySelectorAll('.drop-zone').forEach(zone => zone.innerHTML = '');
        
        // Render each task
        tasks.forEach(task => renderTask(task));
        updateCounts();
    }

    function renderTask(task) {
        const column = document.querySelector(`#col-${task.status} .drop-zone`);
        if (!column) return;

        const card = document.createElement('div');
        card.className = 'task-card';
        card.id = `task-${task.id}`;
        card.draggable = true;

        const assigneeInitial = task.assignedUser?.username ? task.assignedUser.username.charAt(0).toUpperCase() : '?';
        const assigneeName = task.assignedUser?.username || 'Unassigned';

        card.innerHTML = `
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-desc">${escapeHtml(task.description || '')}</div>
            <div class="task-footer">
                <span class="task-id">#${task.id}</span>
                <div class="task-actions">
                    <button class="btn btn-sm btn-edit" data-id="${task.id}" style="background: none; border: none; color: var(--text-secondary); cursor: pointer;"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-delete" data-id="${task.id}" style="background: none; border: none; color: var(--danger); cursor: pointer; margin-left: 0.25rem;"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="task-assignee" title="${assigneeName}">
                    <div class="avatar">${assigneeInitial}</div>
                    <span>${assigneeName}</span>
                </div>
            </div>
        `;

        // Add edit event listener
        const editBtn = card.querySelector('.btn-edit');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent triggering drag
                openEditModal(task.id);
            });
        }

        // Add delete event listener
        const deleteBtn = card.querySelector('.btn-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // prevent triggering drag
                if (confirm('Are you sure you want to delete this task?')) {
                    await deleteSingleTask(task.id);
                }
            });
        }

        // Add drag events
        card.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', task.id);
            setTimeout(() => card.classList.add('dragging'), 0);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });

        column.appendChild(card);
    }

    function updateCounts() {
        ['TO_DO', 'DOING', 'DONE'].forEach(status => {
            const count = tasks.filter(t => t.status === status).length;
            document.querySelector(`#col-${status} .task-count`).textContent = count;
        });
    }

    async function deleteSingleTask(taskId) {
        try {
            const response = await fetch(`/kanban/api/tasks/${taskId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                tasks = tasks.filter(t => t.id !== taskId);
                renderAllTasks();
            } else {
                alert('Failed to delete task');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Error deleting task');
        }
    }

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});

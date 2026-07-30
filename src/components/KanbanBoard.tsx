import { useState, useEffect, memo } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { Task, TasksByStatus, Status } from "@/lib/types";
import TaskCard from "./TaskCard";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface KanbanColumnProps {
  title: string;
  tasks: Task[];
  status: Status;
  canEditTaskStatus: (task: Task) => boolean;
  onDelete?: (taskId: string) => void;
  onTaskClick?: (task: Task) => void;
  onEdit?: (task: Task) => void;
}

const columnTitles: Record<Status, string> = {
  'draft': 'Draft',
  'in-progress': 'In Progress',
  'under-review': 'Under Review',
  'completed': 'Completed',
  'canceled': 'Canceled',
  'archived': 'Archived'
};

// Use memo to prevent unnecessary re-renders
const KanbanColumn = memo(({ 
  title, 
  tasks, 
  status, 
  canEditTaskStatus, 
  onDelete = () => {}, 
  onTaskClick,
  onEdit
}: KanbanColumnProps) => {
  return (
    <Droppable droppableId={status}>
      {(provided) => (
        <div
          className="bg-secondary/50 rounded-lg p-3 min-h-[70vh] w-72 flex-shrink-0"
          {...provided.droppableProps}
          ref={provided.innerRef}
          style={{ overflow: 'visible' }}
        >
          <h3 className="font-medium text-sm mb-3 flex items-center justify-between">
            <span>{title}</span>
            <span className="bg-secondary px-2 rounded text-xs">{tasks.length}</span>
          </h3>
          
          <div className="space-y-3" style={{ overflow: 'visible' }}>
            {tasks.map((task, index) => (
              <Draggable 
                key={task.id} 
                draggableId={task.id} 
                index={index}
                isDragDisabled={!canEditTaskStatus(task)}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                      ...provided.draggableProps.style,
                      opacity: snapshot.isDragging ? 0.8 : 1,
                      transition: snapshot.isDragging ? 'transform 0.2s ease-out' : 'transform 0.2s ease-in, opacity 0.2s ease-in',
                      transform: snapshot.isDragging ? `${provided.draggableProps.style?.transform} scale(1.05)` : provided.draggableProps.style?.transform,
                      boxShadow: snapshot.isDragging ? '0 5px 15px rgba(0, 0, 0, 0.1)' : 'none'
                    }}
                  >
                    <TaskCard 
                      task={task} 
                      onDelete={onDelete} 
                      onClick={onTaskClick ? () => onTaskClick(task) : undefined}
                      onEdit={onEdit}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
});

interface KanbanBoardProps {
  tasks: TasksByStatus;
  onTaskMove?: (taskId: string, newStatus: Status) => void;
  onDelete?: (taskId: string) => void;
  onTaskClick?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  showArchived?: boolean;
}

const KanbanBoard = ({ tasks, onTaskMove, onDelete, onTaskClick, onEdit, showArchived = false }: KanbanBoardProps) => {
  const [localTasks, setLocalTasks] = useState<TasksByStatus>(tasks);
  const { user } = useAuth();

  // Sync props with state when tasks prop changes
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Check if user can edit task status
  const canEditTaskStatus = (task: Task) => {
    if (!user) return false;
    
    // Check if this is "Моя задача" - task assigned to the current user
    const isMyTask = task.assignees && task.assignees.some(assignee => assignee.id === user.id);
    
    // Check if user is the creator of the task
    const isCreator = task.createdBy === user.id;
    
    // Check if user is an admin or team-lead
    const isAdmin = user.role === 'admin' || user.role === 'team-lead';
    
    // Admin or creator can always edit, assignees can edit their own tasks
    return isAdmin || isCreator || isMyTask;
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    
    // Dropped outside the list or in the same position
    if (!destination) return;
    
    const sourceId = source.droppableId as Status;
    const destId = destination.droppableId as Status;
    
    // If dropped in the same column and same position, do nothing
    if (sourceId === destId && source.index === destination.index) return;
    
    // Find the task that was dragged
    const sourceColumn = localTasks[sourceId] || [];
    const taskToMove = sourceColumn[source.index];
    
    if (!taskToMove) return;
    
    // Double-check permissions before proceeding
    if (!canEditTaskStatus(taskToMove)) {
      toast.error('У вас нет прав на изменение статуса этой задачи');
      return;
    }
    
    // Create a new state object to avoid mutation
    const newTasks = {...localTasks};
    
    // If moving within the same column
    if (sourceId === destId) {
      const newColumn = [...sourceColumn];
      // Remove the task from its old position
      newColumn.splice(source.index, 1);
      // Insert the task at the new position
      newColumn.splice(destination.index, 0, taskToMove);
      newTasks[sourceId] = newColumn;
    } else {
      // Moving to a different column
      // Remove from source column
      newTasks[sourceId] = sourceColumn.filter(t => t.id !== taskToMove.id);
      
      // Update task status
      const updatedTask = {...taskToMove, status: destId};
      
      // Add to destination column
      const destColumn = [...(newTasks[destId] || [])];
      destColumn.splice(destination.index, 0, updatedTask);
      newTasks[destId] = destColumn;
      
      // Notify parent component
      if (onTaskMove) {
        onTaskMove(updatedTask.id, destId);
      }
    }
    
    setLocalTasks(newTasks);
  };

  const handleDelete = (taskId: string) => {
    if (!onDelete) return;
    
    const newTasks = {...localTasks};
    Object.keys(newTasks).forEach(status => {
      newTasks[status as Status] = newTasks[status as Status].filter(task => task.id !== taskId);
    });
    
    setLocalTasks(newTasks);
    
    onDelete(taskId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 pb-4 px-1" style={{ overflow: 'auto', height: 'auto' }}>
        {Object.entries(columnTitles)
          .filter(([status]) => {
            // If showing archived, only show the archived column
            if (showArchived) {
              return status === 'archived';
            }
            // Otherwise show all columns except archived
            return status !== 'archived';
          })
          .map(([status, title]) => (
            <KanbanColumn
              key={status}
              title={title}
              tasks={localTasks[status as Status] || []}
              status={status as Status}
              canEditTaskStatus={canEditTaskStatus}
              onDelete={handleDelete}
              onTaskClick={onTaskClick}
              onEdit={onEdit}
            />
          ))
        }
      </div>
    </DragDropContext>
  );
};

export default KanbanBoard;

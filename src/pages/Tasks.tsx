import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getEnhancedTasks, getTasks, getUsers, deleteTask } from "@/lib/api-utils";
import TaskCard from "@/components/TaskCard";
import KanbanBoard from "@/components/KanbanBoard";
import { Task, Status, User } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, Search } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { TaskForm } from "@/components/TaskForm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { TaskDetail } from "@/components/TaskDetail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_ENDPOINTS } from '@/config/api';

const Tasks = () => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch all tasks
  const { 
    data: allTasks = [], 
    refetch: refetchTasks,
    isLoading: tasksLoading,
    isError: tasksError
  } = useQuery({
    queryKey: ["enhanced-tasks"],
    queryFn: () => getEnhancedTasks(token),
    enabled: !!token,
    // Reduce stale time to ensure fresh data on initial load
    staleTime: 0,
    // Fetch immediately on component mount
    refetchOnMount: true
  });

  // Fetch users from the server
  const { 
    data: users = [], 
    isLoading: usersLoading, 
    refetch: refetchUsers 
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(token),
    enabled: !!token,
    staleTime: 0,
    refetchOnMount: true
  });

  // Local state
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  
  // Force refresh when dialog closes
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Immediate refresh when dialog closes
      refetchTasks();
      refetchUsers();
      // Also invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  };
  
  // Setup effect to periodically refresh data
  useEffect(() => {
    // Initial data load
    if (token) {
      refetchTasks();
      refetchUsers();
    }
    
    // Set up a refresh interval
    const refreshIntervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && token) {
        refetchTasks();
      }
    }, 3000); // Refresh every 3 seconds when tab is visible
    
    // Clean up interval on component unmount
    return () => clearInterval(refreshIntervalId);
  }, [refetchTasks, refetchUsers, token]);
  
  // Filter tasks based on search query, selected users, and archived status
  const filteredTasks = useMemo(() => {
    // Start with all tasks
    return allTasks.filter(task => {
      // Filter by archived status unless explicitly showing archived
      if (!showArchived && task.status === 'archived') {
        return false;
      }
      
      // If showing only archived tasks, filter out non-archived tasks
      if (showArchived && task.status !== 'archived') {
        return false;
      }
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(query) && 
            !task.description.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Filter by selected users
      if (selectedUsers.length > 0) {
        const hasSelectedUser = task.assignees && 
          task.assignees.some(assignee => selectedUsers.includes(assignee.id));
        
        if (!hasSelectedUser) {
          return false;
        }
      }
      
      // If it passed all filters, include it
      return true;
    });
  }, [allTasks, searchQuery, selectedUsers, showArchived]);

  // Group tasks by status for Kanban board
  const filteredTasksByStatus = useMemo(() => ({
    draft: filteredTasks.filter(task => task.status === "draft"),
    "in-progress": filteredTasks.filter(task => task.status === "in-progress"),
    "under-review": filteredTasks.filter(task => task.status === "under-review"),
    completed: filteredTasks.filter(task => task.status === "completed"),
    canceled: filteredTasks.filter(task => task.status === "canceled"),
    archived: filteredTasks.filter(task => task.status === "archived")
  }), [filteredTasks]);

  // Check if user can edit task status - same logic as in KanbanBoard
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

  // Handle task status change
  const handleTaskMove = async (taskId: string, newStatus: Status) => {
    try {
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;
      
      // Check permissions before doing anything
      if (!canEditTaskStatus(task)) {
        toast.error('Only administrator, team lead, task creator or assigned executor can change task status');
        return;
      }
      
      // Update the UI optimistically
      const updatedTasks = allTasks.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      );
      
      queryClient.setQueryData(["enhanced-tasks"], updatedTasks);
      
      // Perform the API update
      await fetch(API_ENDPOINTS.TASKS.BY_ID(taskId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      // Refresh data after successful update
      refetchTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
      refetchTasks();
    }
  };
  
  // Handle task deletion
  const handleDeleteTask = async (taskId: string) => {
    try {
      // Find the task
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;
      
      // Check if user can delete the task (creator, admin, or assignee can delete)
      if (user && (user.role === 'admin' || user.role === 'team-lead' || task.createdBy === user.id || (task.assigneeIds && task.assigneeIds.includes(user.id)))) {
        // Optimistically update UI
        const updatedTasks = allTasks.filter(t => t.id !== taskId);
        
        // Update the cache immediately
        queryClient.setQueryData(["enhanced-tasks"], updatedTasks);
        
        // Call the API to delete the task
        await deleteTask(taskId, token || '');
        
        // Show success message
        toast.success('Task successfully deleted');
        
        // Refresh tasks and calendar data
        refetchTasks();
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      } else {
        toast.error('You do not have permission to delete this task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
      // Revert optimistic update on error
      refetchTasks();
    }
  };
  
  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    // If the user is already selected, clear the selection
    if (selectedUsers.includes(userId)) {
      setSelectedUsers([]);
    } else {
      // Otherwise, select only this user (replacing any previous selection)
      setSelectedUsers([userId]);
    }
  };

  // Handle task click to open task detail
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailOpen(true);
  };
  
  // Handle edit task action from quick menu
  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailOpen(true);
  };
  
  // Handle task detail close
  const handleTaskDetailClose = () => {
    setTaskDetailOpen(false);
    setSelectedTask(null);
  };
  
  // Handle task update
  const handleTaskUpdated = () => {
    refetchTasks();
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["tasks-by-status"] });
    queryClient.invalidateQueries({ queryKey: ["enhanced-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
  };

  return (
    <MainLayout title="Tasks">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                Assignees <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {usersLoading ? (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  Loading users...
                </div>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      if (selectedUsers.includes(user.id)) {
                        setSelectedUsers([]);
                      } else {
                        setSelectedUsers([user.id]);
                      }
                    }}
                  >
                    <div className="mr-2 h-4 w-4 flex items-center justify-center">
                      {selectedUsers.includes(user.id) && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <UserAvatar user={user} size="sm" />
                      <span>{user.name}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  No available users
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="flex border rounded-md overflow-hidden">
            <Button 
              variant={view === "kanban" ? "default" : "ghost"} 
              className="rounded-none flex-1"
              onClick={() => setView("kanban")}
            >
              Kanban
            </Button>
            <Button 
              variant={view === "list" ? "default" : "ghost"} 
              className="rounded-none flex-1"
              onClick={() => setView("list")}
            >
              List
            </Button>
          </div>
          
          <Button 
            variant={showArchived ? "default" : "outline"}
            className="gap-1"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? "Regular Tasks" : "Task Archive"}
          </Button>
          
          <Button className="gap-1" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add Task
          </Button>
        </div>
      </div>
      
      {tasksLoading ? (
        <Skeleton className="h-96" />
      ) : (
        view === "kanban" ? (
          <KanbanBoard 
            tasks={filteredTasksByStatus} 
            onTaskMove={handleTaskMove} 
            onDelete={handleDeleteTask}
            onTaskClick={handleTaskClick}
            onEdit={handleEditTask}
            showArchived={showArchived}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onDelete={handleDeleteTask}
                onClick={() => handleTaskClick(task)}
                onEdit={handleEditTask}
              />
            ))}
            {filteredTasks.length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-xl text-muted-foreground">No tasks found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try changing search parameters
                </p>
              </div>
            )}
          </div>
        )
      )}
      
      <TaskForm 
        open={dialogOpen} 
        onOpenChange={handleDialogOpenChange} 
        onTaskCreated={() => {
          refetchTasks();
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["tasks-by-status"] });
          queryClient.invalidateQueries({ queryKey: ["enhanced-tasks"] });
          queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        }}
      />
      
      <TaskDetail 
        task={selectedTask} 
        open={taskDetailOpen} 
        onOpenChange={setTaskDetailOpen}
        onTaskUpdated={handleTaskUpdated}
      />
    </MainLayout>
  );
};

export default Tasks;

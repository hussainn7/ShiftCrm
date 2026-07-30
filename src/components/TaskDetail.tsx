import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Task, User, Status, SubTask } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUsers, getClients, getProjects, updateTask, sendNotification } from '@/lib/api-utils';
import { toast } from 'sonner';
import UserAvatar from '@/components/UserAvatar';
import { CalendarIcon, Plus, Trash2, Check, X, Download, Eye, Image, File, FileText, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
// CSS for hiding scrollbar is added inline to avoid import issues
import { isImageFile, FileAttachment, UPLOADS_BASE_URL } from '@/lib/file-utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { CustomBadge } from './ui/custom-badge';

// Simple UUID generator function that doesn't rely on crypto.randomUUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface TaskDetailProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
}

const statusOptions: { value: Status; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in-progress", label: "In Progress" },
  { value: "under-review", label: "Under Review" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" }
];

export function TaskDetail({ task, open, onOpenChange, onTaskUpdated }: TaskDetailProps) {
  const { user, token, addNotification } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  
  // Task state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('draft');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  
  // Fetch data
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(token),
    enabled: !!token
  });
  
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(token),
    enabled: !!token
  });
  
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(token),
    enabled: !!token
  });
  
  // Check if user can edit this task
  const canEditTask = () => {
    if (!task || !user) return false;
    
    // Check if this is "Моя задача" - task assigned to the current user
    const isMyTask = task.assignees && task.assignees.some(assignee => assignee.id === user.id);
    
    // Admin or team-lead or creator can always edit, assignees can edit their own tasks
    return user.role === 'admin' || user.role === 'team-lead' || task.createdBy === user.id || isMyTask;
  };
  
  // Initialize form with task data
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'draft');
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
      setClientId(task.clientId);
      setProjectId(task.projectId);
      setAssigneeIds(task.assigneeIds || []);
      setSubtasks(task.subTasks || []);
      setFileAttachments(task.attachments ? task.attachments.map(url => ({ id: generateUUID(), name: url.split('/').pop() || 'file', path: url, type: '', size: 0, isImage: false })) : []);
    }
  }, [task]);
  
  // Reset editing state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);
  
  // Filter projects based on selected client
  const filteredProjects = clientId 
    ? projects.filter(project => project.clientId === clientId)
    : projects;
  
  // Handle adding a new subtask
  const addSubtask = () => {
    setSubtasks([...subtasks, { id: generateUUID(), title: '', completed: false }]);
  };
  
  // Handle removing a subtask
  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
  };
  
  // Handle subtask title change
  const updateSubtaskTitle = (id: string, title: string) => {
    setSubtasks(subtasks.map(st => st.id === id ? { ...st, title } : st));
  };
  
  // Handle subtask completion toggle
  const toggleSubtaskCompletion = (id: string) => {
    setSubtasks(subtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st));
  };
  
  // Get assigned users from their IDs
  const getAssignedUsers = () => {
    if (!task) return [];
    
    // If task already has populated assignees array, use it
    if (task.assignees && Array.isArray(task.assignees)) {
      return task.assignees;
    }
    
    // Otherwise, use assigneeIds to find users
    if (task.assigneeIds && Array.isArray(task.assigneeIds)) {
      return task.assigneeIds
        .map(id => users.find(user => user.id === id))
        .filter(Boolean) as User[];
    }
    
    return [];
  };
  
  // Save task changes
  const saveChanges = async () => {
    if (!task) return;
    
    try {
      // Prepare updated task data
      const updatedTask = {
        ...task,
        title,
        description,
        status,
        dueDate: dueDate ? dueDate.toISOString() : task.dueDate,
        clientId,
        projectId,
        assigneeIds,
        subTasks: subtasks,
        fileAttachments,
      };
      
      // Get previous assignees to determine who's newly assigned
      const previousAssigneeIds = task.assignees && task.assignees.length > 0 
        ? task.assignees.map(a => a.id) 
        : [];
      const newAssigneeIds = assigneeIds.filter(id => !previousAssigneeIds.includes(id));
      
      // Update the task
      await updateTask(task.id, updatedTask, token || '');
      
      // Send notifications to newly assigned users
      if (newAssigneeIds.length > 0) {
        // Get client and project names for the notification
                  const clientName = clientId
            ? clients.find(c => c.id === clientId)?.name || "Unknown client"
            : "No client";
            
          const projectName = projectId
            ? projects.find(p => p.id === projectId)?.name || "Unknown project"
            : "No project";
        
        // Notify each newly assigned user
        newAssigneeIds.forEach(userId => {
          // Don't notify the creator
          if (userId !== user?.id) {
            // Find user info for personalized notification
            const assignedUser = users.find(u => u.id === userId);
            if (assignedUser) {
              // Create notification object
              const notification = {
                type: "task_assignment",
                title: "New Task Assignment",
                message: `You have been assigned to task "${title}" ${projectName !== "No project" ? `for project "${projectName}"` : ''} ${clientName !== "No client" ? `(client: ${clientName})` : ''}. Task status: ${status}.`,
                entityId: task.id,
                entityType: "task" as "task" | "project" | "client",
                taskId: task.id
              };
              
              // Add notification to current user's context
              addNotification(notification);
              
              // Also send notification to the server for the assigned user
              // This ensures the notification persists and is visible when the assigned user logs in
              try {
                sendNotification(userId, notification, token || '');
              } catch (error) {
                console.error("Error sending notification to user:", error);
              }
            }
          }
        });
      }
      
      // Show success message
      toast.success('Task updated successfully');
      
      // Reset editing state
      setIsEditing(false);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-by-status'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-tasks'] });
      
      // Call onTaskUpdated callback if provided
      if (onTaskUpdated) {
        onTaskUpdated();
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };
  
  if (!task) return null;
  
  // Get assigned users
  const assignedUsers = getAssignedUsers();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" aria-describedby="task-detail-description">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {isEditing ? (
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="text-xl font-semibold"
              />
            ) : (
              <div className="flex items-center justify-between w-full">
                <span>{task.title}</span>
                <CustomBadge variant={status}>{statusOptions.find(s => s.value === status)?.label || status}</CustomBadge>
              </div>
            )}
          </DialogTitle>
          <p id="task-detail-description" className="sr-only">Detailed task information</p>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="flex w-full overflow-x-auto" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }} data-hide-scrollbar>
            <TabsTrigger value="details" className="flex-1 min-w-fit text-xs sm:text-sm">Details</TabsTrigger>
            <TabsTrigger value="subtasks" className="flex-1 min-w-fit text-xs sm:text-sm">Subtasks</TabsTrigger>
            <TabsTrigger value="attachments" className="flex-1 min-w-fit text-xs sm:text-sm">Files</TabsTrigger>
            <TabsTrigger value="comments" className="flex-1 min-w-fit text-xs sm:text-sm">Comments</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 min-w-fit text-xs sm:text-sm">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="attachments" className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Files and Attachments</h3>
              {fileAttachments && fileAttachments.length > 0 ? (
                <div className="space-y-2">
                  {fileAttachments.map((file, index) => (
                    <div key={file.id || index} className="flex items-center justify-between p-2 border rounded-md">
                      <div className="flex items-center">
                        {file.isImage ? (
                          <Image className="mr-2 h-4 w-4" />
                        ) : (
                          <File className="mr-2 h-4 w-4" />
                        )}
                        <span className="mr-2">{file.name}</span>
                        {file.size && (
                          <span className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* {file.isImage && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(file.path, '_blank')}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )} */}
                        {/* Download button temporarily disabled */}
                        {/* <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            // Create a proper anchor element for downloading
                            const a = document.createElement('a');
                            a.href = file.path;
                            // Force download attribute with the original filename
                            a.setAttribute('download', file.name);
                            // Append to body, click, and remove
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                                                      title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button> */}
                        {isEditing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              // Remove file from attachments
                              setFileAttachments(fileAttachments.filter(f => 
                                f.id !== file.id
                              ));
                              toast.success('File deleted');
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground p-4">
                  No attached files
                </div>
              )}
              
              {isEditing && (
                <div className="mt-4">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      
                      try {
                        // Process each file to create proper file attachments
                        const newAttachmentsPromises = Array.from(files).map(file => ({
                          id: generateUUID(),
                          name: file.name,
                          path: URL.createObjectURL(file),
                          type: file.type,
                          size: file.size,
                          isImage: isImageFile(file.name)
                        }));
                        
                        const newAttachments = await Promise.all(newAttachmentsPromises);
                        const updatedAttachments = [...fileAttachments, ...newAttachments];
                        
                        setFileAttachments(updatedAttachments);
                        toast.success('Files added');
                      } catch (error) {
                        console.error('Error uploading files:', error);
                        toast.error('Error uploading files');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="w-full"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Add Files
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="details" className="space-y-4">
            {/* Description */}
            <div>
              <h3 className="text-sm font-medium mb-2">Description</h3>
              {isEditing ? (
                <Textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  className="min-h-[100px]"
                />
              ) : (
                <div className="bg-muted p-3 rounded-md whitespace-pre-wrap">
                  {task.description || "No description"}
                </div>
              )}
            </div>
            
            {/* Status */}
            {isEditing && (
              <div>
                <h3 className="text-sm font-medium mb-2">Status</h3>
                <Select value={status} onValueChange={(value: Status) => setStatus(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Due Date */}
            <div>
              <h3 className="text-sm font-medium mb-2">Due Date</h3>
              {isEditing ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "dd.MM.yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <div className="bg-muted p-3 rounded-md">
                  {task.dueDate ? format(new Date(task.dueDate), "dd.MM.yyyy") : "No due date"}
                </div>
              )}
            </div>
            
            {/* Client */}
            <div>
              <h3 className="text-sm font-medium mb-2">Client</h3>
              {isEditing ? (
                <Select 
                  value={clientId || ''} 
                  onValueChange={(value) => {
                    setClientId(value === 'none' ? undefined : value);
                    // Reset project if client changes
                    setProjectId(undefined);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="bg-muted p-3 rounded-md">
                  {task.client ? task.client.name : "No client"}
                </div>
              )}
            </div>
            
            {/* Project */}
            <div>
              <h3 className="text-sm font-medium mb-2">Project</h3>
              {isEditing ? (
                <Select 
                  value={projectId || ''} 
                  onValueChange={(value) => setProjectId(value === 'none' ? undefined : value)}
                  disabled={!clientId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!clientId ? "First select a client" : "Select project"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filteredProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="bg-muted p-3 rounded-md">
                  {task.project ? task.project.name : "No project"}
                </div>
              )}
            </div>
            
            {/* Assignees */}
            <div>
              <h3 className="text-sm font-medium mb-2">Assignees</h3>
              {isEditing ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>
                        {assigneeIds.length 
                          ? `Selected assignees: ${assigneeIds.length}` 
                          : "Select assignees"}
                      </span>
                      <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {users.map((user) => (
                      <DropdownMenuCheckboxItem
                        key={user.id}
                        checked={assigneeIds.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            // Add this user to the existing selection
                            setAssigneeIds([...assigneeIds, user.id]);
                          } else {
                            // Deselect this user
                            setAssigneeIds(assigneeIds.filter((id) => id !== user.id));
                          }
                        }}
                      >
                        <div className="flex items-center">
                          <UserAvatar user={user} size="sm" />
                          <span className="ml-2">{user.name}</span>
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedUsers && assignedUsers.length > 0 ? (
                    assignedUsers.map((assignee) => (
                      <div key={assignee.id} className="flex items-center bg-muted p-2 rounded-md">
                        <UserAvatar user={assignee} size="sm" />
                        <span className="ml-2">{assignee.name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="bg-muted p-3 rounded-md w-full">No assignees</div>
                  )}
                </div>
              )}
            </div>
            
            {/* Created by */}
            <div>
              <h3 className="text-sm font-medium mb-2">Created by</h3>
              <div className="bg-muted p-3 rounded-md">
                                  {task.creator?.name || "Unknown"}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="subtasks" className="space-y-4">
            {isEditing && (
              <Button onClick={addSubtask} className="mb-4">
                <Plus className="mr-2 h-4 w-4" /> Add Subtask
              </Button>
            )}
            
            {subtasks && subtasks.length > 0 ? (
              <div className="space-y-2">
                {subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 p-2 border rounded-md">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleSubtaskCompletion(subtask.id)}
                        >
                          {subtask.completed ? <Check className="h-4 w-4" /> : <div className="h-4 w-4 border rounded-sm" />}
                        </Button>
                        <Input
                          value={subtask.title}
                          onChange={(e) => updateSubtaskTitle(subtask.id, e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSubtask(subtask.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className={cn(
                          "flex items-center gap-2 flex-1",
                          subtask.completed && "line-through text-muted-foreground"
                        )}>
                          {subtask.completed ? <Check className="h-4 w-4" /> : <div className="h-4 w-4 border rounded-sm" />}
                          <span>{subtask.title}</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground p-4 flex items-center justify-center gap-2">
                <span className="inline-flex items-center">
                  <X className="h-4 w-4 mr-1" />
                  No subtasks
                </span>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="comments" className="space-y-4">
            {/* Only show comments if user is involved with the task */}
            {canEditTask ? (
              task.comments && task.comments.length > 0 ? (
                <div className="space-y-4">
                  {task.comments.map((comment) => (
                    <div key={comment.id} className="bg-muted p-3 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <UserAvatar user={users.find(u => u.id === comment.userId)} size="sm" />
                        <span className="font-medium">{users.find(u => u.id === comment.userId)?.name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">
                          {comment.createdAt ? format(new Date(comment.createdAt), "dd.MM.yyyy HH:mm") : ''}
                        </span>
                      </div>
                      <p>{comment.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground p-4">
                  No comments
                </div>
              )
            ) : (
              <div className="text-center text-muted-foreground p-4">
                Comments are only available to task participants
              </div>
            )}
            
            {/* Add comment form - only for task participants */}
            {user && canEditTask && (
              <div className="mt-4 space-y-2">
                <Textarea 
                  placeholder="Add comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[100px]"
                />
                <Button 
                  onClick={() => {
                    if (!newComment.trim()) return;
                    
                    // Create a new comment object
                    const newCommentObj = {
                      id: generateUUID(),
                      userId: user.id,
                      text: newComment.trim(),
                      createdAt: new Date().toISOString()
                    };
                    
                    // Update the task with the new comment
                    if (task && token) {
                      const updatedComments = [...(task.comments || []), newCommentObj];
                      
                      // Call the API to update the task
                      updateTask(task.id, { comments: updatedComments }, token)
                        .then(() => {
                          toast.success('Comment added');
                          setNewComment('');
                          
                          // Notify task assignees
                          if (task.assignees && task.assignees.length > 0) {
                            task.assignees.forEach(assignee => {
                              if (assignee.id !== user.id) {
                                try {
                                  sendNotification(assignee.id, {
                                    type: 'comment',
                                    title: 'New comment',
                                    message: `${user.name} left a comment on task "${task.title}"`,
                                    taskId: task.id
                                  }, token);
                                } catch (error) {
                                  console.error('Error sending notification:', error);
                                  // Continue even if notification fails
                                }
                              }
                            });
                          }
                          
                          // Refresh task data
                          if (onTaskUpdated) onTaskUpdated();
                        })
                        .catch(error => {
                          toast.error('Failed to add comment');
                          console.error('Error adding comment:', error);
                        });
                    }
                  }}
                  disabled={!newComment.trim()}
                  className="w-full"
                >
                  Send Comment
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4">
            {task.editHistory && task.editHistory.length > 0 ? (
              <div className="space-y-4">
                {task.editHistory.map((edit, index) => (
                  <div key={index} className="bg-muted p-3 rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <UserAvatar user={users.find(u => u.id === edit.userId)} size="sm" />
                      <span className="font-medium">{users.find(u => u.id === edit.userId)?.name || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">
                        {edit.timestamp ? format(new Date(edit.timestamp), "dd.MM.yyyy HH:mm") : ''}
                      </span>
                    </div>
                    <p>Changes: {edit.changes}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground p-4">
                No edit history
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-6">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={saveChanges}>
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {canEditTask() && (
                <Button onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

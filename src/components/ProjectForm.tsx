import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { addProject, updateProject, getUsers, sendNotification } from "@/lib/api-utils";
import { useQuery } from "@tanstack/react-query";
import { getClients } from "@/lib/api-utils";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";

const projectSchema = z.object({
  name: z.string().min(1, "Название проекта обязательно"),
  description: z.string().min(1, "Описание обязательно"),
  clientId: z.string().min(1, "Клиент обязателен"),
  status: z.enum(["active", "completed", "on-hold"]),
  startDate: z.date(),
  endDate: z.date().optional(),
  assignedUserIds: z.array(z.string()).default([]),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: any; // Project to edit, if provided
  mode?: 'add' | 'edit';
}

export function ProjectForm({ open, onOpenChange, project, mode = 'add' }: ProjectFormProps) {
  const queryClient = useQueryClient();
  const { user, token, addNotification } = useAuth();
  const [usersCommandOpen, setUsersCommandOpen] = React.useState(false);
  
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => getClients(token || ""),
    enabled: !!token
  });
  
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(token),
    enabled: !!token
  });
  
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      clientId: "",
      status: "active",
      startDate: new Date(),
      assignedUserIds: [], // Initialize as empty array
    },
  });
  
  // Set form values when editing a project
  useEffect(() => {
    if (mode === 'edit' && project && open) {
      form.reset({
        name: project.name,
        description: project.description,
        clientId: project.clientId,
        status: project.status,
        startDate: project.startDate ? new Date(project.startDate) : new Date(),
        endDate: project.endDate ? new Date(project.endDate) : undefined,
        assignedUserIds: project.assignedUserIds || [],
      });
    }
  }, [project, mode, open, form]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      if (mode === 'add') {
        form.reset({
          name: "",
          description: "",
          clientId: "",
          status: "active",
          startDate: new Date(),
          assignedUserIds: [],
        });
      }
    }
  }, [open, form, mode]);

  async function onSubmit(values: ProjectFormValues) {
    try {
      // Ensure assignedUserIds is an array of strings and remove duplicates
      const assignedUserIds = Array.isArray(values.assignedUserIds) 
        ? [...new Set(values.assignedUserIds.map(id => String(id)))]
        : [];

      let projectData = {
        name: values.name,
        description: values.description,
        clientId: values.clientId,
        status: values.status,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate ? values.endDate.toISOString() : undefined,
        assignedUserIds: assignedUserIds,
      };
      
      // Only include createdBy when creating a new project, not when editing
      if (mode !== 'edit') {
        projectData = {
          ...projectData,
          createdBy: user?.id || ""
        };
      }
      
      let resultProject;
      
      if (mode === 'edit' && project) {
        // Update existing project
        const updatedProjectData = {
          ...projectData
        };
        
        resultProject = await updateProject(project.id, updatedProjectData, token || "");
        toast.success("Проект успешно обновлен");
      } else {
        // Create new project
        resultProject = await addProject(projectData, token || "");
        toast.success("Проект успешно добавлен");
      }
      // --- Reset form with latest project data to force UI state sync ---
      if (resultProject) {
        form.reset({
          name: resultProject.name,
          description: resultProject.description,
          clientId: resultProject.clientId,
          status: resultProject.status,
          startDate: resultProject.startDate ? new Date(resultProject.startDate) : new Date(),
          endDate: resultProject.endDate ? new Date(resultProject.endDate) : undefined,
          assignedUserIds: resultProject.assignedUserIds || [],
        });
      }
      
      // Notify assigned users
      try {
        if (values.assignedUserIds && values.assignedUserIds.length > 0) {
          const clientName = clients.find(c => c.id === values.clientId)?.name || "Unknown Client";

          // Debug: Log assignedUserIds and users
          console.log('Assigned User IDs (raw):', values.assignedUserIds);
          console.log('Available Users:', users.map(u => u.id));

          // Filter out invalid user IDs (always compare as strings)
          const validUserIds = values.assignedUserIds.filter(userId => 
            users.some(u => String(u.id) === String(userId))
          );

          // Debug: Log validUserIds after filtering
          console.log('Valid User IDs after filtering:', validUserIds);
          
          // Only notify valid users
          validUserIds.forEach(userId => {
            const assignedUser = users.find(u => u.id === userId);
            
            if (assignedUser) {
              try {
                // Add client-side notification
                addNotification({
                  type: "project_assignment",
                  title: "Новое назначение на проект",
                  message: `Вы были назначены на проект "${values.name}" для клиента "${clientName}". Вы можете просматривать детали проекта, но только создатель проекта или администратор может редактировать его.`,
                  entityId: resultProject.id,
                  entityType: "project",
                  projectId: resultProject.id
                });
              } catch (notificationError) {
                console.error("Error adding notification to context:", notificationError);
              }
              
              // Send server-side notification
              try {
                const notification = {
                  type: "project_assignment",
                  title: "Новое назначение на проект",
                  message: `Вы были назначены на проект "${values.name}" для клиента "${clientName}". Вы можете просматривать детали проекта, но только создатель проекта или администратор может редактировать его.`,
                  entityId: resultProject.id,
                  entityType: "project",
                  projectId: resultProject.id
                };
                
                sendNotification(userId, notification, token || '');
              } catch (error) {
                console.error("Error sending notification to user:", error);
              }
            }
          });
        }
      } catch (error) {
        console.error("Error handling notifications:", error);
      }

      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects-with-clients"] });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error(mode === 'edit' ? "Error updating project:" : "Error adding project:", error);
      toast.error(mode === 'edit' ? "Ошибка при обновлении проекта" : "Ошибка при добавлении проекта");
      
      // Even if there was an error, we should still close the form if the project was actually added
      // This handles the case where the project is added but notifications fail
      if (error instanceof TypeError && error.message.includes("randomUUID")) {
        // This is the specific error we're trying to handle
        // Project was likely added successfully but notification failed
        form.reset();
        onOpenChange(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-4 pt-5">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Закрыть</span>
        </button>
        <DialogHeader className="pb-2">
          <DialogTitle>
            {mode === 'edit' ? 'Edit project' : 'Add project'}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Название проекта" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Описание проекта" 
                      className="h-20 resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Клиент</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите клиента" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="assignedUserIds"
              render={({ field }) => {
                // Ensure field.value is always an array
                const fieldValue = field.value || [];
                
                // Create a set to track selected user IDs
                const selectedSet = new Set(fieldValue.map(id => String(id)));
                
                return (
                <FormItem>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel>Участники проекта</FormLabel>
                      <span className="text-sm text-muted-foreground">{selectedSet.size} участников</span>
                    </div>
                    <FormControl>
                      <div className="border rounded-lg p-2 max-h-[300px] overflow-y-auto">
                        {users.length === 0 ? (
                          <div className="text-muted-foreground text-center py-4">Нет доступных пользователей</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {users.map((user) => (
                              <div 
                                key={user.id} 
                                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 border border-muted/50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const isSelected = selectedSet.has(String(user.id));
                                  const newValues = isSelected
                                    ? Array.from(selectedSet).filter(id => id !== String(user.id))
                                    : [...Array.from(selectedSet), String(user.id)];
                                  field.onChange(newValues);
                                }}
                              >
                                <Checkbox 
                                  id={`user-${user.id}`}
                                  checked={fieldValue.includes(String(user.id))}
                                  className="h-4 w-4"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-medium text-[10px] truncate">
                                        {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                                      </h3>
                                      {/* <div className="text-[10px] px-2 bg-muted/50 rounded-full">
                                        {user.role}
                                      </div> */}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {user.email}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
                );
              }}
            />
            
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Статус</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите статус" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Активный</SelectItem>
                      <SelectItem value="completed">Завершен</SelectItem>
                      <SelectItem value="on-hold">На паузе</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Дата начала</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full h-8 pl-2 text-left font-normal text-sm",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd.MM.yyyy")
                            ) : (
                              <span>Выберите дату</span>
                            )}
                            <CalendarIcon className="ml-auto h-3 w-3" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Дата окончания (опц.)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full h-8 pl-2 text-left font-normal text-sm",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd.MM.yyyy")
                            ) : (
                              <span>Выберите дату</span>
                            )}
                            <CalendarIcon className="ml-auto h-3 w-3" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit">{mode === 'edit' ? 'Сохранить' : 'Добавить'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

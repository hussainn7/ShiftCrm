import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomBadge } from "@/components/ui/custom-badge";
import { ExternalLink, Plus, Search, Calendar, FileText, Clock, Link2, Trash2 } from "lucide-react";
import { ClientForm } from "@/components/ClientForm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getClients, getEnhancedTasks, getProjects, deleteClient } from "@/lib/api-utils";
import { Client, Task, Project } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

const Clients = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => getClients(token || '')
  });
  
  const { data: allTasks = [] } = useQuery({
    queryKey: ["enhanced-tasks"],
    queryFn: () => getEnhancedTasks(token || '')
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(token || '')
  });
  
  // Filter clients based on search query
  const filteredClients = (clients as Client[]).filter((client: Client) => 
    searchQuery === "" ||
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Get tasks count for each client
  const getClientTasksCount = (clientId: string) => {
    return (allTasks as Task[]).filter(task => task.clientId === clientId).length;
  };

  // Get projects count for each client
  const getClientProjectsCount = (clientId: string) => {
    return (projects as Project[]).filter(project => project.clientId === clientId).length;
  };
  
  // Handle client deletion
  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    
    try {
      await deleteClient(clientToDelete.id, token || '');
      
      // Show success message
      toast.success('Client successfully deleted');
      
      // Close the delete dialog
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      
      // If client details dialog is open and we're deleting the selected client, close it
      if (selectedClient && selectedClient.id === clientToDelete.id) {
        setClientDetailsOpen(false);
        setSelectedClient(null);
      }
      
      // Refresh data
      refetchClients();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["enhanced-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Failed to delete client');
    }
  };
  
  // Check if user can delete a client
  const canDeleteClient = (client: Client) => {
    return user?.role === 'admin' || user?.role === 'team-lead' || client.createdBy === user?.id;
  };
  
  // Check if user can edit a client
  const canEditClient = (client: Client) => {
    return user?.role === 'admin' || user?.role === 'team-lead';
  };
  
  // Open edit dialog
  const openEditDialog = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setClientToEdit(client);
    setEditDialogOpen(true);
  };
  
  // Open delete confirmation dialog
  const openDeleteDialog = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening client details
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Clients</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Client
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">No clients found</p>
            </div>
          ) : (
            filteredClients.map((client: Client) => (
              <ClientCard
                key={client.id}
                client={client}
                tasksCount={getClientTasksCount(client.id)}
                projectsCount={getClientProjectsCount(client.id)}
                onClick={() => {
                  setSelectedClient(client);
                  setClientDetailsOpen(true);
                }}
                onDelete={canDeleteClient(client) ? (e) => openDeleteDialog(client, e) : undefined}
                onEdit={canEditClient(client) ? (e) => openEditDialog(client, e) : undefined}
              />
            ))
          )}
        </div>
      </div>
      
      {/* Add Client Form */}
      <ClientForm open={dialogOpen} onOpenChange={setDialogOpen} />
      
      {/* Edit Client Form */}
      {clientToEdit && (
        <ClientForm 
          open={editDialogOpen} 
          onOpenChange={setEditDialogOpen} 
          client={clientToEdit} 
          isEditing={true} 
        />
      )}
      
      {selectedClient && (
        <ClientDetailsDialog
          client={selectedClient}
          open={clientDetailsOpen}
          onOpenChange={setClientDetailsOpen}
          tasks={(allTasks as Task[]).filter(task => task.clientId === selectedClient.id)}
          projects={(projects as Project[]).filter(project => project.clientId === selectedClient.id)}
          onDelete={canDeleteClient(selectedClient) ? () => {
            setClientToDelete(selectedClient);
            setDeleteDialogOpen(true);
          } : undefined}
          onEdit={canEditClient(selectedClient) ? () => {
            setClientToEdit(selectedClient);
            setEditDialogOpen(true);
          } : undefined}
        />
      )}
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The client will be deleted along with all related tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

interface ClientCardProps {
  client: Client;
  tasksCount: number;
  projectsCount: number;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  onEdit?: (e: React.MouseEvent) => void;
}

const ClientCard = ({ client, tasksCount, projectsCount, onClick, onDelete, onEdit }: ClientCardProps) => {
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors relative" onClick={onClick}>
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={onEdit}
            title="Редактировать"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            title="Удалить"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg pr-6">{client.name}</CardTitle>
        <CardDescription className="line-clamp-2 break-words">{client.description}</CardDescription>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm mb-4 overflow-hidden text-ellipsis break-words line-clamp-3">{client.description}</p>
        
        {client.links && client.links.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Links:</h4>
            <div className="space-y-1 max-w-full overflow-hidden">
              {client.links.map((link, index) => (
                <a 
                  key={index} 
                  href={link.startsWith('http') ? link : `https://${link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline flex items-center gap-1 break-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  {link}
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-4">
        <div className="flex items-center gap-1">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{tasksCount} tasks</span>
        </div>
        <div className="flex items-center gap-1">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{projectsCount} projects</span>
        </div>
      </CardFooter>
    </Card>
  );
};

interface ClientDetailsDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  projects: Project[];
  onDelete?: () => void;
  onEdit?: () => void;
}

const ClientDetailsDialog = ({ client, open, onOpenChange, tasks, projects, onDelete, onEdit }: ClientDetailsDialogProps) => {
  const [activeTab, setActiveTab] = useState("overview");

  // Filter tasks for this client
  const clientTasks = tasks.filter(task => task.clientId === client.id);
  
  // Filter projects for this client
  const clientProjects = projects.filter(project => project.clientId === client.id);

  // Sort tasks by date (newest first)
  const sortedTasks = [...clientTasks].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Group tasks by project
  const tasksByProject = clientTasks.reduce((acc, task) => {
    const projectId = task.projectId || 'no-project';
    if (!acc[projectId]) {
      acc[projectId] = [];
    }
    acc[projectId].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <DialogTitle className="text-xl">{client.name}</DialogTitle>
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={onEdit}
                  title="Редактировать"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={onDelete}
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6">
          <div className="flex border-b mb-6">
            <button
              className={`px-4 py-2 font-medium text-sm ${activeTab === "overview" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm ${activeTab === "projects" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("projects")}
            >
              Projects ({projects.length})
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm ${activeTab === "tasks" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("tasks")}
            >
              Tasks ({tasks.length})
            </button>
          </div>
          
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">Description</h3>
                  <p className="text-sm text-muted-foreground">{client.description}</p>
                </div>
                
                {client.website && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Website</h3>
                    <a 
                      href={client.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary flex items-center gap-1 hover:underline"
                    >
                      {client.website}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                
                {client.contactPerson && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Contact Person</h3>
                    <p className="text-sm text-muted-foreground">{client.contactPerson}</p>
                  </div>
                )}
                
                {client.contactEmail && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Email</h3>
                    <a 
                      href={`mailto:${client.contactEmail}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {client.contactEmail}
                    </a>
                  </div>
                )}
                
                {client.contactPhone && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Phone</h3>
                    <a 
                      href={`tel:${client.contactPhone}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {client.contactPhone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === "projects" && (
            <div className="space-y-4">
                              {projects.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No projects for this client</p>
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((project) => (
                    <Card key={project.id}>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-base">{project.name}</CardTitle>
                        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {project.startDate && format(new Date(project.startDate), "dd MMM yyyy", { locale: enUS })}
                            {project.endDate && ` - ${format(new Date(project.endDate), "dd MMM yyyy", { locale: enUS })}`}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === "tasks" && (
            <div className="space-y-4">
                              {clientTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No tasks for this client</p>
                  </div>
                ) : (
                <div className="space-y-2">
                  {Object.keys(tasksByProject).length > 0 ? (
                    <div className="space-y-6">
                      {Object.entries(tasksByProject).map(([projectId, tasks]) => {
                        const project = projectId !== 'no-project' 
                          ? clientProjects.find(p => p.id === projectId) 
                          : null;
                        
                        return (
                          <div key={projectId} className="space-y-2">
                                                          <h4 className="font-medium flex items-center gap-2">
                                {project ? project.name : 'Tasks without project'}
                                <CustomBadge variant={project?.status === 'active' ? 'default' : 
                                  project?.status === 'completed' ? 'secondary' : 'outline'}>
                                  {project?.status === 'active' ? 'Active' : 
                                   project?.status === 'completed' ? 'Completed' : 'Paused'}
                                </CustomBadge>
                              </h4>
                            <div className="space-y-2">
                              {tasks.map(task => (
                                <Card key={task.id}>
                                  <CardHeader className="p-3 pb-2">
                                    <div className="flex justify-between items-start">
                                      <CardTitle className="text-base">{task.title}</CardTitle>
                                      <CustomBadge variant={
                                        task.status === 'completed' ? 'success' :
                                        task.status === 'in-progress' ? 'default' :
                                        task.status === 'under-review' ? 'warning' :
                                        task.status === 'canceled' ? 'destructive' : 'secondary'
                                      }>
                                        {task.status === 'draft' ? 'Draft' :
                                         task.status === 'in-progress' ? 'In Progress' :
                                         task.status === 'under-review' ? 'Under Review' :
                                         task.status === 'completed' ? 'Completed' : 'Canceled'}
                                      </CustomBadge>
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      <span>Due: {format(new Date(task.dueDate), 'dd MMM yyyy', {locale: enUS})}</span>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No tasks for this client</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Clients;

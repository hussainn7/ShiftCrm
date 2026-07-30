import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Search, Plus, Trash2, Pencil } from 'lucide-react';
import { ProjectForm } from "@/components/ProjectForm";
import { ProjectDetail } from "@/components/ProjectDetail";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjects, getEnhancedTasks, getProjectsWithClients, deleteProject } from "@/lib/api-utils";
import { Project, Task } from "@/lib/types";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

const Projects = () => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  
  const { data: projects = [], isLoading: projectsLoading, error: projectsError, refetch: refetchProjects } = useQuery({
    queryKey: ["projects-with-clients"],
    queryFn: () => getProjectsWithClients(token),
    enabled: !!token,
    retry: 3,
    onError: (error) => {
      console.error('Error fetching projects:', error);
      toast.error('Не удалось загрузить проекты');
    }
  });
  
  const { data: allTasks = [], isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ["enhanced-tasks"],
    queryFn: () => getEnhancedTasks(token),
    enabled: !!token,
    retry: 3,
    onError: (error) => {
      console.error('Error fetching tasks:', error);
      toast.error('Не удалось загрузить задачи');
    }
  });
  
  // Filter projects based on search query
  const filteredProjects = projects.filter((project: Project) => 
    searchQuery === "" ||
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Get tasks count for each project
  const getProjectTasksCount = (projectId: string) => {
    return allTasks.filter(task => task.projectId === projectId).length;
  };
  
  // Check if user can edit a project
  const canEditProject = (project: Project) => {
    return user?.role === 'admin' || user?.role === 'team-lead' || project.createdBy === user?.id;
  };

  // Check if user can delete a project
  const canDeleteProject = (project: Project) => {
    return user?.role === 'admin' || user?.role === 'team-lead' || project.createdBy === user?.id;
  };
  
  // Check if user is assigned to a project
  const isUserAssignedToProject = (project: Project) => {
    if (!user) return false;
    return project.assignedUserIds && project.assignedUserIds.includes(user.id);
  };
  
  // Handle project deletion
  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    try {
      await deleteProject(projectToDelete.id, token || '');
      
      // Show success message
      toast.success('Project successfully deleted');
      
      // Close the delete dialog
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      
      // Refresh data
      refetchProjects();
      queryClient.invalidateQueries({ queryKey: ["enhanced-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };
  
  // Open project details
  const openProjectDetails = (project: Project) => {
    setSelectedProject(project);
    setDetailDialogOpen(true);
  };
  
  // Open edit project dialog
  const openEditDialog = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening project details
    setProjectToEdit(project);
    setEditDialogOpen(true);
  };
  
  // Open delete confirmation dialog
  const openDeleteDialog = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening project details
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };
  
  if (projectsError || tasksError) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">An error occurred while loading data</p>
        </div>
      </MainLayout>
    );
  }
  
  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">Projects</h1>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search projects..."
                className="pl-8 w-full sm:w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Button className="gap-1" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add Project
            </Button>
          </div>
        </div>
        
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground">No projects found</p>
            <p className="text-sm text-muted-foreground mt-1">Try changing search parameters or add a new project</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project: Project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                tasksCount={getProjectTasksCount(project.id)}
                onDelete={canDeleteProject(project) ? (e) => openDeleteDialog(project, e) : undefined}
                onEdit={canEditProject(project) ? (e) => openEditDialog(project, e) : undefined}
                onClick={() => openProjectDetails(project)}
              />
            ))}
          </div>
        )}
      </div>
      
      <ProjectForm 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
      />
      
      {/* Edit Project Dialog */}
      <ProjectForm 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
        project={projectToEdit} 
        mode="edit" 
      />
      
      <ProjectDetail
        project={selectedProject}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onEdit={(project) => {
          setDetailDialogOpen(false);
          setProjectToEdit(project);
          setEditDialogOpen(true);
        }}
      />
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The project will be deleted along with all related tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

interface ProjectCardProps {
  project: Project;
  tasksCount: number;
  onDelete?: (e: React.MouseEvent) => void;
  onEdit?: (e: React.MouseEvent) => void;
  onClick: () => void;
}

const ProjectCard = ({ project, tasksCount, onDelete, onEdit, onClick }: ProjectCardProps) => {
  const { user } = useAuth();
  
  // Check if user can delete a project
  const canDelete = () => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'team-lead' || project.createdBy === user.id;
  };
  
  // Check if user is assigned to a project
  const isAssigned = () => {
    if (!user) return false;
    return project.assignedUserIds && project.assignedUserIds.includes(user.id);
  };
  
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors relative" onClick={onClick}>
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        {onEdit && canDelete() && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(e);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>

          </div>
        )}
        {onDelete && canDelete() && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{project.name}</h3>
            {isAssigned() && (
              <Badge variant="outline" className="bg-blue-50">You are assigned</Badge>
            )}
          </div>
        </div>
        
        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 pt-0">
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
          <CalendarIcon className="h-4 w-4" />
          <span>
            {project.startDate && format(new Date(project.startDate), "dd MMM yyyy", { locale: enUS })}
            {project.endDate && ` - ${format(new Date(project.endDate), "dd MMM yyyy", { locale: enUS })}`}
          </span>
        </div>
        
        {project.client && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {project.client.name}
            </Badge>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex justify-between items-center">
        <Badge variant={
          project.status === 'active' ? 'default' :
          project.status === 'completed' ? 'secondary' :
          'outline'
        }>
          {project.status === 'active' ? 'Active' :
           project.status === 'completed' ? 'Completed' :
           'Paused'}
        </Badge>
        
        <div className="text-xs text-muted-foreground">
          {tasksCount} tasks
        </div>
      </CardFooter>
    </Card>
  );
};

export default Projects;

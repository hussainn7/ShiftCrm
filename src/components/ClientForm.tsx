
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { addClient, updateClient } from "@/lib/api-utils";
import { useAuth } from "@/contexts/AuthContext";
import { Client } from "@/lib/types";

const clientSchema = z.object({
  name: z.string().min(1, "Название Clientа обязательно"),
  description: z.string().min(1, "Описание обязательно"),
  links: z.string().optional(),
  status: z.boolean().default(true),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client; // Optional client for editing
  isEditing?: boolean; // Flag to indicate if we're editing or adding
}

export function ClientForm({ open, onOpenChange, client, isEditing = false }: ClientFormProps) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      description: "",
      links: "",
      status: true,
    },
  });
  
  // Set form values when editing an existing client
  useEffect(() => {
    if (client && isEditing) {
      form.reset({
        name: client.name,
        description: client.description,
        links: client.links ? client.links.join('\n') : '',
        status: client.status === 'active',
      });
    }
  }, [client, isEditing, form]);

  async function onSubmit(values: ClientFormValues) {
    try {
      const links = values.links ? values.links.split("\n").filter(link => link.trim() !== "") : [];
      
      if (isEditing && client) {
        // Update existing client
        // Only update the fields that we have in the form
        const updateData: Partial<Client> = {
          name: values.name,
          description: values.description,
          links: links,
          status: values.status ? "active" : "inactive",
        };
        
        await updateClient(client.id, updateData, token || '');
        toast.success("Client успешно обновлен");
      } else {
        // Add new client
        const newClientData = {
          name: values.name,
          description: values.description,
          links: links,
          status: values.status ? "active" : "inactive" as 'active' | 'inactive',
          createdBy: '', // This will be set on the server based on the token
          // Include empty values for optional fields to satisfy the type
          contactPerson: '',
          contactEmail: '',
          contactPhone: '',
          website: '',
          tags: [],
        };
        
        await addClient(newClientData, token || '');
        toast.success("Client успешно добавлен");
      }
      
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error(isEditing ? "Error updating client:" : "Error adding client:", error);
      toast.error(isEditing ? "Ошибка при обновлении Clientа" : "Ошибка при добавлении Clientа");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit client' : 'Add client'}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Название компании" {...field} />
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
                    <Textarea placeholder="Описание Clientа" {...field} className="min-h-[100px]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="links"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ссылки (одна на строку)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Активный статус</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit">{isEditing ? 'Сохранить' : 'Добавить'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

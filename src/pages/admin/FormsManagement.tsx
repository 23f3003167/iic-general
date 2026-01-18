import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useToast } from '@/components/ui/use-toast';
import {
  getForms,
  createForm,
  updateForm,
  deleteForm,
} from '@/lib/firestoreService';
import type { FormEntry, FormCategory, FormStatus } from '@/types';
import { StatusBadge } from '@/components/forms/StatusBadge';
import { CategoryBadge } from '@/components/forms/CategoryBadge';

export function FormsManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [forms, setForms] = useState<FormEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormEntry | null>(null);
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<FormEntry, 'id'>>({
    title: '',
    category: 'Other',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    status: 'Upcoming',
    formUrl: '',
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        navigate('/admin');
        return;
      }
      const allowed = await verifyAdminAccess(user);
      if (!allowed) {
        await signOut(auth);
        toast({
          title: 'Unauthorized',
          description: 'Your account is not allowed to access admin.',
          variant: 'destructive',
        });
        navigate('/admin');
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      setIsAdmin(true);
      setChecking(false);
    });
    return () => unsub();
  }, [navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      loadForms();
    }
  }, [isAdmin]);

  const loadForms = async () => {
    try {
      setLoading(true);
      const data = await getForms();
      setForms(data);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error loading forms',
        description: 'Could not fetch forms from database.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (form?: FormEntry) => {
    if (form) {
      setEditingForm(form);
      setFormData({
        title: form.title,
        category: form.category,
        description: form.description,
        startDate: form.startDate,
        startTime: form.startTime || '',
        endDate: form.endDate,
        endTime: form.endTime || '',
        status: form.status,
        formUrl: form.formUrl,
      });
    } else {
      setEditingForm(null);
      setFormData({
        title: '',
        category: 'Other',
        description: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        status: 'Upcoming',
        formUrl: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingForm(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingForm) {
        await updateForm(editingForm.id, formData);
        toast({
          title: 'Form updated',
          description: 'The form has been updated successfully.',
        });
      } else {
        await createForm(formData);
        toast({
          title: 'Form created',
          description: 'The form has been created successfully.',
        });
      }
      handleCloseDialog();
      loadForms();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not save the form. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingFormId) return;
    try {
      await deleteForm(deletingFormId);
      toast({
        title: 'Form deleted',
        description: 'The form has been deleted successfully.',
      });
      setDeleteDialogOpen(false);
      setDeletingFormId(null);
      loadForms();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not delete the form. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeletingFormId(id);
    setDeleteDialogOpen(true);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Forms Management</h2>
          <p className="text-muted-foreground">Create and manage placement forms</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Form
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading forms...</p>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No forms yet. Create your first form!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold leading-tight">
                    {form.title}
                  </CardTitle>
                  <StatusBadge status={form.status} />
                </div>
                <CategoryBadge category={form.category} className="w-fit" />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {form.description}
                </p>
                <div className="text-xs text-muted-foreground">
                  {new Date(form.startDate).toLocaleDateString()} — {new Date(form.endDate).toLocaleDateString()}
                </div>
                <a
                  href={form.formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View Form <ExternalLink className="h-3 w-3" />
                </a>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenDialog(form)}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openDeleteDialog(form.id)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingForm ? 'Edit Form' : 'Create New Form'}</DialogTitle>
            <DialogDescription>
              {editingForm ? 'Update the form details below.' : 'Fill in the details to create a new form.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: FormCategory) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Marks">Marks</SelectItem>
                    <SelectItem value="Training">Training</SelectItem>
                    <SelectItem value="Slot">Slot</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: FormStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Upcoming">Upcoming</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime || ''}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime || ''}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="formUrl">Form URL *</Label>
              <Input
                id="formUrl"
                type="url"
                value={formData.formUrl}
                onChange={(e) => setFormData({ ...formData, formUrl: e.target.value })}
                placeholder="https://forms.google.com/..."
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingForm ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this form? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FormsManagement;

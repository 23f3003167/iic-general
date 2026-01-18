import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useToast } from '@/components/ui/use-toast';
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from '@/lib/firestoreService';
import type { Document } from '@/types';

export function DocumentsManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ title: string; description: string; url: string }>({
    title: '',
    description: '',
    url: '',
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
      loadDocuments();
    }
  }, [isAdmin]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await getDocuments();
      setDocuments(data);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error loading documents',
        description: 'Could not fetch documents from database.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (document?: Document) => {
    if (document) {
      setEditingDocument(document);
      setFormData({
        title: document.title,
        description: document.description,
        url: document.url,
      });
    } else {
      setEditingDocument(null);
      setFormData({
        title: '',
        description: '',
        url: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDocument(null);
  };

  const detectDocType = (url: string): 'PDF' | 'Drive' | 'External' => {
    const u = url.toLowerCase();
    if (u.endsWith('.pdf')) return 'PDF';
    if (u.includes('drive.google.com')) return 'Drive';
    return 'External';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDocument) {
        await updateDocument(editingDocument.id, {
          ...formData,
          type: detectDocType(formData.url),
        });
        toast({
          title: 'Document updated',
          description: 'The document has been updated successfully.',
        });
      } else {
        await createDocument({
          ...formData,
          type: detectDocType(formData.url),
        });
        toast({
          title: 'Document created',
          description: 'The document has been created successfully.',
        });
      }
      handleCloseDialog();
      loadDocuments();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not save the document. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingDocumentId) return;
    try {
      await deleteDocument(deletingDocumentId);
      toast({
        title: 'Document deleted',
        description: 'The document has been deleted successfully.',
      });
      setDeleteDialogOpen(false);
      setDeletingDocumentId(null);
      loadDocuments();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not delete the document. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeletingDocumentId(id);
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
          <h2 className="text-2xl font-bold">Documents Management</h2>
          <p className="text-muted-foreground">Create and manage reference documents</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Document
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading documents...</p>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No documents yet. Create your first document!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold leading-tight flex-1">
                    {doc.title}
                  </CardTitle>
                  <Badge variant="outline">{doc.type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {doc.description}
                </p>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View Document <ExternalLink className="h-3 w-3" />
                </a>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenDialog(doc)}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openDeleteDialog(doc.id)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDocument ? 'Edit Document' : 'Create New Document'}
            </DialogTitle>
            <DialogDescription>
              {editingDocument
                ? 'Update the document details below.'
                : 'Fill in the details to create a new document.'}
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
            {/* Type removed; determined automatically from URL */}
            <div className="space-y-2">
              <Label htmlFor="url">URL *</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://..."
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">{editingDocument ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
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

export default DocumentsManagement;

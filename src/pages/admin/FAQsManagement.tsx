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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useToast } from '@/components/ui/use-toast';
import {
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
} from '@/lib/firestoreService';
import type { FAQ } from '@/types';

export function FAQsManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [deletingFAQId, setDeletingFAQId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<FAQ, 'id'>>({
    question: '',
    answer: '',
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
      loadFAQs();
    }
  }, [isAdmin]);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      const data = await getFAQs();
      setFaqs(data);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error loading FAQs',
        description: 'Could not fetch FAQs from database.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (faq?: FAQ) => {
    if (faq) {
      setEditingFAQ(faq);
      setFormData({
        question: faq.question,
        answer: faq.answer,
      });
    } else {
      setEditingFAQ(null);
      setFormData({
        question: '',
        answer: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingFAQ(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFAQ) {
        await updateFAQ(editingFAQ.id, formData);
        toast({
          title: 'FAQ updated',
          description: 'The FAQ has been updated successfully.',
        });
      } else {
        await createFAQ(formData);
        toast({
          title: 'FAQ created',
          description: 'The FAQ has been created successfully.',
        });
      }
      handleCloseDialog();
      loadFAQs();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not save the FAQ. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingFAQId) return;
    try {
      await deleteFAQ(deletingFAQId);
      toast({
        title: 'FAQ deleted',
        description: 'The FAQ has been deleted successfully.',
      });
      setDeleteDialogOpen(false);
      setDeletingFAQId(null);
      loadFAQs();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not delete the FAQ. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeletingFAQId(id);
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
          <h2 className="text-2xl font-bold">FAQs Management</h2>
          <p className="text-muted-foreground">Create and manage frequently asked questions</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add FAQ
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading FAQs...</p>
      ) : faqs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No FAQs yet. Create your first FAQ!</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.id} value={`item-${index}`}>
                  <div className="flex items-start gap-2">
                    <AccordionTrigger className="flex-1 text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <div className="flex gap-1 pt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(faq)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(faq.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingFAQ ? 'Edit FAQ' : 'Create New FAQ'}
            </DialogTitle>
            <DialogDescription>
              {editingFAQ
                ? 'Update the FAQ details below.'
                : 'Fill in the details to create a new FAQ.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question *</Label>
              <Input
                id="question"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">Answer *</Label>
              <Textarea
                id="answer"
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                rows={5}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">{editingFAQ ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete FAQ</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this FAQ? This action cannot be undone.
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

export default FAQsManagement;

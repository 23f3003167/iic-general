import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Eye, CheckCircle2, XCircle, Slash } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useCreateRecruiter, useRecruiters, useUpdateRecruiter } from '@/hooks/useRecruiters';
import { recruiterSchema, type RecruiterFormValues } from '@/lib/adminSchemas';
import type { Recruiter } from '@/types';

const statusOptions = ['all', 'VERIFIED', 'PENDING', 'REJECTED', 'DISABLED'] as const;

export function RecruitersManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState('');
  const [editRecruiter, setEditRecruiter] = useState<Recruiter | null>(null);
  const [viewRecruiter, setViewRecruiter] = useState<Recruiter | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const { data: recruiters = [], isLoading } = useRecruiters(statusFilter, companyFilter);
  const createRecruiter = useCreateRecruiter();
  const updateRecruiter = useUpdateRecruiter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setIsAdmin(false);
          navigate('/admin');
          return;
        }

        const allowed = await verifyAdminAccess(user);
        if (!allowed) {
          await signOut(auth);
          setIsAdmin(false);
          navigate('/admin');
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error('Recruiters auth check failed:', error);
        setIsAdmin(false);
        navigate('/admin');
      } finally {
        setChecking(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const form = useForm<RecruiterFormValues>({
    resolver: zodResolver(recruiterSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      designation: '',
      companyName: '',
      companyWebsite: '',
      linkedInUrl: '',
      industry: '',
      companySize: '',
      companyDescription: '',
    },
  });

  function resetForm() {
    form.reset({
      name: '',
      email: '',
      phone: '',
      designation: '',
      companyName: '',
      companyWebsite: '',
      linkedInUrl: '',
      industry: '',
      companySize: '',
      companyDescription: '',
    });
    setEditRecruiter(null);
  }

  const filteredRecruiters = useMemo(
    () =>
      recruiters.filter((recruiter) => {
        const statusMatches = statusFilter === 'all' || recruiter.status === statusFilter;
        const searchText = companyFilter.trim().toLowerCase();
        const companyMatches =
          !searchText ||
          recruiter.companyName.toLowerCase().includes(searchText) ||
          recruiter.name.toLowerCase().includes(searchText);
        return statusMatches && companyMatches;
      }),
    [companyFilter, recruiters, statusFilter],
  );

  const showDrawer = (recruiter: Recruiter) => {
    setViewRecruiter(recruiter);
    setDrawerOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditDialog = (recruiter: Recruiter) => {
    form.reset({
      name: recruiter.name,
      email: recruiter.email,
      phone: recruiter.phone,
      designation: recruiter.designation,
      companyName: recruiter.companyName,
      companyWebsite: recruiter.companyWebsite ?? '',
      linkedInUrl: recruiter.linkedInUrl ?? '',
      industry: recruiter.industry,
      companySize: recruiter.companySize,
      companyDescription: recruiter.companyDescription ?? '',
    });
    setEditRecruiter(recruiter);
    setFormOpen(true);
  };

  const handleSubmit = async (values: RecruiterFormValues) => {
    try {
      if (editRecruiter) {
        await updateRecruiter.mutateAsync({
          id: editRecruiter.id,
          payload: {
            ...values,
          },
        });
        toast({ title: 'Recruiter updated', description: 'Recruiter profile updated successfully.' });
      } else {
        await createRecruiter.mutateAsync({
          ...values,
          status: 'PENDING',
          opportunitiesPosted: 0,
          applicationsCount: 0,
          selectionCount: 0,
          createdAt: new Date().toISOString(),
        });
        toast({ title: 'Recruiter added', description: 'New recruiter has been registered.' });
      }
      setFormOpen(false);
      resetForm();
    } catch (error) {
      console.error('recruiter save failed', error);
      toast({ title: 'Action failed', description: 'Unable to save recruiter details.', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (recruiter: Recruiter, status: Recruiter['status']) => {
    try {
      await updateRecruiter.mutateAsync({ id: recruiter.id, payload: { status } });
      toast({ title: 'Status updated', description: `${recruiter.name} is now ${status}.` });
    } catch (error) {
      console.error(error);
      toast({ title: 'Update failed', description: 'Unable to update status.', variant: 'destructive' });
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  const recruiterCount = recruiters.length;
  const visibleCount = filteredRecruiters.length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recruiters</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage recruiter approvals, company profiles, and outreach status.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">{recruiterCount}</div>
            <div>{visibleCount} visible</div>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" /> Add recruiter
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[240px_1fr] items-end">
          <div className="space-y-2">
            <Label htmlFor="statusFilter">Verification status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue>{statusFilter === 'all' ? 'All statuses' : statusFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? 'All statuses' : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyFilter">Company</Label>
            <Input
              id="companyFilter"
              placeholder="Search by company"
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recruiter list</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading recruiters...</p>
          ) : filteredRecruiters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
              No recruiters match your filter.
            </div>
          ) : (
            <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecruiters.map((recruiter) => (
                    <TableRow key={recruiter.id}>
                      <TableCell>
                        <div className="font-medium">{recruiter.name}</div>
                        <div className="text-xs text-muted-foreground">{recruiter.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{recruiter.companyName}</div>
                        <div className="text-xs text-muted-foreground">{recruiter.designation}</div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                          {recruiter.status}
                        </span>
                      </TableCell>
                      <TableCell>{recruiter.opportunitiesPosted}</TableCell>
                      <TableCell>{new Date(recruiter.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="space-x-2 whitespace-nowrap text-right">
                        <Button size="sm" variant="ghost" onClick={() => showDrawer(recruiter)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(recruiter)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editRecruiter ? 'Edit Recruiter' : 'Register Recruiter'}</DialogTitle>
            <DialogDescription>
              Use this form to capture recruiter details and company information.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Recruiter Name</Label>
              <Input id="name" {...form.register('name')} />
              <p className="text-sm text-destructive">{form.formState.errors.name?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Official Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              <p className="text-sm text-destructive">{form.formState.errors.email?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register('phone')} />
              <p className="text-sm text-destructive">{form.formState.errors.phone?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" {...form.register('designation')} />
              <p className="text-sm text-destructive">{form.formState.errors.designation?.message}</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" {...form.register('companyName')} />
              <p className="text-sm text-destructive">{form.formState.errors.companyName?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyWebsite">Company Website</Label>
              <Input id="companyWebsite" {...form.register('companyWebsite')} />
              <p className="text-sm text-destructive">{form.formState.errors.companyWebsite?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedInUrl">LinkedIn URL</Label>
              <Input id="linkedInUrl" {...form.register('linkedInUrl')} />
              <p className="text-sm text-destructive">{form.formState.errors.linkedInUrl?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" {...form.register('industry')} />
              <p className="text-sm text-destructive">{form.formState.errors.industry?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companySize">Company Size</Label>
              <Input id="companySize" {...form.register('companySize')} />
              <p className="text-sm text-destructive">{form.formState.errors.companySize?.message}</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companyDescription">Company Description</Label>
              <Textarea id="companyDescription" rows={4} {...form.register('companyDescription')} />
              <p className="text-sm text-destructive">{form.formState.errors.companyDescription?.message}</p>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)} type="button">
                Cancel
              </Button>
              <Button type="submit">
                {editRecruiter ? 'Save Changes' : 'Register Recruiter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-w-3xl">
          <DrawerHeader>
            <DrawerTitle>Recruiter Details</DrawerTitle>
            <DrawerDescription>Review recruitment company and verification status.</DrawerDescription>
            <DrawerClose className="absolute right-4 top-4" />
          </DrawerHeader>
          <div className="space-y-6 p-4">
            {viewRecruiter ? (
              <>
                <section className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Recruiter Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>Name:</strong> {viewRecruiter.name}</p>
                      <p><strong>Email:</strong> {viewRecruiter.email}</p>
                      <p><strong>Phone:</strong> {viewRecruiter.phone}</p>
                      <p><strong>Designation:</strong> {viewRecruiter.designation}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Company Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>Company:</strong> {viewRecruiter.companyName}</p>
                      <p><strong>Website:</strong> {viewRecruiter.companyWebsite || 'N/A'}</p>
                      <p><strong>LinkedIn:</strong> {viewRecruiter.linkedInUrl || 'N/A'}</p>
                      <p><strong>Industry:</strong> {viewRecruiter.industry}</p>
                      <p><strong>Size:</strong> {viewRecruiter.companySize}</p>
                    </CardContent>
                  </Card>
                </section>
                <section className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Verification Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>Status:</strong> {viewRecruiter.status}</p>
                      <p><strong>Notes:</strong> {viewRecruiter.verificationNotes || 'None'}</p>
                      <p><strong>Verified By:</strong> {viewRecruiter.verifiedBy || 'N/A'}</p>
                      <p><strong>Date:</strong> {viewRecruiter.verificationDate || 'N/A'}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Opportunities Posted</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>Posted:</strong> {viewRecruiter.opportunitiesPosted}</p>
                      <p><strong>Applications:</strong> {viewRecruiter.applicationsCount}</p>
                      <p><strong>Selections:</strong> {viewRecruiter.selectionCount}</p>
                    </CardContent>
                  </Card>
                </section>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No recruiter selected.</p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export default RecruitersManagement;

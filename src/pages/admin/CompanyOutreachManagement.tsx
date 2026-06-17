import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Eye, CheckCircle2, XCircle, Archive } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useOpportunities, useCreateOpportunity, useUpdateOpportunity, useApplications } from '@/hooks/useOpportunities';
import { opportunitySchema, type OpportunityFormValues } from '@/lib/adminSchemas';
import type { Opportunity } from '@/types';

const typeOptions = ['all', 'Internship', 'Full Time', 'Apprenticeship', 'Contract', 'Draft'] as const;
const statusOptions = ['all', 'Draft', 'Pending Approval', 'Approved', 'Closed', 'Rejected'] as const;

export function CompanyOutreachManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: opportunities = [], isLoading } = useOpportunities(typeFilter, statusFilter);
  const { data: applications = [] } = useApplications();
  const createOpportunity = useCreateOpportunity();
  const updateOpportunity = useUpdateOpportunity();

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
        console.error('CompanyOutreach auth check failed:', error);
        setIsAdmin(false);
        navigate('/admin');
      } finally {
        setChecking(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      title: '',
      companyName: '',
      type: 'Internship',
      domain: 'Both',
      location: '',
      workMode: 'Onsite',
      description: '',
      stipendCtc: '',
      deadline: new Date().toISOString().slice(0, 10),
      diploma: false,
      bsc: false,
      bs: false,
      trainingCompleted: false,
      internshipPlan: false,
      employmentPlan: false,
      domainTargeting: 'Both',
      minActivityPoints: 0,
      skillsRequired: '',
      experienceRequired: '',
      applicationQuestions: [
        { id: 'fullName', label: 'Full Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'phone', label: 'Phone', type: 'text', required: true },
        { id: 'degreeStatus', label: 'Degree Status', type: 'text', required: true },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'applicationQuestions' });

  const filteredOpportunities = useMemo(
    () =>
      opportunities.filter((opportunity) => {
        const matchesText =
          searchText === '' ||
          opportunity.title.toLowerCase().includes(searchText.toLowerCase()) ||
          opportunity.companyName.toLowerCase().includes(searchText.toLowerCase());
        return matchesText;
      }),
    [opportunities, searchText],
  );

  const overview = useMemo(() => {
    const active = opportunities.filter((item) => item.status === 'Approved').length;
    const pending = opportunities.filter((item) => item.status === 'Pending Approval').length;
    const offersReleased = opportunities.reduce((sum, item) => sum + (item.offersReleased ?? 0), 0);
    const companiesEngaged = new Set(opportunities.map((item) => item.companyName)).size;
    return {
      active,
      pending,
      applicationsReceived: applications.length,
      companiesEngaged,
      offersReleased,
    };
  }, [opportunities, applications]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingOpportunity(null);
  };

  const openCreateForm = () => {
    setEditingOpportunity(null);
    form.reset({
      title: '',
      companyName: '',
      type: 'Internship',
      domain: 'Both',
      location: '',
      workMode: 'Onsite',
      description: '',
      stipendCtc: '',
      deadline: new Date().toISOString().slice(0, 10),
      diploma: false,
      bsc: false,
      bs: false,
      trainingCompleted: false,
      internshipPlan: false,
      employmentPlan: false,
      domainTargeting: 'Both',
      minActivityPoints: 0,
      skillsRequired: '',
      experienceRequired: '',
      applicationQuestions: [
        { id: 'fullName', label: 'Full Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'phone', label: 'Phone', type: 'text', required: true },
        { id: 'degreeStatus', label: 'Degree Status', type: 'text', required: true },
      ],
    });
    setFormOpen(true);
  };

  const openEditForm = (opportunity: Opportunity) => {
    form.reset({
      title: opportunity.title,
      companyName: opportunity.companyName,
      type: opportunity.type,
      domain: opportunity.domain,
      location: opportunity.location,
      workMode: opportunity.workMode,
      description: opportunity.description,
      stipendCtc: opportunity.stipendCtc,
      deadline: opportunity.deadline,
      diploma: opportunity.eligibility.diploma,
      bsc: opportunity.eligibility.bsc,
      bs: opportunity.eligibility.bs,
      trainingCompleted: opportunity.eligibility.trainingCompleted,
      internshipPlan: opportunity.eligibility.internshipPlan,
      employmentPlan: opportunity.eligibility.employmentPlan,
      domainTargeting: opportunity.domain,
      minActivityPoints: opportunity.minActivityPoints,
      skillsRequired: opportunity.skillsRequired.join(', '),
      experienceRequired: opportunity.experienceRequired,
      applicationQuestions: opportunity.applicationQuestions,
    });
    setEditingOpportunity(opportunity);
    setFormOpen(true);
  };

  const handleSave = async (values: OpportunityFormValues) => {
    const record: Omit<Opportunity, 'id'> = {
      title: values.title,
      companyName: values.companyName,
      type: values.type,
      domain: values.domain,
      location: values.location,
      workMode: values.workMode,
      description: values.description,
      stipendCtc: values.stipendCtc,
      deadline: values.deadline,
      eligibility: {
        diploma: values.diploma,
        bsc: values.bsc,
        bs: values.bs,
        trainingCompleted: values.trainingCompleted,
        internshipPlan: values.internshipPlan,
        employmentPlan: values.employmentPlan,
      },
      minActivityPoints: values.minActivityPoints,
      skillsRequired: values.skillsRequired
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
      experienceRequired: values.experienceRequired,
      applicationQuestions: values.applicationQuestions,
      status: editingOpportunity ? editingOpportunity.status : 'Pending Approval',
      applicationsCount: editingOpportunity ? editingOpportunity.applicationsCount : 0,
      offersReleased: editingOpportunity ? editingOpportunity.offersReleased : 0,
      createdBy: 'admin',
      createdAt: editingOpportunity ? editingOpportunity.createdAt : new Date().toISOString(),
    };

    try {
      if (editingOpportunity) {
        await updateOpportunity.mutateAsync({ id: editingOpportunity.id, payload: record });
        toast({ title: 'Opportunity updated', description: 'Opportunity details were saved.' });
      } else {
        await createOpportunity.mutateAsync(record);
        toast({ title: 'Opportunity created', description: 'New opportunity has been added.' });
      }
      closeForm();
    } catch (error) {
      console.error(error);
      toast({ title: 'Save failed', description: 'Unable to save opportunity.', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (opportunity: Opportunity, status: Opportunity['status']) => {
    try {
      await updateOpportunity.mutateAsync({ id: opportunity.id, payload: { status } });
      toast({ title: 'Status updated', description: `${opportunity.title} is now ${status}.` });
    } catch (error) {
      console.error(error);
      toast({ title: 'Update failed', description: 'Unable to update opportunity status.', variant: 'destructive' });
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Company Outreach</h1>
          <p className="text-muted-foreground">Track opportunities, approvals, and company engagement.</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" /> Create Opportunity
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>Active Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{overview.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{overview.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Applications Received</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{overview.applicationsReceived}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Companies Engaged</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{overview.companiesEngaged}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Offers Released</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{overview.offersReleased}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Opportunity Management</CardTitle>
            <p className="text-sm text-muted-foreground">Filter and manage outreach opportunities.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 w-full md:w-auto">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue>{typeFilter === 'all' ? 'Type' : typeFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue>{statusFilter === 'all' ? 'Status' : statusFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search title or company"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading opportunities...</p>
          ) : filteredOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opportunities found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOpportunities.map((opportunity) => (
                  <TableRow key={opportunity.id}>
                    <TableCell>{opportunity.title}</TableCell>
                    <TableCell>{opportunity.companyName}</TableCell>
                    <TableCell>{opportunity.type}</TableCell>
                    <TableCell>{opportunity.domain}</TableCell>
                    <TableCell>{opportunity.applicationsCount}</TableCell>
                    <TableCell>{opportunity.status}</TableCell>
                    <TableCell>{new Date(opportunity.deadline).toLocaleDateString()}</TableCell>
                    <TableCell>{opportunity.createdBy}</TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap">
                      <Button size="sm" variant="outline">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditForm(opportunity)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleStatusChange(opportunity, 'Approved')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleStatusChange(opportunity, 'Rejected')}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(opportunity, 'Closed')}>
                        <Archive className="h-3.5 w-3.5" /> Close
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application Tracking</CardTitle>
          <CardDescription>Overview of pipeline stages based on available applications.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {['Applied', 'Shortlisted', 'Assessment', 'Interview', 'Offer', 'Rejected', 'Joined'].map((stage) => (
              <Card key={stage}>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{stage}</p>
                  <p className="text-2xl font-semibold">
                    {applications.filter((application) => application.stage === stage).length}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {formOpen && (
        <Card className="mx-auto w-full max-w-5xl border-border bg-background p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{editingOpportunity ? 'Edit Opportunity' : 'Create Opportunity'}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Add or update opportunity details, eligibility criteria, and application questions.
              </p>
            </div>
            <Button variant="outline" onClick={closeForm}>
              Close form
            </Button>
          </div>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Opportunity Title</Label>
                <Input id="title" {...form.register('title')} />
                <p className="text-sm text-destructive">{form.formState.errors.title?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company</Label>
                <Input id="companyName" {...form.register('companyName')} />
                <p className="text-sm text-destructive">{form.formState.errors.companyName?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Opportunity Type</Label>
                <Select value={form.watch('type')} onValueChange={(value) => form.setValue('type', value as any)}>
                  <SelectTrigger>
                    <SelectValue>{form.watch('type')}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {['Internship', 'Full Time', 'Apprenticeship', 'Contract', 'Draft'].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Select value={form.watch('domain')} onValueChange={(value) => form.setValue('domain', value as any)}>
                  <SelectTrigger>
                    <SelectValue>{form.watch('domain')}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {['Programming', 'Data Science', 'Both'].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" {...form.register('location')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workMode">Remote/Hybrid/Onsite</Label>
                <Select value={form.watch('workMode')} onValueChange={(value) => form.setValue('workMode', value as any)}>
                  <SelectTrigger>
                    <SelectValue>{form.watch('workMode')}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {['Remote', 'Hybrid', 'Onsite'].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Application Deadline</Label>
                <Input id="deadline" type="date" {...form.register('deadline')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={4} {...form.register('description')} />
              <p className="text-sm text-destructive">{form.formState.errors.description?.message}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="stipendCtc">Stipend/CTC</Label>
                <Input id="stipendCtc" {...form.register('stipendCtc')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minActivityPoints">Min Activity Points</Label>
                <Input id="minActivityPoints" type="number" {...form.register('minActivityPoints', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experienceRequired">Experience Required</Label>
                <Input id="experienceRequired" {...form.register('experienceRequired')} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {[
                { field: 'diploma', label: 'Diploma Students' },
                { field: 'bsc', label: 'BSc Students' },
                { field: 'bs', label: 'BS Students' },
                { field: 'trainingCompleted', label: 'Training Completed Students' },
                { field: 'internshipPlan', label: 'Internship Plan Students' },
                { field: 'employmentPlan', label: 'Employment Plan Students' },
              ].map((item) => (
                <label key={item.field} className="flex items-center gap-2 text-sm">
                  <Checkbox {...form.register(item.field as any)} />
                  {item.label}
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="skillsRequired">Skills Required</Label>
              <Input id="skillsRequired" {...form.register('skillsRequired')} placeholder="Comma separated" />
            </div>

            <div className="space-y-2">
              <Label>Application Questions</Label>
              <div className="space-y-3">
                {fields.map((question, index) => (
                  <div key={question.id} className="grid gap-2 rounded border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">Question {index + 1}</p>
                      <Button variant="outline" size="sm" type="button" onClick={() => remove(index)}>
                        Remove
                      </Button>
                    </div>
                    <Input
                      placeholder="Question label"
                      {...form.register(`applicationQuestions.${index}.label` as const)}
                    />
                    <Select
                      value={form.watch(`applicationQuestions.${index}.type` as any)}
                      onValueChange={(value) => form.setValue(`applicationQuestions.${index}.type` as any, value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue>{form.watch(`applicationQuestions.${index}.type` as any)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {['text', 'textarea', 'number', 'dropdown', 'file'].map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox {...form.register(`applicationQuestions.${index}.required` as const)} />
                      Required
                    </label>
                  </div>
                ))}
                <Button type="button" onClick={() => append({ id: `q-${Date.now()}`, label: 'Custom Question', type: 'text', required: false })}>
                  Add Custom Question
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeForm} type="button">
                Cancel
              </Button>
              <Button type="submit">{editingOpportunity ? 'Save Opportunity' : 'Create Opportunity'}</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export default CompanyOutreachManagement;

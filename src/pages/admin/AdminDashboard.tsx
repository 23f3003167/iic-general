import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bell,
  HelpCircle,
  BookOpen,
  MailCheck,
  Wrench,
  LogOut,
  Home,
  Plus,
  ClipboardList,
  Calendar,
  Database,
  BarChart3,
} from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';
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
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useToast } from '@/components/ui/use-toast';
import {
  getAnnouncements,
  getFAQs,
  getDocuments,
  createAnnouncement,
  createFAQ,
  createDocument,
} from '@/lib/firestoreService';
import AnnouncementsManagement from './AnnouncementsManagement';
import FAQsManagement from './FAQsManagement';
import DocumentsManagement from './DocumentsManagement';
import ToolsManagement from './ToolsManagement';
import EvaluatorsManagement from './EvaluatorsManagement';
import ExamsManagement from './ExamsManagement';
import SlotsAvailabilityPage from './SlotsAvailability';
import DatabaseManagement from './DatabaseManagement';
import { RecruitersManagement } from './RecruitersManagement';
import { CompanyOutreachManagement } from './CompanyOutreachManagement';
import ReportsManagement from './ReportsManagement';

const adminNavItems = [
  { path: '/admin/dashboard', label: 'Overview', icon: Home },
  { path: '/admin/announcements', label: 'Announcements', icon: Bell },
  { path: '/admin/tools', label: 'Tools', icon: Wrench },
  { path: '/admin/faqs', label: 'FAQs', icon: HelpCircle },
  { path: '/admin/documents', label: 'Documents', icon: BookOpen },
  { path: '/admin/exams', label: 'Exams', icon: ClipboardList },
  { path: '/admin/slots-availability', label: 'Slots Availability', icon: Calendar },
  { path: '/admin/evaluators', label: 'Evaluators', icon: CheckCircle2 },
  { path: '/admin/recruiters', label: 'Recruiters', icon: MailCheck },
  { path: '/admin/company-outreach', label: 'Company Outreach', icon: Bell },
  { path: '/admin/database', label: 'Database', icon: Database },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [stats, setStats] = useState({
    announcements: 0,
    faqs: 0,
    documents: 0,
  });
  const [openAddDialog, setOpenAddDialog] = useState<string | null>(null);

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
    if (isAdmin && location.pathname === '/admin/dashboard') {
      loadStats();
    }
  }, [isAdmin, location]);

  const loadStats = async (showToast?: boolean) => {
    try {
      const [announcements, faqs, documents] = await Promise.all([
        getAnnouncements(),
        getFAQs(),
        getDocuments(),
      ]);
      setStats({
        announcements: announcements.length,
        faqs: faqs.length,
        documents: documents.length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/admin');
  };

    const handleAddAnnouncement = async (announcementData: any) => {
      try {
        await createAnnouncement(announcementData);
        toast({
          title: 'Announcement created',
          description: 'The announcement has been created successfully.',
        });
        setOpenAddDialog(null);
        loadStats();
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'Could not create the announcement. Please try again.',
          variant: 'destructive',
        });
      }
    };

    const handleAddFAQ = async (faqData: any) => {
      try {
        await createFAQ(faqData);
        toast({
          title: 'FAQ created',
          description: 'The FAQ has been created successfully.',
        });
        setOpenAddDialog(null);
        loadStats();
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'Could not create the FAQ. Please try again.',
          variant: 'destructive',
        });
      }
    };

    const handleAddDocument = async (docData: any) => {
      try {
        await createDocument(docData);
        toast({
          title: 'Document created',
          description: 'The document has been created successfully.',
        });
        setOpenAddDialog(null);
        loadStats();
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'Could not create the document. Please try again.',
          variant: 'destructive',
        });
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

  const currentPage = location.pathname;
  const statsData = [
    {
      label: 'Announcements',
      count: stats.announcements,
      icon: Bell,
      color: 'text-accent',
    },
    {
      label: 'FAQs',
      count: stats.faqs,
      icon: HelpCircle,
      color: 'text-category-marks',
    },
    {
      label: 'Documents',
      count: stats.documents,
      icon: BookOpen,
      color: 'text-category-slot',
    },
  ];

  const renderContent = () => {
    switch (currentPage) {
      case '/admin/announcements':
        return <AnnouncementsManagement />;
      case '/admin/tools':
        return <ToolsManagement />;
      case '/admin/faqs':
        return <FAQsManagement />;
      case '/admin/documents':
        return <DocumentsManagement />;
      case '/admin/exams':
        return <ExamsManagement />;
      case '/admin/slots-availability':
        return <SlotsAvailabilityPage />;
      case '/admin/evaluators':
        return <EvaluatorsManagement />;
      case '/admin/recruiters':
        return <RecruitersManagement />;
      case '/admin/company-outreach':
        return <CompanyOutreachManagement />;
      case '/admin/database':
        return <DatabaseManagement />;
      case '/admin/reports':
        return <ReportsManagement />;
      default:
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Dashboard Overview</h1>
              <p className="text-muted-foreground">
                Manage announcements, FAQs, documents, and exams.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {statsData.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.label}>
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-muted">
                          <Icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stat.count}</p>
                          <p className="text-xs text-muted-foreground">
                            {stat.label}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Button
                    onClick={() => setOpenAddDialog('announcement')}
                    className="w-full justify-start"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Announcement
                  </Button>
                  <Button
                    onClick={() => setOpenAddDialog('faq')}
                    className="w-full justify-start"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add FAQ
                  </Button>
                  <Button
                    onClick={() => setOpenAddDialog('document')}
                    className="w-full justify-start"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Document
                  </Button>
                  <Button
                    onClick={() => navigate('/admin/exams')}
                    className="w-full justify-start"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Manage Exams
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <>
    <div className="min-h-screen bg-muted/30">
      {/* Admin Header */}
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-sm">
                IIC
              </div>
            </Link>
            <span className="text-sm font-medium">Admin Dashboard</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar */}
          <aside className="lg:w-56 shrink-0">
            <nav className="space-y-1">
              {adminNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
    {/* Add Dialogs */}
    <AddAnnouncementDialog
      open={openAddDialog === 'announcement'}
      onOpenChange={(open) => setOpenAddDialog(open ? 'announcement' : null)}
      onSubmit={handleAddAnnouncement}
    />
    <AddFAQDialog
      open={openAddDialog === 'faq'}
      onOpenChange={(open) => setOpenAddDialog(open ? 'faq' : null)}
      onSubmit={handleAddFAQ}
    />
    <AddDocumentDialog
      open={openAddDialog === 'document'}
      onOpenChange={(open) => setOpenAddDialog(open ? 'document' : null)}
      onSubmit={handleAddDocument}
    />
  </>
  );
};

// Dialog Components
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
}

const AddAnnouncementDialog = ({ open, onOpenChange, onSubmit }: DialogProps) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    date: new Date().toISOString().split('T')[0],
    important: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      title: '',
      content: '',
      date: new Date().toISOString().split('T')[0],
      important: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Announcement</DialogTitle>
          <DialogDescription>
            Create a new announcement for students.
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
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="important"
              type="checkbox"
              checked={formData.important}
              onChange={(e) => setFormData({ ...formData, important: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="important" className="cursor-pointer">
              Mark as Important
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Announcement</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AddFAQDialog = ({ open, onOpenChange, onSubmit }: DialogProps) => {
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      question: '',
      answer: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New FAQ</DialogTitle>
          <DialogDescription>
            Create a new frequently asked question.
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
              rows={4}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create FAQ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AddDocumentDialog = ({ open, onOpenChange, onSubmit }: DialogProps) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
  });

  const detectDocType = (url: string): 'PDF' | 'Drive' | 'External' => {
    const u = url.toLowerCase();
    if (u.endsWith('.pdf')) return 'PDF';
    if (u.includes('drive.google.com')) return 'Drive';
    return 'External';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      type: detectDocType(formData.url),
    });
    setFormData({
      title: '',
      description: '',
      url: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Document</DialogTitle>
          <DialogDescription>
            Add a new document for students to access.
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Document</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

};

export default AdminDashboard;

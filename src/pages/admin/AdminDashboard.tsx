import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  Bell,
  HelpCircle,
  BookOpen,
  LogOut,
  Home,
  Plus,
} from 'lucide-react';
import {
  mockForms,
  mockAnnouncements,
  mockFAQs,
  mockDocuments,
} from '@/data/mockData';

const adminNavItems = [
  { path: '/admin/dashboard', label: 'Overview', icon: Home },
  { path: '/admin/forms', label: 'Forms', icon: FileText },
  { path: '/admin/announcements', label: 'Announcements', icon: Bell },
  { path: '/admin/faqs', label: 'FAQs', icon: HelpCircle },
  { path: '/admin/documents', label: 'Documents', icon: BookOpen },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const adminStatus = localStorage.getItem('isAdmin');
    if (!adminStatus) {
      navigate('/admin');
    } else {
      setIsAdmin(true);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    navigate('/admin');
  };

  if (!isAdmin) return null;

  const stats = [
    {
      label: 'Total Forms',
      count: mockForms.length,
      open: mockForms.filter((f) => f.status === 'Open').length,
      icon: FileText,
      color: 'text-primary',
    },
    {
      label: 'Announcements',
      count: mockAnnouncements.length,
      important: mockAnnouncements.filter((a) => a.important).length,
      icon: Bell,
      color: 'text-accent',
    },
    {
      label: 'FAQs',
      count: mockFAQs.length,
      icon: HelpCircle,
      color: 'text-category-marks',
    },
    {
      label: 'Documents',
      count: mockDocuments.length,
      icon: BookOpen,
      color: 'text-category-slot',
    },
  ];

  return (
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
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Dashboard Overview</h1>
              <p className="text-muted-foreground">
                Manage forms, announcements, FAQs, and documents.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              {stats.map((stat) => {
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

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Button variant="outline" className="justify-start">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Form
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Announcement
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <Plus className="mr-2 h-4 w-4" />
                    Add FAQ
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Document
                  </Button>
                </div>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Full CRUD operations will be available after Firebase integration.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FileText, MessageSquare, HelpCircle, BookOpen, Shield } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Forms', icon: FileText },
  { path: '/announcements', label: 'Announcements', icon: MessageSquare },
  { path: '/faqs', label: 'FAQs', icon: HelpCircle },
  { path: '/documents', label: 'Documents', icon: BookOpen },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card">
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground">
        <div className="container flex h-8 items-center justify-between text-sm">
          <span>IIC - Placement Training Portal</span>
          <span className="hidden sm:inline">iic@study.iitm.ac.in</span>
        </div>
      </div>
      
      {/* Main nav */}
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-lg">
            IIC
          </div>
          <span className="hidden font-semibold sm:inline-block">
            Industry Interaction Cell
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
          <Link
            to="/admin"
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ml-2 border',
              location.pathname.startsWith('/admin')
                ? 'bg-accent text-accent-foreground border-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted border-border'
            )}
          >
            <Shield className="h-4 w-4" />
            <span className="hidden md:inline">Admin</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

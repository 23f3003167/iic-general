import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FileText, MessageSquare, HelpCircle, BookOpen, Phone, Mail } from 'lucide-react';

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
      {/* Main nav (logo and top bar removed) */}
      <div className="container flex h-14 items-center justify-between">
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
        </nav>
        
        {/* Support links in the corner */}
        <div className="flex items-center gap-3">
          <a
            href="https://placements.study.iitm.ac.in/support/raiseticket"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Raise a Support Ticket"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden md:inline">Support Ticket</span>
          </a>
          <a
            href="mailto:iic@study.iitm.ac.in"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Support Email"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden md:inline">Support Mail</span>
          </a>
        </div>
      </div>
    </header>
  );
}

import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { mockAnnouncements } from '@/data/mockData';
import { AlertCircle, Bell } from 'lucide-react';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const Announcements = () => {
  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2">
            <Bell className="h-7 w-7 text-primary" />
            Announcements
          </h1>
          <p className="text-muted-foreground">
            Official updates from the Industry Interaction Cell.
          </p>
        </div>

        <div className="space-y-4">
          {mockAnnouncements.map((announcement) => (
            <Card
              key={announcement.id}
              className={
                announcement.important
                  ? 'border-l-4 border-l-accent'
                  : ''
              }
            >
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  {announcement.important && (
                    <AlertCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-semibold">{announcement.title}</h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(announcement.date)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {announcement.content}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Announcements;

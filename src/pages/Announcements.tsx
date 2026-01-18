import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { getAnnouncements } from '@/lib/firestoreService';
import { Bell } from 'lucide-react';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const Announcements = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const data = await getAnnouncements();
      const sorted = data.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setAnnouncements(sorted);
    } catch (error) {
      console.error('Error loading announcements:', error);
    } finally {
      setLoading(false);
    }
  };

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

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading announcements...</p>
        ) : announcements.length > 0 ? (
          <div className="divide-y rounded-md border">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="p-4">
                <div className="flex items-start justify-between">
                  <h3 className="font-medium">
                    {announcement.title}
                    {announcement.important && (
                      <span className="ml-2 text-xs text-red-600">(Important)</span>
                    )}
                  </h3>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(announcement.date)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {announcement.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No announcements yet.</p>
        )}
      </div>
    </Layout>
  );
};

export default Announcements;

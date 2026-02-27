import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAnnouncements } from '@/lib/firestoreService';
import { Bell, AlertCircle } from 'lucide-react';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatAnnouncementContent(content: string): React.ReactNode {
  // Split by asterisks and double asterisks for better formatting
  const parts = content.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  
  return parts.map((part, index) => {
    // Bold text (**text**)
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    // Italic or emphasis (*text*)
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index} className="italic">{part.slice(1, -1)}</em>;
    }
    // Regular text - split by newlines for better line breaks
    if (part.trim()) {
      return part.split('\n').map((line, lineIndex) => (
        <span key={`${index}-${lineIndex}`}>
          {line}
          {lineIndex < part.split('\n').length - 1 && <br />}
        </span>
      ));
    }
    return null;
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
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{announcement.title}</CardTitle>
                        {announcement.important && (
                          <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                            <AlertCircle className="h-3 w-3" />
                            Important
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(announcement.date)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-700 dark:text-gray-300 space-y-2">
                    {formatAnnouncementContent(announcement.content)}
                  </div>
                </CardContent>
              </Card>
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

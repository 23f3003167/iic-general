import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDocuments } from '@/lib/firestoreService';
import { BookOpen, ExternalLink, FileText, HardDrive, Link2 } from 'lucide-react';

const typeIcons: Record<string, any> = {
  PDF: FileText,
  Drive: HardDrive,
  External: Link2,
};

const Documents = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const data = await getDocuments();
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Reference Documents
          </h1>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading documents...</p>
        ) : documents.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => {
              const Icon = typeIcons[doc.type] || FileText;
              return (
                <Card key={doc.id} className="flex flex-col">
                  <CardContent className="pt-5 flex flex-col flex-1">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 rounded bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-tight">
                          {doc.title}
                        </h3>
                        <span className="text-xs text-muted-foreground uppercase">
                          {doc.type}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">
                      {doc.description}
                    </p>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2"
                      >
                        Open Document
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No documents available yet.</p>
        )}
      </div>
    </Layout>
  );
};

export default Documents;

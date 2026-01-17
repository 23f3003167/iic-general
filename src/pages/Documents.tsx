import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockDocuments } from '@/data/mockData';
import { BookOpen, ExternalLink, FileText, HardDrive, Link2 } from 'lucide-react';

const typeIcons = {
  PDF: FileText,
  Drive: HardDrive,
  External: Link2,
};

const Documents = () => {
  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Reference Documents
          </h1>
          <p className="text-muted-foreground">
            Official documents, templates, and resources for placement preparation.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockDocuments.map((doc) => {
            const Icon = typeIcons[doc.type];
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
      </div>
    </Layout>
  );
};

export default Documents;

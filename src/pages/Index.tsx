import { Layout } from '@/components/layout/Layout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const Index = () => {
  return (
    <>
      <Layout>
        <div className="container py-8 space-y-6">
          {/* Information Banner */}
          <Alert className="border-l-4 border-l-blue-600 bg-blue-50/50 shadow-sm">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <AlertDescription className="text-blue-900 text-sm leading-relaxed">
              <div className="space-y-1">
                <p className="font-semibold text-base">Student Eligibility Notice</p>
                <p className="text-blue-800">
                  Only IIC Jan 2026 training students are authorized to access the portal. 
                  Announcements and documents are exclusively available for registered students.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {/* Hero Section */}
          <div className="text-center space-y-2 pb-4 border-b">
            <h1 className="text-2xl font-bold sm:text-3xl">
              Placement Training Portal
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Access announcements, FAQs, documents, and other training resources.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-6 text-center hover:bg-accent/50 transition-colors">
              <h3 className="text-lg font-semibold mb-2">Announcements</h3>
              <p className="text-sm text-muted-foreground mb-4">Stay updated with latest news and updates</p>
              <a href="/announcements" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                View Announcements
              </a>
            </div>

            <div className="rounded-lg border bg-card p-6 text-center hover:bg-accent/50 transition-colors">
              <h3 className="text-lg font-semibold mb-2">FAQs</h3>
              <p className="text-sm text-muted-foreground mb-4">Find answers to frequently asked questions</p>
              <a href="/faqs" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                View FAQs
              </a>
            </div>

            <div className="rounded-lg border bg-card p-6 text-center hover:bg-accent/50 transition-colors">
              <h3 className="text-lg font-semibold mb-2">Documents</h3>
              <p className="text-sm text-muted-foreground mb-4">Access training materials and resources</p>
              <a href="/documents" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                View Documents
              </a>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
};

export default Index;

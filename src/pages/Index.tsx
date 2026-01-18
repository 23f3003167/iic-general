import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { FormCard } from '@/components/forms/FormCard';
import { FormSection } from '@/components/forms/FormSection';
import { QueryDifferentiator } from '@/components/forms/QueryDifferentiator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getForms } from '@/lib/firestoreService';
import { AlertCircle } from 'lucide-react';

const Index = () => {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const data = await getForms();
      setForms(data);
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const openForms = forms.filter((f) => f.status === 'Open');
  const upcomingForms = forms.filter((f) => f.status === 'Upcoming');
  const closedForms = forms.filter((f) => f.status === 'Closed');

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        {/* Disclaimer Alert */}
        <Alert className="border-l-4 border-l-amber-500 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            <strong>Important:</strong> Only IIC Jan 2026 training students are allowed to fill the forms. Announcements and documents are applicable only for registered students.
          </AlertDescription>
        </Alert>

        {/* Hero Section */}
        <div className="text-center space-y-2 pb-4 border-b">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Placement Training Forms
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Access Google Forms for training issues, marks discrepancy resolution, 
            slot booking, and other administrative processes.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading forms...</p>
            ) : (
              <>
                {/* Open Forms - Primary */}
                <FormSection
                  title="Open Forms"
                  count={openForms.length}
                  variant="primary"
                  defaultOpen={true}
                >
                  {openForms.length > 0 ? (
                    openForms.map((form) => <FormCard key={form.id} form={form} />)
                  ) : (
                    <p className="text-muted-foreground col-span-full text-center py-8">
                      No forms are currently open.
                    </p>
                  )}
                </FormSection>

                {/* Upcoming Forms */}
                <FormSection
                  title="Upcoming Forms"
                  count={upcomingForms.length}
                  variant="secondary"
                  defaultOpen={true}
                >
                  {upcomingForms.length > 0 ? (
                    upcomingForms.map((form) => <FormCard key={form.id} form={form} />)
                  ) : (
                    <p className="text-muted-foreground col-span-full text-center py-8">
                      No upcoming forms scheduled.
                    </p>
                  )}
                </FormSection>

                {/* Closed Forms - Collapsed by default */}
                <FormSection
                  title="Closed Forms"
                  count={closedForms.length}
                  variant="muted"
                  defaultOpen={false}
                >
                  {closedForms.length > 0 ? (
                    closedForms.map((form) => <FormCard key={form.id} form={form} />)
                  ) : (
                    <p className="text-muted-foreground col-span-full text-center py-8">
                      No closed forms.
                    </p>
                  )}
                </FormSection>
              </>
            )}
          </div>
          {/* Sidebar */}
          <aside className="lg:col-span-1 lg:sticky lg:top-20 space-y-4">
            <QueryDifferentiator />
          </aside>
        </div>
      </div>
    </Layout>
  );
};

export default Index;

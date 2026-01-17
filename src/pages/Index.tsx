import { Layout } from '@/components/layout/Layout';
import { FormCard } from '@/components/forms/FormCard';
import { FormSection } from '@/components/forms/FormSection';
import { mockForms } from '@/data/mockData';

const Index = () => {
  const openForms = mockForms.filter((f) => f.status === 'Open');
  const upcomingForms = mockForms.filter((f) => f.status === 'Upcoming');
  const closedForms = mockForms.filter((f) => f.status === 'Closed');

  return (
    <Layout>
      <div className="container py-8 space-y-8">
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
      </div>
    </Layout>
  );
};

export default Index;

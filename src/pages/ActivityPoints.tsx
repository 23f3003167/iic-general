import { Layout } from '@/components/layout/Layout';

const ActivityPoints = () => {
  return (
    <Layout>
      <div className="container py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Section */}
          <div className="text-center space-y-2 pb-4 border-b">
            <h1 className="text-2xl font-bold sm:text-3xl">
              Activity Points
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Fill out this form to claim activity points after completing activities.
            </p>
          </div>

          {/* Google Form Embed */}
          <div className="flex justify-center">
            <iframe
              src="https://docs.google.com/forms/d/e/1FAIpQLScKq2iceagaelvu46t0ABdZkXyTB0AVQ5aJM8cDQd6dwlvc6g/viewform?embedded=true"
              style={{ width: '1100px', height: '700px' }}
              frameBorder="0"
              marginHeight={0}
              marginWidth={0}
              className="w-full max-w-[1100px]"
              title="Activity Points Form"
            >
              Loading…
            </iframe>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ActivityPoints;

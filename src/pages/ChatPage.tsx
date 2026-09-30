import { Layout } from '@/components/layout/Layout';
import Chat from '../../chatbot/frontend/Chat';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const ChatPage = () => {
  return (
    <Layout>
      <div className="container max-w-6xl py-6 space-y-6 sm:py-8">
        {/* Information Banner */}
        <Alert className="border-l-4 border-l-blue-600 bg-blue-50/50 shadow-sm">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <AlertDescription className="text-blue-900 text-sm leading-relaxed">
            <div className="space-y-1">
              <p className="font-semibold text-base">AI Help Chat</p>
              <p className="text-blue-800">
                Ask questions about the placement training program, forms, policies, and announcements. 
                Our AI assistant will help you find the information you need.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Hero Section */}
        <div className="space-y-2 border-b pb-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">IIC Training Desk</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Help Chat
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get instant answers about training, placement policies, forms, and announcements.
          </p>
        </div>

        {/* Chat Container */}
        <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(240px,0.75fr)]">
          <div className="min-h-[520px] lg:min-h-[580px]">
            <Chat />
          </div>
          
          {/* Info Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h3 className="font-semibold text-foreground">How to get a useful answer</h3>
              <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span><span>Select the topic that best matches your question.</span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span><span>Ask in your own words. Exact wording is not required.</span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">3</span><span>Open the official source when you need more detail.</span></li>
                </ol>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
              <h3 className="font-semibold text-amber-950 dark:text-amber-100">Couldn’t find an answer?</h3>
              <p className="mb-3 mt-2 text-sm text-amber-900/80 dark:text-amber-100/80">
                Ask your question in the IIC Training Google Space for team assistance.
              </p>
              <a 
                href="/" 
                className="text-sm font-semibold text-amber-800 hover:underline dark:text-amber-200"
              >
                Go to Forms →
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ChatPage;

import { Layout } from '@/components/layout/Layout';
import Chat from '../../chatbot/frontend/Chat';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const ChatPage = () => {
  return (
    <Layout>
      <div className="container py-8 space-y-6">
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
        <div className="text-center space-y-2 pb-4 border-b">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Help Chat
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get instant answers about training, placement policies, forms, and announcements.
          </p>
        </div>

        {/* Chat Container */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Chat />
          </div>
          
          {/* Info Sidebar */}
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Quick Tips</h3>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li>• Ask about placement training process</li>
                <li>• Inquire about policies and guidelines</li>
                <li>• Learn about activity points</li>
                <li>• Get form submission help</li>
              </ul>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-3">Need Personal Help?</h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                For case-specific issues, use the Google Forms section from the home page.
              </p>
              <a 
                href="/" 
                className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
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

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Mail, CheckCircle } from 'lucide-react';
import { verifyStudentEmail, storeVerifiedEmail } from '@/lib/emailVerificationService';
import { useToast } from '@/components/ui/use-toast';

interface MailVerificationModalProps {
  onVerified: (email: string) => void;
}

const MailVerificationModal = ({ onVerified }: MailVerificationModalProps) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await verifyStudentEmail(email);
      
      if (result.verified) {
        storeVerifiedEmail(email);
        toast({
          title: 'Success',
          description: 'Email verified successfully. Welcome!',
        });
        onVerified(result.email);
      } else {
        setError('Email not found in authorized student list. Please check your email and try again.');
        toast({
          title: 'Verification Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center">Email Verification</DialogTitle>
          <DialogDescription className="text-center">
            Please verify your email to access the portal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-l-4 border-l-blue-600 bg-blue-50/50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 text-sm">
              Only IIC May 2026 training students are authorized to access this portal.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                disabled={isLoading}
                required
              />
            </div>

            {error && (
              <Alert className="border-l-4 border-l-red-600 bg-red-50/50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-900 text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">○</span>
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Verify Email
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-gray-500 text-center">
            Your email will be stored locally for this browser session
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MailVerificationModal;

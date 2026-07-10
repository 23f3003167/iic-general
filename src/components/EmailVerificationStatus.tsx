import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface EmailVerificationStatusProps {
  email: string;
  verified: boolean;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
}

const EmailVerificationStatus = ({
  email,
  verified,
  isLoading,
  error,
  onRetry,
}: EmailVerificationStatusProps) => {
  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            ) : verified ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <Mail className="h-6 w-6 text-red-600" />
            )}
          </div>
          <DialogTitle className="text-center">
            {isLoading
              ? 'Verifying Email'
              : verified
              ? 'Email Verified'
              : 'Verification Failed'}
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            {email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading && (
            <Alert className="border-l-4 border-l-blue-600 bg-blue-50/50">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 inline-block mr-2" />
              <AlertDescription className="text-blue-900 text-sm inline">
                Checking if you're an authorized student...
              </AlertDescription>
            </Alert>
          )}

          {verified && (
            <Alert className="border-l-4 border-l-green-600 bg-green-50/50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900 text-sm">
                Your email has been verified successfully. Welcome to the IIC Portal!
              </AlertDescription>
            </Alert>
          )}

          {error && !verified && (
            <Alert className="border-l-4 border-l-red-600 bg-red-50/50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-900 text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && !verified && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                If you believe this is an error, Check with the IIC Team.
              </p>
              {onRetry && (
                <Button onClick={onRetry} className="w-full">
                  Try Again
                </Button>
              )}
              <p className="text-xs text-gray-500 text-center">
                For assistance, contact the IIC team
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailVerificationStatus;

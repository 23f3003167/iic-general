import { ReactNode, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import EmailVerificationStatus from '@/components/EmailVerificationStatus';
import { getStoredVerifiedEmail, storeVerifiedEmail, verifyStudentEmail } from '@/lib/emailVerificationService';
import { useToast } from '@/components/ui/use-toast';

interface ProtectedStudentRouteProps {
  children: ReactNode;
}

const ProtectedStudentRoute = ({ children }: ProtectedStudentRouteProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [studentEmail, setStudentEmail] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        setIsLoading(false);
        return;
      }

      const userEmail = user.email.toLowerCase().trim();
      setStudentEmail(userEmail);

      // Check if already verified in localStorage
      const storedEmail = getStoredVerifiedEmail();
      if (storedEmail === userEmail) {
        setIsVerified(true);
        setIsLoading(false);
        return;
      }

      // Auto-verify against Level 1 sheet
      setIsVerifying(true);
      try {
        const result = await verifyStudentEmail(userEmail);
        if (result.verified) {
          storeVerifiedEmail(userEmail);
          setIsVerified(true);
          toast({
            title: 'Success',
            description: 'Email verified successfully. Welcome!',
          });
        } else {
          setVerificationError(result.message || 'Email not authorized. Please contact the IIC team.');
          toast({
            title: 'Verification Failed',
            description: result.message,
            variant: 'destructive',
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Verification failed';
        setVerificationError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setIsVerifying(false);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [toast]);

  const handleRetry = async () => {
    if (!studentEmail) return;

    setIsVerifying(true);
    setVerificationError(null);

    try {
      const result = await verifyStudentEmail(studentEmail);
      if (result.verified) {
        storeVerifiedEmail(studentEmail);
        setIsVerified(true);
        toast({
          title: 'Success',
          description: 'Email verified successfully!',
        });
      } else {
        setVerificationError(result.message || 'Email not authorized.');
        toast({
          title: 'Verification Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      setVerificationError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  // Not logged in
  if (!studentEmail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please log in to access this page</p>
        </div>
      </div>
    );
  }

  // Verification in progress or failed
  if (!isVerified) {
    return (
      <EmailVerificationStatus
        email={studentEmail}
        verified={false}
        isLoading={isVerifying}
        error={verificationError || undefined}
        onRetry={handleRetry}
      />
    );
  }

  // Verified - show content
  return <>{children}</>;
};

export default ProtectedStudentRoute;

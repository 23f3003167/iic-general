import { ReactNode, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import EmailVerificationStatus from '@/components/EmailVerificationStatus';
import { getStoredVerifiedEmail, storeVerifiedEmail, verifyStudentEmail } from '@/lib/emailVerificationService';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface ProtectedStudentRouteProps {
  children: ReactNode;
}

const ProtectedStudentRoute = ({ children }: ProtectedStudentRouteProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [studentEmail, setStudentEmail] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast({
        title: 'Signed in',
        description: 'Successfully signed in with Google',
      });
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: 'Sign in failed',
        description: error instanceof Error ? error.message : 'Failed to sign in',
        variant: 'destructive',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      setStudentEmail(null);
      setIsVerified(false);
      setVerificationError(null);
      toast({
        title: 'Signed out',
        description: 'Successfully signed out',
      });
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: 'Sign out failed',
        description: error instanceof Error ? error.message : 'Failed to sign out',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? { uid: user.uid, email: user.email, emailVerified: user.emailVerified } : 'No user');
      
      if (!user) {
        setIsLoading(false);
        return;
      }

      if (!user.email) {
        console.error('User authenticated but no email available:', user);
        setVerificationError('No email associated with your account. Please contact support.');
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
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Student Portal Login</h2>
            <p className="text-gray-600">Sign in with your IITM email to access the portal</p>
          </div>
          <Button 
            onClick={handleGoogleSignIn} 
            disabled={isSigningIn}
            size="lg"
            className="min-w-[200px]"
          >
            {isSigningIn ? (
              <>
                <span className="animate-spin mr-2">○</span>
                Signing in...
              </>
            ) : (
              'Sign in with Google'
            )}
          </Button>
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

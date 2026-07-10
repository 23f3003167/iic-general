import { ReactNode, useEffect, useState } from 'react';
import MailVerificationModal from '@/components/MailVerificationModal';
import { getStoredVerifiedEmail } from '@/lib/emailVerificationService';

interface ProtectedStudentRouteProps {
  children: ReactNode;
}

const ProtectedStudentRoute = ({ children }: ProtectedStudentRouteProps) => {
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(true);

  useEffect(() => {
    const storedEmail = getStoredVerifiedEmail();
    setVerifiedEmail(storedEmail);
    setIsCheckingEmail(false);
  }, []);

  const handleEmailVerified = (email: string) => {
    setVerifiedEmail(email);
  };

  if (isCheckingEmail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!verifiedEmail) {
    return <MailVerificationModal onVerified={handleEmailVerified} />;
  }

  return <>{children}</>;
};

export default ProtectedStudentRoute;

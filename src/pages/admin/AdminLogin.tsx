import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Chrome } from 'lucide-react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useToast } from '@/components/ui/use-toast';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [status, setStatus] = useState<'idle' | 'signing'>('idle');

  const handleGoogleSignIn = async () => {
    try {
      setStatus('signing');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const signedInEmail = result.user.email || '';

      if (!(await verifyAdminAccess(result.user))) {
        await signOut(auth);
        toast({
          title: 'Unauthorized',
          description: 'This account is not allowed to access admin.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Signed in',
        description: `Signed in with ${signedInEmail}.`,
      });
      navigate('/admin/dashboard');
    } catch (error) {
      console.error(error);
      if ((error as any).code === 'auth/popup-closed-by-user') {
        // User closed the popup; no error toast needed
      } else {
        toast({
          title: 'Sign-in failed',
          description: 'Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setStatus('idle');
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && (await verifyAdminAccess(user))) {
        navigate('/admin/dashboard');
      }
    });
    return () => unsub();
  }, [navigate]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Access the IIC admin dashboard
          </p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGoogleSignIn}
            className="w-full"
            disabled={status !== 'idle'}
          >
            <Chrome className="mr-2 h-4 w-4" />
            {status === 'signing' ? 'Signing in...' : 'Sign in with Google'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;

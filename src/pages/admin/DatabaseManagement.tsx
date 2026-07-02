import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useToast } from '@/components/ui/use-toast';
import { Database, Copy, Check, Loader2 } from 'lucide-react';
import { getDatabaseData } from '@/lib/toolsService';

interface CategoryData {
  [key: string]: string[];
}

interface LevelData {
  level: string;
  categories: CategoryData;
}

const APPS_SCRIPT_URL = import.meta.env.VITE_DB_APPS_SCRIPT_WEB_APP_URL as string;

export default function DatabaseManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<'level1' | 'level2' | 'level3'>('level1');
  const [levelData, setLevelData] = useState<Record<string, LevelData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<{ level: string; category: string; emails: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        navigate('/admin');
        return;
      }
      const allowed = await verifyAdminAccess(user);
      if (!allowed) {
        await signOut(auth);
        toast({
          title: 'Unauthorized',
          description: 'Your account is not allowed to access admin.',
          variant: 'destructive',
        });
        navigate('/admin');
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      setIsAdmin(true);
      setChecking(false);
    });
    return () => unsub();
  }, [navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      loadAllData();
    }
  }, [isAdmin]);

 const loadAllData = async () => {
  try {
    setLoading(true);

    if (!APPS_SCRIPT_URL) {
      throw new Error('No API URL configured. Please set VITE_DB_APPS_SCRIPT_WEB_APP_URL in .env');
    }

    const data = await new Promise<any>((resolve, reject) => {
      const callbackName = `jsonp_callback_${Date.now()}`;
      const script = document.createElement('script');

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Request timed out'));
      }, 15000);

      function cleanup() {
        clearTimeout(timeout);
        delete (window as any)[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      (window as any)[callbackName] = (result: any) => {
        cleanup();
        resolve(result);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Failed to load script'));
      };

      script.src = `${APPS_SCRIPT_URL}?action=all&callback=${callbackName}`;
      document.head.appendChild(script);
    });

    if (data.error) {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
      return;
    }

    setLevelData({
      level1: data.level1,
      level2: data.level2,
      level3: data.level3,
    });
  } catch (error) {
    console.error('Error loading data:', error);
    toast({
      title: 'Error',
      description: 'Failed to load data. Please verify the Apps Script is deployed correctly.',
      variant: 'destructive',
    });
  } finally {
    setLoading(false);
  }
};

  const handleCategoryClick = (level: string, category: string, emails: string[]) => {
    setSelectedCategory({ level, category, emails });
    setCopied(false);
  };

  const handleCopyEmails = () => {
    if (selectedCategory) {
      const emailText = selectedCategory.emails.join(', ');
      navigator.clipboard.writeText(emailText);
      setCopied(true);
      toast({
        title: 'Copied',
        description: 'Email IDs copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  const currentLevelData = levelData[activeTab];
  const categories = currentLevelData?.categories || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Database</h1>
        <p className="text-muted-foreground">
          View and manage student email IDs by pending activities
        </p>
      </div>

      {/* Level Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'level1' ? 'default' : 'outline'}
              onClick={() => setActiveTab('level1')}
            >
              Level 1
            </Button>
            <Button
              variant={activeTab === 'level2' ? 'default' : 'outline'}
              onClick={() => setActiveTab('level2')}
            >
              Level 2
            </Button>
            <Button
              variant={activeTab === 'level3' ? 'default' : 'outline'}
              onClick={() => setActiveTab('level3')}
            >
              Level 3
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(categories).length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending activities found for {activeTab.replace('level', 'Level ')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(categories).map(([category, emails]) => (
            <Card
              key={category}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleCategoryClick(activeTab, category, emails)}
            >
              <CardHeader>
                <CardTitle className="text-base">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {emails.length} student{emails.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Email Popup Dialog */}
      <Dialog open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedCategory?.level.replace('level', 'Level ')} - {selectedCategory?.category}
            </DialogTitle>
            <DialogDescription>
              {selectedCategory?.emails.length} student email IDs
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-2">
              {selectedCategory?.emails.map((email, index) => (
                <div
                  key={index}
                  className="p-2 bg-muted rounded text-sm font-mono"
                >
                  {email}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCopyEmails}
              className="w-full sm:w-auto"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy All Emails
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

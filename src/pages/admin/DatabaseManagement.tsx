import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Database, Copy, Check, Loader2, Search } from 'lucide-react';

interface CategoryData {
  [key: string]: string[];
}

interface LevelData {
  level: string;
  categories: CategoryData;
}

interface StudentField {
  header: string;
  value: string;
}

interface StudentAttempt {
  header: string;
  value: string;
}

interface StudentLevelResult {
  level: string;
  found: boolean;
  error?: string;
  fields?: StudentField[];
  attempts?: StudentAttempt[];
}

interface StudentSearchResult {
  email: string;
  level1: StudentLevelResult;
  level2: StudentLevelResult;
  level3: StudentLevelResult;
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
  const [searchEmail, setSearchEmail] = useState('');
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [studentSearchResult, setStudentSearchResult] = useState<StudentSearchResult | null>(null);

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
      const data = await fetchDatabaseJsonp<{ level1: LevelData; level2: LevelData; level3: LevelData }>({ action: 'all' });

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

  const fetchDatabaseJsonp = <T,>(params: Record<string, string>): Promise<T> => {
    if (!APPS_SCRIPT_URL) {
      return Promise.reject(new Error('No API URL configured. Please set VITE_DB_APPS_SCRIPT_WEB_APP_URL in .env'));
    }

    return new Promise<T>((resolve, reject) => {
      const callbackName = `jsonp_callback_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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

      (window as any)[callbackName] = (result: unknown) => {
        cleanup();
        resolve(result as T);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Failed to load script'));
      };

      const url = new URL(APPS_SCRIPT_URL);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      url.searchParams.set('callback', callbackName);

      script.src = url.toString();
      document.head.appendChild(script);
    });
  };

  const submitStudentSearch = async () => {
    const normalizedEmail = searchEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast({
        title: 'Missing email',
        description: 'Enter a student email ID to search.',
        variant: 'destructive',
      });
      return;
    }

    setSearchingStudent(true);
    try {
      const result = await fetchDatabaseJsonp<StudentSearchResult | { error: string }>({
        action: 'searchStudent',
        email: normalizedEmail,
      });

      if ('error' in result) {
        throw new Error(result.error);
      }

      setStudentSearchResult(result);
    } catch (error) {
      toast({
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'Could not search student.',
        variant: 'destructive',
      });
      setStudentSearchResult(null);
    } finally {
      setSearchingStudent(false);
    }
  };

  const formatAttemptCode = (value?: string): string => {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return '—';

    switch (normalized) {
      case 'FA1B':
        return 'First Attempt';
      case 'FA2B':
        return 'First Attempt';
      case 'RA1B':
        return 'ReAttempt';
      case 'RA2B':
        return 'ReAttempt';
      default:
        return value || '—';
    }
  };

  const renderStudentLevelCard = (levelResult: StudentLevelResult) => {
    const visibleFields = (levelResult.fields || []).filter((field) => field.header && field.value);
    const excludedHeaders = new Set(['batch', 'name', 'status', 'plan', 'domain']);
    const detailFields = visibleFields.filter((field) => {
      const normalizedHeader = field.header.trim().toLowerCase();
      return !excludedHeaders.has(normalizedHeader) && normalizedHeader.indexOf('attempt') === -1;
    });

    return (
      <Card key={levelResult.level}>
        <CardHeader>
          <CardTitle className="text-base">{levelResult.level}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!levelResult.found ? (
            <p className="text-sm text-muted-foreground">
              {levelResult.error || 'No matching row found in this level.'}
            </p>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                {detailFields.map((field) => (
                  <div key={`${levelResult.level}-${field.header}`} className="rounded border bg-muted/20 p-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{field.header}</p>
                    <p className="text-sm break-words">{field.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Attempts</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {(levelResult.attempts || []).map((attempt) => (
                    <div key={`${levelResult.level}-${attempt.header}`} className="rounded border bg-muted/20 p-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{attempt.header}</p>
                    <p className="text-sm">{formatAttemptCode(attempt.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const getStudentBadgeFields = (result: StudentSearchResult): StudentField[] => {
    const levels = [result.level1, result.level2, result.level3];
    const headersInOrder = ['batch', 'name', 'status', 'plan', 'domain'];
    const collected: Record<string, string> = {};

    headersInOrder.forEach((targetHeader) => {
      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        if (!level?.found || !level.fields) continue;
        const matched = level.fields.find(
          (field) => field.header.trim().toLowerCase() === targetHeader && String(field.value || '').trim(),
        );
        if (matched) {
          collected[targetHeader] = matched.value;
          break;
        }
      }
    });

    return headersInOrder
      .filter((header) => collected[header])
      .map((header) => ({
        header: header.toUpperCase(),
        value: collected[header],
      }));
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Student by Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Enter student email ID"
            />
            <Button onClick={submitStudentSearch} disabled={searchingStudent} className="sm:w-auto">
              {searchingStudent ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search
            </Button>
          </div>
          {studentSearchResult && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Showing matched rows for <span className="font-medium">{studentSearchResult.email}</span>
              </p>
              <div className="rounded border bg-muted/10 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Student</p>
                <div className="flex flex-wrap gap-2">
                  {getStudentBadgeFields(studentSearchResult).map((field) => (
                    <Badge key={`student-badge-${field.header}`} variant="secondary" className="max-w-full">
                      <span className="mr-1 text-[10px]">{field.header}:</span>
                      <span className="break-all">{field.value}</span>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                {renderStudentLevelCard(studentSearchResult.level1)}
                {renderStudentLevelCard(studentSearchResult.level2)}
                {renderStudentLevelCard(studentSearchResult.level3)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

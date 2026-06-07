import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listSlotsAvailability } from '@/lib/firestoreService';
import { fetchPresentationSummaryStats, combineSlotsData } from '@/lib/presentationService';

type PresentationSlotsOverview = {
  instructorName: string;
  instructorNumber: string;
  slotsGiven: number;
  slotsAllocated: number;
  slotsWithFeedback: number;
  absentees: number;
  slotsTaken: number;
};

export function PresentationSlotsOverview() {
  const { toast } = useToast();
  const [data, setData] = useState<PresentationSlotsOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch from Firestore (slots given)
      const firestoreSlots = await listSlotsAvailability('presentation');

      // Fetch from Apps Script (slots allocated, absentees)
      const summaryStats = await fetchPresentationSummaryStats();

      // Combine and calculate
      const combined = combineSlotsData(firestoreSlots, summaryStats);
      setData(combined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalSlotsGiven = data.reduce((sum, item) => sum + item.slotsGiven, 0);
  const totalSlotsAllocated = data.reduce((sum, item) => sum + item.slotsAllocated, 0);
  const totalSlotsTaken = data.reduce((sum, item) => sum + item.slotsTaken, 0);
  const totalAbsentees = data.reduce((sum, item) => sum + item.absentees, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Presentation Slots Overview</h2>
          <p className="text-muted-foreground">Statistics on slot allocation and attendance</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="pt-6 flex gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900 dark:text-red-100">Error loading data</p>
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Total Slots Given</p>
              <p className="text-3xl font-bold mt-2">{totalSlotsGiven}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Total Slots Allocated</p>
              <p className="text-3xl font-bold mt-2">{totalSlotsAllocated}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Total Slots Taken</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                {totalSlotsTaken}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Total Absentees</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                {totalAbsentees}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Instructor Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading data...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-semibold py-3 px-2">Instructor</th>
                    <th className="text-center font-semibold py-3 px-2">Slots Given</th>
                    <th className="text-center font-semibold py-3 px-2">Slots Allocated</th>
                    <th className="text-center font-semibold py-3 px-2">Slots Taken</th>
                    <th className="text-center font-semibold py-3 px-2">Absentees</th>
                    <th className="text-center font-semibold py-3 px-2">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, idx) => {
                    const utilization =
                      item.slotsGiven > 0
                        ? Math.round((item.slotsAllocated / item.slotsGiven) * 100)
                        : 0;
                    const absenceRate =
                      item.slotsAllocated > 0
                        ? Math.round((item.absentees / item.slotsAllocated) * 100)
                        : 0;

                    return (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">{item.instructorName}</td>
                        <td className="py-3 px-2 text-center">{item.slotsGiven}</td>
                        <td className="py-3 px-2 text-center">{item.slotsAllocated}</td>
                        <td className="py-3 px-2 text-center">
                          <Badge variant="default">{item.slotsTaken}</Badge>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Badge
                            variant={item.absentees > 0 ? 'destructive' : 'secondary'}
                          >
                            {item.absentees} ({absenceRate}%)
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  utilization >= 80
                                    ? 'bg-green-500'
                                    : utilization >= 50
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold w-12">{utilization}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PresentationSlotsOverview;

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { getReportsData, ReportsDataResponse } from '@/lib/toolsService';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ReportsManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportsDataResponse | null>(null);

  const loadReports = async () => {
    setLoading(true);
    try {
      const reports = await getReportsData();
      setData(reports);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reports data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const renderRegistrationTable = () => {
    if (!data?.registration) return null;

    const { domains, plans, table } = data.registration;

    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Registration Data</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-xs h-8">Domain</TableHead>
                  {plans.map((plan) => (
                    <TableHead key={plan} className="text-center font-semibold text-xs h-8">
                      {plan}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-semibold text-xs h-8">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-xs">{row.domain}</TableCell>
                    {plans.map((plan) => (
                      <TableCell key={plan} className="text-center text-xs">
                        {row[plan] as number}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-semibold text-xs">
                      {row.grandTotal as number}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLevelTable = (levelData: { level: string; table: Array<{ status: string; count: number }>; total: number }) => {
    if (!levelData) return null;

    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{levelData.level}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-xs h-8">Status</TableHead>
                  <TableHead className="text-center font-semibold text-xs h-8">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levelData.table.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-xs">{row.status}</TableCell>
                    <TableCell className="text-center text-xs">{row.count}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-semibold text-xs">Total</TableCell>
                  <TableCell className="text-center font-semibold text-xs">{levelData.total}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTerminationTable = () => {
    if (!data?.termination) return null;

    const { domainNotFilled, level1Termination, total } = data.termination;

    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Termination Mails</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold text-xs h-8">Category</TableHead>
                <TableHead className="text-center font-semibold text-xs h-8">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-xs">Domain Not Filled</TableCell>
                <TableCell className="text-center text-xs">{domainNotFilled}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-xs">Level 1 Termination</TableCell>
                <TableCell className="text-center text-xs">{level1Termination}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold text-xs">Total</TableCell>
                <TableCell className="text-center font-semibold text-xs">{total}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm">Real-time training batch status reports</p>
        </div>
        <Button onClick={loadReports} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {renderRegistrationTable()}
        {renderLevelTable(data?.level1)}
        {renderLevelTable(data?.level2)}
        {renderLevelTable(data?.level3)}
        {renderTerminationTable()}
      </div>
    </div>
  );
};

export default ReportsManagement;

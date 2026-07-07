import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarClock, AlertCircle, Clock } from 'lucide-react';
import { checkStudentSlot } from '@/lib/behavioralService';

const SlotBookings = () => {
  const [email, setEmail] = useState('');
  const [assessmentType, setAssessmentType] = useState('behavioral');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slotInfo, setSlotInfo] = useState<any>(null);
  const [error, setError] = useState('');

  const handleCheckSlot = async () => {
    if (!email) {
      setError('Please enter your email ID');
      return;
    }

    setLoading(true);
    setError('');
    setSlotInfo(null);

    try {
      const data = await checkStudentSlot(email, assessmentType);

      if (!data.found) {
        setError(data.message || 'No slot found for this email');
        return;
      }

      setSlotInfo(data);
    } catch (err: any) {
      setError(err.message || 'Failed to check slot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEmail('');
    setError('');
    setSlotInfo(null);
  };

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="text-center space-y-2 pb-4 border-b">
          <h1 className="text-2xl font-bold sm:text-3xl">Slot Bookings</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Check your scheduled assessment slot time
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          <Alert className="border-l-4 border-l-orange-600 bg-orange-50/50 shadow-sm">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <AlertDescription className="text-orange-900 text-sm leading-relaxed">
              <div className="space-y-1">
                <p className="font-semibold text-base">Important Instructions</p>
                <p className="text-orange-800">
                  Everyone who have a behavioural assessment session scheduled, please join only at your booked slot time. Do not join too early or too late.
                </p>
                <p className="text-orange-800 font-medium">
                  Please note: Joining outside your scheduled time is not permitted. If evaluators report early logins, the slot will be cancelled and marked as absent.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex justify-center">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <CalendarClock className="h-5 w-5" />
                  Check Your Slot
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Check Your Assessment Slot</DialogTitle>
                  <DialogDescription>
                    Enter your email ID to find your scheduled slot
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email ID</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@study.iitm.ac.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assessment-type">Assessment Type</Label>
                    <Select
                      value={assessmentType}
                      onValueChange={setAssessmentType}
                      disabled={loading}
                    >
                      <SelectTrigger id="assessment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="behavioral">Behavioral Assessment</SelectItem>
                        <SelectItem value="presentation" disabled>Presentation Assessment (Coming Soon)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  {slotInfo && (
                    <Alert className="border-l-4 border-l-green-600 bg-green-50/50">
                      <Clock className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-900">
                        <div className="space-y-2">
                          <p className="font-semibold">Your Scheduled Slot:</p>
                          <p className="text-lg font-bold">{slotInfo.slot}</p>
                          <p className="text-sm">Instructor: {slotInfo.instructor}</p>
                          <p className="text-sm">Name: {slotInfo.name}</p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button
                    onClick={handleCheckSlot}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Checking...' : 'Check Slot'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SlotBookings;

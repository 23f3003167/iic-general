import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarClock, AlertCircle, Clock, CheckCircle2, Info } from 'lucide-react';
import {
  bookBehavioralSlot,
  checkStudentSlot as checkBehavioralSlot,
  getBehavioralBookableSlots,
  type BehavioralBookableSlot,
  type BehavioralStudentVerification,
  verifyBehavioralStudent
} from '@/lib/behavioralService';
import { checkStudentSlot as checkPresentationSlot } from '@/lib/presentationService';

const SlotBookings = () => {
  const [email, setEmail] = useState('');
  const [assessmentType, setAssessmentType] = useState('behavioral');
  const [isOpen, setIsOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slotInfo, setSlotInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verification, setVerification] = useState<BehavioralStudentVerification | null>(null);
  const [availableSlots, setAvailableSlots] = useState<BehavioralBookableSlot[]>([]);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingName, setBookingName] = useState('');
  const [bookingContact, setBookingContact] = useState('');
  const [bookingSlot, setBookingSlot] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);
  const currentTimestamp = useMemo(
    () => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }),
    [bookingDialogOpen]
  );

  const makeBookingId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `booking_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  };

  const handleCheckSlot = async () => {
    if (!email) {
      setError('Please enter your email ID');
      return;
    }

    setLoading(true);
    setError('');
    setSlotInfo(null);

    try {
      let data;
      if (assessmentType === 'behavioral') {
        data = await checkBehavioralSlot(email, assessmentType);
      } else if (assessmentType === 'presentation') {
        data = await checkPresentationSlot(email, assessmentType);
      } else {
        throw new Error('Invalid assessment type');
      }

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

  const handleVerifyForBooking = async () => {
    const normalizedEmail = verifyEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setVerifyError('Please enter your email ID');
      return;
    }

    setVerifyLoading(true);
    setVerifyError('');
    setVerification(null);
    setAvailableSlots([]);
    setBookingSuccess(null);

    try {
      const verifyResult = await verifyBehavioralStudent(normalizedEmail);
      setVerification(verifyResult);

      if (!verifyResult.verified) {
        setVerifyError('This email is not authorized for behavioral slot booking.');
        return;
      }

      if (verifyResult.alreadyBooked && verifyResult.booking) {
        return;
      }

      const slotsResult = await getBehavioralBookableSlots(normalizedEmail);
      setAvailableSlots(slotsResult.slots || []);

      if (!slotsResult.slots || slotsResult.slots.length === 0) {
        setVerifyError('No slots are currently available.');
        return;
      }

      setBookingName('');
      setBookingContact('');
      setBookingSlot('');
      setBookingDialogOpen(true);
    } catch (err: any) {
      setVerifyError(err.message || 'Could not verify email.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleBookSlot = async () => {
    const bookingEmail = verification?.email || verifyEmail.trim().toLowerCase();
    if (!bookingEmail || !bookingName.trim() || !bookingContact.trim() || !bookingSlot) {
      setVerifyError('Fill all booking fields before confirming.');
      return;
    }

    setBookingLoading(true);
    setVerifyError('');

    try {
      const result = await bookBehavioralSlot({
        bookingId: makeBookingId(),
        name: bookingName.trim(),
        email: bookingEmail,
        contact: bookingContact.trim(),
        slot: bookingSlot,
      });

      setBookingSuccess(result);
      setBookingDialogOpen(false);
      setVerification({
        verified: true,
        email: result.email,
        alreadyBooked: true,
        booking: {
          timestamp: result.timestamp,
          name: result.name,
          email: result.email,
          contact: result.contact,
          slot: result.slot,
          status: result.status,
        },
      });
      setAvailableSlots([]);
    } catch (err: any) {
      setVerifyError(err.message || 'Booking failed. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="flex justify-between items-center pb-4 border-b gap-4">
          <div className="text-left space-y-2">
            <h1 className="text-2xl font-bold sm:text-3xl">Slot Bookings</h1>
            <p className="text-muted-foreground max-w-2xl">
              Check your scheduled assessment slot time
            </p>
          </div>
          <div className="flex gap-2 items-center whitespace-nowrap">
            <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="gap-2">
                  <Info className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Important Instructions</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-orange-900 mb-2">Behavioral Assessment</h3>
                      <p className="text-sm text-orange-800 mb-2">
                        Everyone who have a behavioural assessment session scheduled, please join only at your booked slot time. Do not join too early or too late.
                      </p>
                      <p className="text-sm text-orange-800 font-medium">
                        Please note: Joining outside your scheduled time is not permitted. If evaluators report early logins, the slot will be cancelled and marked as absent.
                      </p>
                    </div>
                    <div className="border-t pt-3">
                      <h3 className="font-semibold text-blue-900 mb-2">Presentation Assessment</h3>
                      <p className="text-sm text-blue-800 mb-2">
                        Everyone who have a presentation assessment session scheduled, please join only at your booked slot time. Do not join too early or too late.
                      </p>
                      <p className="text-sm text-blue-800 font-medium">
                        Please note: Joining outside your scheduled time is not permitted. If evaluators report early logins, the slot will be cancelled and marked as absent.
                      </p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
                        <SelectItem value="presentation">Presentation Assessment</SelectItem>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Book Behavioral Slot</CardTitle>
              <CardDescription>
                Verify your IITM email first. If verified, you can book an available slot directly from the portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-email">Email ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="verify-email"
                    type="email"
                    placeholder="your.email@study.iitm.ac.in"
                    value={verifyEmail}
                    onChange={(e) => setVerifyEmail(e.target.value)}
                    disabled={verifyLoading}
                  />
                  <Button onClick={handleVerifyForBooking} disabled={verifyLoading}>
                    {verifyLoading ? 'Verifying...' : 'Verify & Continue'}
                  </Button>
                </div>
              </div>

              {verifyError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{verifyError}</AlertDescription>
                </Alert>
              ) : null}

              {verification?.alreadyBooked && verification.booking ? (
                <Alert className="border-l-4 border-l-green-600 bg-green-50/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 text-sm">
                    <p className="font-semibold">You already have a booked behavioral slot.</p>
                    <p className="text-xs mt-1">Name: {verification.booking.name}</p>
                    <p className="text-xs">Email: {verification.booking.email}</p>
                    <p className="text-xs">Contact: {verification.booking.contact}</p>
                    <p className="text-xs">Slot: {verification.booking.slot}</p>
                    <p className="text-xs">Timestamp: {verification.booking.timestamp}</p>
                  </AlertDescription>
                </Alert>
              ) : null}

              {bookingSuccess ? (
                <Alert className="border-l-4 border-l-green-600 bg-green-50/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 text-sm">
                    <p className="font-semibold">Slot booked successfully.</p>
                    <p className="text-xs mt-1">Name: {bookingSuccess.name}</p>
                    <p className="text-xs">Email: {bookingSuccess.email}</p>
                    <p className="text-xs">Contact: {bookingSuccess.contact}</p>
                    <p className="text-xs">Slot: {bookingSuccess.slot}</p>
                    <p className="text-xs">Timestamp: {bookingSuccess.timestamp}</p>
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Book Presentation Slot</CardTitle>
              <CardDescription>
                Verify your IITM email first. If verified, you can book an available slot directly from the portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="presentation-verify-email">Email ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="presentation-verify-email"
                    type="email"
                    placeholder="your.email@study.iitm.ac.in"
                    value={verifyEmail}
                    onChange={(e) => setVerifyEmail(e.target.value)}
                    disabled={verifyLoading}
                  />
                  <Button onClick={handleVerifyForBooking} disabled={verifyLoading}>
                    {verifyLoading ? 'Verifying...' : 'Verify & Continue'}
                  </Button>
                </div>
              </div>

              {verifyError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{verifyError}</AlertDescription>
                </Alert>
              ) : null}

              {verification?.alreadyBooked && verification.booking ? (
                <Alert className="border-l-4 border-l-green-600 bg-green-50/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 text-sm">
                    <p className="font-semibold">You already have a booked presentation slot.</p>
                    <p className="text-xs mt-1">Name: {verification.booking.name}</p>
                    <p className="text-xs">Email: {verification.booking.email}</p>
                    <p className="text-xs">Contact: {verification.booking.contact}</p>
                    <p className="text-xs">Slot: {verification.booking.slot}</p>
                    <p className="text-xs">Timestamp: {verification.booking.timestamp}</p>
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Confirm Behavioral Slot Booking</DialogTitle>
              <DialogDescription>
                Fill the details below to book your slot. Booking is confirmed only after successful server response.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Timestamp (IST)</Label>
                <Input value={currentTimestamp} readOnly />
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={bookingName}
                  onChange={(e) => setBookingName(e.target.value)}
                  placeholder="Enter your full name"
                  disabled={bookingLoading}
                />
              </div>
              <div className="space-y-1">
                <Label>Email ID</Label>
                <Input value={verification?.email || verifyEmail.trim().toLowerCase()} readOnly />
              </div>
              <div className="space-y-1">
                <Label>Contact</Label>
                <Input
                  value={bookingContact}
                  onChange={(e) => setBookingContact(e.target.value)}
                  placeholder="Enter your contact number"
                  disabled={bookingLoading}
                />
              </div>
              <div className="space-y-1">
                <Label>Slots (Timing in IST)</Label>
                <Select value={bookingSlot} onValueChange={setBookingSlot} disabled={bookingLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an available slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((item) => (
                      <SelectItem key={item.slot} value={item.slot}>
                        {item.slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBookingDialogOpen(false)} disabled={bookingLoading}>
                Cancel
              </Button>
              <Button onClick={handleBookSlot} disabled={bookingLoading}>
                {bookingLoading ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default SlotBookings;

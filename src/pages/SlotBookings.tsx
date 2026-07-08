import { useMemo, useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarClock, AlertCircle, Clock, CheckCircle2, Info, Calendar, Clock3 } from 'lucide-react';
import {
  bookBehavioralSlot,
  checkStudentSlot as checkBehavioralSlot,
  getBehavioralBookableSlots,
  type BehavioralBookableSlot,
  type BehavioralStudentVerification,
  verifyBehavioralStudent
} from '@/lib/behavioralService';
import { checkStudentSlot as checkPresentationSlot } from '@/lib/presentationService';
import { getBookingWindowsFromFirestore } from '@/lib/firestoreService';

const SlotBookings = () => {
  const [email, setEmail] = useState('');
  const [assessmentType, setAssessmentType] = useState('behavioral');
  const [isOpen, setIsOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slotInfo, setSlotInfo] = useState<any>(null);
  const [error, setError] = useState('');
  
  // Behavioral state
  const [behavioralEmail, setBehavioralEmail] = useState('');
  const [behavioralVerifyLoading, setBehavioralVerifyLoading] = useState(false);
  const [behavioralVerifyError, setBehavioralVerifyError] = useState('');
  const [behavioralVerification, setBehavioralVerification] = useState<BehavioralStudentVerification | null>(null);
  const [behavioralAvailableSlots, setBehavioralAvailableSlots] = useState<BehavioralBookableSlot[]>([]);
  const [behavioralBookingDialogOpen, setBehavioralBookingDialogOpen] = useState(false);
  const [behavioralBookingLoading, setBehavioralBookingLoading] = useState(false);
  const [behavioralBookingName, setBehavioralBookingName] = useState('');
  const [behavioralBookingContact, setBehavioralBookingContact] = useState('');
  const [behavioralBookingSlot, setBehavioralBookingSlot] = useState('');
  const [behavioralBookingSuccess, setBehavioralBookingSuccess] = useState<any>(null);
  
  // Presentation state
  const [presentationEmail, setPresentationEmail] = useState('');
  const [presentationVerifyLoading, setPresentationVerifyLoading] = useState(false);
  const [presentationVerifyError, setPresentationVerifyError] = useState('');
  const [presentationVerification, setPresentationVerification] = useState<BehavioralStudentVerification | null>(null);
  const [presentationAvailableSlots, setPresentationAvailableSlots] = useState<BehavioralBookableSlot[]>([]);
  const [presentationBookingDialogOpen, setPresentationBookingDialogOpen] = useState(false);
  const [presentationBookingLoading, setPresentationBookingLoading] = useState(false);
  const [presentationBookingName, setPresentationBookingName] = useState('');
  const [presentationBookingContact, setPresentationBookingContact] = useState('');
  const [presentationBookingSlot, setPresentationBookingSlot] = useState('');
  const [presentationBookingSuccess, setPresentationBookingSuccess] = useState<any>(null);
  
  // Booking window state
  const [behavioralBookingWindow, setBehavioralBookingWindow] = useState<any>(null);
  const [presentationBookingWindow, setPresentationBookingWindow] = useState<any>(null);
  const [bookingWindowsLoading, setBookingWindowsLoading] = useState(true);
  const currentTimestamp = useMemo(
    () => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }),
    [behavioralBookingDialogOpen, presentationBookingDialogOpen]
  );

  useEffect(() => {
    const fetchBookingWindows = async () => {
      try {
        setBookingWindowsLoading(true);
        const windows = await getBookingWindowsFromFirestore();
        const behavioral = windows.find((w: any) => w.type === 'behavioral');
        const presentation = windows.find((w: any) => w.type === 'presentation');
        setBehavioralBookingWindow(behavioral || null);
        setPresentationBookingWindow(presentation || null);
      } catch (err) {
        console.error('Error fetching booking windows:', err);
      } finally {
        setBookingWindowsLoading(false);
      }
    };
    
    fetchBookingWindows();
  }, []);

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

  const handleVerifyForBehavioralBooking = async () => {
    const normalizedEmail = behavioralEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setBehavioralVerifyError('Please enter your email ID');
      return;
    }

    setBehavioralVerifyLoading(true);
    setBehavioralVerifyError('');
    setBehavioralVerification(null);
    setBehavioralAvailableSlots([]);
    setBehavioralBookingSuccess(null);

    try {
      const verifyResult = await verifyBehavioralStudent(normalizedEmail);
      setBehavioralVerification(verifyResult);

      if (!verifyResult.verified) {
        setBehavioralVerifyError('This email is not authorized for behavioral slot booking.');
        return;
      }

      if (verifyResult.alreadyBooked && verifyResult.booking) {
        return;
      }

      const slotsResult = await getBehavioralBookableSlots(normalizedEmail);
      setBehavioralAvailableSlots(slotsResult.slots || []);

      if (!slotsResult.slots || slotsResult.slots.length === 0) {
        setBehavioralVerifyError('No slots are currently available.');
        return;
      }

      setBehavioralBookingName('');
      setBehavioralBookingContact('');
      setBehavioralBookingSlot('');
      setBehavioralBookingDialogOpen(true);
    } catch (err: any) {
      setBehavioralVerifyError(err.message || 'Could not verify email.');
    } finally {
      setBehavioralVerifyLoading(false);
    }
  };

  const handleVerifyForPresentationBooking = async () => {
    const normalizedEmail = presentationEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setPresentationVerifyError('Please enter your email ID');
      return;
    }

    setPresentationVerifyLoading(true);
    setPresentationVerifyError('');
    setPresentationVerification(null);
    setPresentationAvailableSlots([]);
    setPresentationBookingSuccess(null);

    try {
      const verifyResult = await verifyBehavioralStudent(normalizedEmail);
      setPresentationVerification(verifyResult);

      if (!verifyResult.verified) {
        setPresentationVerifyError('This email is not authorized for presentation slot booking.');
        return;
      }

      if (verifyResult.alreadyBooked && verifyResult.booking) {
        return;
      }

      const slotsResult = await getBehavioralBookableSlots(normalizedEmail);
      setPresentationAvailableSlots(slotsResult.slots || []);

      if (!slotsResult.slots || slotsResult.slots.length === 0) {
        setPresentationVerifyError('No slots are currently available.');
        return;
      }

      setPresentationBookingName('');
      setPresentationBookingContact('');
      setPresentationBookingSlot('');
      setPresentationBookingDialogOpen(true);
    } catch (err: any) {
      setPresentationVerifyError(err.message || 'Could not verify email.');
    } finally {
      setPresentationVerifyLoading(false);
    }
  };

  const handleBookBehavioralSlot = async () => {
    const bookingEmail = behavioralVerification?.email || behavioralEmail.trim().toLowerCase();
    if (!bookingEmail || !behavioralBookingName.trim() || !behavioralBookingContact.trim() || !behavioralBookingSlot) {
      setBehavioralVerifyError('Fill all booking fields before confirming.');
      return;
    }

    setBehavioralBookingLoading(true);
    setBehavioralVerifyError('');

    try {
      const result = await bookBehavioralSlot({
        bookingId: makeBookingId(),
        name: behavioralBookingName.trim(),
        email: bookingEmail,
        contact: behavioralBookingContact.trim(),
        slot: behavioralBookingSlot,
      });

      setBehavioralBookingSuccess(result);
      setBehavioralBookingDialogOpen(false);
      setBehavioralVerification({
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
      setBehavioralAvailableSlots([]);
    } catch (err: any) {
      setBehavioralVerifyError(err.message || 'Booking failed. Please try again.');
    } finally {
      setBehavioralBookingLoading(false);
    }
  };

  const handleBookPresentationSlot = async () => {
    const bookingEmail = presentationVerification?.email || presentationEmail.trim().toLowerCase();
    if (!bookingEmail || !presentationBookingName.trim() || !presentationBookingContact.trim() || !presentationBookingSlot) {
      setPresentationVerifyError('Fill all booking fields before confirming.');
      return;
    }

    setPresentationBookingLoading(true);
    setPresentationVerifyError('');

    try {
      const result = await bookBehavioralSlot({
        bookingId: makeBookingId(),
        name: presentationBookingName.trim(),
        email: bookingEmail,
        contact: presentationBookingContact.trim(),
        slot: presentationBookingSlot,
      });

      setPresentationBookingSuccess(result);
      setPresentationBookingDialogOpen(false);
      setPresentationVerification({
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
      setPresentationAvailableSlots([]);
    } catch (err: any) {
      setPresentationVerifyError(err.message || 'Booking failed. Please try again.');
    } finally {
      setPresentationBookingLoading(false);
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
                <Label htmlFor="behavioral-verify-email">Email ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="behavioral-verify-email"
                    type="email"
                    placeholder="your.email@study.iitm.ac.in"
                    value={behavioralEmail}
                    onChange={(e) => setBehavioralEmail(e.target.value)}
                    disabled={behavioralVerifyLoading}
                  />
                  <Button onClick={handleVerifyForBehavioralBooking} disabled={behavioralVerifyLoading}>
                    {behavioralVerifyLoading ? 'Verifying...' : 'Verify & Continue'}
                  </Button>
                </div>
              </div>

              {behavioralVerifyError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{behavioralVerifyError}</AlertDescription>
                </Alert>
              ) : null}

              {behavioralVerification?.alreadyBooked && behavioralVerification.booking ? (
                <Alert className="border-l-4 border-l-green-600 bg-green-50/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 text-sm">
                    <p className="font-semibold">You already have a booked behavioral slot.</p>
                    <p className="text-xs mt-1">Name: {behavioralVerification.booking.name}</p>
                    <p className="text-xs">Email: {behavioralVerification.booking.email}</p>
                    <p className="text-xs">Contact: {behavioralVerification.booking.contact}</p>
                    <p className="text-xs">Slot: {behavioralVerification.booking.slot}</p>
                    <p className="text-xs">Timestamp: {behavioralVerification.booking.timestamp}</p>
                  </AlertDescription>
                </Alert>
              ) : null}

              {behavioralBookingSuccess ? (
                <Alert className="border-l-4 border-l-green-600 bg-green-50/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 text-sm">
                    <p className="font-semibold">Slot booked successfully.</p>
                    <p className="text-xs mt-1">Name: {behavioralBookingSuccess.name}</p>
                    <p className="text-xs">Email: {behavioralBookingSuccess.email}</p>
                    <p className="text-xs">Contact: {behavioralBookingSuccess.contact}</p>
                    <p className="text-xs">Slot: {behavioralBookingSuccess.slot}</p>
                    <p className="text-xs">Timestamp: {behavioralBookingSuccess.timestamp}</p>
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
                    value={presentationEmail}
                    onChange={(e) => setPresentationEmail(e.target.value)}
                    disabled={presentationVerifyLoading}
                  />
                  <Button onClick={handleVerifyForPresentationBooking} disabled={presentationVerifyLoading}>
                    {presentationVerifyLoading ? 'Verifying...' : 'Verify & Continue'}
                  </Button>
                </div>
              </div>

              {presentationVerifyError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{presentationVerifyError}</AlertDescription>
                </Alert>
              ) : null}

              {presentationVerification?.alreadyBooked && presentationVerification.booking ? (
                <Alert className="border-l-4 border-l-green-600 bg-green-50/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 text-sm">
                    <p className="font-semibold">You already have a booked presentation slot.</p>
                    <p className="text-xs mt-1">Name: {presentationVerification.booking.name}</p>
                    <p className="text-xs">Email: {presentationVerification.booking.email}</p>
                    <p className="text-xs">Contact: {presentationVerification.booking.contact}</p>
                    <p className="text-xs">Slot: {presentationVerification.booking.slot}</p>
                    <p className="text-xs">Timestamp: {presentationVerification.booking.timestamp}</p>
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Dialog open={behavioralBookingDialogOpen} onOpenChange={setBehavioralBookingDialogOpen}>
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
                  value={behavioralBookingName}
                  onChange={(e) => setBehavioralBookingName(e.target.value)}
                  placeholder="Enter your full name"
                  disabled={behavioralBookingLoading}
                />
              </div>
              <div className="space-y-1">
                <Label>Email ID</Label>
                <Input value={behavioralVerification?.email || behavioralEmail.trim().toLowerCase()} readOnly />
              </div>
              <div className="space-y-1">
                <Label>Contact</Label>
                <Input
                  value={behavioralBookingContact}
                  onChange={(e) => setBehavioralBookingContact(e.target.value)}
                  placeholder="Enter your contact number"
                  disabled={behavioralBookingLoading}
                />
              </div>
              <div className="space-y-1">
                <Label>Slots (Timing in IST)</Label>
                <Select value={behavioralBookingSlot} onValueChange={setBehavioralBookingSlot} disabled={behavioralBookingLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an available slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {behavioralAvailableSlots.map((item) => (
                      <SelectItem key={item.slot} value={item.slot}>
                        {item.slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBehavioralBookingDialogOpen(false)} disabled={behavioralBookingLoading}>
                Cancel
              </Button>
              <Button onClick={handleBookBehavioralSlot} disabled={behavioralBookingLoading}>
                {behavioralBookingLoading ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={presentationBookingDialogOpen} onOpenChange={setPresentationBookingDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Confirm Presentation Slot Booking</DialogTitle>
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
                  value={presentationBookingName}
                  onChange={(e) => setPresentationBookingName(e.target.value)}
                  placeholder="Enter your full name"
                  disabled={presentationBookingLoading}
                />
              </div>
              <div className="space-y-1">
                <Label>Email ID</Label>
                <Input value={presentationVerification?.email || presentationEmail.trim().toLowerCase()} readOnly />
              </div>
              <div className="space-y-1">
                <Label>Contact</Label>
                <Input
                  value={presentationBookingContact}
                  onChange={(e) => setPresentationBookingContact(e.target.value)}
                  placeholder="Enter your contact number"
                  disabled={presentationBookingLoading}
                />
              </div>
              <div className="space-y-1">
                <Label>Slots (Timing in IST)</Label>
                <Select value={presentationBookingSlot} onValueChange={setPresentationBookingSlot} disabled={presentationBookingLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an available slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {presentationAvailableSlots.map((item) => (
                      <SelectItem key={item.slot} value={item.slot}>
                        {item.slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPresentationBookingDialogOpen(false)} disabled={presentationBookingLoading}>
                Cancel
              </Button>
              <Button onClick={handleBookPresentationSlot} disabled={presentationBookingLoading}>
                {presentationBookingLoading ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default SlotBookings;

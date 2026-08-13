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
import { checkStudentSlot as checkPresentationSlot, bookPresentationSlot, getPresentationBookableSlots } from '@/lib/presentationService';
import { 
  checkStudentSlot as checkOneOnOneSlot,
  getOneOnOneBookableSlots,
  bookOneOnOneSlot,
  type OneOnOneBookableSlot,
  type OneOnOneBookSlotRequest
} from '@/lib/oneOnOneService';
import { getBookingWindowsFromFirestore, isBookingWindowOpen } from '@/lib/firestoreService';
import { 
  getStoredVerifiedEmail,
  getStoredStudentDomain, 
  getStoredStudentPlan,
  storeStudentDomain,
  storeStudentPlan
} from '@/lib/emailVerificationService';

const SlotBookings = () => {
  const [assessmentType, setAssessmentType] = useState('behavioral');
  const [isOpen, setIsOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slotInfo, setSlotInfo] = useState<any>(null);
  const [error, setError] = useState('');
  
  // Behavioral state
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
  
  // 1on1 state
  const [oneOnOneDomain, setOneOnOneDomain] = useState('');
  const [oneOnOnePlan, setOneOnOnePlan] = useState('');
  const [oneOnOneVerifyLoading, setOneOnOneVerifyLoading] = useState(false);
  const [oneOnOneVerifyError, setOneOnOneVerifyError] = useState('');
  const [oneOnOneVerification, setOneOnOneVerification] = useState<any>(null);
  const [oneOnOneAvailableSlots, setOneOnOneAvailableSlots] = useState<OneOnOneBookableSlot[]>([]);
  const [oneOnOneBookingDialogOpen, setOneOnOneBookingDialogOpen] = useState(false);
  const [oneOnOneBookingLoading, setOneOnOneBookingLoading] = useState(false);
  const [oneOnOneBookingName, setOneOnOneBookingName] = useState('');
  const [oneOnOneBookingContact, setOneOnOneBookingContact] = useState('');
  const [oneOnOneBookingSlot, setOneOnOneBookingSlot] = useState('');
  const [oneOnOneBookingSuccess, setOneOnOneBookingSuccess] = useState<any>(null);
  const [oneOnOneResumeDriveLink, setOneOnOneResumeDriveLink] = useState('');
  const [oneOnOneProgressCardDriveLink, setOneOnOneProgressCardDriveLink] = useState('');
  
  // Booking window state
  const [behavioralBookingWindow, setBehavioralBookingWindow] = useState<any>(null);
  const [presentationBookingWindow, setPresentationBookingWindow] = useState<any>(null);
  const [oneOnOneBookingWindow, setOneOnOneBookingWindow] = useState<any>(null);
  const [bookingWindowsLoading, setBookingWindowsLoading] = useState(true);
  const [bookingWindowOpen, setBookingWindowOpen] = useState({
    behavioral: false,
    presentation: false,
    oneOnOne: false,
  });
  const verifiedEmail = getStoredVerifiedEmail()?.trim().toLowerCase() || '';
  const currentTimestamp = useMemo(
    () => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }),
    [behavioralBookingDialogOpen, presentationBookingDialogOpen, oneOnOneBookingDialogOpen]
  );

  useEffect(() => {
    const fetchBookingWindows = async () => {
      try {
        setBookingWindowsLoading(true);
        const windows = await getBookingWindowsFromFirestore();
        const behavioral = windows.find((w: any) => w.type === 'behavioral');
        const presentation = windows.find((w: any) => w.type === 'presentation');
        const oneOnOne = windows.find((w: any) => w.type === 'oneOnOne');
        setBehavioralBookingWindow(behavioral || null);
        setPresentationBookingWindow(presentation || null);
        setOneOnOneBookingWindow(oneOnOne || null);
        const [behavioralStatus, presentationStatus, oneOnOneStatus] = await Promise.all([
          isBookingWindowOpen('behavioral'),
          isBookingWindowOpen('presentation'),
          isBookingWindowOpen('oneOnOne'),
        ]);
        setBookingWindowOpen({
          behavioral: behavioralStatus.open,
          presentation: presentationStatus.open,
          oneOnOne: oneOnOneStatus.open,
        });
      } catch (err) {
        console.error('Error fetching booking windows:', err);
      } finally {
        setBookingWindowsLoading(false);
      }
    };
    
    fetchBookingWindows();
    const intervalId = window.setInterval(fetchBookingWindows, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const makeBookingId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `booking_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  };

  const handleCheckSlot = async () => {
    if (!verifiedEmail) {
      setError('Please verify your email by signing in before checking a slot.');
      return;
    }

    setLoading(true);
    setError('');
    setSlotInfo(null);

    try {
      let data;
      if (assessmentType === 'behavioral') {
        data = await checkBehavioralSlot(verifiedEmail, assessmentType);
      } else if (assessmentType === 'presentation') {
        data = await checkPresentationSlot(verifiedEmail, assessmentType);
      } else if (assessmentType === 'oneOnOne') {
        data = await checkOneOnOneSlot(verifiedEmail, assessmentType);
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
    setError('');
    setSlotInfo(null);
  };

  const handleVerifyForBehavioralBooking = async () => {
    const normalizedEmail = verifiedEmail;
    if (!normalizedEmail) {
      setBehavioralVerifyError('Please verify your email by signing in before booking a slot.');
      return;
    }

    setBehavioralVerifyLoading(true);
    setBehavioralVerifyError('');
    setBehavioralVerification(null);
    setBehavioralAvailableSlots([]);
    setBehavioralBookingSuccess(null);
    console.log('Starting behavioral verification with email:', normalizedEmail);

    try {
      // First check if booking window is open from Firestore
      const bookingWindowCheck = await isBookingWindowOpen('behavioral');
      console.log('Behavioral booking window check result:', bookingWindowCheck);
      if (!bookingWindowCheck.open) {
        console.log('Booking window is closed, setting error');
        setBehavioralVerifyError('Slot booking window is currently closed');
        return;
      }

      console.log('Booking window is open, calling verifyBehavioralStudent');
      const verifyResult = await verifyBehavioralStudent(normalizedEmail);
      console.log('Behavioral verify result:', verifyResult);
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
        setBehavioralVerifyError(slotsResult.message || 'No slots are available right now. Please try again later.');
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
    const normalizedEmail = verifiedEmail;
    if (!normalizedEmail) {
      setPresentationVerifyError('Please verify your email by signing in before booking a slot.');
      return;
    }

    setPresentationVerifyLoading(true);
    setPresentationVerifyError('');
    setPresentationVerification(null);
    setPresentationAvailableSlots([]);
    setPresentationBookingSuccess(null);

    try {
      // First check if booking window is open from Firestore
      const bookingWindowCheck = await isBookingWindowOpen('presentation');
      if (!bookingWindowCheck.open) {
        setPresentationVerifyError('Slot booking window is currently closed');
        return;
      }

      // Use presentation Apps Script to get bookable slots
      const slotsResult = await getPresentationBookableSlots(normalizedEmail);
      
      if (!slotsResult.verified) {
        setPresentationVerifyError('This email is not authorized for presentation slot booking.');
        return;
      }

      if (slotsResult.slots && slotsResult.slots.length === 0) {
        setPresentationVerification({
          verified: true,
          email: normalizedEmail,
          alreadyBooked: true,
          booking: null
        });
        return;
      }

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
    const bookingEmail = behavioralVerification?.email || verifiedEmail;
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
    const bookingEmail = presentationVerification?.email || verifiedEmail;
    if (!bookingEmail || !presentationBookingName.trim() || !presentationBookingContact.trim() || !presentationBookingSlot) {
      setPresentationVerifyError('Fill all booking fields before confirming.');
      return;
    }

    setPresentationBookingLoading(true);
    setPresentationVerifyError('');

    try {
      const result = await bookPresentationSlot({
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

  const handleVerifyForOneOnOneBooking = async () => {
    const normalizedEmail = verifiedEmail;
    if (!normalizedEmail) {
      setOneOnOneVerifyError('Please verify your email by signing in before booking a slot.');
      return;
    }
    if (!oneOnOneDomain) {
      setOneOnOneVerifyError('Please select your domain');
      return;
    }
    if (!oneOnOnePlan) {
      setOneOnOneVerifyError('Please select your plan');
      return;
    }

    setOneOnOneVerifyLoading(true);
    setOneOnOneVerifyError('');
    setOneOnOneVerification(null);
    setOneOnOneAvailableSlots([]);
    setOneOnOneBookingSuccess(null);

    try {
      const bookingWindowCheck = await isBookingWindowOpen('oneOnOne');
      if (!bookingWindowCheck.open) {
        setOneOnOneVerifyError('Booking window is currently closed.');
        return;
      }

      // Store domain and plan in local storage
      storeStudentDomain(oneOnOneDomain);
      storeStudentPlan(oneOnOnePlan);

      const slotsResult = await getOneOnOneBookableSlots(normalizedEmail, oneOnOneDomain, oneOnOnePlan);
      
      if (!slotsResult.verified) {
        setOneOnOneVerifyError('This email is not authorized for 1on1 slot booking.');
        return;
      }

      if (slotsResult.alreadyBooked && slotsResult.booking) {
        setOneOnOneVerification({
          verified: true,
          email: normalizedEmail,
          domain: oneOnOneDomain,
          plan: oneOnOnePlan,
          alreadyBooked: true,
          booking: slotsResult.booking
        });
        return;
      }

      setOneOnOneAvailableSlots(slotsResult.slots || []);

      if (!slotsResult.slots || slotsResult.slots.length === 0) {
        setOneOnOneVerifyError('No slots are currently available for your domain.');
        return;
      }

      setOneOnOneBookingName('');
      setOneOnOneBookingContact('');
      setOneOnOneBookingSlot('');
      setOneOnOneBookingDialogOpen(true);
    } catch (err: any) {
      setOneOnOneVerifyError(err.message || 'Could not verify email.');
    } finally {
      setOneOnOneVerifyLoading(false);
    }
  };

  const handleBookOneOnOneSlot = async () => {
    const bookingEmail = oneOnOneVerification?.email || verifiedEmail;
    const domain = oneOnOneDomain || getStoredStudentDomain() || '';
    const plan = oneOnOnePlan || getStoredStudentPlan() || '';

    if (!bookingEmail || !oneOnOneBookingName.trim() || !oneOnOneBookingContact.trim() || !oneOnOneBookingSlot || !domain || !plan) {
      setOneOnOneVerifyError('Fill all booking fields before confirming.');
      return;
    }

    if (!oneOnOneResumeDriveLink.trim() || !oneOnOneProgressCardDriveLink.trim()) {
      setOneOnOneVerifyError('Please provide both resume and progress card drive links.');
      return;
    }

    setOneOnOneBookingLoading(true);
    setOneOnOneVerifyError('');

    try {
      const result = await bookOneOnOneSlot({
        bookingId: makeBookingId(),
        name: oneOnOneBookingName.trim(),
        email: bookingEmail,
        contact: oneOnOneBookingContact.trim(),
        slot: oneOnOneBookingSlot,
        domain,
        plan,
        resumeDriveLink: oneOnOneResumeDriveLink.trim(),
        progressCardDriveLink: oneOnOneProgressCardDriveLink.trim(),
      });

      setOneOnOneBookingSuccess(result);
      setOneOnOneBookingDialogOpen(false);
      setOneOnOneVerification({
        verified: true,
        email: result.email,
        domain: result.domain,
        plan: result.plan,
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
      setOneOnOneAvailableSlots([]);
    } catch (err: any) {
      setOneOnOneVerifyError(err.message || 'Booking failed. Please try again.');
    } finally {
      setOneOnOneBookingLoading(false);
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
                    Check the scheduled slot for your verified portal email
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Verified Email ID</Label>
                    <Input value={verifiedEmail || 'Sign in to verify your email'} readOnly />
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
                        <SelectItem value="oneOnOne">1on1 Assessment</SelectItem>
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
                Use your verified portal email to book an available slot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bookingWindowsLoading ? (
                <p className="text-sm text-muted-foreground">Checking booking window…</p>
              ) : !bookingWindowOpen.behavioral ? (
                <p className="text-sm text-muted-foreground">Booking window is currently closed.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Using verified email: {verifiedEmail || 'Sign in to continue'}</p>
                  <Button onClick={handleVerifyForBehavioralBooking} disabled={behavioralVerifyLoading}>
                    {behavioralVerifyLoading ? 'Verifying...' : 'Verify & Continue'}
                  </Button>
                </div>
              )}

              {behavioralVerifyError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{behavioralVerifyError}</AlertDescription>
                </Alert>
              ) : null}

              {/* Show behavioral booking window timeline from Firestore if available */}
              {behavioralBookingWindow ? (
                <div className="rounded-md border p-3 bg-muted/10 text-sm">
                  <div className="font-medium">Booking Window (Behavioral)</div>
                  <div>{behavioralBookingWindow.availableDate || '—'}</div>
                  <div>{behavioralBookingWindow.availableStartTime || '—'} to {behavioralBookingWindow.availableEndTime || '—'}</div>
                </div>
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
                Use your verified portal email to book an available slot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bookingWindowsLoading ? (
                <p className="text-sm text-muted-foreground">Checking booking window…</p>
              ) : !bookingWindowOpen.presentation ? (
                <p className="text-sm text-muted-foreground">Booking window is currently closed.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Using verified email: {verifiedEmail || 'Sign in to continue'}</p>
                  <Button onClick={handleVerifyForPresentationBooking} disabled={presentationVerifyLoading}>
                    {presentationVerifyLoading ? 'Verifying...' : 'Verify & Continue'}
                  </Button>
                </div>
              )}

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

              {/* Show presentation booking window timeline from Firestore if available */}
              {presentationBookingWindow ? (
                <div className="rounded-md border p-3 bg-muted/10 text-sm">
                  <div className="font-medium">Booking Window (Presentation)</div>
                  <div>{presentationBookingWindow.availableDate || '—'}</div>
                  <div>{presentationBookingWindow.availableStartTime || '—'} to {presentationBookingWindow.availableEndTime || '—'}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Book 1on1 Slot</CardTitle>
              <CardDescription>
                Use your verified portal email and select your domain and plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bookingWindowsLoading ? (
                <p className="text-sm text-muted-foreground">Checking booking window…</p>
              ) : !bookingWindowOpen.oneOnOne ? (
                <p className="text-sm text-muted-foreground">Booking window is currently closed.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Using verified email: {verifiedEmail || 'Sign in to continue'}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="oneonone-domain">Domain</Label>
                      <Select value={oneOnOneDomain} onValueChange={setOneOnOneDomain} disabled={oneOnOneVerifyLoading}>
                        <SelectTrigger id="oneonone-domain">
                          <SelectValue placeholder="Select domain" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Data Science">Data Science</SelectItem>
                          <SelectItem value="Programming">Programming</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="oneonone-plan">Plan</Label>
                      <Select value={oneOnOnePlan} onValueChange={setOneOnOnePlan} disabled={oneOnOneVerifyLoading}>
                        <SelectTrigger id="oneonone-plan">
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Internship">Internship</SelectItem>
                          <SelectItem value="Employment">Employment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleVerifyForOneOnOneBooking} disabled={oneOnOneVerifyLoading} className="w-full">
                    {oneOnOneVerifyLoading ? 'Verifying...' : 'Verify & Continue'}
                  </Button>
                </>
              )}

              {oneOnOneVerifyError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{oneOnOneVerifyError}</AlertDescription>
                </Alert>
              ) : null}

              {oneOnOneVerification?.alreadyBooked && oneOnOneVerification.booking && !oneOnOneBookingSuccess ? (
                <Alert className="border-l-4 border-l-green-600 bg-green-50/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 text-sm">
                    <p className="font-semibold">You already have a booked 1on1 slot.</p>
                    <p className="text-xs mt-1">Name: {oneOnOneVerification.booking.name}</p>
                    <p className="text-xs">Email: {oneOnOneVerification.booking.email}</p>
                    <p className="text-xs">Contact: {oneOnOneVerification.booking.contact}</p>
                    <p className="text-xs">Slot: {oneOnOneVerification.booking.slot}</p>
                    <p className="text-xs">Timestamp: {oneOnOneVerification.booking.timestamp}</p>
                  </AlertDescription>
                </Alert>
              ) : null}

              {oneOnOneBookingSuccess ? (
                <Alert className="border-l-4 border-l-green-600 bg-green-50/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 text-sm">
                    <p className="font-semibold">Slot booked successfully.</p>
                    <p className="text-xs mt-1">Name: {oneOnOneBookingSuccess.name}</p>
                    <p className="text-xs">Email: {oneOnOneBookingSuccess.email}</p>
                    <p className="text-xs">Contact: {oneOnOneBookingSuccess.contact}</p>
                    <p className="text-xs">Slot: {oneOnOneBookingSuccess.slot}</p>
                    <p className="text-xs">Domain: {oneOnOneBookingSuccess.domain}</p>
                    <p className="text-xs">Plan: {oneOnOneBookingSuccess.plan}</p>
                    <p className="text-xs">Timestamp: {oneOnOneBookingSuccess.timestamp}</p>
                  </AlertDescription>
                </Alert>
              ) : null}

              {/* Show 1on1 booking window timeline from Firestore if available */}
              {oneOnOneBookingWindow ? (
                <div className="rounded-md border p-3 bg-muted/10 text-sm">
                  <div className="font-medium">Booking Window (1on1)</div>
                  <div>{oneOnOneBookingWindow.availableDate || '—'}</div>
                  <div>{oneOnOneBookingWindow.availableStartTime || '—'} to {oneOnOneBookingWindow.availableEndTime || '—'}</div>
                </div>
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
                <Input value={behavioralVerification?.email || verifiedEmail} readOnly />
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
                <Input value={presentationVerification?.email || verifiedEmail} readOnly />
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

        <Dialog open={oneOnOneBookingDialogOpen} onOpenChange={setOneOnOneBookingDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Confirm 1on1 Slot Booking</DialogTitle>
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
                  value={oneOnOneBookingName}
                  onChange={(e) => setOneOnOneBookingName(e.target.value)}
                  placeholder="Enter your full name"
                  disabled={oneOnOneBookingLoading}
                />
              </div>
              <div className="space-y-1">
                <Label>Email ID</Label>
                <Input value={oneOnOneVerification?.email || verifiedEmail} readOnly />
              </div>
              <div className="space-y-1">
                <Label>Contact</Label>
                <Input
                  value={oneOnOneBookingContact}
                  onChange={(e) => setOneOnOneBookingContact(e.target.value)}
                  placeholder="Enter your contact number"
                  disabled={oneOnOneBookingLoading}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Domain</Label>
                  <Input value={oneOnOneDomain || getStoredStudentDomain() || ''} readOnly />
                </div>
                <div className="space-y-1">
                  <Label>Plan</Label>
                  <Input value={oneOnOnePlan || getStoredStudentPlan() || ''} readOnly />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Slots (Timing in IST)</Label>
                <Select value={oneOnOneBookingSlot} onValueChange={setOneOnOneBookingSlot} disabled={oneOnOneBookingLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an available slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {oneOnOneAvailableSlots.map((item) => (
                      <SelectItem key={item.slot} value={item.slot}>
                        {item.slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Resume Drive Link</Label>
                <Input
                  type="url"
                  value={oneOnOneResumeDriveLink}
                  onChange={(e) => setOneOnOneResumeDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  disabled={oneOnOneBookingLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Upload your resume to Google Drive, set sharing to 'Anyone with the link can view', and paste the link here.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Progress Card Drive Link</Label>
                <Input
                  type="url"
                  value={oneOnOneProgressCardDriveLink}
                  onChange={(e) => setOneOnOneProgressCardDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  disabled={oneOnOneBookingLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Download your progress card from Student Dashboard &gt; Documents for Download, upload to Google Drive, set sharing to 'Anyone with the link can view,' and paste the link here.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOneOnOneBookingDialogOpen(false)} disabled={oneOnOneBookingLoading}>
                Cancel
              </Button>
              <Button onClick={handleBookOneOnOneSlot} disabled={oneOnOneBookingLoading}>
                {oneOnOneBookingLoading ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default SlotBookings;

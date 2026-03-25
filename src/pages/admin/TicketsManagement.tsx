import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { auth } from '@/lib/firebase';
import {
  getTickets,
  sendBulkTicketMails,
  sendTicketMail,
  updateTicketDraft,
} from '@/lib/ticketsService';
import type { Ticket, TicketCategory, TicketStatus } from '@/types';
import { Loader2, Mail, Pencil, RefreshCw, Save } from 'lucide-react';

type StatusFilter = TicketStatus | 'ALL' | 'OPEN';

const statuses: Array<StatusFilter> = ['OPEN', 'SENT', 'NEW', 'DRAFTED', 'ERROR', 'ALL'];

function statusVariant(status: TicketStatus): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (status === 'SENT') return 'default';
  if (status === 'ERROR') return 'destructive';
  if (status === 'DRAFTED') return 'secondary';
  return 'outline';
}

function getTicketCategory(ticket: Ticket): string {
  const issueRelated = (ticket.issueRelated || '').trim();
  const level1 = (ticket.level1 || '').trim();
  const level2 = (ticket.level2 || '').trim();
  const level3 = (ticket.level3 || '').trim();
  const domainPlan = (ticket.domainPlan || '').trim();
  const fallbackCategory = (ticket.category || '').trim();

  let activity = '';
  if (level3) activity = level3;
  else if (level2) activity = level2;
  else if (level1) activity = level1;

  if (issueRelated === 'Activity Points' && domainPlan) {
    return `Activity Points - ${domainPlan}`;
  }

  if (issueRelated && activity) {
    return `${issueRelated} - ${activity}`;
  }

  if (issueRelated) {
    return issueRelated;
  }

  return fallbackCategory || 'Uncategorized';
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}

function isOpenStatus(status: TicketStatus): boolean {
  return status !== 'SENT';
}

const TicketsManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [category, setCategory] = useState<TicketCategory | 'ALL'>('ALL');
  const [status, setStatus] = useState<StatusFilter>('OPEN');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isDraftEditable, setIsDraftEditable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.ticketId === selectedId) || null,
    [tickets, selectedId],
  );

  const categoryOptions = useMemo(() => {
    const dynamicCategories = new Set<string>();

    tickets.forEach((ticket) => {
      const derivedCategory = getTicketCategory(ticket);
      if (derivedCategory) dynamicCategories.add(derivedCategory);
    });

    if (category !== 'ALL') {
      dynamicCategories.add(category);
    }

    return ['ALL', ...Array.from(dynamicCategories).sort((a, b) => a.localeCompare(b))];
  }, [tickets, category]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await getTickets({
        category: category === 'ALL' ? 'ALL' : category,
        status: status === 'OPEN' ? 'ALL' : status,
        query: search.trim(),
      });

      const mappedTickets = data.map((ticket) => ({
        ...ticket,
        category: getTicketCategory(ticket),
      }));

      const filteredTickets = mappedTickets.filter((ticket) => {
        if (status === 'OPEN') return isOpenStatus(ticket.status);
        if (status === 'ALL') return true;
        return ticket.status === status;
      });

      setTickets(filteredTickets);

      if (filteredTickets.length === 0) {
        setSelectedId(null);
        setDraft('');
        setIsDraftEditable(true);
        return;
      }

      const exists = selectedId && filteredTickets.some((ticket) => ticket.ticketId === selectedId);
      const activeId = exists ? selectedId : filteredTickets[0].ticketId;
      const activeTicket = filteredTickets.find((ticket) => ticket.ticketId === activeId) || filteredTickets[0];
      setSelectedId(activeTicket.ticketId);
      setDraft(activeTicket.mailDraft || '');
      setIsDraftEditable(activeTicket.status !== 'SENT');
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not load tickets',
        description:
          error instanceof Error
            ? error.message
            : 'Please verify Apps Script endpoint and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedId(ticket.ticketId);
    setDraft(ticket.mailDraft || '');
    setIsDraftEditable(ticket.status !== 'SENT');
  };

  const handleSaveDraft = async () => {
    if (!selectedTicket) return;

    setSaving(true);
    try {
      const nextStatus: TicketStatus =
        selectedTicket.status === 'SENT' ? 'SENT' : draft.trim() ? 'DRAFTED' : selectedTicket.status;

      const updated = await updateTicketDraft({
        ticketId: selectedTicket.ticketId,
        mailDraft: draft,
        status: nextStatus,
        assignedTo: auth.currentUser?.email || '',
      });

      setTickets((prev) => prev.map((ticket) => (ticket.ticketId === updated.ticketId ? updated : ticket)));

      toast({
        title: 'Draft saved',
        description: 'Mail draft has been synced to Tickets sheet.',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not save draft',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!selectedTicket) return;
    if (!draft.trim()) {
      toast({
        title: 'Draft required',
        description: 'Please write the mail draft before sending.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      if (draft !== selectedTicket.mailDraft) {
        await updateTicketDraft({
          ticketId: selectedTicket.ticketId,
          mailDraft: draft,
          status: 'DRAFTED',
          assignedTo: auth.currentUser?.email || '',
        });
      }

      const updated = await sendTicketMail({
        ticketId: selectedTicket.ticketId,
        sentBy: auth.currentUser?.email || 'unknown@iic.local',
      });
      setIsDraftEditable(false);
      setTickets((prev) =>
        prev
          .map((ticket) => (ticket.ticketId === updated.ticketId ? { ...updated, category: getTicketCategory(updated) } : ticket))
          .filter((ticket) => (status === 'OPEN' ? isOpenStatus(ticket.status) : true)),
      );

      if (status === 'OPEN') {
        setSelectedBulkIds((prev) => prev.filter((id) => id !== updated.ticketId));
      }

      await loadTickets();

      toast({
        title: 'Mail sent',
        description: `Mail sent to ${updated.studentEmail}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Mail send failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const toggleBulkSelection = (ticketId: string, checked: boolean) => {
    setSelectedBulkIds((prev) => {
      if (checked) return Array.from(new Set([...prev, ticketId]));
      return prev.filter((id) => id !== ticketId);
    });
  };

  const handleBulkSend = async () => {
    if (selectedBulkIds.length === 0) {
      toast({
        title: 'No tickets selected',
        description: 'Select at least one ticket for bulk send.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const result = await sendBulkTicketMails({
        ticketIds: selectedBulkIds,
        sentBy: auth.currentUser?.email || 'unknown@iic.local',
      });

      const failedCount = result.failed.length;
      const successCount = result.successIds.length;

      toast({
        title: 'Bulk send completed',
        description: `${successCount} sent, ${failedCount} failed.`,
        variant: failedCount > 0 ? 'destructive' : 'default',
      });

      setSelectedBulkIds([]);
      await loadTickets();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Bulk send failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Tickets Management</h2>
          <p className="text-muted-foreground">Manage student doubts from Tickets sheet and send replies.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTickets} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleBulkSend} disabled={sending || selectedBulkIds.length === 0}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Send Selected ({selectedBulkIds.length})
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory | 'ALL')}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search by email, name, issue"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadTickets();
                }
              }}
            />

            <Button variant="secondary" onClick={loadTickets}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Queries</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[560px] overflow-y-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading tickets...</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets found for current filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow
                      key={ticket.ticketId}
                      className={selectedId === ticket.ticketId ? 'bg-muted/60' : ''}
                      onClick={() => handleSelectTicket(ticket)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedBulkIds.includes(ticket.ticketId)}
                          onCheckedChange={(checked) => toggleBulkSelection(ticket.ticketId, checked === true)}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{ticket.studentName || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{ticket.studentEmail}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(ticket.timestamp)}
                      </TableCell>
                      <TableCell>{ticket.category}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(ticket.status)}>{ticket.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reply Draft</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedTicket ? (
              <p className="text-sm text-muted-foreground">Select a ticket to view details and send mail.</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Posted</p>
                  <p className="text-sm leading-relaxed">{formatTimestamp(selectedTicket.timestamp)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Issue</p>
                  <p className="text-sm leading-relaxed">{selectedTicket.issueText}</p>
                </div>

                {selectedTicket.fileUrl && (
                  <a
                    href={selectedTicket.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline"
                  >
                    Open attachment
                  </a>
                )}

                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={12}
                  disabled={!isDraftEditable}
                  placeholder="Write response draft..."
                />

                {!isDraftEditable && selectedTicket.status === 'SENT' && (
                  <p className="text-xs text-muted-foreground">
                    This reply is locked because the mail is already sent. Click Edit to modify.
                  </p>
                )}

                {selectedTicket.lastError && (
                  <p className="text-xs text-red-600">Last error: {selectedTicket.lastError}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={saving || sending || !isDraftEditable}
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Draft
                  </Button>

                  {!isDraftEditable && selectedTicket.status === 'SENT' && (
                    <Button variant="outline" onClick={() => setIsDraftEditable(true)} disabled={sending || saving}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}

                  <Button onClick={handleSend} disabled={sending || (selectedTicket.status === 'SENT' && !isDraftEditable)}>
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    Send Mail
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TicketsManagement;

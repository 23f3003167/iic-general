export type SummaryStats = {
  instructorName: string;
  instructorNumber: string;
  slotsAllocated: number;
  slotsWithFeedback: number;
  absentees: number;
};

export type SlotOverview = SummaryStats & {
  slotsGiven: number;
  slotsTaken: number;
};

export function normalizeInstructorKey(value: string | undefined | null): string {
  return String(value || '').trim().toLowerCase();
}

export function calculateSlotsGiven(startTime: string, endTime: string, section: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;
  const durationMinutes = endTotalMinutes - startTotalMinutes;

  const slotDuration = normalizeInstructorKey(section) == "behavioral" ? 10 : 15;

  return Math.max(0, Math.floor(durationMinutes / slotDuration));
}

export function findOverviewByName(
  overviewMap: Map<string, SlotOverview>,
  instructorName: string,
): SlotOverview | undefined {
  const normalizedName = normalizeInstructorKey(instructorName);
  for (const overview of overviewMap.values()) {
    if (normalizeInstructorKey(overview.instructorName) === normalizedName) {
      return overview;
    }
  }
  return undefined;
}

export function combineSlotsData(
  firestoreSlots: Array<{
    instructorName: string;
    instructorNumber: string;
    startTime: string;
    endTime: string;
    section: string;    
  }>,
  summaryStats: SummaryStats[],
): SlotOverview[] {
  const overviewMap = new Map<string, SlotOverview>();

  firestoreSlots.forEach((slot) => {
    const key = normalizeInstructorKey(slot.instructorNumber) || normalizeInstructorKey(slot.instructorName);
    const slotsGiven = calculateSlotsGiven(slot.startTime, slot.endTime, slot.section);

    if (!overviewMap.has(key)) {
      overviewMap.set(key, {
        instructorName: slot.instructorName,
        instructorNumber: slot.instructorNumber,
        slotsGiven,
        slotsAllocated: 0,
        slotsWithFeedback: 0,
        absentees: 0,
        slotsTaken: 0,
      });
      return;
    }

    const existing = overviewMap.get(key)!;
    existing.slotsGiven += slotsGiven;
  });

  summaryStats.forEach((stat) => {
    const statKey = normalizeInstructorKey(stat.instructorNumber) || normalizeInstructorKey(stat.instructorName);
    let overview = overviewMap.get(statKey);

    if (!overview) {
      overview = findOverviewByName(overviewMap, stat.instructorName);
    }

    if (overview) {
      overview.slotsAllocated += stat.slotsAllocated;
      overview.slotsWithFeedback += stat.slotsWithFeedback;
      overview.absentees += stat.absentees;
      overview.slotsTaken = Math.max(0, overview.slotsWithFeedback - overview.absentees);
      if (!overview.instructorNumber && stat.instructorNumber) {
        overview.instructorNumber = stat.instructorNumber;
      }
      if (!overview.instructorName && stat.instructorName) {
        overview.instructorName = stat.instructorName;
      }
      return;
    }

    overviewMap.set(statKey, {
      instructorName: stat.instructorName,
      instructorNumber: stat.instructorNumber,
      slotsGiven: 0,
      slotsAllocated: stat.slotsAllocated,
      slotsWithFeedback: stat.slotsWithFeedback,
      absentees: stat.absentees,
      slotsTaken: Math.max(0, stat.slotsWithFeedback - stat.absentees),
    });
  });

  return Array.from(overviewMap.values()).sort((a, b) =>
    (a.instructorName || '').localeCompare(b.instructorName || ''),
  );
}

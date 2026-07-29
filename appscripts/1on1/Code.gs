/** Calendar support used by Api.gs after a successful 1-on-1 booking. */
function handleEvaluatorSession(values, sheet, rowIndex, studentEmail, evaluatorEmail) {
  var block = findEvaluatorBlock(values, rowIndex);
  var eventId = String(values[block.top][5] || '').trim();
  var start = extractStartTime(values[block.top][0]);
  var end = extractEndTime(values[block.bottom][0]);
  eventId = createOrUpdateMeeting(eventId, start, end, evaluatorEmail, studentEmail);
  for (var i = block.top; i <= block.bottom; i++) sheet.getRange(i + 1, 6).setValue(eventId);
}

function findEvaluatorBlock(values, rowIndex) {
  var instructor = values[rowIndex][4], top = rowIndex, bottom = rowIndex;
  while (top > 1 && values[top - 1][4] === instructor && areSlotsContinuous(values[top - 1][0], values[top][0])) top--;
  while (bottom < values.length - 1 && values[bottom + 1][4] === instructor && areSlotsContinuous(values[bottom][0], values[bottom + 1][0])) bottom++;
  return { top: top, bottom: bottom };
}
function areSlotsContinuous(first, second) { return extractEndTime(first).getTime() === extractStartTime(second).getTime(); }
function extractStartTime(slot) { return parseSlotTime_(slot, true); }
function extractEndTime(slot) { return parseSlotTime_(slot, false); }
function parseSlotTime_(slot, start) {
  var match = String(slot).match(/(\d{2})\/(\d{2})\/(\d{4}).*?(\d{1,2}):(\d{2})\s*([AP]M).*?[-–—]\s*(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) throw new Error('Cannot parse slot time: ' + slot);
  var hour = Number(start ? match[4] : match[7]), minute = Number(start ? match[5] : match[8]), period = String(start ? match[6] : match[9]).toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12; if (period === 'AM' && hour === 12) hour = 0;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), hour, minute);
}
function createOrUpdateMeeting(eventId, start, end, evaluatorEmail, studentEmail) {
  var calendarId = String(PropertiesService.getScriptProperties().getProperty('ONE_ON_ONE_CALENDAR_ID') || '').trim();
  if (!calendarId) throw new Error('ONE_ON_ONE_CALENDAR_ID is not configured.');
  if (!eventId) {
    var event = Calendar.Events.insert({ summary: '1-on-1 Session', description: 'Kindly attend the scheduled session.', start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' }, end: { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' }, attendees: [{ email: evaluatorEmail }, { email: studentEmail }], conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } }, calendarId, { conferenceDataVersion: 1, sendUpdates: 'all' });
    return event.id;
  }
  var existing = Calendar.Events.get(calendarId, eventId), attendees = existing.attendees || [];
  if (!attendees.some(function (attendee) { return attendee.email === studentEmail; })) attendees.push({ email: studentEmail });
  existing.attendees = attendees;
  Calendar.Events.update(existing, calendarId, eventId, { sendUpdates: 'all' });
  return eventId;
}

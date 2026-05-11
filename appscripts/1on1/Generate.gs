function openSlotWizard() {
  const html = HtmlService.createHtmlOutputFromFile("wizard")
    .setWidth(420)
    .setHeight(520);

  SpreadsheetApp.getUi().showModalDialog(html, "Create Slots");
}

function getInstructors() {

  const sheet = SpreadsheetApp.getActive()
  .getSheetByName("Instructors");

  const data = sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues();

  const list=[];

  data.forEach(r=>{
    if(r[0] && r[1]){
      list.push({
        name:r[0],
        email:r[1]
      });
    }
  });

  return list;
}

function generateSlots(data){

  const sheet = SpreadsheetApp.getActive()
  .getSheetByName("Slot");

  const duration = parseOneOnOneDurationMinutes_(data.durationMinutes);

  let start=parseDateTime(data.date,data.start);
  const end=parseDateTime(data.date,data.end);

  const rows=[];

  while(start<end){

    const slotEnd=new Date(start.getTime()+duration*60000);
    if(slotEnd>end) break;

    const day=Utilities.formatDate(start,"Asia/Kolkata","EEEE");

    const slotText=
      Utilities.formatDate(start,"Asia/Kolkata","dd/MM/yyyy")
      +" "+day+" "
      +formatTime(start)
      +" – "
      +formatTime(slotEnd)
      +" ("+data.domain+")";

    rows.push([
      slotText,
      0,
      1,
      1,
      //data.plan,
      data.email
    ]);

    start=slotEnd;
  }

  if(rows.length>0){
    sheet.getRange(sheet.getLastRow()+1,1,rows.length,5).setValues(rows);
  }

  return rows.length;
}

function parseDateTime(dateStr,timeStr){

  const [y,m,d]=dateStr.split("-").map(Number);

  const [h,min]=timeStr.split(":").map(Number);

  return new Date(y,m-1,d,h,min,0);
}

function formatTime(d){
  return Utilities.formatDate(d,"Asia/Kolkata","hh:mm a");
}
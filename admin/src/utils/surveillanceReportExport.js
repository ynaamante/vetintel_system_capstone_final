import { csvCell } from './billingView.js';
import { reportRows, reportTime } from './surveillanceReports.js';

const printable = value => String(value??'').replace(/[–—]/g,'-').replace(/’/g,"'").replace(/·/g,'|');
export async function createSurveillanceFile(report,format,generatedAt) {
  if(format==='CSV')return new Blob(['\ufeff'+reportRows(report,generatedAt).map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const {jsPDF}=await import('jspdf');
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  doc.setProperties({title:report.title,subject:'Privacy-protected veterinary disease surveillance',author:'VetIntel'});
  const margin=14,width=269,bottom=192;
  let y=18;
  const text=(value,x,at,options)=>doc.text(Array.isArray(value)?value.map(printable):printable(value),x,at,options);
  const paragraph=(value,fontSize=9)=>{
    doc.setFontSize(fontSize);doc.setFont('helvetica','normal');
    const lines=doc.splitTextToSize(printable(value),width);
    for(const line of lines){if(y+5>bottom)newPage();text(line,margin,y);y+=4.5;}
    y+=2;
  };
  function header(first=false) {
    doc.setTextColor(12,73,34);doc.setFont('helvetica','bold');doc.setFontSize(first?20:14);
    text(`VetIntel | ${report.title}`,margin,18);
    doc.setTextColor(71,93,79);doc.setFont('helvetica','normal');doc.setFontSize(8);
    text(`Generated: ${reportTime(generatedAt)} (Asia/Manila)`,margin,25);
    text(`Data snapshot: ${reportTime(report.snapshotAt)} (Asia/Manila)`,margin,30);
    doc.setDrawColor(203,222,208);doc.line(margin,34,283,34);y=41;
  }
  function newPage(){doc.addPage();header();}
  function table(section) {
    if(y+24>bottom)newPage();
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(20,56,32);text(section.title,margin,y);y+=7;
    const weights=section.columns.map(column=>/Rule/i.test(column)?3.8:/Clinic|Disease|Barangay/i.test(column)?2:/Week/i.test(column)?2.2:1.3);
    const weightTotal=weights.reduce((sum,n)=>sum+n,0),widths=weights.map(n=>width*n/weightTotal);
    const lineHeight=3.8;
    const cells=values=>values.map((value,index)=>doc.splitTextToSize(printable(value),widths[index]-5));
    const drawHeader=()=>{
      doc.setFont('helvetica','bold');doc.setFontSize(8.5);
      const lines=cells(section.columns),height=Math.max(...lines.map(row=>row.length))*lineHeight+5;
      doc.setFillColor(231,243,232);doc.rect(margin,y,width,height,'F');doc.setTextColor(23,60,35);
      let x=margin;lines.forEach((row,index)=>{text(row,x+2.5,y+4.5);x+=widths[index];});y+=height;
    };
    drawHeader();
    const rows=section.rows.length?section.rows:[section.columns.map((_,index)=>index===0?'No matching data.':'')];
    for(const row of rows) {
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);
      const lines=cells(row),height=Math.max(...lines.map(value=>value.length))*lineHeight+5;
      if(y+height>bottom){newPage();drawHeader();doc.setFont('helvetica','normal');doc.setFontSize(8.5);}
      doc.setTextColor(32,51,39);let x=margin;
      lines.forEach((value,index)=>{text(value,x+2.5,y+4.5);x+=widths[index];});
      y+=height;doc.setDrawColor(222,232,224);doc.line(margin,y,283,y);
    }
    y+=10;
  }
  header(true);
  paragraph(`Reporting dates: ${report.period.start} to ${report.period.end} | ${report.type==='signals'?'Comparison: signal week versus previous calendar week':`Previous period: ${report.period.previous_start} to ${report.period.previous_end}`}`);
  paragraph(`Disease: ${report.scope.disease} | Clinic: ${report.scope.clinic} | Reporting barangay: ${report.scope.area}`);
  paragraph(`Status: ${report.scope.status} | Search: ${report.scope.search} | Date basis: ${report.dateBasis}`);
  paragraph(report.notice);
  if(y+32>bottom)newPage();
  const blockWidth=width/report.summary.length;
  doc.setFillColor(240,248,240);doc.roundedRect(margin,y,width,29,3,3,'F');
  report.summary.forEach(([label,value],index)=>{
    const x=margin+index*blockWidth+5;
    doc.setTextColor(25,66,37);doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    text(doc.splitTextToSize(label,blockWidth-10),x,y+6);
    doc.setFont('helvetica','bold');doc.setFontSize(19);text(value,x,y+23);
  });y+=38;
  if(report.trend.length) {
    if(y+75>bottom)newPage();
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(20,56,32);text('Confirmed Cases Trend',margin,y);y+=8;
    const x0=margin+10,w=width-18,h=43,max=Math.max(1,...report.trend.map(row=>row.cases||0));
    doc.setDrawColor(208,223,212);doc.setLineWidth(0.2);doc.line(x0,y,x0,y+h);doc.line(x0,y+h,x0+w,y+h);
    doc.setFontSize(8);doc.setFont('helvetica','normal');text(max,x0-3,y+2,{align:'right'});text(0,x0-3,y+h,{align:'right'});
    let previous=null;
    report.trend.forEach((point,index)=>{
      const x=x0+(report.trend.length===1?w/2:index*w/(report.trend.length-1));
      if(point.cases===null){previous=null;return;}
      const at=y+h-point.cases/max*h;
      doc.setDrawColor(7,126,47);doc.setFillColor(7,126,47);doc.setLineWidth(0.65);
      if(previous)doc.line(previous.x,previous.y,x,at);
      doc.circle(x,at,0.9,'F');doc.setTextColor(20,78,35);text(point.cases,x,at-2,{align:'center'});
      if(index%Math.max(1,Math.ceil(report.trend.length/6))===0||index===report.trend.length-1){doc.setTextColor(72,94,79);text(point.label,x,y+h+5,{align:'center'});}
      previous={x,y:at};
    });y+=h+15;
  }
  for(const section of report.sections)table(section);
  paragraph(`Privacy: ${report.privacy}`,8);
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(93,113,100);text('VetIntel | Shared summaries contain no individual patient or owner records.',margin,202);text(`${page} / ${pages}`,283,202,{align:'right'});}
  return doc.output('blob');
}

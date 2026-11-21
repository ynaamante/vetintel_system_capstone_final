export const signalStatus = value => ({new:'Needs Review',under_review:'Under Review',resolved:'Resolved'}[value] || value);
export const signalTrigger = value => ({
  threshold_exceeded:'Threshold Exceeded',
  growth_increase:'Growth Increase',
  threshold_and_growth_increase:'Threshold and Growth Increase',
}[String(value || '').toLowerCase().replace(/\s+/g,'_')] || value || 'Not recorded');
export const signalDate = value => value ? new Date(value).toLocaleString('en-PH', {timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not recorded';
export const signalWeek = row => `${new Date(row.period_start+'T00:00:00Z').toLocaleDateString('en-PH',{month:'short',day:'numeric',timeZone:'UTC'})} – ${new Date(row.period_end+'T00:00:00Z').toLocaleDateString('en-PH',{month:'short',day:'numeric',timeZone:'UTC'})}`;

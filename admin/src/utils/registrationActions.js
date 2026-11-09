export const registrationActionLabels = {
  continue: 'Continue Registration', details: 'View Details', delete: 'Delete Draft',
  attachments: 'View Attachments', review: 'View Review Status', history: 'Audit History',
  edit: 'Edit & Resubmit', feedback: "View Doctor’s Feedback", patient: 'View Patient Record',
  rejection: 'View Rejection Reason',
};
export function registrationActions(status) {
  return ({
    Draft: ['continue', 'details', 'delete'],
    'Needs review': ['details', 'attachments', 'review', 'history'],
    'Waiting on reception': ['edit', 'feedback', 'details', 'history'],
    Approved: ['patient', 'details', 'attachments', 'history'],
    Rejected: ['rejection', 'details', 'history'],
    Duplicated: ['rejection', 'details', 'history'],
    Withdrawn: ['details', 'history'],
  })[status] || ['details', 'history'];
}
export function registrationStatusLabel(status) {
  return ({ 'Needs review': 'Pending Approval', 'Waiting on reception': 'Changes Requested',
    Approved: 'Approved – Patient Created' })[status] || status;
}

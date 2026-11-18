/**
 * Every URL the suite touches, in one place. When porting to web/tests/e2e,
 * this is the main file to change: map each key to the Next.js route.
 */
export const routes = {
  login: '/',
  home: '/home',
  logout: '/logout',

  addEmployee: '/hr/addEmployee',
  employeeList: '/hr/viewEmployee',
  employeeDetails: (id: number) => `/hr/viewDetails?id=${id}`,
  editEmployee: (id: number) => `/hr/editEmployee?id=${id}`,
  myProfile: '/hr/viewProfile',

  departments: '/hr/addDep',
  positions: '/hr/addPos',

  notices: '/addNotice',

  leaveRequest: '/addLeave',
  myLeaveHistory: '/viewLeave',
  pendingLeave: '/displayLeave',
  allLeave: '/viewLeavebyAdmin',

  addAppraisal: '/addPerformance',
  appraisals: '/viewPerformance',

  changePassword: '/changePassword',

  /** Form endpoints, used only by the "direct submission" role tests. */
  api: {
    saveDepartment: '/hr/saveDep',
  },
} as const;

/** HR-only pages and the heading each one shows; used by role-enforcement tests. */
export const hrOnlyPages: { name: string; path: string; heading: RegExp }[] = [
  { name: 'Add Employee', path: routes.addEmployee, heading: /add employee/i },
  { name: 'Employee list', path: routes.employeeList, heading: /employees listing/i },
  { name: 'Manage Departments', path: routes.departments, heading: /manage departments/i },
  { name: 'Manage Positions', path: routes.positions, heading: /manage positions/i },
  { name: 'Manage Notices', path: routes.notices, heading: /manage notices/i },
  { name: 'Pending leave requests', path: routes.pendingLeave, heading: /pending leave requests/i },
  { name: 'All leave requests', path: routes.allLeave, heading: /all leave requests/i },
  { name: 'Add appraisal', path: routes.addAppraisal, heading: /add performance appraisal/i },
  { name: 'Appraisals', path: routes.appraisals, heading: /performance appraisals/i },
];

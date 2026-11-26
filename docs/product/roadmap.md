# Product roadmap

**Status:** Approved by the founder on 2026-11-26. Owner: Lead PM.

**Change at approval:** the founder removed B4 (two-factor login for HR admins). It is out of the roadmap, and the B numbers below keep their original values, so there is no B4.

Written 2026-11-25 against the repo at `84fea31` (main), with web research done the same day. The Design & UX section was added on 2026-11-26.

**Summary:** We should not compete with Rippling or BambooHR on breadth. Our opening is a modern, light, self-hosted HR core for organisations of about 20 to 500 people. These are teams that want to own their employee data (EU and regulated buyers), that have staff without company email, or that are tired of per-seat SaaS pricing with seat minimums and paid tiers for SSO. Open-source alternatives are either dated (OrangeHRM) or ERP-heavy (Frappe HR, Odoo). Today the product is a clean, secure rebuild of a legacy app, but its one daily workflow, leave, has no balances, no managers and no holiday calendar. **Top recommendation: after the launch blockers, build a real leave engine with manager approvals.** It is the loop every evaluator tests first, and it is where the incumbents' reviews show specific, fixable complaints.

---

## 1. What exists today

### Features (from `web/src/app/`, `web/prisma/schema.prisma`, `docs/architecture/contracts.md`)

| Area | What it does | Notes |
|---|---|---|
| Auth | Username + password (Better Auth, argon2id), DB-backed sessions, forced password change on first login, rate-limited sign-in, no self sign-up. HR creates accounts. Employees without email get a placeholder `@users.invalid` address. | The security work is strong: allowlisted auth endpoints, an authz-matrix test per action, server-only seams (ADR-0004). |
| Roles | `HR_ADMIN` and `EMPLOYEE` only. | The README says "three roles... `HR_ADMIN` and `HR`", but the `Role` enum has two. Either the docs are wrong or a role is missing. |
| Employees | CRUD, profile, department and position, soft termination (disables login and rejects pending leave). | No manager / reporting line, no start date, no employee number, no documents, no custom fields, no compensation. `Gender` is only `MALE`/`FEMALE`. |
| Org | Departments and positions (flat lists, unique names). | No hierarchy, no locations, no legal entities. |
| Leave | Apply, history, HR approval queue, "all leave" view, a "seen" flag for decisions. Five fixed types. | contracts.md rule 7: "No balance tracking, no overlap check, no cancellation." Rule 7a: **HR admins can't apply for leave.** No half days, no holiday calendar, no manager approval. HR approves everything. |
| Appraisals | One record per project: name, dates, rating. | This is a rating log, not a performance cycle. |
| Notices | HR posts General / Urgent / Holiday notices to a board, shown on the dashboard. | No targeting by department, no read receipts. |
| Platform | Docker Compose + Caddy (auto TLS), health check, migrations, `create-admin` CLI, documented backups, CI with unit, integration, e2e and Docker build. | Single instance (the in-memory rate limiter is documented). Single tenant. MIT licence. |

### Real weaknesses and missing basics
1. **The leave module is legacy parity, not product.** No balances, accruals, cancellation, overlap check or holidays. HR staff can't take leave in their own system.
2. **No manager concept.** Every approval goes through HR, which doesn't scale past roughly 30 people and isn't how any competitor works.
3. **No way to get data in or out.** A fresh install has zero employees. There is no CSV import and no export. For a "you own your data" product, this is a contradiction.
4. **No audit trail** for changes to employee records (PII). Only leave decisions record `decidedBy`.
5. **No 2FA** for `HR_ADMIN` accounts, which hold everyone's personal data. The founder removed 2FA from the roadmap on 2026-11-26.
6. **No outbound email or notifications** at all. That is fine for no-email staff, but managers and HR need something.
7. **Docs and code disagree on roles** (README vs `Role` enum).
8. **The data model is narrow and somewhat dated:** binary gender, three marital statuses, no hire date, no employment type (full-time, part-time, contractor).

---

## 2. Market research

### Pricing and targets (public figures; most vendors quote on request)

| Vendor | Target | Published or reported price | Confidence |
|---|---|---|---|
| BambooHR | SMB, ~25–1,000 | ~$10 / $17 / $25 PEPM (Core / Pro / Elite) for 26+ employees. Flat monthly fee (from ~$250) for ≤25. Payroll, benefits and time are add-ons. [bamboohr.com/pricing](https://www.bamboohr.com/pricing/), [Gusto guide](https://gusto.com/resources/guides/switch-payroll-providers/bamboohr-pricing) | Medium. One source gives $10.25 / $17.50. |
| Rippling | SMB to mid-market, all-in-one | From ~$8 per user per month plus a monthly base fee ($35–$40 reported). Each module costs extra. [Capterra](https://capterra.com/p/172127/Rippling/pricing/), [Business.org](https://www.business.org/finance/accounting/rippling-payroll-review/) | Medium. The base fee is reported inconsistently. |
| Gusto | US small business, payroll-first | $49/mo + $6/person (Simple), $80 + $12 (Plus), $180 + $22 (Premium). [gusto.com/pricing](https://gusto.com/pricing) | High. |
| HiBob | Mid-market, "modern" HR | Quote only. Order forms set a minimum number of authorised users ([HiBob terms](https://www.hibob.com/privacy/customer-subscription-terms/)). A reported 25–50 employee floor is unverified ([CostBench](https://costbench.com/compare/hibob-vs-personio/)). | Low on the numbers. |
| Personio | EU SMB, 10–10,000 | Quote only, depends on headcount and add-on apps. [personio.com/pricing](https://personio.com/pricing). Third-party estimates of ~$5–15 PEPM are unverified. | Low on the numbers. |
| Deel | Global / remote teams | HR from ~$5 per employee per month. Reports conflict on whether a free HR tier still exists. [Compono](https://www.compono.com/articles/deel-hr-pricing-guide-2026), [Dupple](https://dupple.com/pricing/deel) | Medium. |
| Workday HCM | Mid-market and enterprise | Estimates of ~$100–200 per employee per year, plus implementation of ~$150k+ for 200–500 employees. Minimum deal sizes are disputed. [OutSail](https://www.outsail.co/post/how-much-does-workday-cost), [Redress Compliance](https://redresscompliance.com/workday-pricing-decoded.html) | Low. Consultant estimates, not list prices. |
| OrangeHRM | SMB, open-source "Starter" + paid Advanced | Starter is free with community support only. Advanced is quote-based and reportedly starts at 25 employees. [OrangeHRM Starter](https://orangehrmlive.com/orangehrm-starter-open-source-software), [FitSmallBusiness](https://fitsmallbusiness.com/orangehrm-review/) | Medium. |
| Frappe HR | SMB, open source (ERPNext family) | Free to self-host. Frappe Cloud from ~$5 per site per month. [iTechGuides](https://www.itechguides.com/directory/hr-software/frappe-hr/) | Medium. |
| Odoo (HR apps) | SMB ERP | Standard ~$31.10 per user per month (annual). Custom pricing is reported between $46.70 and $76.20. API and Studio need Custom. [odoo.com/pricing](https://odoo.com/pricing), [Toolradar](https://toolradar.com/tools/odoo/pricing.md) | Medium. Odoo charges per *user*, so self-service for every employee gets expensive. |

### Common complaints
- **Cost structure, not features.** Per-seat costs that grow with headcount, essential modules sold as add-ons, seat minimums ("some vendors charge for 25 seats even if you have 10") and data-export or exit fees. [DEV buyer's guide](https://dev.to/james_pinder_3e5813b28ad5/hr-software-for-small-business-a-buyers-guide-55lo), [Lattice pricing guide](https://lattice.com/articles/hr-software-pricing), [TechRepublic](https://www.techrepublic.com/de/article/best-hr-software-for-small-business/)
- **Rippling:** support responsiveness, complex setup, cost. [Software Advice](https://www.softwareadvice.com/hr/rippling-profile/), [SpotSaaS](https://www.spotsaas.com/blog/rippling-review)
- **BambooHR time off** (individual reviews, not a measured pattern): vacation can only be requested in days, not hours; staff can't see teammates' *pending* requests; accrual can't be viewed far ahead; filtering by type is confusing. [G2](https://www.g2.com/products/bamboohr/reviews), [Capterra](https://www.capterra.com/p/110968/BambooHR/reviews/?page=3)
- **OrangeHRM:** usability and slow support. One reviewer "wasted a year" trying to make it work. Setup needs a LAMP stack. [Software Advice UK](https://www.softwareadvice.co.uk/software/2180/orangehrm), [Capterra](https://www.capterra.com/p/49068/OrangeHRM/reviews/)
- **Frappe HR:** months of implementation, and deep customisation needs Python and server hooks. Note that the source is a competitor's blog. [Medevel](https://medevel.com/frappe-hr/), [IceHrm](https://icehrm.com/blog/icehrm-vs-frappe-hr-open-source-hr-modules-compared-q-30/)
- **SSO tax:** SAML SSO is often sold only in enterprise tiers, and SCIM is gated even higher or sold separately. [Zeltser](https://zeltser.com/witholding-sso), [Clerk](https://clerk.com/articles/auth-platforms-with-sso-and-scim-in-the-base-tier)

### Trends
- **Tighter budgets and consolidation.** Sapient's 2026 survey (quoted in search snippets; I did not read the full report) says only 30% of organisations plan to increase HR tech spend, down from 47%. AI spend is up while total budgets fall. [Cornerstone](https://www.cornerstoneondemand.com/resources/article/what-does-ai-in-hr-technology-actually-look-like-in-2026/), [HR Executive](https://hrexecutive.com/?p=157903)
- **More first-time HRIS buyers.** OutSail saw clients with no existing HRIS rise from ~9% to 16% in 2026. [OutSail](https://www.outsail.co/post/observing-hr-tech-buying-behavior-in-2026)
- **Buyers fear burden more than missing features** (G2, 211 interviews). [G2 AI in HR report](https://learn.g2.com/ai-in-hr-report)
- **AI agents are early.** Use is ~4% of organisations, expected to triple. Privacy is a top barrier. [Cornerstone](https://www.cornerstoneondemand.com/resources/article/what-does-ai-in-hr-technology-actually-look-like-in-2026/), [HR.com/Eightfold](https://eightfold.ai/wp-content/uploads/State-of-Todays-HR-Technology-and-Integrations-2026-ResearchReport-HRdotcom-Eightfold.pdf)
- **EU sovereignty.** The CLOUD Act reaches US vendors wherever the data sits, and self-hosting is being pushed as the workaround. Most of these sources are vendors with an interest in that conclusion. [Orrick](https://www.orrick.com/en/Insights/2026/01/Data-Localization-and-the-Sovereign-Cloud-EU-Cloud-Regulations-Explained), [Elestio](https://blog.elest.io/digital-sovereignty-in-2026-how-eu-data-residency-laws-are-driving-the-self-hosting-boom/)
- **EU Pay Transparency Directive.** The transposition deadline of 7 June 2026 has passed, and only a few member states have transposed it. Gap reports are due from June 2027 for employers with 150+ staff, and from 2031 for those with 100–149. [Morgan Lewis](https://www.morganlewis.com/pubs/2026/06/eu-pay-transparency-directive-the-deadline-for-transposition-has-passed-what-now), [Lockton](https://global.lockton.com/us/en/news-insights/eu-pay-transparency-directive-implementation-status)
- **Frontline / deskless staff** are poorly served because HR software treats company email as the identity anchor. Vendors answer with ID, QR or shared-device login. [Staffbase](https://staffbase.com/blog/reach-employees-without-email-access), [Netchex](https://netchex.com/?p=24026). Statistics in this space mostly come from vendors.

---

## 3. Market gaps

1. **A light, modern self-hosted core.** Between OrangeHRM (dated PHP/LAMP, usability complaints) and Frappe/Odoo (ERP weight, months to implement, Python customisation), nobody offers a "docker compose up and it's usable in an afternoon" HR core on a modern stack. We already have the deployment story (Compose, Caddy, migrations, backups doc). *Evidence:* [Software Advice OrangeHRM](https://www.softwareadvice.co.uk/software/2180/orangehrm), [Medevel on Frappe HR](https://medevel.com/frappe-hr/).
2. **Staff without email.** Most HR SaaS assumes a work email for login and notifications. We already log in by username and tolerate placeholder emails. This is an accident of legacy parity that turns into a real advantage for retail, hospitality, manufacturing, care and NGOs. *Evidence:* [Staffbase](https://staffbase.com/blog/reach-employees-without-email-access).
3. **The SaaS cost structure itself.** Per-seat pricing, seat minimums, paid add-ons, SSO tax and exit fees. A self-hosted product with SSO, export and all modules included removes every one of these. The contrarian call: don't build a SaaS pricing ladder at all for v1. *Evidence:* [DEV buyer's guide](https://dev.to/james_pinder_3e5813b28ad5/hr-software-for-small-business-a-buyers-guide-55lo), [Zeltser on SSO](https://zeltser.com/witholding-sso).
4. **EU data control plus pay transparency** for 100–500-person EU firms that are too small for Workday but now face pay-gap reporting. This gap is real but slower and legally variable by country. *Evidence:* [Morgan Lewis](https://www.morganlewis.com/pubs/2026/06/eu-pay-transparency-directive-the-deadline-for-transposition-has-passed-what-now).

**Target customer for v1:** an organisation of 20–300 people with one HR generalist and someone technical enough to run Docker. Mixed desk and non-desk staff. Often EU-based or data-sensitive (NGO, public-adjacent, healthcare-adjacent). Today they use spreadsheets or have outgrown a free tool.

---

## 4. Roadmap

### 4.0 Launch-blocking basics (Phase 0, do before any bet)

B4 (two-factor login) was removed by the founder and is not listed.

| # | Item | Why it blocks | Size | Areas |
|---|---|---|---|---|
| B1 | **Fix the roles story.** Either add the `HR` role the README promises, or correct the README. Let HR admins apply for leave, with someone else approving (no self-approval). | Docs mismatch on day one. HR staff can't use the core workflow. | S | backend, security, docs |
| B2 | **Bulk CSV import and full data export** (employees, org, leave; CSV + JSON). | A fresh install is empty, and "own your data" needs an exit. | M | backend, frontend, data |
| B3 | **Audit log** for create, update and terminate on employees, accounts, roles and leave decisions (actor, timestamp, before and after). Read-only view for admins. | PII system. GDPR accountability. Buyers ask for it. | M | data, backend, security |
| B5 | **Data model fixes:** hire date, employment type, an inclusive gender option (or optional free text), employee number. | Every import file a customer brings will have these fields. | S | data, frontend |
| B6 | **Optional SMTP** notifications for leave submitted and decided (skipped for placeholder emails). | Managers and HR won't sit on the dashboard waiting. | S–M | backend, platform |

### 4.1 Differentiating bets (ranked)

#### Bet 1 (top): Leave that runs itself, with managers
- **Problem:** Leave is the only daily workflow, and today it is a request log. HR approves everything. There are no balances, holidays or cancellation.
- **Target user:** the HR generalist at a 20–300-person company, plus line managers and employees.
- **Evidence:** Leave is table stakes. Even free OrangeHRM Starter ships PTO management ([SourceForge listing](https://sourceforge.net/p/orangehrm)). The market leader's reviews name specific gaps we can beat on day one: hours vs days, pending visibility, forward accrual view ([G2](https://www.g2.com/products/bamboohr/reviews), [Capterra](https://www.capterra.com/p/110968/BambooHR/reviews/?page=3)).
- **Scope:** `managerId` on employees; manager approval with HR fallback; leave policies per type (annual allowance, accrual monthly or up front, carry-over cap); balances in days *or* hours, including half days; public-holiday calendars by location; working-day calculation; cancellation and overlap check; a team calendar that shows pending and approved requests.
- **Size:** L
- **Areas:** data, backend, frontend, security (new approval permissions in the authz matrix)
- **Acceptance criteria:**
  1. An employee sees their current balance and a projected balance for any future date, and a request that would go negative is blocked (or flagged, per policy).
  2. A request goes to the employee's manager. If there is no manager, it goes to HR. Nobody can approve their own request, and the authz matrix covers it.
  3. Requested days exclude weekends and the location's public holidays, and support half days or hours.
  4. A manager sees a team calendar showing both pending and approved leave before deciding.

#### Bet 2: Frontline mode (no email needed)
- **Problem:** Shift and site staff have no company email or laptop, so most HR tools lock them out.
- **Target user:** retail, hospitality, manufacturing, care and NGO employers with mixed workforces.
- **Evidence:** [Staffbase](https://staffbase.com/blog/reach-employees-without-email-access), [Netchex](https://netchex.com/?p=24026). We already have username login and placeholder emails (`docs/data/schema-decisions.md`).
- **Scope:** installable PWA, mobile-first leave and notice screens, QR or one-time-code onboarding instead of temporary passwords, an optional shared-kiosk mode with PIN and short sessions, notices targeted by department with read acknowledgement.
- **Size:** M
- **Areas:** frontend, security (PIN and kiosk sessions, onboarding codes), backend
- **Acceptance criteria:**
  1. An employee with no email goes from a printed QR code to their first leave request in under 2 minutes on a phone.
  2. A kiosk session auto-signs out after N minutes idle and can never reach HR pages.
  3. HR can see which employees acknowledged an Urgent notice.

#### Bet 3: "Own it in an afternoon" self-host package
- **Problem:** Self-hosted HR tools are hard to install, upgrade and back up. SaaS tools lock in data and charge per seat.
- **Target user:** a technical founder or IT generalist at an EU or data-sensitive SMB.
- **Evidence:** OrangeHRM needs LAMP setup and gets support complaints ([FitSmallBusiness](https://fitsmallbusiness.com/orangehrm-review/)). Frappe HR takes months to implement ([Medevel](https://medevel.com/frappe-hr/)). Exit and export fees are a named SaaS cost ([Lattice](https://lattice.com/articles/hr-software-pricing)). Sovereignty pressure: [Orrick](https://www.orrick.com/en/Insights/2026/01/Data-Localization-and-the-Sovereign-Cloud-EU-Cloud-Regulations-Explained).
- **Scope:** a single install script or prebuilt images on a registry, scheduled encrypted backups with a tested restore command, a first-run setup wizard in the browser (replacing the admin CLI), an in-app version and update notice, and a "data protection" page for buyers (where data lives, retention, a per-employee DSAR export).
- **Size:** M
- **Areas:** platform, backend, frontend, security
- **Acceptance criteria:**
  1. From a blank VPS to a signed-in admin takes ≤15 minutes, following only the README, verified in CI or by a clean-room test.
  2. A nightly backup is restored to a fresh host by one documented command, and that restore is tested in CI.
  3. HR can export everything held about one employee (a DSAR) in one click.

#### Bet 4: SSO and SCIM included, no tier
- **Problem:** SAML or OIDC SSO and SCIM provisioning are paywalled in most HR SaaS. IT wants HR to be the source of truth for joiners and leavers.
- **Target user:** 50–500-person companies on Google Workspace or Entra ID.
- **Evidence:** [Zeltser](https://zeltser.com/witholding-sso), [Clerk](https://clerk.com/articles/auth-platforms-with-sso-and-scim-in-the-base-tier), and BambooHR's SAML only covers authentication ([Stitchflow](https://www.stitchflow.com/scim/bamboohr)).
- **Scope:** OIDC sign-in (Google, Entra, any OIDC provider) alongside username login; outbound joiner and leaver events or an SCIM endpoint so termination deprovisions downstream.
- **Size:** M
- **Areas:** security (major review of the allowlisted auth surface), backend, platform
- **Acceptance criteria:**
  1. An admin configures Entra or Google OIDC from the UI, and existing users link by verified email.
  2. Terminating an employee disables their SSO login immediately (sessions are DB-backed already).
  3. Username login keeps working for no-email staff when SSO is on.

#### Bet 5 (later, 2027): EU pay transparency kit
- **Problem:** EU employers must answer workers' pay-information requests and, at 100–150+ staff, publish gender pay-gap reports. SMB tools rarely hold structured pay data.
- **Target user:** 100–500-person EU employers.
- **Evidence:** [Morgan Lewis](https://www.morganlewis.com/pubs/2026/06/eu-pay-transparency-directive-the-deadline-for-transposition-has-passed-what-now), [Lockton tracker](https://global.lockton.com/us/en/news-insights/eu-pay-transparency-directive-implementation-status). **Uncertainty:** national transposition is incomplete and varies by country. We need legal review before committing to report formats.
- **Scope:** compensation history (encrypted, restricted role), pay bands per position, job categories, a pay-gap report by category, and a workflow for worker information requests.
- **Size:** L
- **Areas:** data, security (field-level access and encryption), backend, frontend
- **Acceptance criteria:**
  1. Compensation fields are visible only to a dedicated role, and every read is audit-logged.
  2. The pay-gap report computes mean and median gaps by category and exports as CSV.
  3. An employee can submit a pay-information request and HR's response is tracked to a deadline.

### 4.2 Top recommendation: build Bet 1 next (after the launch blockers)
- Leave is the **only daily-use loop** in the product. Today it fails the first five minutes of any trial: there are no balances, HR can't take leave, and there are no managers.
- It is where incumbents' reviews show **concrete, cheap-to-beat gaps** (hours vs days, pending visibility, forward accrual).
- It is the **foundation for Bets 2 and 4**. Frontline staff mostly use HR software to request leave and read notices, and SSO only matters once managers are in the system.
- It fits the codebase: the service and contract layers and the authz matrix make the new approval permissions safe to add.

Suggested order: B1–B3, B5–B6 (B4 removed), then Bet 1, then Bet 2, then Bet 3, then Bet 4, with Bet 5 reviewed in Q2 2027 against transposition status.

### 4.3 What NOT to build
- **Payroll and tax filing.** It is country-specific, carries high liability, and Gusto, Deel and local providers own it. Offer a clean payroll export (CSV) instead.
- **Recruiting / ATS, benefits administration, EOR or global contractor payments.** Each is a separate market, and adding them invites the "burden" buyers fear ([G2](https://learn.g2.com/ai-in-hr-report)).
- **Hosted multi-tenant SaaS (for now).** It would turn us into a weaker BambooHR and break the self-host story. Revisit once the self-host product has users.
- **A generic AI chatbot or "AI insights".** Agent adoption is ~4%, privacy is the top barrier, and our buyers chose self-hosting for privacy. The only defensible later use is an optional, locally hosted assistant that answers policy questions from the customer's own leave policies.
- **Native iOS and Android apps.** A PWA covers the frontline need at a fraction of the cost.
- **A full performance suite** (360s, OKRs, calibration) before leave works. The current appraisal log is enough for launch.
- **Engagement surveys, recognition or an intranet.** Crowded, and outside the core.

---

### Caveats
- Most pricing for HiBob, Personio and Workday is quote-based. The figures above are third-party estimates and are labelled as such.
- Several trend and market sources are vendor content with a commercial interest. I note this wherever it applies.
- No Reddit threads came up in my searches. The complaint evidence comes from G2, Capterra, Software Advice and buyer guides.
- Market sizing (TAM) is not estimated. I found no reliable source for the "self-hosted SMB HR" segment.

---

## 5. Design & UX

Based on reading `web/src/app/**` and `web/src/components/**` and looking at `docs/images/dashboard.png`, `employees.png` and `leave-requests.png`. I did not run the app.

### 5.1 State of the UI today

**Overall:** The UI foundations are solid. The product design is thin. The frontend team built a disciplined component layer: shadcn/Base UI primitives that aren't forked, semantic tokens with light and dark pairs meant to meet WCAG AA, `ActionForm` with inline errors and focus management, `ConfirmActionDialog` for irreversible actions, a skip link, `sr-only` table captions, and a written convention doc (`web/src/components/README.md`). The screens look clean and consistent. What's missing is *flow* design. Every screen is a CRUD table or form that mirrors the legacy app, with no tasks, context or guidance built around what HR and employees are actually trying to do.

**Strengths (keep):**
- One shell, with role-based nav defined in data (`components/shell/nav-config.ts`), a mobile sheet nav below `md` (`components/shell/mobile-nav.tsx`) and a theme switch.
- Consistent page anatomy through `PageHeader` (one h1, breadcrumbs, actions), `EmptyState`, `StatusPill` and badges.
- Shared `(app)/loading.tsx`, `(app)/error.tsx` (focuses the heading and shows a reference digest) and `not-found.tsx`.
- Accessibility rules are written down: labels, `aria-describedby`, focus after errors, colour always paired with text, 375px layouts, reduced motion.

**Concrete problems:**

| # | Problem | Where | Impact |
|---|---|---|---|
| U1 | **Placeholder copy shipped in production.** The "Our company policy" card describes a *payroll module* we don't have, and HR can't edit it. | `web/src/app/(app)/dashboard/page.tsx` (`Our company policy` card), visible in `docs/images/dashboard.png` | Misleading. It's on the first screen every user sees, so it's a launch blocker. |
| U2 | **Employees can't reach most of their own information.** Their nav has only Apply and History. Notices are limited to the 5 newest on the dashboard (`/notices` requires `HR_ADMIN`). Employees can't see their own appraisals. Profile is only reachable from the user menu. | `components/shell/nav-config.ts` (`EMPLOYEE`), `app/(app)/notices/page.tsx` (`requireRole(HR_ADMIN)`), `app/(app)/profile/page.tsx` | Self-service is the whole point for 90%+ of users. Older notices disappear for them. |
| U3 | **HR decides leave with no context.** The pending queue shows name, type, dates and reason, but no day count, balance, overlapping absences or team view. The reason column is hidden below `md`, so on a phone the approver can't see why. | `app/(app)/leave/requests/page.tsx` (lines ~67–93), `docs/images/leave-requests.png` | Approvals turn into guesswork, and this is the main daily HR task. |
| U4 | **Apply-for-leave is a bare form.** Type, two native date inputs and a reason, with no duration preview, balance, holidays or warning about clashes. | `app/(app)/leave/_components/leave-client.tsx` (~38–60) | This is the most-used employee screen and it gives no feedback. |
| U5 | **Lists won't scale.** Employees, All leave and Appraisals have no search, sort, pagination or filters beyond the employee status tabs. The internal DB `ID` is the first column. | `app/(app)/employees/page.tsx`, `app/(app)/leave/all/page.tsx`, `app/(app)/appraisals/page.tsx` | Works at 12 seed rows. Breaks at 150 people or 2,000 leave rows. |
| U6 | **Information architecture follows database tables, not jobs.** The nav mixes destinations with actions ("Add employee" and "Add appraisal" sit beside "Manage …"). The labels "Manage X" are redundant. Quick actions on the dashboard repeat the nav. There are no HR metrics (headcount, who's out today). | `components/shell/nav-config.ts`, `app/(app)/dashboard/page.tsx` (`QuickLinks`) | It looks like an admin panel. Evaluators compare it with BambooHR's "who's out" home page. |
| U7 | **Two date styles on one screen.** Calendar dates render as "22 Dec 2026" and instants as "Nov 22, 2026, 02:04 AM". | `components/calendar-date.tsx` vs `components/local-time.tsx`; visible in `docs/images/leave-requests.png` | Minor, but it's the kind of inconsistency a reviewer notices. |
| U8 | **No first-run experience.** A fresh install means a CLI admin, then an empty dashboard. There is no setup checklist (company name, departments, holidays, first employees or import). New credentials are shown once in `CredentialsPanel`, and HR has to hand them over by hand. | `scripts/create-admin.ts`, `components/common/credentials-panel.tsx`, `app/(app)/employees/_components/employee-form.tsx` | The first 10 minutes decide self-hosted adoption (Bet 3). Handing over passwords is a frontline blocker (Bet 2). |
| U9 | **The employee form is one long ~15-field page.** It mixes personal data, job data and login creation, with no sections or progressive disclosure. | `app/(app)/employees/_components/employee-form.tsx` (265 lines, fields at ~78–213) | Slow for HR, and it will get worse once B5 adds fields. |
| U10 | **Accessibility isn't tested automatically.** The checklist is manual and the Playwright specs (`web/tests/e2e/*.spec.ts`) include no axe scan. Native `<details>` for notices and native date inputs are acceptable, but untested with screen readers. | `web/tests/e2e/` | The quality of the rules has no regression guard. |
| U11 | **Mobile is responsive, not mobile-designed.** Tables lose columns below `md`/`lg`, and the sidebar becomes a sheet. Nothing is built for phone-first use (bottom actions, cards instead of tables, large tap targets beyond ~36px). | `components/shell/app-shell.tsx`, all list pages | Acceptable for HR at a desk. Not acceptable for frontline staff (Bet 2). |
| U12 | The brand is a generic "HR Management" with a placeholder icon, and there's no product name or customer branding (logo, colour). | `components/shell/brand.tsx` | Self-hosting customers will want their own logo on the login page. |

### 5.2 Which roadmap items need design first

| Item | Design first? | Why / what design delivers |
|---|---|---|
| U1 placeholder copy, U7 date format | No. Engineering fixes them now. | One-line fixes. Fold them into B1. |
| B1 roles / HR self-leave | No | Reuses existing screens. Design reviews the PR. |
| **B2 CSV import and export** | **Yes (light)** | The import wizard needs design for column mapping, row-level error preview, duplicate handling, dry run, then commit. Export is a button and needs none. |
| B3 audit log view | No | A filterable table that follows existing patterns. Design reviews the PR. |
| B5 data model fields | Light | It forces the employee form split (U9) into sections. One wireframe. |
| B6 notifications | Light | Email copy and preferences. Written spec only. |
| **Bet 1 Leave engine** | **Yes (heavy)** | Policy configuration (accrual, carry-over, hours vs days) is the hardest UX in HR software. It needs: employee request flow with live balance and clash preview; manager approval with team calendar; HR policy setup; holiday calendars; and the balance-adjustment and audit view. Also fixes U3 and U4. |
| **Bet 2 Frontline mode** | **Yes (heavy)** | A new interaction model: PWA on a phone, QR onboarding, kiosk with PIN, notice acknowledgement. It also fixes U8's credential handover and U11. |
| **Bet 3 Self-host package** | **Yes (medium)** | First-run setup wizard and checklist (U8), branding (U12), data-protection page. |
| Bet 4 SSO / SCIM | Light | The admin config screen. Mostly security work. |
| Bet 5 Pay transparency | Yes, later | Report design and the employee request flow. Not before 2027. |
| IA cleanup (U2, U5, U6) | **Yes (medium)** | An employee self-service hub (notices archive, my appraisals, profile), list search and pagination patterns, and job-based nav. Do this as part of Bet 1, because the leave work restructures the nav anyway. |

### 5.3 Do we need a dedicated UI/UX design agent role?

**Yes.** It should be a single, narrowly scoped Product Designer agent next to the lead engineers. It is not a visual-design or branding role.

Why:
- The top three bets are flow problems: leave policy, frontline phones, first-run. The frontend lead's strength, shown in the code, is components, accessibility and conventions. Asking the same lead to invent the flows mixes "what should this do for the user" with "how do we build it", and the first answer becomes whatever is quickest to build. That is how the current legacy-parity screens came about.
- Every gap we picked to win on (Section 3) is a usability gap: OrangeHRM's usability complaints, Frappe's implementation burden, BambooHR's time-off friction, deskless staff being locked out. Feature parity won't win them. Better flows will.
- Engineering is gated on specs anyway. Bet 1 can't start well without decisions on accrual UI and the approval layout.

**Role definition: Product Designer (UX) agent**

| | |
|---|---|
| **Owns** | User flows and task analysis per roadmap item; wireframes; the information architecture and nav map; UX copy and microcopy (labels, empty states, errors, emails); the **design-system layer above `components/ui`** (patterns such as list + search + pagination, wizard, approval card, calendar, mobile card list; token additions); accessibility acceptance criteria per feature; UX review of frontend PRs. |
| **Delivers** | For each item, one spec in the repo at `docs/design/<item>.md` containing the problem, users and jobs; the flows (numbered steps plus edge cases: empty, error, no permission, no email, mobile); **ASCII wireframes in the markdown** for every state, or a static HTML wireframe under `docs/design/wireframes/` when layout matters (calendar, kiosk); copy tables; accessibility criteria; and open questions for the PM. It also delivers a short UX review comment on each UI PR, as **text handed to the director**, since GitHub writes go through leads. And it delivers a one-off UX audit backlog, starting from §5.1. |
| **Hand-off** | Designer writes the spec, then the PM confirms scope, then the **frontend lead signs off feasibility**, mapping each wireframe to existing components or flagging new primitives. Then engineering builds. Then the designer reviews the preview or screenshots against the spec's states and acceptance criteria, and the frontend lead decides whether to fix now or open a follow-up. The spec is the contract, and changes go back through the designer. |
| **Must not** | Write or change application code, `components/ui` primitives, `globals.css` tokens, or tests (it proposes tokens, and the frontend lead implements them). Make product scope or priority calls (the PM does). Make security or auth decisions (Security does). Create GitHub issues, PRs or comments directly. Run high-fidelity visual or branding work, or Figma-style pixel specs. Approve a PR (it gives findings, the frontend lead decides). |
| **Cost guardrails** | One spec per round, short-lived, Opus. The design system documentation stays in the existing `web/src/components/README.md`, not a parallel doc. |

### 5.4 Roadmap changes

Design becomes the **first step for B2 (import wizard), Bets 1, 2 and 3, and the IA cleanup**. It runs one item ahead of engineering, so it adds no calendar time.

Revised order:
1. **Now, in parallel:**
   - Engineering builds B1, B3, B5 and B6, plus the quick fixes U1 (remove the payroll placeholder card; launch blocker) and U7.
   - The designer delivers (a) the §5.1 audit as a prioritised backlog, (b) the **B2 import wizard spec**, (c) the **Bet 1 leave spec, including the IA and nav restructure and the employee self-service hub (U2, U3, U4, U5, U6)**.
2. Engineering builds **B2** to spec. The designer moves on to the **Bet 3 first-run and setup spec** (U8, U12).
3. Engineering builds **Bet 1**, the top recommendation, unchanged. The designer specs **Bet 2 frontline mode** (U11, QR onboarding).
4. Engineering builds Bet 3, then Bet 2. Add an axe scan to Playwright (U10) alongside Bet 2.
5. Bet 4 (light design), then Bet 5 (reviewed in Q2 2027).

The only new launch blocker is **U1**. The top recommendation stays Bet 1, now with a design spec as its first step.

---

## 6. Issues

Phase 0 work is tracked under the [`phase-0`](https://github.com/uts58/HR-Management-System/labels/phase-0) label:

- [#26](https://github.com/uts58/HR-Management-System/issues/26) U1 + U7: remove the payroll placeholder card and use one date style
- [#27](https://github.com/uts58/HR-Management-System/issues/27) B1: fix the roles mismatch and let HR admins request leave
- [#29](https://github.com/uts58/HR-Management-System/issues/29) B3: audit log
- [#30](https://github.com/uts58/HR-Management-System/issues/30) B5: employee data model fields
- [#31](https://github.com/uts58/HR-Management-System/issues/31) B6: optional SMTP notifications for leave
- [#32](https://github.com/uts58/HR-Management-System/issues/32) B2: CSV import and export (blocked on `docs/design/csv-import.md`)

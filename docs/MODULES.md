# Modules

A map of every business module: its routes, code and data. The rules themselves are in [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md); permissions are in [AUTHORIZATION.md](./AUTHORIZATION.md).

The sidebar (`lib/nav-config.tsx`) groups modules the same way as this page.

---

## Overview

| Module | Main route(s) | Service | Actions | View permission |
|---|---|---|---|---|
| [Dashboard](#dashboard) | `/dashboard` | `dashboard.ts` | `dashboard.ts` | sign-in only |
| [Projects](#projects) | `/projects` | `projects.ts` | `projects.ts` | `projects:view` |
| [Customers](#customers) | `/customers` | `customers.ts` | `customers.ts` | `customers:view` |
| [Products & Services](#products--services) | `/products` | `products.ts` | `products.ts` | `products:view` |
| [Quotations](#quotations) | `/quotations` | `quotations.ts` | `quotations.ts` | `quotations:view` |
| [Orders](#orders) | `/orders` | `orders.ts` | `orders.ts` | `orders:view` |
| [Invoices](#invoices) | `/invoices` | `invoices.ts` | `invoices.ts` | `invoices:view` |
| [Payments](#payments) | `/payments` | `payments.ts` | `payments.ts` | `payments:view` |
| [Production](#production) | `/production` | `production.ts` | `production.ts` | `production:view` |
| [Deliveries](#deliveries) | `/deliveries` | `deliveries.ts` | `deliveries.ts` | `deliveries:view` |
| [Planner](#planner) | `/planner` | `calendar.ts` | — | sign-in only |
| [Companion](#companion) | `/companion` | `companion/*` | `companion.ts` | `companion:use` |
| [Calendar](#calendar) | `/calendar` | `calendar.ts` | `calendar.ts` | `calendar:view` |
| [Tasks](#tasks) | `/tasks` | `tasks.ts` | `tasks.ts` | `tasks:view` |
| [Notes](#notes) | `/notes` | `notes.ts` | `notes.ts` | `notes:view` |
| [Finance overview](#finance-overview) | `/finance`, `/finance/receivables`, `/finance/payables` | `accounting/reports.ts`, `accounting/accounts.ts` | — | `finance:view` |
| [Tax](#tax) | `/finance/tax` | `accounting/reports.ts` | — | `tax:view` |
| [Accounts](#accounts) | `/accounts` | `accounting/accounts.ts` | `accounts.ts` | `accounting:view` |
| [Journal](#journal) | `/accounting/journal`, `/accounting/ledger`, `/accounting/periods` | `accounting/journal.ts`, `accounting/periods.ts` | `journal.ts`, `periods.ts` | `journal:view` |
| [Reports](#reports) | `/reports/profit-loss`, `/reports/balance-sheet`, `/reports/cash-flow` | `accounting/reports.ts` | — | `reports:view` |
| [Expenses](#expenses) | `/expenses` | `expenses.ts` | `expenses.ts` | `expenses:view` |
| [Vendors](#vendors) | `/vendors` | `vendors.ts` | `vendors.ts` | `vendors:view` |
| [Users](#users) | `/users` | `users.ts` | `users.ts` | `users:manage` |
| [Settings](#settings) | `/settings` | `settings.ts`, `numbering.ts` | `settings.ts` | `settings:view` |
| [My account](#my-account) | `/account` | `account.ts` | `account.ts` | sign-in only |

Services live in `lib/services/`, actions in `lib/actions/`, and module components in `components/<module>/`. The login page (`/login`) is covered in [AUTHORIZATION.md](./AUTHORIZATION.md#login-flow).

---

## Dashboard

- **Purpose:** the day's priorities and this month's money.
- **Components:** `components/dashboard/` — `revenue-chart.tsx` (range switcher calls `getRevenueSeriesAction`), `operational-widgets.tsx`, `needs-attention.tsx`, `recent-transactions.tsx`; `shared/stat-card.tsx`, `shared/activity-timeline.tsx`.
- **Data:** payments, expenses, invoices, quotations, tasks, production jobs, deliveries, activity log.
- **Rules:**
  - KPI cards (revenue, expenses, net profit) are current calendar month on a cash basis, compared with last month.
  - "Outstanding Payments" covers all non-cancelled invoices, including drafts.
  - "Needs attention" lists overdue and unpaid invoices, quotations awaiting a reply (`SENT`) and recent invoices.
  - Operational widgets show today's open tasks, active production jobs and today's scheduled deliveries.
  - There's no permission gate: every signed-in user, including Employees, sees these figures.

## Projects

- **Purpose:** client projects with live per-user time tracking.
- **Routes:** `/projects`, `/projects/new`, `/projects/[id]`, `/projects/[id]/edit`, plus `/api/projects/**`.
- **Components:** `components/projects/*`.
- **Models:** `Project`, `ProjectTimeEntry`.
- **Rules:** owner-only timer control, one running timer per project and per user. Full details: [PROJECTS.md](./PROJECTS.md).

## Customers

- **Purpose:** the customer directory and each customer's financial summary.
- **Routes:** `/customers`, `/customers/new`, `/customers/[id]`, `/customers/[id]/edit`.
- **Components:** `components/customers/customer-form.tsx`, `delete-customer-item.tsx`, `quick-create-customer-dialog.tsx`; `shared/customer-combobox.tsx` (the picker used by other modules).
- **Models:** `Customer` (type `INDIVIDUAL`/`BUSINESS`, status `ACTIVE`/`INACTIVE`).
- **Relationships:** quotations, invoices, payments, orders, production jobs, deliveries, tasks, notes (`notesList`), calendar events, projects.
- **Rules:**
  - The list shows total business, outstanding and last transaction date.
  - The detail page lists invoices, quotations, payments, orders, tasks, notes and activity.
  - Deleting is blocked when the customer has quotations, invoices or payments.
  - Only active customers appear in pickers.

## Products & Services

- **Purpose:** the catalogue used to fill quotation and invoice lines.
- **Routes:** `/products`, `/products/new`, `/products/[id]/edit`. `/products/[id]` redirects to the edit page.
- **Components:** `components/products/product-form.tsx`, `delete-product-item.tsx`; `shared/product-picker-button.tsx`.
- **Models:** `Product` (type `PRODUCT`/`SERVICE`, unit, selling price, optional cost price, GST rate), `ProductCategory`.
- **Rules:**
  - Categories are free text and created on save.
  - A product used on any quotation or invoice line can't be deleted.
  - Only active products appear in the picker.
  - Picking a product fills the line's name, description, rate and GST rate.

## Quotations

- **Purpose:** price quotes for customers.
- **Routes:** `/quotations`, `/quotations/new` (`?customerId=` preselects a customer), `/quotations/[id]`, `/quotations/[id]/edit`.
- **Components:** `components/quotations/quotation-form.tsx`, `quotation-actions.tsx`, `delete-quotation-item.tsx`; `shared/document-items-editor.tsx`; `components/documents/*`.
- **Actions:** `lib/actions/quotations.ts`; "Book Print Order" uses `convertQuotationToOrderAction` in `lib/actions/orders.ts`.
- **Models:** `Quotation` (including `notes`, `terms` and `paymentTerms` — the "Payment Conditions" field), `QuotationItem`.
- **Rules:**
  - Status flow `DRAFT → SENT → ACCEPTED/REJECTED/EXPIRED`.
  - An accepted quotation converts once to an invoice and once to an order.
  - Only drafts can be deleted.
  - No print or PDF button. See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#quotations) and [DOCUMENTS.md](./DOCUMENTS.md).

## Orders

- **Purpose:** confirmed print jobs that drive production and delivery.
- **Routes:** `/orders`, `/orders/new`, `/orders/[id]`, `/orders/[id]/edit`, `/orders/[id]/document` (printable order document).
- **Components:** `components/orders/order-form.tsx`, `order-list.tsx`, `order-detail.tsx`, `delete-order-item.tsx`. The document page reuses `components/documents/document-preview.tsx` with `kind: "Order"` and the same Print / Download PDF buttons as invoices; its data comes from `getOrderForDocument()`.
- **Models:** `Order`, `OrderItem`; creates `ProductionJob` rows; may have one `Delivery`.
- **Rules:**
  - One GST rate from Settings; totals are recomputed on the server.
  - One production job is created per line.
  - Order status also changes automatically from production and delivery updates.
  - Deleting an order also deletes its jobs and delivery. See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#orders).

## Invoices

- **Purpose:** bills to customers.
- **Routes:** `/invoices`, `/invoices/new` (`?customerId=`), `/invoices/[id]`, `/invoices/[id]/edit`.
- **Components:** `components/invoices/invoice-form.tsx`, `invoice-actions.tsx`, `payment-history.tsx`, `cancel-invoice-item.tsx`; `components/documents/*`.
- **Models:** `Invoice`, `InvoiceItem`.
- **Rules:**
  - "Overdue" is derived from the due date.
  - An invoice is editable only if it wasn't converted from a quotation, has no payments and isn't cancelled.
  - Mark as Sent posts the journal entry; Cancel reverses it. Invoices can't be deleted.
  - The detail page has Download PDF, Print, Share (copies the page URL) and Record Payment. See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#invoices).

## Payments

- **Purpose:** money received against invoices.
- **Routes:** `/payments`, `/payments/new` (`?invoiceId=` preselects the invoice), `/payments/[id]`.
- **Components:** `components/payments/payment-form.tsx`, `delete-payment-button.tsx`, `delete-payment-item.tsx`.
- **Models:** `Payment`.
- **Rules:**
  - A payment can't exceed the outstanding balance, even with concurrent payments (Serializable transaction).
  - Deleting a payment reverses its journal entry. See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#payments).

## Production

- **Purpose:** the shop-floor queue of jobs per order.
- **Routes:** `/production` (per-stage counts, kanban by default, `?view=list` for the table; filters `q`, `stage`, `priority`, `assignedToId`), `/production/new` (`production:create`), `/production/[id]`.
- **Components:** `components/production/production-list.tsx`, `production-kanban.tsx`, `production-detail.tsx`, `production-job-form.tsx`.
- **Models:** `ProductionJob`, `ProductionJobHistory`.
- **Rules:**
  - Stage changes write history and set the order to `READY` or `IN_PRODUCTION`.
  - The assignee is set only at manual creation. See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#production).

## Deliveries

- **Purpose:** getting finished orders to customers.
- **Routes:** `/deliveries` (filters: status, assigned person, delivery date), `/deliveries/new` (`deliveries:create`), `/deliveries/[id]`.
- **Components:** `components/deliveries/delivery-list.tsx`, `delivery-form.tsx`, `delivery-detail.tsx`.
- **Models:** `Delivery`, `DeliveryStatusHistory`.
- **Rules:**
  - One delivery per order.
  - `OUT_FOR_DELIVERY` and `DELIVERED` update the order's status. See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#deliveries).

## Planner

- **Purpose:** one-day agenda.
- **Routes:** `/planner?date=YYYY-MM-DD` (defaults to today).
- **Components:** `components/planner/planner-workspace.tsx`.
- **Data:** tasks due, calendar events, orders due for completion, deliveries that day, and up to 5 pinned notes (`getPlannerDataForDate()` in `calendar.ts`).
- **Rules:** no page-level permission gate. The sidebar shows the link to users with `tasks:view`.

## Companion

- **Purpose:** each person's settings for the Windows desktop Morning Companion, which shows a daily briefing of websites, Slack errors, Gmail and tasks. Full guide: [COMPANION.md](./COMPANION.md).
- **Routes:**
  - `/companion` (page);
  - `/api/companion/briefing` (desktop app, bearer device token);
  - `/api/companion/google/{connect,callback}`;
  - `/api/companion/installer` (download).
- **Setup guide:** the top of the page shows a step-by-step checklist with live ticks (`components/companion/setup-guide.tsx`).
- **Components:** `components/companion/*`.
- **Services:**
  - `lib/services/companion/`: settings and team policy, devices, accounts, and the briefing orchestrator;
  - `integrations/`: one file per integration;
  - `listOpenTasksDueBefore()` in `tasks.ts`.
- **Rules:**
  - Everything is per user.
  - Admins choose which sections employees may use (`CompanionTeamPolicy`, `companion:manage`).
  - Clients have no access.
  - "All team tasks" is honoured for admins only.

## Calendar

- **Purpose:** month/week calendar of everything with a date.
- **Routes:** `/calendar?date=&view=month|week`, `/calendar/event/[id]`, `/api/calendar/feed` (iCal).
- **Components:** `components/calendar/calendar-view.tsx`, `event-form-dialog.tsx`, `calendar-event-actions.tsx`, `google-calendar-sync-dialog.tsx`; `lib/google-calendar.ts` builds "add to Google Calendar" links.
- **Models:** `CalendarEvent`; also reads tasks, deliveries, production jobs and invoices.
- **Rules:**
  - Creating, editing and deleting events all need `calendar:create`.
  - The calendar shows events, task due dates, deliveries, production due dates and due dates of invoices that aren't `PAID`.
- **Known issues:**
  - The iCal feed and the Google links write the entered times with a `Z` suffix, so they are treated as UTC, not local time.
  - The "Sync Google Calendar" dialog tells users to subscribe Google Calendar to `/api/calendar/feed`. That URL requires a signed-in session (`proxy.ts`), so Google's servers are redirected to `/login` and receive no events.

## Tasks

- **Purpose:** to-dos linked to customers, orders, quotations, invoices, production jobs and projects, shown as a Trello-style board or a list.
- **Routes:** `/tasks` (`?view=board` is the default, `?view=list` is the table; `?filter=assigned|tagged`), `/tasks/new`, `/tasks/[id]`. `/tasks/[id]/edit` redirects to `/tasks/[id]`. The same board is the project's Tasks tab.
- **Components:**
  - `task-board.tsx`: columns To Do / In Progress / Completed, plus Cancelled when it has tasks; `@dnd-kit` drag and drop; a "+" and an "Add task" button on every column.
  - `task-card.tsx`: deadline, assignee, tagged people, a done checkbox, Start/Stop timer.
  - `task-create-dialog.tsx`: quick create, with a default status and an optional "start the timer now".
  - `task-workspace.tsx`: the task page, where every field edits in place.
  - `task-timer-panel.tsx`, `task-comments.tsx`, `task-attachments.tsx`.
  - `task-list.tsx` and `task-form.tsx` (used by `/tasks/new`).
- **Models:** `Task` (status, `position`, priority, due date + time, reminder, tags, assignee), `TaskComment`.
- **The task page (`/tasks/[id]`) is the editor.** There is no separate edit page or modal.
  - Title, description, status, priority, project, assignee, due date and time, reminder, tags and tagged people save in place: text on blur, selects and dates on change. They use `updateTaskAction` and the shared `taskFormSchema`.
  - The page loads the task for the signed-in user (`getTaskDetail(id, user)`), so employees and clients only open tasks they can see.
  - Users who can't edit (clients on team-owned tasks) get the same page read-only, with comments still open.
  - Beside the fields: **Time tracking**, **Comments**, **Attachments** and **Activity**.
- **Done checkbox.** Ticking the box on a card (or "Mark Complete" on the task page) completes the task and moves it to Completed. Unticking reopens it as To Do. It uses `toggleTaskStatusAction`, so the usual rules apply.
- **Move to another status.** Each card has a "Move to…" menu (the ⋯ button) next to drag and drop. It calls `moveTaskAction`, so the same rules apply, and it works with a click or on touch screens. The task page has a Status field too.
- **Add a task in any status.** The "+" in a column header opens the create dialog with that status. Clients can only add to To Do.
- **Timer on a task.**
  - The panel shows the running clock, with Stop for your own timer.
  - **Starting a timer on one task stops your timer on any other** (`startProjectTimer` with `autoStopPrevious`). The panel and the dialog say so.
  - "Start the timer on this task now" in the create dialog starts it right after the task is created.
  - Clients can see timers but not start them. Only the person who started a timer can stop it ([PROJECTS.md](./PROJECTS.md#timer-ownership)).
- **Comments** (`lib/services/task-comments.ts`):
  - Anyone who can see the task can read and post, clients included. This is deliberately wider than edit.
  - Authors edit their own; the author or an admin deletes.
  - A new comment notifies the assignee, the creator, tagged people and earlier commenters (not the author), and is logged as `task.commented`.
- **Other rules:**
  - Dragging calls `moveTaskAction` → `moveTask()`: it sets the status and a fractional `position` between the neighbouring cards. Clients can move only tasks they created; employees need access to the task's project; admins can move anything.
  - A task's assignee (and tagged people) can be an active admin, an employee assigned to the project, or a client user linked to the project's customer. See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#tasks-notes-and-calendar).
  - **Attachments** (images, PDF, DOC/DOCX, XML, up to 25 MB) are stored in S3. See [STORAGE.md](./STORAGE.md).
  - Deleting a task deletes its comments (cascade) and attachments.
  - Cards show overdue deadlines in red.

## Notes

- **Purpose:** free-form notes, optionally linked to a customer, order or task.
- **Routes:** `/notes`, `/notes/new`, `/notes/[id]`, `/notes/[id]/edit`.
- **Components:** `components/notes/note-list.tsx`, `note-form.tsx`, `note-detail.tsx`.
- **Models:** `Note` (title, content, tags, pinned).
- **Rules:** pinned notes sort first; 12 per page.

## Finance overview

- **Purpose:** the accounting position at a glance.
- **Routes:** `/finance`, `/finance/receivables` (aging by customer), `/finance/payables` (by vendor).
- **Data:**
  - Year-to-date P&L totals from posted journal entries;
  - cash and bank balances (accounts 1010/1020/1030);
  - receivables, payables and net GST;
  - shortcuts to journal, ledger, chart of accounts and periods.
- **Rules:** journal-based, so an invoice counts as revenue once it is marked Sent. This differs from the dashboard's cash view — see [Revenue recognition](./BUSINESS-LOGIC.md#revenue-recognition).

## Tax

- **Purpose:** GST summary.
- **Routes:** `/finance/tax` (`tax:view`).
- **Components:** `components/reports/report-export-buttons.tsx` (Print / Export PDF).
- **Rules:** output GST (2100) − input GST (1200) from posted journal entries for the selected range. No CGST/SGST/IGST split.

## Accounts

- **Purpose:** chart of accounts and cash/bank balances.
- **Routes:** `/accounts`, `/accounts/new` (`accounting:manage`), `/accounts/cash-bank`.
- **Components:** `components/accounting/account-form.tsx`.
- **Models:** `Account`.
- **Rules:**
  - The default chart is created automatically the first time `/accounts` loads with no accounts.
  - Balances are computed from posted journal lines. System accounts are flagged `isSystem`.
  - `toggleAccountAction` exists but no page uses it.

## Journal

- **Purpose:** double-entry journal, general ledger and accounting periods.
- **Routes:** `/accounting/journal` (search, status and date filters), `/accounting/journal/new` (`journal:create`), `/accounting/journal/[id]` (with Reverse), `/accounting/ledger?accountId=`, `/accounting/periods` (`accounting:manage`).
- **Components:** `components/accounting/journal-form.tsx`, `journal-reversal-button.tsx`, `period-form.tsx`, `period-toggle.tsx`.
- **Models:** `JournalEntry`, `JournalEntryLine`, `AccountingPeriod`.
- **Rules:**
  - Entries must balance. Manual entries are posted immediately.
  - Corrections are made by reversal only.
  - Closing a period isn't enforced. See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#accounting).

## Reports

- **Purpose:** financial statements.
- **Routes:** `/reports/profit-loss` and `/reports/cash-flow` take `?preset=` (default `this_month`) or `?preset=custom&start=&end=`; `/reports/balance-sheet` takes `?asOf=YYYY-MM-DD` (default today).
- **Components:** `components/reports/report-export-buttons.tsx` — Print Report and Export PDF (same exporter as invoices).
- **Rules:** built only from `POSTED` journal entries. The balance sheet includes cumulative retained earnings and flags imbalances.

## Expenses

- **Purpose:** business spending.
- **Routes:** `/expenses`, `/expenses/new`, `/expenses/[id]`, `/expenses/[id]/edit`.
- **Components:** `components/expenses/expense-list.tsx`, `expense-form.tsx`, `expense-detail.tsx`, `delete-expense-item.tsx`.
- **Models:** `Expense`, `ExpenseCategory` (seeded), optional `Vendor`.
- **Rules:**
  - Only `RECORDED` expenses count toward totals.
  - A journal entry is posted on create and reversed on delete, but not adjusted on edit.
  - Amounts come from the form. See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#expenses).

## Vendors

- **Purpose:** supplier directory.
- **Routes:** `/vendors`, `/vendors/new`, `/vendors/[id]`, `/vendors/[id]/edit`.
- **Components:** `components/vendors/vendor-list.tsx`, `vendor-form.tsx`, `vendor-detail.tsx`, `delete-vendor-item.tsx`.
- **Models:** `Vendor`.
- **Rules:**
  - Totals count `RECORDED` expenses. GSTIN is stored upper-case.
  - Deleting needs `vendors:edit` and unlinks the vendor's expenses.

## Users

- **Purpose:** staff accounts.
- **Routes:** `/users`, `/users/new`, `/users/[id]`, `/users/[id]/edit`.
- **Components:** `features/users/user-form.tsx`, `features/users/user-status-toggle.tsx`, `components/users/user-status-item.tsx`.
- **Models:** `User`.
- **Rules:**
  - Admin only (`users:manage`). Passwords must be at least 8 characters.
  - You can't deactivate yourself, and there's no delete. See [AUTHORIZATION.md](./AUTHORIZATION.md#user-status-and-deactivation).

## My account

- **Purpose:** every signed-in user (admin, employee or client) changes their own name and password. Opened from the avatar menu in the top bar.
- **Route:** `/account`. Its layout only requires a session (`requireAuth`); `proxy.ts` also allows it for the client role.
- **Components:** `components/account/profile-form.tsx`, `password-form.tsx`.
- **Rules:**
  - Actions use `requireAuth()`, and the user id always comes from the session, so nobody can edit another account here. Email and role stay admin-managed on `/users`.
  - Changing the password needs the current password, then at least 8 characters, entered twice.
  - A new name reaches the session through `useSession().update()`: the `jwt` callback in `auth.ts` re-reads the name on that trigger and on its regular 60-second recheck.
  - Both changes are logged as `account.name_changed` and `account.password_changed`, with no secrets.

## Settings

- **Purpose:** company profile and document defaults.
- **Routes:** `/settings` (view: `settings:view`, save: `settings:edit`).
- **Components:** `components/settings/company-settings-form.tsx`, `numbering-form.tsx`.
- **Models:** `CompanySettings`, `NumberingSequence`.
- **Fields:**
  - company name, tagline, address, phone, email, website, GSTIN, PAN;
  - bank name, account name, account number, IFSC, branch;
  - default quotation and invoice terms;
  - default GST rate, quotation validity days, invoice due days;
  - quotation and invoice number prefixes.
- **Where each setting is used:**

  | Setting | Used by |
  |---|---|
  | Company details and bank details | Document letterhead and footer |
  | Default GST rate | Orders |
  | Invoice due days | Quotation → invoice conversion |
  | Default invoice terms | New and converted invoices |
  | Default quotation terms, quotation validity days | Nothing yet — see [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#known-gaps) |
  | Logo URL (`logoUrl`; no Settings field edits it yet) | Document letterhead; falls back to `/Logo.png` |

## Not routed: customer and vendor statements

`components/accounting/statement-view.tsx`, `lib/actions/statements.ts` (`statements:view`) and `lib/services/accounting/statements.ts` build customer and vendor statements with running balances and PDF export. No page renders them yet.

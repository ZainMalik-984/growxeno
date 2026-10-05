# COMPLETE SOURCE-OF-TRUTH DEVELOPMENT PROMPT

## Production-Grade Internal Business Operations Management System

You are an elite senior full-stack engineer, software architect, database architect, security engineer, and high-end product designer.

Build a real production-quality internal business operations management platform.

This project must be treated as a serious business application, not a prototype, coding exercise, landing page, or generic AI-generated SaaS dashboard.

The application's architecture, data model, authorization system, search/filtering, UX, performance, and documentation must be deliberately designed before implementation.

Do not omit requirements.

Do not silently simplify requirements.

Do not reinterpret business terminology.

Do not replace requested functionality with a weaker approximation.

Do not introduce unnecessary technologies.

Do not create fake functionality merely to make a screen appear complete.

When there is an architectural choice, prefer the option that provides:

- Strong data integrity
- Low resource usage
- Good performance
- Maintainability
- Clear code organization
- Clear database organization
- Strong security
- Excellent UX
- Easy future modification
- Minimal unnecessary complexity

---

# 1. COMPLETE BUSINESS CONTEXT

This application is for an internal service business.

The business receives work from multiple sources and then manages that work internally.

The application is used to:

- Manage orders
- Manage recurring wholesale Buyers
- Manage Customers/end customers
- Manage Workers/users
- Assign work to Workers
- Track individual Order Items
- Track deadlines
- Track statuses
- Manage Services and Categories
- Manually enter daily statistics for users
- Manage Buyer pricing
- Manage Buyer balances
- Manage Buyer payments
- Manage Worker payments
- Track expenses
- Calculate revenue
- Calculate costs
- Calculate profit
- Manage files
- Manage order notes
- Manage activity/audit history
- Send email notifications
- Send WhatsApp notifications
- Manage notification templates
- Manage notification logs
- Generate reports
- Manage users
- Manage roles
- Manage permissions
- Search and filter operational data quickly

The application must be independent of Fiverr.

---

# 2. ABSOLUTE FIVERR RULE

THERE IS NO FIVERR INTEGRATION.

Do not build:

- Fiverr API integration
- Fiverr authentication
- Fiverr seller account integration
- Fiverr seller dashboard
- Fiverr seller statistics
- Fiverr synchronization
- Fiverr scraping
- Fiverr webhooks
- Fiverr marketplace automation
- Fiverr data importing

Do not design the architecture around Fiverr.

Fiverr must not become a dependency.

If an order came from an external marketplace or platform, the application may simply record its source manually.

The system should be a general business/order management system.

Possible Order Source values can include:

- DIRECT
- WHOLESALE
- MANUAL
- OTHER

Do not create Fiverr-specific modules.

---

# 3. CORE BUSINESS TERMINOLOGY

These definitions are mandatory.

## Buyer

A Buyer is a recurring commercial client with an ongoing business relationship.

A Buyer may receive wholesale pricing.

A Buyer may have:

- Pricing tier
- Custom pricing
- Balance
- Credit limit
- Payment history
- Order history
- Multiple Customers
- Multiple orders

Example:

Buyer:
ABC Digital Agency

Customers:

- John Smith
- XYZ Corporation
- Sarah Williams

The Buyer may be paying for work performed for those Customers.

---

## Customer

A Customer is the end/job customer associated with a specific piece of work.

A Customer is NOT automatically the same thing as a Buyer.

A Customer may be associated with a Buyer.

A Customer can also exist independently.

Do not merge Buyer and Customer into one model.

The distinction must be reflected in:

- Database
- UI
- Search
- Filters
- Forms
- Reports
- Relationships
- Business logic

---

## Worker / User

The person who actually performs the work.

Examples:

- UX Designer
- Developer
- SEO Specialist
- WordPress Developer

Users may have roles and permissions independently of their operational Worker capabilities.

A Worker should only see functionality they are authorized to access.

---

# 4. USERS

Users will be entered and managed manually inside the application.

There is no external user directory requirement.

Support at minimum:

- Super Admin
- Admin
- User / Worker

However, roles must NOT be hard-coded into the authorization architecture.

The actual system must support completely custom dynamic roles.

The initial roles can be seeded into the database, but after setup they must behave like normal editable roles.

---

# 5. DYNAMIC ROLE AND PERMISSION SYSTEM

This is a critical requirement.

The authorization system must be fully dynamic.

Roles are collections of permissions.

Permissions must be stored in the database.

Do not hard-code role permission sets in application code.

Do not build:

if user.role === "admin"

throughout the application.

Instead, use centralized authorization.

---

# 6. MULTIPLE ROLES PER USER

A user may have multiple roles.

Example:

Ahmed:

- Senior Worker
- Reviewer

The user's effective role permissions should be the combined permissions from all assigned roles, subject to direct user overrides.

---

# 7. CUSTOM ROLES

Super Admin must be able to:

- Create roles
- Edit roles
- Rename roles
- Delete roles where allowed
- Duplicate roles
- Assign permissions to roles
- Remove permissions from roles
- Assign roles to users
- Remove roles from users
- View role details
- View users assigned to a role

The UI must make permission management easy.

---

# 8. PERMISSIONS

Permissions must be granular enough to be useful.

Examples:

orders.view
orders.create
orders.edit
orders.delete
orders.assign
orders.process
orders.change\_status
orders.comment
orders.files.view
orders.files.upload
orders.activity.view
orders.export

buyers.view
buyers.create
buyers.edit
buyers.delete
buyers.pricing.view
buyers.pricing.manage
buyers.payments.view
buyers.payments.manage

customers.view
customers.create
customers.edit
customers.delete

workers.view
workers.create
workers.edit
workers.delete
workers.assign
workers.stats.view
workers.payments.view
workers.payments.manage

daily\_stats.view
daily\_stats.create
daily\_stats.edit
daily\_stats.delete
daily\_stats.export

services.view
services.create
services.edit
services.delete

categories.view
categories.create
categories.edit
categories.delete

finance.view
finance.revenue.view
finance.expenses.view
finance.expenses.create
finance.expenses.edit
finance.profit.view
finance.buyer\_payments.view
finance.buyer\_payments.manage
finance.worker\_payments.view
finance.worker\_payments.manage

reports.view
reports.sales
reports.orders
reports.workers
reports.buyers
reports.customers
reports.profit
reports.export

communications.view
email.send
whatsapp.send
templates.view
templates.manage
message\_logs.view

users.view
users.create
users.edit
users.delete

roles.view
roles.create
roles.edit
roles.delete

permissions.view
settings.view
settings.edit

This is an example initial permission catalog.

The architecture must allow the catalog to grow.

---

# 9. DIRECT USER PERMISSIONS

A specific permission can be assigned directly to an individual user.

Example:

Ahmed's role does not normally allow:

orders.assign

But the Super Admin directly grants:

orders.assign

Ahmed now has it without changing the underlying role.

This is mandatory.

---

# 10. DIRECT USER DENIES

A direct user permission must also support explicit DENY.

Example:

Role grants:

finance.view

But a particular user must not see Finance.

Assign:

finance.view = DENY

The user is denied even though the role grants it.

Use:

ALLOW
DENY

as direct assignment effects.

---

# 11. PERMISSION PRECEDENCE

Implement a deterministic permission resolution system.

Recommended precedence:

1. Direct DENY
2. Direct ALLOW
3. Role-derived ALLOW
4. No permission

Document this explicitly.

The system must provide the final effective permission set for a user.

---

# 12. EFFECTIVE ACCESS VIEW

Each user profile should have an access section showing:

- Assigned roles
- Permissions inherited from roles
- Direct permissions
- Direct denies
- Effective permissions
- Permission source

Example:

Ahmed Khan

Roles:

- Senior Worker
- Reviewer

Effective Permissions:

orders.view ROLE
orders.edit ROLE
orders.assign DIRECT ALLOW
finance.view DIRECT DENY
daily\_stats.view DIRECT ALLOW

This should make permission troubleshooting easy.

---

# 13. RBAC DATABASE MODELS

At minimum:

users
roles
permissions
user\_roles
role\_permissions
user\_permissions

Recommended structure:

roles:

- id
- name
- slug
- description
- is\_system
- created\_at
- updated\_at

permissions:

- id
- name
- key
- module
- description
- created\_at
- updated\_at

user\_roles:

- user\_id
- role\_id
- created\_at

role\_permissions:

- role\_id
- permission\_id
- created\_at

user\_permissions:

- user\_id
- permission\_id
- effect
- created\_at
- created\_by

The exact schema may be improved by the architect, but functionality must remain equivalent.

---

# 14. AUTHENTICATION

Use Supabase Auth.

Support:

- Login
- Logout
- Session handling
- Password reset
- Email verification where appropriate
- Secure sessions
- Optional MFA architecture for future use

Keep authentication identity separate from application user profile data.

Conceptually:

Supabase Auth identity
↓
Application User
↓
Roles
↓
Permissions

---

# 15. SECURITY

Security is a first-class requirement.

Use:

- Supabase Auth
- Server-side authorization
- Centralized permission checks
- Supabase Row Level Security
- Server-side validation
- Zod
- Secure environment variables
- Audit logs
- Safe file access
- Appropriate database constraints

Never expose:

SUPABASE\_SERVICE\_ROLE\_KEY

to the browser.

Do not trust UI visibility as authorization.

Hiding a route is NOT security.

Every protected server action/API/database operation must also enforce authorization.

---

# 16. SUPABASE

Use Supabase as the platform.

Use:

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime where beneficial

The primary business database is PostgreSQL.

Use Supabase rather than a separately self-managed PostgreSQL server.

---

# 17. PRISMA

Use Prisma as the application ORM.

The Prisma schema must be easy to understand and organized.

Do not create one enormous unreadable schema file if that makes maintenance difficult.

The database source structure must make it easy for a developer to answer:

- Where is the Buyer model?
- Where is the Order model?
- Where are Order Item relationships?
- Where are permissions?
- Where are financial models?
- Where are indexes?
- Where are constraints?

If the selected Prisma setup requires a single generated schema, organize source schema files in a maintainable manner and document how they are assembled/generated.

Use clear naming.

Use explicit relationships.

Avoid cryptic abbreviations.

---

# 18. DATABASE MAINTAINABILITY REQUIREMENT

The database schema is critical.

A future developer should be able to open the project and quickly understand:

- Every table/model
- What it is for
- What it connects to
- Which fields are important
- Which fields are nullable
- Which fields are unique
- Which fields are indexed
- Which fields are financial
- Which fields are historical
- Which models are operational
- Which models are configuration

Do not hide database complexity in confusing abstractions.

Use clear model names.

Use comments/documentation around non-obvious business rules.

---

# 19. DATABASE DOCUMENTATION

Create:

docs/DATABASE.md

It must document every important model/table.

For each model include:

- Purpose
- Important fields
- Relationships
- Cardinality
- Important indexes
- Important constraints
- Business rules
- Soft-delete behavior if applicable
- Audit behavior if applicable

Example:

Order:

- belongs to optional Buyer
- belongs to optional Customer
- has many Order Items
- has many Files
- has many Notes
- has activity history
- has financial information
- has a status
- has a deadline

---

# 20. DATABASE MIGRATIONS

Use Prisma migrations.

Migrations must be:

- Version controlled
- Organized
- Reviewable
- Reproducible

Never make destructive schema changes casually.

Before destructive changes:

- Assess impact
- Update migration
- Update documentation
- Preserve data where necessary
- Verify dependent code

---

# 21. CORE DATABASE ENTITIES

At minimum, support:

users
roles
permissions
user\_roles
role\_permissions
user\_permissions

buyers
buyer\_contacts
buyer\_pricing

customers

services
categories

orders
order\_items
order\_files
order\_notes
order\_activity

daily\_stats

buyer\_payments
worker\_payments

expenses
financial\_transactions

notifications
notification\_templates
notification\_preferences
message\_logs

audit\_logs

system\_settings

Additional supporting entities may be introduced when genuinely necessary.

Do not add tables simply for complexity.

---

# 22. ORDER MODEL

Every Order should support:

- Internal Order ID/number
- Source
- Buyer
- Customer
- Order date
- Deadline
- Status
- Total amount
- Notes
- Created by
- Created timestamp
- Updated timestamp

Optional external reference fields may exist for manually recorded external references.

Do not make them Fiverr-specific.

---

# 23. ORDER SOURCE

Use a generic source field.

Possible values:

- DIRECT
- WHOLESALE
- MANUAL
- OTHER

The architecture should permit future sources without redesigning the entire system.

---

# 24. ORDER ITEMS

An Order can contain multiple Order Items.

Every Order Item should support:

- Order ID
- Service
- Category
- Worker
- Description
- Item-specific deadline
- Selling price
- Worker cost
- Status
- Notes
- Links
- Files
- Created timestamp
- Updated timestamp

---

# 25. LINKS IN ORDER ITEMS

This is a specific requirement.

Order Items must support one or multiple links/URLs.

Examples:

- Reference website
- Source page
- Client URL
- Google Drive link
- Design reference
- Repository
- Document
- Delivery/reference URL
- Any work-related external URL

Links must be stored in a way that is easy to search and filter.

Do NOT only place them in a giant notes text field if the requirement is to filter by them.

Prefer a proper normalized structure if multiple links per item are supported.

For example:

order\_item\_links

- id
- order\_item\_id
- url
- label/type
- created\_at
- created\_by

Alternatively, if exactly one canonical URL is guaranteed, a dedicated indexed URL field may be appropriate.

The implementation must support the actual requirement of filtering orders based on links contained inside Order Items.

---

# 26. ORDER SEARCH — CRITICAL

Searching orders must be extremely easy.

Users should be able to find an order quickly without remembering exactly where something was stored.

Global order search should support, where applicable:

- Internal Order ID
- Order number
- Buyer name
- Customer name
- Worker name
- Service
- Category
- Email
- Phone
- External reference
- Order Item description
- Order Item links/URLs
- Notes
- Relevant searchable metadata

Do not build a search system that only searches order IDs.

---

# 27. ORDER ITEM LINK SEARCH

Users must be able to search/filter by a URL stored in an Order Item.

Example:

Input:

[https://example.com/project/client-a](https://example.com/project/client-a)

The system should find the Order containing an Order Item with that link.

Also support useful URL matching behavior such as:

- Full URL
- URL substring
- Domain
- Path fragment
- Search term contained in URL

Do this efficiently.

Do not load every order into the browser and filter the entire dataset in JavaScript.

---

# 28. FILTERABLE ORDERS

Orders should support easy filtering.

At minimum:

- Status
- Buyer
- Customer
- Worker
- Service
- Category
- Source
- Deadline
- Order date
- Created date
- Assigned/unassigned
- Overdue
- Due today
- Due this week
- Completed
- Pending
- Has links
- Link/domain search
- Payment status where relevant
- Amount range
- Search text

Support combinations.

Example:

Status = In Progress
AND
Worker = Ahmed
AND
Deadline = Today

Another example:

Buyer = ABC Agency
AND
Service = UX Design
AND
Order Item Link contains example.com

---

# 29. FILTER UX

Filtering must be extremely easy.

Do not create a confusing filter wall.

Use a clean filter system.

Possible structure:

Search
[ Search orders, buyers, customers, links... ]

Filters
Status
Buyer
Customer
Worker
Service
Date
Deadline
Source
More

Advanced filters can be expandable.

Filters should be represented in a restrained way consistent with the design system.

Do not use colorful filter chips unless genuinely necessary.

---

# 30. FILTER URL STATE

Important filters should be represented in URL query parameters where practical.

Example:

/orders?status=in\_progress&worker=123&buyer=456

This allows:

- Bookmarkable views
- Browser back/forward
- Shareable filtered views
- Predictable state
- Better usability

Keep query parameters clean and deterministic.

---

# 31. FILTER PERFORMANCE

Filtering must be server-side for large datasets.

Do not:

1. Fetch thousands of orders
2. Load them all in the browser
3. Filter with JavaScript

Instead use database queries.

Example conceptual behavior:

database:
WHERE status = ...
AND worker\_id = ...
AND buyer\_id = ...
AND deadline ...

Use proper indexes.

---

# 32. SEARCH PERFORMANCE

Search should be optimized for minimum resource usage.

Do not perform unnecessary database queries.

Do not query the same dataset repeatedly.

Do not fetch columns that are not required.

Select only the required fields.

Use pagination.

Use indexes.

Debounce search inputs.

Avoid searching on every keystroke without debounce.

Use a sensible debounce interval.

Use database-supported search methods where appropriate.

For larger datasets, evaluate PostgreSQL capabilities such as:

- B-tree indexes
- Trigram indexes
- Full text search
- Functional indexes
- Composite indexes

Choose based on actual search patterns.

Do not add expensive indexing blindly.

---

# 33. PAGINATION

Large lists must be paginated.

Do not load all orders, workers, buyers, customers, or logs at once.

Use server-side pagination.

Prefer efficient pagination strategies for very large datasets.

Where appropriate, cursor-based pagination may be better than expensive deep offset pagination.

Document the choice.

---

# 34. FILTER INDEXING

Design indexes around actual queries.

Potential order query indexes may involve:

- status
- deadline
- buyer\_id
- customer\_id
- created\_at
- updated\_at
- worker-related relationships
- source
- service/category relationships

Do not create every imaginable composite index.

Each index has storage and write/update cost.

Choose indexes based on real access patterns.

Document important indexes in DATABASE.md.

---

# 35. MINIMUM RESOURCE USAGE

The entire application should be designed with resource efficiency as a goal.

Avoid:

- Duplicate API calls
- Duplicate database queries
- N+1 queries
- Unnecessary realtime subscriptions
- Massive client payloads
- Fetching unnecessary columns
- Unnecessary chart data
- Unnecessary polling
- Unnecessary client-side state
- Unnecessary rerenders
- Unnecessary dependencies

Use:

- Server Components where possible
- Server-side filtering
- Pagination
- Selective columns
- Query batching where appropriate
- Database indexes
- Caching where useful
- Debounced search
- Lazy loading for large/secondary sections
- Proper query invalidation
- Efficient realtime subscriptions only where needed

---

# 36. N+1 QUERY PREVENTION

Be especially careful on:

- Orders list
- Buyer order history
- Worker workload
- Reports
- Activity logs
- Daily statistics
- Payment lists

Do not make one database request per row.

Use proper relations, batching, joins, aggregation, or carefully structured queries.

---

# 37. DASHBOARD RESOURCE USAGE

The dashboard should not execute dozens of independent requests every time it loads.

Group related data where practical.

Use efficient aggregate queries.

Do not load full order histories merely to display:

Active Orders = 24

Use count/aggregate queries.

Do not fetch thousands of activity records merely to show five recent activities.

Fetch only what is displayed.

---

# 38. REALTIME

Supabase Realtime may be used where it creates real value.

Good candidates:

- Notifications
- Active order updates
- Worker assignment changes
- Status changes
- Activity feed where useful

Do not subscribe every page to every database table.

Realtime subscriptions must be narrow and purposeful.

---

# 39. ORDER STATUSES

Use:

PENDING
PROCESSING
IN\_PROGRESS
INTERNAL\_REVIEW
READY\_FOR\_DELIVERY
DELIVERED
COMPLETED
REVISION
CANCELLED

Implement controlled status transitions.

Do not permit every arbitrary jump unless explicitly allowed by the business rules.

---

# 40. ORDER WORKFLOW

Recommended flow:

PENDING
↓
PROCESSING
↓
IN\_PROGRESS
↓
INTERNAL\_REVIEW
↓
READY\_FOR\_DELIVERY
↓
DELIVERED
↓
COMPLETED

Revision:

REVISION
↓
IN\_PROGRESS

Cancellation:

CANCELLED

The exact allowed transitions should be represented centrally.

Document them in:

docs/ORDERS.md

---

# 41. ORDER STATUS VS ITEM STATUS

These are independent.

Example:

Order #10482

UX Design:
Completed

Development:
In Progress

Overall Order:
In Progress

When all required items are complete, the order can move toward review/ready/delivery according to the configured workflow.

Do not automatically overwrite item statuses merely because the parent order changed.

---

# 42. PROCESS ORDER

When authorized Admin/Manager processes an order:

1. Validate order data.
2. Validate assigned work.
3. Change order status.
4. Activate assigned Order Items if applicable.
5. Record activity.
6. Generate notifications.
7. Queue email.
8. Queue WhatsApp if enabled/configured.
9. Record message activity.
10. Update timestamps.
11. Return a clear result to the UI.

Financial/data changes must use proper transactions where required.

---

# 43. WORKER DASHBOARD

Workers should primarily see work assigned to them.

Dashboard should show:

- New work
- Active work
- Due today
- Overdue
- Recently completed
- Important notifications

Workers should have easy access to their assigned orders.

---

# 44. WORKER ACTIONS

Depending on permissions, workers can:

- Open assigned work
- Start Work
- Add Note
- Upload Files
- Change allowed item status
- Mark work complete
- Request Revision

Workers must not automatically receive access to financial information.

---

# 45. WORKER PROFILE

Worker profile may contain:

- Name
- User identity
- Roles
- Categories/services
- Active work
- Completed work
- Pending work
- Performance
- Daily statistics
- Payments
- Activity

Access to sensitive sections must be permission-controlled.

---

# 46. BUYER SYSTEM

Buyer profile should include:

- Name
- Type
- Active/inactive status
- Email
- WhatsApp
- Contacts
- Pricing tier
- Custom prices
- Total orders
- Total spent
- Outstanding balance
- Credit limit
- Payment history
- Order history
- Associated Customers
- Notes
- Activity

---

# 47. BUYER PRICING

Support pricing tiers.

Initial examples:

- Retail
- Wholesale
- Silver
- Gold
- VIP
- Custom

The exact names should be editable/configurable.

Each Buyer can have:

- Default pricing tier
- Service-specific pricing
- Custom overrides

Example:

Gold:

UX Design = $120
Development = $350

ABC Agency override:

UX Design = $105

---

# 48. BUYER BALANCE / ACCOUNT

Buyers may have a financial account.

Track:

- Credit limit
- Current balance
- Available credit
- Orders
- Payments
- Outstanding amount

Do not calculate financial truth only in the UI.

Use ledger/transaction records.

---

# 49. CUSTOMER SYSTEM

Customer profile should remain simpler.

Fields may include:

- Name
- Type
- Associated Buyer
- Email
- Phone
- Notes
- Orders
- Last order

Do not treat Customer as an alternative name for Buyer.

---

# 50. SERVICES AND CATEGORIES

Services should be separate from categories where useful.

Examples:

Category:
Design

Services:

- UX Design
- UI Design
- Wireframes

Category:
Development

Services:

- Web Development
- WordPress
- Frontend
- Backend

Use service/category relationships consistently.

---

# 51. DAILY STATISTICS — CRITICAL

Daily statistics will be manually entered.

The system is NOT required to fetch them from external platforms.

The user/admin will enter statistics for each user for each day.

Daily statistics are a separate domain model.

Do not infer them automatically from Order records.

---

# 52. DAILY STATISTICS EXAMPLE

Date: September 9

Ahmed:

Orders: 8
Completed: 6
Pending: 2
Revenue: $240

Bilal:

Orders: 5
Completed: 5
Pending: 0
Revenue: $180

---

# 53. DAILY STATISTICS FEATURES

Support:

- Add daily stats
- Edit daily stats
- Delete daily stats
- Bulk entry
- Copy previous day
- Date filtering
- User filtering
- Historical records
- Export
- Performance charts

---

# 54. DAILY STATISTICS PAGE

Prefer an efficient table.

Example:

Date | User | Orders | Completed | Pending | Revenue

Make daily entry fast.

The administrator should be able to enter statistics for multiple users without opening many separate pages.

---

# 55. DAILY STATISTICS DASHBOARD

Support:

- Today
- 7 Days
- 30 Days
- 90 Days
- Custom range

Possible visualizations:

- Orders/day
- Completed/day
- Revenue
- User comparison
- Productivity trends

Do not add charts simply for decoration.

Every chart should answer a useful operational question.

---

# 56. FINANCE

Finance must include:

- Revenue
- Worker Costs
- Worker Payments
- Buyer Payments
- Expenses
- Profit
- Outstanding balances

Per order:

Selling Amount

- Worker Cost
- Other Cost
  \= Order Profit

---

# 57. FINANCIAL DATA INTEGRITY

Financial truth must live on the server/database.

Do not trust frontend calculations.

Do not make financial totals dependent on client-side state.

Use server-side calculations and appropriate database transactions.

---

# 58. WORKER PAYMENTS

Track:

- Worker
- Order
- Order Item
- Service
- Amount earned
- Amount paid
- Outstanding
- Payment date
- Payment reference
- Notes

Worker summary:

Earned
Paid
Outstanding

---

# 59. BUYER PAYMENTS

Track:

- Buyer
- Amount
- Date
- Reference
- Payment method
- Notes
- Related invoice/order where applicable
- Created by

Use a proper financial history.

---

# 60. EXPENSES

Support:

- Amount
- Category
- Date
- Description
- Paid by
- Attachment
- Notes

Possible categories:

- Software
- Advertising
- Infrastructure
- Salaries
- Office
- Miscellaneous

These must be configurable where useful.

---

# 61. FINANCIAL TRANSACTIONS

Where appropriate, use a transaction/ledger model rather than storing only totals.

Totals can be derived from transaction history.

Do not create an inconsistent system where:

buyer.balance = one number

and transaction records imply another.

Define the source of truth explicitly.

---

# 62. ORDER NOTES

Orders should have internal notes.

Notes should be searchable where useful.

Notes can contain:

- Operational instructions
- Internal comments
- Clarifications
- Review comments

Activity and comments should not be confused.

---

# 63. ORDER FILES

Use Supabase Storage for actual files.

Do not store large binary files directly in PostgreSQL.

Store file metadata in PostgreSQL.

Metadata can include:

- File ID
- Order ID
- Order Item ID where applicable
- Uploaded by
- Filename
- Storage path
- MIME type
- Size
- Created timestamp

Support files at Order and/or Order Item level where useful.

---

# 64. ACTIVITY / AUDIT LOG

Create a first-class audit system.

Record:

- Who performed the action
- What action happened
- Entity
- Entity ID
- Time
- Previous value where useful
- New value where useful

Examples:

"Admin assigned Order #10482 to Ahmed."

"Ahmed changed the item status from In Progress to Internal Review."

"Admin changed Buyer ABC Agency pricing from $120 to $105."

Audit history must not be casually editable.

---

# 65. NOTIFICATIONS

Create one centralized notification system.

Events include:

ORDER\_CREATED
ORDER\_ASSIGNED
ORDER\_PROCESSED
ORDER\_STARTED
ORDER\_COMPLETED
ORDER\_REVISED
DEADLINE\_24H
DEADLINE\_6H
DEADLINE\_TODAY
ORDER\_OVERDUE
PAYMENT\_DUE

Add additional events when needed.

---

# 66. NOTIFICATION CHANNELS

Support:

- In-App
- Email
- WhatsApp

The notification system should decide which channels are enabled.

Do not duplicate notification logic separately inside every feature.

---

# 67. IN-APP NOTIFICATIONS

Create a notification center.

Each notification should support:

- Title
- Message
- Type
- Recipient
- Read/unread state
- Created time
- Optional entity reference
- Optional action URL

Users should be able to easily see unread notifications.

---

# 68. EMAIL

Use Resend for transactional email.

Use it for:

- Assignment notifications
- Deadline reminders
- Completion notifications
- Buyer payment reminders
- Account-related emails
- Administrative notifications
- Scheduled summaries where needed

Do not hard-code email bodies throughout the application.

Use notification templates.

---

# 69. WHATSAPP

Use the official Meta WhatsApp Business Platform.

Do NOT build around WhatsApp Web automation.

Do NOT rely on browser automation as the primary messaging architecture.

Create a provider layer so the core application is not tightly coupled to one provider implementation.

---

# 70. MESSAGE TEMPLATES

Create reusable templates.

Variables can include:

{{worker\_name}}
{{order\_id}}
{{order\_number}}
{{service}}
{{category}}
{{deadline}}
{{buyer\_name}}
{{customer\_name}}
{{amount}}
{{hours\_remaining}}

Validate variables.

Prevent broken placeholders.

---

# 71. MESSAGE LOGS

Every outbound message should be recorded.

Fields should support:

- Recipient
- Channel
- Template
- Event
- Provider message ID
- Created time
- Sent time
- Delivery time where available
- Status
- Error message

Statuses:

QUEUED
SENDING
SENT
DELIVERED
FAILED

---

# 72. ASYNCHRONOUS MESSAGING

Do not make the user wait while email/WhatsApp providers respond.

Use:

Redis
\+
BullMQ

for queued work such as:

- Emails
- WhatsApp
- Deadline reminders
- Retries
- Scheduled notifications
- Heavy reports

The core order transaction should not depend on the messaging provider successfully responding synchronously.

---

# 73. RETRIES

External notification failures should have retry behavior.

Retry intelligently.

Do not create infinite retries.

Store failures.

Allow authorized admins to inspect failed messages.

---

# 74. COMMUNICATION SETTINGS

Allow configuration such as:

Email enabled/disabled
WhatsApp enabled/disabled

Per-event channel preferences where appropriate.

Example:

Order Assigned:

Email = ON
WhatsApp = ON

Order Completed:

Email = ON
WhatsApp = OFF

Deadline 6 Hours:

Email = OFF
WhatsApp = ON

---

# 75. REPORTS

Support reports for:

- Sales
- Orders
- Workers
- Buyers
- Customers
- Profit
- Expenses
- Worker payments
- Buyer payments
- Daily statistics

Reports should support:

- Date ranges
- Filters
- Export where authorized

Do not run huge expensive report queries unnecessarily.

---

# 76. GLOBAL SEARCH

Create a global search experience.

It should be able to find, where permitted:

- Orders
- Buyers
- Customers
- Workers
- Services
- Categories
- Phone
- Email
- External references
- Relevant Order Item links

Use Cmd/Ctrl + K.

Search results should be categorized.

Example:

Orders
\#10482
\#10481

Buyers
ABC Digital Agency

Customers
John Smith

Workers
Ahmed Khan

---

# 77. ORDER SEARCH EXPERIENCE

The Orders page should provide both:

- Fast text search
- Structured filtering

A user should not need to navigate through many pages to find one order.

Make search prominent.

---

# 78. SAVED FILTERS

Consider supporting saved filters/views when useful.

Example:

"My Overdue Orders"

"Orders Due Today"

"Ahmed's Active Orders"

"ABC Agency In Progress"

If implemented, store filters as structured data.

Do not save arbitrary unsafe SQL.

---

# 79. CALENDAR

A calendar/deadline view is recommended.

Show:

- Deadlines
- Due today
- Overdue
- Scheduled work

Calendar data should be queried efficiently.

Do not preload every historical order into the calendar.

---

# 80. APPLICATION NAVIGATION

Navigation must be clean and hierarchical.

Use a sidebar.

Do not use a giant flat list.

Related routes should be grouped into nested sections.

Example:

OVERVIEW

Dashboard
Notifications
Activity

OPERATIONS
Orders
All Orders
Pending
Processing
In Progress
Review
Ready for Delivery
Completed
Cancelled
Overdue

CRM
Buyers
Customers
Contacts

WORKFORCE
Workers
Daily Statistics
Performance
Payments

SERVICES
Services
Categories

FINANCE
Overview
Revenue
Buyer Payments
Worker Payments
Expenses
Profit

COMMUNICATION
Email
WhatsApp
Templates
Message Logs

REPORTS
Sales
Orders
Workers
Buyers
Customers
Profit

SYSTEM
Users
Roles
Permissions
Settings

---

# 81. PERMISSION-AWARE NAVIGATION

Navigation must respond to permissions.

Do not show inaccessible modules to users when they clearly have no access.

However, navigation hiding is only UX behavior.

Server authorization remains mandatory.

Example:

Worker sees:

Dashboard
My Orders
My Notifications
My Statistics

Finance user sees Finance.

Super Admin sees everything.

---

# 82. NESTED SIDEBAR

Sections should expand/collapse.

Example:

CRM
Buyers
Customers
Contacts

Finance
Revenue
Buyer Payments
Worker Payments
Expenses
Profit

Do not expose every nested route permanently if it creates visual noise.

Use expansion state intelligently.

Persist open state where useful.

---

# 83. SIDEBAR UX

The sidebar must be:

- Clean
- Quiet
- Structural
- Easy to scan
- Consistent
- Not over-designed

No:

- Neon active states
- Giant glowing icons
- Excessive rounded containers
- Decorative gradients

Use subtle typography and spacing.

---

# 84. ROUTE STRUCTURE

Use a clean route hierarchy.

Examples:

/dashboard

/orders
/orders?status=in\_progress
/orders/[id]

/buyers
/buyers/[id]

/customers
/customers/[id]

/workers
/workers
/workers/[id]
/workers/[id]/stats
/workers/[id]/payments

/daily-stats

/services
/categories

/finance
/finance/revenue
/finance/buyer-payments
/finance/worker-payments
/finance/expenses
/finance/profit

/communication
/communication/email
/communication/whatsapp
/communication/templates
/communication/message-logs

/reports

/settings/users
/settings/roles
/settings/permissions
/settings/system

Use query parameters for list filtering where practical instead of unnecessary duplicate route implementations.

---

# 85. BREADCRUMBS

Use restrained breadcrumbs for deep pages.

Example:

Orders / #10482

Settings / Access Control / Roles / Operations Manager

Do not make breadcrumbs visually dominant.

---

# 86. DASHBOARD PURPOSE

The dashboard should answer:

"What requires my attention right now?"

It should NOT attempt to display every possible metric.

---

# 87. DASHBOARD TOP METRICS

Useful primary metrics:

- Active Orders
- Due Today
- Overdue
- This Month Revenue

Additional metrics can appear contextually.

Prefer typography and whitespace over giant floating cards.

---

# 88. DASHBOARD ORDER TABLE

Include an "Orders Requiring Attention" table.

Columns can include:

- Order
- Buyer
- Customer
- Worker
- Deadline
- Status

Use wide, readable rows.

---

# 89. UPCOMING DEADLINES

Show chronological upcoming deadlines.

Prioritize:

- Overdue
- Due today
- Due soon

Keep this operational rather than decorative.

---

# 90. WORKER WORKLOAD

Show useful workload information.

Example:

Ahmed
4 active orders

Bilal
7 active orders

Use restrained visualization.

---

# 91. RECENT ACTIVITY

Show recent important activity.

Only fetch the number of records actually displayed.

Do not load the entire audit table.

---

# 92. HIGH-END PRODUCT DESIGN REQUIREMENT

The application must NOT look like a generic AI-built dashboard.

The visual target is:

- Clean
- Sophisticated
- Editorial
- Minimal
- Professional
- Calm
- Highly readable
- Structured
- Dense where useful
- Spacious where useful
- Sharp
- Purposeful

Think like an elite product designer designing a high-end operations application.

The system should feel intentionally designed.

---

# 93. ABSOLUTE DESIGN ANTI-PATTERNS

DO NOT USE:

- Distinct rounded border boxes/cards floating on gray backgrounds
- Generic card grids everywhere
- Colorful pill badges for standard statuses
- Dashed dividers
- Dotted dividers
- Heavy solid dividers
- Neon gradients
- Glowing shadows
- Excessive glassmorphism
- Decorative gradient backgrounds
- Giant rounded cards
- Gradient icon backgrounds
- Overly colorful dashboard widgets
- Excessive rounded corners
- "AI SaaS" aesthetic

Do not use visual decoration merely because a template usually includes it.

---

# 94. CANVAS

Use a unified application canvas.

Preferred:

\#FFFFFF

or a very soft:

\#FAFAFA

Sections should flow directly on the canvas.

Do not create a gray page background with a collection of floating cards.

---

# 95. TYPOGRAPHY FIRST

Hierarchy should come from:

- Font size
- Font weight
- Line height
- Color contrast
- Spacing

Use:

Headers:
text-zinc-900 / text-zinc-950

Secondary:
text-zinc-500

Muted:
text-zinc-400

Typography is one of the primary layout tools.

---

# 96. EDITORIAL WHITESPACE

Use generous spacing.

Examples where appropriate:

px-8
px-10
px-12

py-8
py-10
py-12

Do not compress everything simply because it is an internal system.

At the same time, do not waste space unnecessarily.

Create hierarchy through spacing.

---

# 97. CARDS

Cards are NOT the default component.

Do not create a card around:

- Every statistic
- Every input
- Every table
- Every section
- Every form
- Every widget

Use cards only when actual visual containment improves comprehension.

---

# 98. TABLE DESIGN

Tables should be:

- Borderless or minimally bordered
- Wide
- Clean
- Readable
- Spacious
- Editorial

Use:

border-b
border-zinc-100

sparingly.

No heavy grid boxes around every cell.

No excessive visual noise.

---

# 99. STATUS DESIGN

Do not use colorful status pills.

Prefer:

● In Progress

● Completed

● Review

● Overdue

Use:

- Small 4px dot
- Restrained text color
- Subtle visual treatment

Status should be immediately understandable without looking like a UI badge collection.

---

# 100. FORM DESIGN

Forms should use typography and whitespace.

Do not place every field inside a rounded card.

Inputs should be:

- Plain
- Minimal
- Borderless where appropriate
- Bottom-underlined where useful
- Razor-thin bordered where useful
- Strong but restrained focus state

Focus states should be obvious without glowing effects.

---

# 101. BUTTONS

Buttons should be:

- Clear
- Professional
- Appropriately sized
- Minimal
- Easy to scan

Avoid enormous rounded pill buttons.

Primary actions should have strong visual hierarchy without decorative effects.

---

# 102. NAVIGATION DESIGN

Sidebar should be structural.

Use:

- Text
- Spacing
- Subtle icons
- Nested hierarchy
- Quiet active states

No giant colorful icon tiles.

---

# 103. ORDER DETAIL UX

The Order Detail page should behave like a professional workspace.

Suggested structure:

Order header

Order metadata

Work

Files

Notes

Activity

Example:

\#10482
ABC Digital Agency
John Smith

In Progress

Created:
Sep 9, 2026

Deadline:
Sep 10, 2026

Source:
Wholesale

Buyer:
ABC Digital Agency

Customer:
John Smith

WORK

UX Design
Ahmed
In Progress
Deadline: Today 4:00 PM

Development
Bilal
Completed
Deadline: Today 2:00 PM

FILES

NOTES

ACTIVITY

Do not put every section inside a nested card.

---

# 104. RESPONSIVE DESIGN

Desktop is the primary environment.

Application should also work on:

- Laptop
- Tablet
- Mobile

On mobile:

- Sidebar becomes drawer
- Tables adapt intelligently
- Long data remains accessible
- Order workspace stacks correctly
- Important actions remain accessible

Do not simply shrink desktop UI.

---

# 105. ACCESSIBILITY

Implement:

- Semantic HTML
- Keyboard navigation
- Visible focus states
- Proper labels
- Screen-reader-friendly controls
- Accessible dialogs
- Accessible dropdowns
- Escape-to-close
- Appropriate contrast
- Keyboard-operable navigation

Use accessible primitives where appropriate.

---

# 106. FRONTEND TECHNOLOGY

Use:

Next.js
TypeScript
React
App Router
Tailwind CSS
shadcn/ui
Lucide React

Use Server Components where appropriate.

Use Client Components only when interactivity requires them.

---

# 107. UI COMPONENT LIBRARY

Use shadcn/ui as a starting point where useful.

However, customize the components to the project's design system.

Do not blindly use default shadcn styling if it conflicts with the editorial visual language.

The visual system must remain intentional.

---

# 108. FORMS

Use:

React Hook Form
\+
Zod

Validation should be shared where appropriate.

Do not duplicate validation rules between multiple screens.

---

# 109. TABLES

Use TanStack Table.

Support:

- Sorting
- Filtering
- Pagination
- Column visibility where useful
- Row actions
- Bulk actions where meaningful

Do not add every possible feature to every table.

---

# 110. CHARTS

Use Recharts.

Charts should be:

- Restrained
- Readable
- Useful
- Lightweight

Do not create chart-heavy pages merely to make the application look sophisticated.

---

# 111. DATES

Use date-fns where useful.

All date handling must be deliberate regarding timezone.

Do not create inconsistent timezone behavior between database, server, and browser.

Document the application's timezone assumptions.

---

# 112. CLIENT NOTIFICATIONS

Use Sonner for transient UI feedback such as:

Saved
Updated
Assigned
Failed

Do not use toast notifications as a substitute for persistent business notifications.

---

# 113. DRAG AND DROP

Use dnd-kit only where it genuinely improves functionality.

Possible example:

- Work assignment boards

Do not introduce drag-and-drop into ordinary forms or tables without a concrete usability benefit.

---

# 114. FILE STORAGE

Use Supabase Storage.

Do not keep large files in the database.

Use secure access patterns.

Files should have metadata in PostgreSQL.

---

# 115. EMAIL TOOL

Use Resend.

The email integration should be isolated behind a service/provider abstraction.

For example:

emailService.sendTemplate(...)

The order system should not directly know Resend-specific implementation details.

---

# 116. WHATSAPP TOOL

Use Meta WhatsApp Business Platform.

Isolate it behind a provider service.

For example:

whatsappService.sendTemplate(...)

The order system should not directly depend on provider-specific implementation details.

---

# 117. REDIS / BULLMQ

Use Redis + BullMQ where background processing is needed.

Potential queues:

email
whatsapp
notifications
deadline-reminders
reports

Workers should process jobs separately from user request handling.

---

# 118. SENTRY

Use Sentry for:

- Client errors
- Server errors
- Unexpected exceptions
- Integration failures

Never display raw internal stack traces to ordinary users.

---

# 119. POSTHOG

Use PostHog for product/application usage analytics where appropriate.

Examples:

dashboard\_opened
order\_created
order\_processed
worker\_assigned
report\_viewed

Do not use product analytics as the financial source of truth.

Business data remains in PostgreSQL.

---

# 120. DEVELOPMENT TOOLS

Use:

- Node.js
- pnpm
- Git
- GitHub
- VS Code
- Docker

For API/manual testing where useful:

- Postman
  or
- Bruno

---

# 121. TESTING TOOLS

Use:

Vitest

Testing Library

Playwright

Tests should cover business logic and workflows, not just page rendering.

---

# 122. UNIT TESTS

Test:

- Permission resolution
- Permission precedence
- Role assignments
- Order status transitions
- Financial calculations
- Pricing resolution
- Buyer balance calculations
- Worker payment calculations
- Notification event generation
- Search/filter helper logic

---

# 123. COMPONENT TESTS

Test important interactive components.

Examples:

- Order filter UI
- Role permission editor
- User permission editor
- Order item editor
- Daily stats entry
- Payment forms
- Notification template editor

---

# 124. END-TO-END TESTS

Critical workflow:

Login
↓
Create Buyer
↓
Create Customer
↓
Create Order
↓
Add Order Items
↓
Add Order Item Links
↓
Assign Worker
↓
Process Order
↓
Worker opens assigned work
↓
Worker starts work
↓
Worker updates item
↓
Worker marks item complete
↓
Admin reviews
↓
Order completes

Also test:

- Permission restrictions
- Direct user ALLOW
- Direct user DENY
- Multiple roles
- Search by order ID
- Search by buyer
- Search by customer
- Search by worker
- Search by Order Item URL
- Multi-filter combinations
- Daily statistics
- Payment workflows
- Notifications

---

# 125. NO REGRESSIONS

At every development phase:

1. Run type checking.
2. Run linting.
3. Run unit tests.
4. Run component tests.
5. Run critical E2E tests.
6. Run production build.
7. Check migrations.
8. Check permissions.
9. Check responsive UI.
10. Update documentation.

Do not break previously working features while adding new features.

---

# 126. PROJECT STRUCTURE

Use a clean structure.

Example:

business-manager/

app/
(auth)/
(dashboard)/
dashboard/
orders/
buyers/
customers/
workers/
daily-stats/
services/
categories/
finance/
communication/
reports/
settings/
api/

components/
ui/
layout/
orders/
buyers/
customers/
workers/
stats/
finance/
communication/
shared/

lib/
auth/
permissions/
orders/
buyers/
customers/
workers/
stats/
finance/
notifications/
email/
whatsapp/
search/
filters/
supabase/
prisma/

hooks/

types/

validations/

prisma/

docs/

tests/

scripts/

.env.example

README.md

---

# 127. BUSINESS LOGIC ORGANIZATION

Do not put all business logic directly in React components.

Keep business logic in reusable server-side/application modules.

Examples:

lib/orders
lib/permissions
lib/finance
lib/notifications

Presentation components should not become 2,000-line components.

---

# 128. DATA ACCESS ORGANIZATION

Database access should be organized.

Avoid random Prisma calls scattered across unrelated UI components.

Use clearly named query/service functions.

Example concepts:

getOrders()
searchOrders()
getOrderById()
createOrder()
updateOrder()
assignOrderItem()
changeOrderStatus()

getBuyer()
getBuyerBalance()
getBuyerPricing()

resolveUserPermissions()

This is an architectural pattern, not an instruction to create useless abstraction layers.

---

# 129. QUERY DESIGN

Every query should answer:

- What exact data do I need?
- Can this be aggregated?
- Can it be paginated?
- Which indexes support it?
- Can I avoid a second query?
- Am I accidentally creating an N+1 pattern?
- Can the browser receive less data?

Optimize for useful work, not theoretical micro-optimization.

---

# 130. CACHING

Use caching selectively.

Good candidates:

- Static permission definitions
- Service/category lists
- Configuration
- Rarely changing reference data

Do not cache dynamic operational state without a clear invalidation strategy.

Do not introduce caching simply to appear technically advanced.

---

# 131. REPORT PERFORMANCE

Reports can become expensive.

Optimize reports using:

- Date filtering
- Server-side aggregation
- Appropriate indexes
- Limited result sets
- Pre-aggregation only when proven necessary

Do not calculate large reports by downloading raw records into the browser.

---

# 132. SEARCH DATABASE STRATEGY

Design PostgreSQL search deliberately.

For common exact lookups:

Use indexes.

For text/URL substring searches:

Evaluate PostgreSQL trigram indexing or appropriate search strategies.

For phrase/document search:

Evaluate PostgreSQL full-text search where appropriate.

Choose based on actual usage.

Do not add expensive search infrastructure prematurely.

---

# 133. URL SEARCH IMPLEMENTATION

Order Item URLs should be searchable efficiently.

Possible implementation:

- Normalize URLs
- Store canonical URL
- Store domain separately if useful
- Store searchable normalized URL
- Use an appropriate index

Example fields may include:

url
normalized\_url
domain
label

The final design must avoid needless duplication while making common URL queries efficient.

---

# 134. URL NORMALIZATION

Where practical:

- Normalize protocol casing
- Normalize obvious trailing slash differences
- Preserve meaningful paths
- Do not destroy query parameters that matter
- Do not assume every URL should be transformed identically

Document normalization behavior.

---

# 135. EMPTY STATES

Every major data screen must have a useful empty state.

Example:

Orders

No orders found.

Try changing the filters or create a new order.

Do not show giant decorative empty-state illustrations unless genuinely useful.

---

# 136. LOADING STATES

Every major async screen should have proper loading UX.

Use lightweight loading states.

Avoid full-screen spinners when a localized loading state is sufficient.

Tables can use restrained skeletons or loading indicators.

---

# 137. ERROR STATES

Every major operation must have a useful error state.

Tell the user:

- What went wrong, when possible
- Whether they can retry
- What action is required

Do not display technical stack traces.

---

# 138. CONFIRMATIONS

Destructive actions such as:

- Delete user
- Delete role
- Delete order
- Delete expense

must require appropriate confirmation.

Use accessible dialogs.

For especially destructive actions, consider typed confirmation where necessary.

---

# 139. SOFT DELETE

Use soft delete where business history requires retention.

Do not soft delete everything automatically.

Decide per entity based on business and audit requirements.

Document the decision.

Financial and audit history should not disappear simply because a user is removed from ordinary UI.

---

# 140. USER DEACTIVATION

Prefer deactivation over deletion when a user has historical activity.

For example:

active = false

Historical orders, payments, and audit logs should remain intact.

---

# 141. CONFIGURATION

System configuration should be database-backed only when dynamic administration is actually useful.

Do not put every possible setting into the database.

Use environment variables for infrastructure secrets/configuration.

Use application settings for business configuration.

---

# 142. ENVIRONMENT VARIABLES

Create:

.env.example

Never place actual production credentials in source control.

Document every environment variable in:

docs/ENVIRONMENT.md

Include:

- Name
- Purpose
- Required/optional
- Where it is obtained
- Which environment uses it

Do not include real secrets.

---

# 143. DEPLOYMENT

Recommended deployment:

Frontend/Application:
Vercel

Database:
Supabase

Storage:
Supabase Storage

Authentication:
Supabase Auth

Email:
Resend

WhatsApp:
Meta WhatsApp Business Platform

Background jobs:
Redis + BullMQ

Error monitoring:
Sentry

Analytics:
PostHog

Source:
GitHub

---

# 144. LOCAL DEVELOPMENT

Use Docker where useful for supporting local infrastructure.

Development should be easy to start.

Document:

- Node version
- pnpm version where applicable
- Installation
- Environment setup
- Supabase project setup
- Prisma commands
- Migrations
- Seed
- Running application
- Running tests
- Building production version

---

# 145. DOCUMENTATION IS MANDATORY

Documentation is part of the deliverable.

Do NOT consider the project complete without proper documentation.

At minimum create:

README.md

docs/ARCHITECTURE.md
docs/DATABASE.md
docs/DESIGN\_SYSTEM.md
docs/PERMISSIONS.md
docs/ORDERS.md
docs/NOTIFICATIONS.md
docs/API.md
docs/ENVIRONMENT.md
docs/DEPLOYMENT.md
docs/DEVELOPMENT.md

These must contain the actual implemented architecture.

Do not create placeholder documents that only say "coming soon".

---

# 146. README.md

Include:

- Project purpose
- Main features
- Tech stack
- Prerequisites
- Installation
- Environment variables
- Local development
- Database setup
- Supabase setup
- Prisma setup
- Seeding
- Tests
- Production build
- Deployment
- High-level architecture

---

# 147. ARCHITECTURE.md

Explain:

- Frontend
- Server architecture
- Supabase
- PostgreSQL
- Prisma
- Auth
- Authorization
- Storage
- Realtime
- Notifications
- Queues
- Email
- WhatsApp
- Search
- Performance strategy

Include a logical architecture diagram in Mermaid if useful.

---

# 148. DATABASE.md

Document:

- Every core model
- Relationships
- Important fields
- Foreign keys
- Constraints
- Indexes
- Search strategy
- Financial source-of-truth rules
- Audit rules
- Soft deletion decisions
- URL storage/search architecture

Also explain where a developer should go to change a model.

---

# 149. DESIGN\_SYSTEM.md

Document:

- Canvas
- Typography
- Colors
- Spacing
- Tables
- Forms
- Sidebar
- Navigation
- Buttons
- Status indicators
- Empty states
- Loading states
- Error states
- Responsive behavior
- Accessibility
- Forbidden visual patterns

Explicitly document the anti-AI-template rules.

---

# 150. PERMISSIONS.md

Document:

- Permission catalog
- Modules
- Roles
- Multiple roles
- Direct user permissions
- Direct denies
- Permission precedence
- Effective permission calculation
- Server authorization
- RLS strategy
- Navigation visibility rules

Include a permission matrix.

---

# 151. ORDERS.md

Document:

- Order fields
- Order Item fields
- Relationships
- Statuses
- Status transitions
- Assignment
- Processing
- Revisions
- Cancellation
- Completion
- Search
- Filtering
- URL handling
- Activity history
- Files
- Notes

---

# 152. NOTIFICATIONS.md

Document:

- Events
- Channels
- Email provider
- WhatsApp provider
- Templates
- Variables
- Queue
- Retry strategy
- Message statuses
- Logs
- Failure handling

---

# 153. API.md

Document every public/internal route or server action that constitutes an important application interface.

For each:

- Purpose
- Authentication
- Permission
- Input
- Validation
- Output
- Errors
- Side effects

Keep documentation synchronized with implementation.

---

# 154. DEVELOPMENT.md

Document:

- Coding conventions
- Folder structure
- Local setup
- Database workflow
- Migrations
- Seeding
- Running tests
- Linting
- Formatting
- Build
- Debugging
- Adding new permissions
- Adding new roles
- Adding new modules
- Updating docs

---

# 155. DEPLOYMENT.md

Document:

- Supabase production setup
- Vercel
- Environment variables
- Domain
- Storage
- Authentication configuration
- Email
- WhatsApp
- Redis
- Worker/background processing
- Sentry
- PostHog
- Database migrations
- Backups/recovery considerations

---

# 156. CHANGE DOCUMENTATION

Whenever a change affects:

- Database
- Permissions
- Navigation
- API
- Notifications
- Design system
- Deployment
- Business workflow

update the appropriate documentation.

Documentation is not a one-time task.

---

# 157. PROJECT PHASES

Do not attempt to build everything in one uncontrolled generation pass.

Build in deliberate phases.

---

## PHASE 1 — FOUNDATION

Build:

- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- Supabase
- Prisma
- Authentication
- User model
- Roles
- Permissions
- Dynamic RBAC
- Direct user permission overrides
- Direct denies
- Permission-aware navigation
- Application shell
- Initial design system
- Documentation foundation

Verify build.

---

## PHASE 2 — CRM

Build:

- Buyers
- Customers
- Contacts
- Buyer pricing
- Buyer balance
- Buyer payments

Verify search/filtering.

Update documentation.

---

## PHASE 3 — SERVICES

Build:

- Categories
- Services
- Service pricing

Update documentation.

---

## PHASE 4 — ORDERS

Build:

- Orders
- Order Items
- Workers
- Assignment
- Deadlines
- Status transitions
- Files
- Links
- Notes
- Activity
- Search
- Filtering
- URL filtering
- Pagination

This phase is central.

Optimize database queries carefully.

---

## PHASE 5 — WORKER OPERATIONS

Build:

- Worker dashboard
- Assigned work
- Work actions
- Worker profile
- Performance
- Worker activity

Ensure permissions work correctly.

---

## PHASE 6 — DAILY STATISTICS

Build:

- Daily entry
- Bulk entry
- History
- Filters
- Copy previous day
- Charts
- Export
- User comparison

---

## PHASE 7 — FINANCE

Build:

- Revenue
- Worker costs
- Worker payments
- Buyer payments
- Expenses
- Profit
- Financial ledger/transactions
- Financial reports

Verify financial calculations thoroughly.

---

## PHASE 8 — COMMUNICATION

Build:

- In-app notifications
- Email
- WhatsApp
- Templates
- Message logs
- Deadline reminders
- Queue
- Retry handling

---

## PHASE 9 — REPORTING

Build:

- Sales reports
- Order reports
- Worker reports
- Buyer reports
- Customer reports
- Profit reports
- Export

---

## PHASE 10 — HARDENING

Perform:

- Security review
- RLS review
- Permission review
- Search review
- Performance review
- Database index review
- N+1 query audit
- Accessibility audit
- Mobile review
- E2E tests
- Error handling review
- Documentation audit
- Production build

---

# 158. FINAL QUALITY GATE

Before declaring the system complete, explicitly verify all of the following.

## Business structure

- Buyer exists separately from Customer
- One Buyer can have multiple Customers
- Customers can exist independently when appropriate
- Orders exist separately from Order Items
- Order Items can have different Workers
- Order and Order Item statuses remain separate
- Daily statistics are separate from Orders
- Fiverr is not integrated

## Users

- Users can be manually created
- Super Admin works
- Admin works
- Worker/User works
- Multiple roles per user work
- Custom roles work
- Role editing works
- Role permission assignment works
- Direct user ALLOW works
- Direct user DENY works
- Permission precedence works
- Effective permission view works

## Navigation

- Sidebar is clean
- Related routes are nested
- Navigation responds to permissions
- Routes are logically organized
- Breadcrumbs work where useful
- Unauthorized server access is blocked

## Orders

- Orders can be created
- Order Items can be created
- Workers can be assigned
- Deadlines work
- Status transitions work
- Process Order works
- Revision works
- Cancellation works
- Files work
- Notes work
- Activity works
- Multiple links per Order Item work
- Search can find links
- URL filtering works
- Combined filters work
- Pagination works
- Large datasets do not load unnecessarily

## Search

- Order ID search
- Buyer search
- Customer search
- Worker search
- Service search
- External reference search
- Order Item URL search
- Domain/URL substring search where supported
- Multiple filters
- URL-persisted filters
- Efficient database querying
- No browser-side massive dataset filtering

## Daily Stats

- Manual entry
- Bulk entry
- Editing
- Deletion
- Date filters
- User filters
- History
- Charts
- Export

## Finance

- Revenue
- Worker cost
- Worker payments
- Buyer payments
- Expenses
- Outstanding amounts
- Profit
- Server-side financial calculations
- Consistent transaction history

## Communication

- In-app notifications
- Email through Resend
- WhatsApp through official Meta platform
- Templates
- Variables
- Queue
- Retries
- Logs
- Failure states

## Storage

- Supabase Storage works
- File metadata exists in PostgreSQL
- Access is secure

## Security

- Authentication works
- Authorization works
- RLS works
- Service role secret remains server-side
- Financial data is restricted
- Workers cannot access unauthorized records
- Audit logging works

## Performance

- Server-side filtering
- Efficient pagination
- Proper indexes
- No N+1 queries
- Selective columns
- Limited payloads
- Debounced search
- Realtime only where useful
- No unnecessary polling
- No unnecessary requests
- Dashboard queries are efficient
- Reports are optimized
- Search is indexed appropriately

## UX

- No generic AI dashboard styling
- No excessive cards
- No colorful pills
- No neon gradients
- No glowing shadows
- No heavy dividers
- Unified canvas
- Typography-driven hierarchy
- Strong whitespace
- Clean sidebar
- Nested navigation
- Professional tables
- Clean forms
- Excellent readability
- Responsive behavior
- Accessibility

## Engineering

- TypeScript passes
- Lint passes
- Tests pass
- E2E tests pass
- Production build passes
- Migrations work
- Environment variables documented
- No secrets committed
- Code is organized
- No giant monolithic components
- No unnecessary dependencies
- No duplicated business logic

## Documentation

- README.md complete
- ARCHITECTURE.md complete
- DATABASE.md complete
- DESIGN\_SYSTEM.md complete
- PERMISSIONS.md complete
- ORDERS.md complete
- NOTIFICATIONS.md complete
- API.md complete
- ENVIRONMENT.md complete
- DEPLOYMENT.md complete
- DEVELOPMENT.md complete

Documentation must describe the actual implementation.

---

# 159. IMPORTANT IMPLEMENTATION RULE

Before writing major application code, establish and document:

1. Data model
2. Database relationships
3. Permission architecture
4. Permission precedence
5. Order state machine
6. Search/filter architecture
7. Navigation architecture
8. Design system
9. Notification architecture
10. Performance strategy

Then implement against those decisions.

Do not repeatedly redesign foundational architecture halfway through the build unless a genuine requirement requires it.

---

# 160. IMPORTANT AI DEVELOPMENT RULE

Do not optimize for producing the largest amount of code.

Optimize for producing the correct system.

Do not generate placeholder functionality and call it complete.

Do not silently omit difficult requirements.

If a requirement requires additional implementation work, implement it.

When a tradeoff is unavoidable, preserve:

1. Data correctness
2. Security
3. Core business behavior
4. Permission integrity
5. Search/filter functionality
6. Maintainability

before cosmetic extras.

---

# 161. FINAL DESIGN DIRECTIVE

The application must feel like a serious, high-end internal operations product.

It should look as though an experienced product designer and senior engineering team deliberately designed it.

The goal is NOT:

"Make a dashboard with many cards."

The goal is:

"Create a highly usable operational workspace where people can understand data quickly, find records quickly, perform actions safely, and manage a real business efficiently."

Use:

- Typography
- Spacing
- Hierarchy
- Alignment
- Subtle borders
- Restrained color
- Strong table design
- Excellent information architecture

to create the visual quality.

Avoid decorative UI that does not improve the workflow.

---

# 162. SINGLE SOURCE OF TRUTH

Treat this specification as the project's source of truth.

When implementing:

- Do not lose earlier requirements
- Do not override one requirement with a later convenience
- Preserve Buyer vs Customer distinction
- Preserve Order vs Order Item distinction
- Preserve manual Daily Statistics
- Preserve dynamic roles
- Preserve direct user permissions
- Preserve direct user denies
- Preserve permission-aware nested navigation
- Preserve URL-based Order Item searching/filtering
- Preserve resource-efficient querying
- Preserve documentation
- Preserve the editorial design system
- Preserve the complete lack of Fiverr integration

Every future implementation decision must remain consistent with this specification.
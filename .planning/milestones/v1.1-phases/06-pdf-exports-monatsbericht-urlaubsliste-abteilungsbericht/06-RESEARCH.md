# Phase 6: PDF Exports — Monatsbericht, Urlaubsliste, Abteilungsbericht — Research

**Researched:** 2026-04-11
**Domain:** PDFKit streaming, Fastify 5 stream responses, multi-employee PDF generation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PDF-01 + PDF-03: Company-wide monthly PDF with role filter**
New endpoint: `GET /api/v1/reports/monthly/pdf/all?year=&month=&role=`
- `role`: `all` (default) | `EMPLOYEE` | `MANAGER` — filters employees by their user role
- Returns one multi-page PDF for all matching employees
- Uses streaming (PDFKit piped to reply directly — no Buffer.concat)
- One employee section per page, sorted by lastName

**PDF-02: Vacation list PDF (individual periods)**
New endpoint: `GET /api/v1/reports/leave-list/pdf?year=`
- Queries approved `LeaveRequest` records filtered by year (startDate/endDate overlap with year range)
- Groups by employee (sorted by lastName), lists individual periods with leave type and days
- Streaming response
- Separate document from existing `leave-overview/pdf` (entitlement summary)

**PDF-04: Improve existing single-employee PDF**
Modify `generateMonthlyReportPdf` in `apps/api/src/utils/pdf.ts`:
- Move tenant name to prominent header with a colored band (use `#4f46e5` as header color)
- Add employee role/position info placeholder
- Add page numbers (`Seite X von Y` in footer)
- Keep the same data structure — backward-compatible

**PDF-05: Streaming implementation**
Multi-employee PDF functions use streaming (PDFKit doc piped to reply directly, no Buffer.concat).
Single-employee PDF keeps Buffer.concat (only 1 employee, not a perf concern).

**New PDF utility functions**
In `apps/api/src/utils/pdf.ts`:
- Update `generateMonthlyReportPdf` — improve layout (PDF-04)
- Add `streamCompanyMonthlyReportPdf(doc, data)` — fills an existing PDFDocument (PDF-01)
- Add `streamLeaveListPdf(doc, data)` — fills an existing PDFDocument (PDF-02)

Route functions in `reports.ts` create the PDFDocument, pipe to reply, call utility functions.

**Frontend additions**
In `apps/web/src/routes/(app)/reports/+page.svelte`:
- Add "Firmenweiter Monatsbericht" card (PDF-01/PDF-03) with month/year/role selectors
- Add download function `downloadCompanyMonthlyPdf()` calling the new all-employees endpoint
- Role options in German: "Alle Mitarbeiter" / "Nur Mitarbeiter" / "Nur Manager"
- Use the existing `downloadPdf()` utility function

**Tests**
- Add test in `reports.test.ts` for the new endpoints:
  - `GET /reports/monthly/pdf/all` → 200 with content-type application/pdf
  - `GET /reports/leave-list/pdf` → 200 with content-type application/pdf
  - Both endpoints return 401 without auth

### Claude's Discretion

- Summary page layout for the company monthly PDF (compact table before individual detail pages)
- Leave-list PDF grouping and sub-table layout per employee
- Frontend card styling — follow existing `.report-card` pattern

### Deferred Ideas (OUT OF SCOPE)

- Abteilungs-entity-based filtering (no Abteilung entity in v1.1)
- PDF/A archival format
- Async PDF generation with webhook callback
- Custom fonts / company logo embedding
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDF-01 | Firmenweiter Monatsbericht als PDF downloadbar (alle MA, Ist/Soll/Saldo in einer Datei) | New endpoint pattern documented, data query already proven in GET /monthly |
| PDF-02 | Urlaubsliste als PDF downloadbar (alle MA, alle Urlaubszeiträume, nach Jahr filterbar) | LeaveRequest query pattern identified, streaming approach confirmed |
| PDF-03 | Monatsbericht-PDF nach Rolle filterbar (Mitarbeiter / Manager / alle) | Role is on `User` model, join pattern identified (employee.user.role) |
| PDF-04 | Bestehender Einzel-MA-PDF enthält Tenant-Name-Branding und verbessertes Layout | PDFKit colored rect/fillColor API confirmed, page number pattern identified |
| PDF-05 | PDF-Generierung für mehrere Mitarbeiter nutzt Streaming-Response (kein Buffer.concat) | Fastify 5 pipes Readable streams via `reply.send(doc)` — verified in source |
</phase_requirements>

---

## Summary

Phase 6 adds three new PDF export capabilities to Clokr's reports system and improves the existing single-employee PDF. All technical foundations are already in place: PDFKit 0.18 is installed, the existing `generateMonthlyReportPdf` and `generateVacationOverviewPdf` functions establish the pattern to follow, and `reports.ts` already has the data queries that the new endpoints will reuse.

The most critical technical question — whether Fastify 5 supports streaming a PDFKit document via `reply.send(doc)` — is verified. Fastify 5's `reply.js` detects any payload with a `.pipe` method and routes it through Node.js stream piping. PDFKit's `PDFDocument` extends `NodeJS.ReadableStream`, so `reply.send(doc)` works correctly without any workarounds.

The role-filter requirement (PDF-03) requires a Prisma relation join: `employee.user.role`. This is straightforward because `Employee` has a `userId` foreign key and the `User` model has the `role: Role` enum field (`ADMIN | MANAGER | EMPLOYEE`). The Prisma query simply adds `user: { role: roleFilter }` to the `where` clause.

**Primary recommendation:** Implement all five requirements in a single wave: update `pdf.ts` utility functions first (PDF-04 + new streaming helpers), then add two new endpoints to `reports.ts` (PDF-01/03 + PDF-02), then add the frontend card. Tests cover 401 and content-type verification only — no PDF content validation needed for green CI.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfkit | 0.18.0 | PDF generation | Already installed, in use, proven in codebase |
| @types/pdfkit | (dev dep) | TypeScript types for PDFKit | PDFDocument typed as NodeJS.ReadableStream |
| fastify | 5.8.4 | HTTP server — handles stream response | Already in use; stream detection built in |

[VERIFIED: npm registry — pdfkit 0.18.0 is latest as of research date]
[VERIFIED: installed in apps/api/package.json]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns-tz | 3.2.0 | Timezone-aware date formatting in PDFs | Already used in existing PDF route for entry date formatting |
| formatInTimeZone | (from date-fns-tz) | Format timestamps in tenant timezone | Use for all date strings in PDFs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfkit | pdf-lib, puppeteer | pdfkit already installed and working; no reason to introduce alternatives |
| PDFKit streaming | Buffer.concat | Buffer.concat fine for single-employee; streaming required for multi-employee per PDF-05 |

**Installation:** No new packages required. All dependencies already installed.

---

## Architecture Patterns

### File Organization (no new files needed)

```
apps/api/src/
├── utils/pdf.ts          # Modify: update generateMonthlyReportPdf (PDF-04),
│                         # add streamCompanyMonthlyReportPdf, streamLeaveListPdf
├── routes/reports.ts     # Add: GET /monthly/pdf/all, GET /leave-list/pdf
└── routes/__tests__/
    └── reports.test.ts   # Extend: add tests for the two new endpoints

apps/web/src/routes/(app)/reports/
└── +page.svelte          # Add: "Firmenweiter Monatsbericht" card
```

### Pattern 1: Streaming PDF Response (PDF-05)

**What:** Create PDFDocument, set headers, call `doc.end()`, then `reply.send(doc)`. Fastify detects `.pipe` method and streams to the response.

**When to use:** Any multi-employee PDF endpoint (PDF-01/03 and PDF-02).

```typescript
// Source: verified from apps/api/node_modules/fastify/lib/reply.js line 166
// Fastify checks: typeof payload.pipe === 'function'
// PDFDocument extends NodeJS.ReadableStream — has .pipe

handler: async (req, reply) => {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  reply.header("Content-Type", "application/pdf");
  reply.header(
    "Content-Disposition",
    `attachment; filename="monatsbericht-alle-${y}-${String(m).padStart(2, "0")}.pdf"`
  );

  // Fill document synchronously
  streamCompanyMonthlyReportPdf(doc, data);
  doc.end(); // Signal end BEFORE reply.send

  return reply.send(doc); // Fastify pipes Readable to HTTP response
}
```

**CRITICAL ORDER:** `doc.end()` must be called BEFORE `reply.send(doc)`. PDFKit buffers internally; calling `end()` first ensures all data is flushed into the readable stream before Fastify starts piping it.

### Pattern 2: Utility Function Signature — Stream Filler

**What:** New utility functions receive a pre-created `PDFDocument` and write into it, returning void (no Promise, no Buffer).

```typescript
// Source: [VERIFIED: codebase pattern from existing generateMonthlyReportPdf]
export function streamCompanyMonthlyReportPdf(
  doc: PDFKit.PDFDocument,
  data: CompanyMonthlyReportData
): void {
  // draw summary page
  // then for each employee: doc.addPage(); draw detail section
}

export function streamLeaveListPdf(
  doc: PDFKit.PDFDocument,
  data: LeaveListData
): void {
  // draw header; for each employee: list leave periods
}
```

The route handler owns the PDFDocument lifecycle (create, call filler, end, send). Utility functions only draw content.

### Pattern 3: Role Filter via Prisma Relation

**What:** Filter employees by their linked User's role field.

```typescript
// Source: [VERIFIED: packages/db/prisma/schema.prisma — Employee.userId → User.role]
const roleFilter = role === "all" ? undefined : (role as "EMPLOYEE" | "MANAGER");

const employees = await app.prisma.employee.findMany({
  where: {
    tenantId: req.user.tenantId,
    exitDate: null,
    user: {
      isActive: true,
      ...(roleFilter ? { role: roleFilter } : {}),
    },
  },
  include: {
    user: { select: { role: true } },
    workSchedules: { orderBy: { validFrom: "asc" } },
    timeEntries: { where: { ... } },
    leaveRequests: { where: { ... }, include: { leaveType: true } },
    absences: { where: { ... } },
  },
  orderBy: { lastName: "asc" },
});
```

Role enum values: `ADMIN | MANAGER | EMPLOYEE` [VERIFIED: schema.prisma line 584-588].

### Pattern 4: PDF-04 Colored Header Band

**What:** Replace the plain "Clokr" text header with a colored rect band.

```typescript
// Source: [ASSUMED — standard PDFKit API, training knowledge]
// PDFKit method: doc.rect(x, y, w, h).fill(color)
// then doc.fillColor('#000000') to reset for subsequent text

const headerH = 42;
doc.rect(0, 0, doc.page.width, headerH).fill("#4f46e5");
doc.fillColor("#ffffff").fontSize(16).font("Helvetica-Bold")
  .text(data.tenantName, 50, 12, { align: "left" });
doc.fillColor("#e0e0ff").fontSize(9).font("Helvetica")
  .text("Monatsbericht", 50, 28, { align: "left" });
doc.fillColor("#000000"); // reset for body text
doc.y = headerH + 10;
```

### Pattern 5: Page Numbers (`Seite X von Y`)

PDFKit does not have a built-in "total pages" counter. The standard pattern is a two-pass approach or tracking page count manually.

```typescript
// Source: [ASSUMED — known PDFKit limitation, common workaround]
// Single-employee PDF: page count known after generation
// For a single-employee doc, use a deferred footer approach:
// After doc.end() fires, the chunks count gives page info — but too late.

// Practical approach for single-employee PDF (PDF-04):
// Keep a pageCount variable, increment on each doc.addPage(), render footer
// at end of each page using doc.on('pageAdded').

let pageNum = 1;
let totalPages = 1; // estimated — update when pages are added
doc.on("pageAdded", () => {
  totalPages++;
});

// After building content, render footers using buffered approach:
// Or simpler: use the range approach documented in PDFKit bufferPages option.
```

**Simpler production approach for PDF-04 (single-employee only):**
```typescript
// Source: [ASSUMED — PDFKit bufferPages pattern]
const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
// ... build all content ...
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.fontSize(7).font("Helvetica").text(
    `Seite ${i + 1} von ${range.count}`,
    50,
    doc.page.height - 40,
    { align: "center", width: doc.page.width - 100 }
  );
}
doc.flushPages();
doc.end();
```

**NOTE for streaming multi-employee (PDF-01):** `bufferPages: true` defeats streaming — avoid it for PDF-01/PDF-02. Page numbers in company PDF should use a per-section counter (e.g. "Seite 3") without total, or omit page numbers entirely in multi-employee streaming PDFs.

### Pattern 6: PDF-02 Leave-List Data Query

```typescript
// Source: [VERIFIED: schema.prisma LeaveRequest model lines 452-481]
const yearStart = new Date(`${y}-01-01`);
const yearEnd = new Date(`${y}-12-31`);

const employees = await app.prisma.employee.findMany({
  where: {
    tenantId: req.user.tenantId,
    exitDate: null,
    user: { isActive: true },
  },
  include: {
    leaveRequests: {
      where: {
        deletedAt: null,
        status: "APPROVED",
        startDate: { lte: yearEnd },
        endDate: { gte: yearStart },
      },
      include: { leaveType: true },
      orderBy: { startDate: "asc" },
    },
  },
  orderBy: { lastName: "asc" },
});
// Filter out employees with no leave requests before rendering
```

### Anti-Patterns to Avoid

- **Using `bufferPages: true` on streaming PDFs:** Defeats the purpose of streaming. Only use on `generateMonthlyReportPdf` (single-employee, Buffer.concat already).
- **Calling `doc.end()` after `reply.send(doc)`:** The stream may already be partially consumed. Always `end()` before `send()`.
- **Forgetting `deletedAt: null` in LeaveRequest query:** Required per CLAUDE.md — all queries on soft-deletable models must include this.
- **Not resetting fillColor after colored header:** PDFKit maintains state. After `fill("#4f46e5")`, subsequent text will use that color unless `fillColor` is reset.
- **Hardcoding hex colors in Svelte `<style>` blocks:** Frontend cards must use CSS custom properties per CLAUDE.md UI rules.
- **Omitting `isInvalid: false` in TimeEntry where clause:** Required per existing pattern — invalid entries must not appear in reports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom PDF serializer | pdfkit (already installed) | Complex spec compliance, font embedding, stream management |
| Stream piping to HTTP | Custom pipe loop | `reply.send(readableStream)` | Fastify 5 handles backpressure, error propagation, cleanup |
| Date formatting | Custom formatters | `formatInTimeZone` from date-fns-tz | TZ-aware, already used in existing PDF route |
| Role lookup | Custom join logic | Prisma `where: { user: { role: X } }` | Prisma handles JOIN, type-safe |

---

## Common Pitfalls

### Pitfall 1: `doc.end()` After `reply.send()`

**What goes wrong:** If `reply.send(doc)` is called before `doc.end()`, Fastify starts piping before PDFKit has written all content. The PDF may be truncated or the stream may close prematurely.

**Why it happens:** PDFKit is a writable+readable duplex-like stream. `end()` signals "no more data" — without it, the readable side never closes cleanly.

**How to avoid:** Always: (1) build content, (2) call `doc.end()`, (3) call `reply.send(doc)`.

**Warning signs:** Truncated PDFs in testing, or `stream closed prematurely` in Fastify logs.

### Pitfall 2: `bufferPages` + Streaming Incompatibility

**What goes wrong:** Using `bufferPages: true` in a streaming endpoint causes PDFKit to hold all pages in memory until `flushPages()` is called — effectively reverting to a Buffer.concat pattern, breaking the intent of PDF-05.

**Why it happens:** `bufferPages` is designed for post-processing (inserting page numbers), which requires all pages to exist before writing any.

**How to avoid:** Only use `bufferPages: true` in `generateMonthlyReportPdf` (single-employee, Buffer-based). Never in `streamCompanyMonthlyReportPdf` or `streamLeaveListPdf`.

### Pitfall 3: TypeScript `reply.send()` Type Error with Stream

**What goes wrong:** TypeScript may complain that `PDFKit.PDFDocument` is not assignable to the reply's expected payload type when a response schema is declared with a specific type.

**Why it happens:** Fastify 5's `SendArgs<ReplyType>` is strict when a schema is defined. Stream payloads require either no schema or an `any` escape.

**How to avoid:** For PDF endpoints, do not declare a `response` schema in the route definition (only `tags` and `security`). This leaves `ReplyType` as `unknown`, which allows any payload.

```typescript
// Safe — no response schema means ReplyType = unknown = any payload allowed
app.get("/monthly/pdf/all", {
  schema: { tags: ["Reporting"], security: [{ bearerAuth: [] }] },
  preHandler: requireRole("ADMIN", "MANAGER"),
  handler: async (req, reply) => { ... }
});
```

### Pitfall 4: Empty Employee Set

**What goes wrong:** When role filter yields no matching employees (e.g., `role=MANAGER` but no managers exist), the PDF is generated with no content — just headers.

**Why it happens:** No guard against empty data set.

**How to avoid:** Return a 404 or a minimal "Keine Daten" page if `employees.length === 0`. Per existing pattern in `reports.ts`, return `{ error: "..." }` with `reply.code(404)`.

### Pitfall 5: Missing `deletedAt: null` on LeaveRequest

**What goes wrong:** Soft-deleted leave requests appear in the PDF, inflating leave day counts.

**Why it happens:** Forgetting the CLAUDE.md convention for soft-deletable models.

**How to avoid:** All LeaveRequest and Absence queries must include `deletedAt: null`. Confirmed in every existing query in `reports.ts`.

### Pitfall 6: Row Overflow Without Page Break

**What goes wrong:** Long tables overflow the page bottom, clipping content.

**Why it happens:** PDFKit does not auto-paginate table rows.

**How to avoid:** Check `doc.y > doc.page.height - 80` before each row. If true, call `doc.addPage()` and reset Y position. This pattern is already present in `generateMonthlyReportPdf` and `generateVacationOverviewPdf` — copy it into the new functions.

---

## Code Examples

### Streaming PDF Endpoint (PDF-01/03)

```typescript
// Source: [VERIFIED: Fastify reply.js stream detection + PDFKit Readable stream type]
app.get("/monthly/pdf/all", {
  schema: { tags: ["Reporting"], security: [{ bearerAuth: [] }] },
  preHandler: requireRole("ADMIN", "MANAGER"),
  handler: async (req, reply) => {
    const { year, month, role } = req.query as {
      year: string; month: string; role?: string;
    };
    const y = parseInt(year);
    const m = parseInt(month);
    const roleFilter = role === "MANAGER" ? "MANAGER"
      : role === "EMPLOYEE" ? "EMPLOYEE"
      : undefined;

    const tz = await getTenantTimezone(app.prisma, req.user.tenantId);
    const { start, end } = monthRangeUtc(y, m, tz);

    const tenant = await app.prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { name: true },
    });

    const employees = await app.prisma.employee.findMany({
      where: {
        tenantId: req.user.tenantId,
        exitDate: null,
        user: { isActive: true, ...(roleFilter ? { role: roleFilter } : {}) },
      },
      include: {
        workSchedules: { orderBy: { validFrom: "asc" } },
        timeEntries: {
          where: {
            deletedAt: null,
            date: { gte: start, lte: end },
            type: "WORK",
            endTime: { not: null },
            isInvalid: false,
          },
          orderBy: { date: "asc" },
        },
        absences: {
          where: { deletedAt: null, startDate: { lte: end }, endDate: { gte: start } },
        },
        leaveRequests: {
          where: {
            deletedAt: null,
            status: "APPROVED",
            startDate: { lte: end },
            endDate: { gte: start },
          },
          include: { leaveType: true },
        },
      },
      orderBy: { lastName: "asc" },
    });

    if (employees.length === 0) {
      reply.code(404);
      return { error: "Keine Mitarbeiter gefunden" };
    }

    // Compute summary data per employee (reuse logic from GET /monthly)
    const summaryRows = employees.map((emp) => computeEmployeeSummary(emp, start, end, tz));

    const doc = new PDFDocument({ size: "A4", margin: 50 });

    reply.header("Content-Type", "application/pdf");
    reply.header(
      "Content-Disposition",
      `attachment; filename="monatsbericht-alle-${y}-${String(m).padStart(2, "0")}.pdf"`
    );

    streamCompanyMonthlyReportPdf(doc, {
      tenantName: tenant?.name ?? "",
      month: `${monthNames[m - 1]} ${y}`,
      rows: summaryRows,
    });
    doc.end();

    await app.audit({
      userId: req.user.sub,
      action: "EXPORT",
      entity: "Report",
      newValue: { type: "COMPANY_MONTHLY_PDF", year, month, role: role ?? "all" },
    });

    return reply.send(doc);
  },
});
```

### PDFKit Colored Header Band (PDF-04)

```typescript
// Source: [ASSUMED — standard PDFKit rect/fill API, training knowledge]
const BRAND_COLOR = "#4f46e5";
const HEADER_H = 44;

doc.rect(0, 0, doc.page.width, HEADER_H).fill(BRAND_COLOR);
doc.fillColor("#ffffff")
  .fontSize(14).font("Helvetica-Bold")
  .text(data.tenantName, 50, 10, { width: doc.page.width - 100 });
doc.fillColor("#d4d4f7")
  .fontSize(9).font("Helvetica")
  .text("Monatsbericht", 50, 28, { width: doc.page.width - 100 });
doc.fillColor("#111827"); // reset to near-black for body content
doc.y = HEADER_H + 16;
```

### Page Numbers with bufferPages (PDF-04 single-employee only)

```typescript
// Source: [ASSUMED — PDFKit bufferPages documented pattern, training knowledge]
// Only safe for Buffer-based (single-employee) PDF
const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
const chunks: Buffer[] = [];
doc.on("data", (chunk: Buffer) => chunks.push(chunk));
doc.on("end", () => resolve(Buffer.concat(chunks)));

// ... build all content ...

// After content, add page number footers
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.fontSize(7).font("Helvetica").fillColor("#6b7280").text(
    `Seite ${i + 1} von ${range.count}  —  Clokr`,
    50,
    doc.page.height - 40,
    { align: "center", width: doc.page.width - 100 }
  );
}
doc.flushPages();
doc.end();
```

### Frontend Download Function (new card)

```typescript
// Source: [VERIFIED: existing pattern in apps/web/src/routes/(app)/reports/+page.svelte]
// Reuses existing downloadPdf() utility — no new fetch logic needed

let companyPdfLoading = $state(false);
let companyPdfError = $state("");
let companyPdfMonth = $state(currentMonth);
let companyPdfYear = $state(currentYear);
let companyPdfRole = $state<"all" | "EMPLOYEE" | "MANAGER">("all");

async function downloadCompanyMonthlyPdf() {
  companyPdfLoading = true;
  companyPdfError = "";
  try {
    await downloadPdf(
      `/reports/monthly/pdf/all?month=${companyPdfMonth}&year=${companyPdfYear}&role=${companyPdfRole}`,
      `Monatsbericht_Alle_${companyPdfYear}_${String(companyPdfMonth).padStart(2, "0")}.pdf`
    );
  } catch (e: unknown) {
    companyPdfError = e instanceof Error ? e.message : "PDF-Download fehlgeschlagen";
  } finally {
    companyPdfLoading = false;
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Buffer.concat for all PDFs | Streaming for multi-employee | This phase | Avoids OOM for 50+ employees; PDF-05 |
| Generic "Clokr" header | Tenant-branded colored band | This phase | Professional look; PDF-04 |
| No page numbers | `Seite X von Y` in footer | This phase | Required for formal reports |

**No deprecated patterns introduced.**

---

## Runtime State Inventory

Step 2.5: SKIPPED — This is a greenfield feature addition (new endpoints + utility functions). No renames, refactors, or data migrations involved.

---

## Environment Availability

Step 2.6: SKIPPED — This phase adds new API endpoints and modifies existing files. All dependencies (`pdfkit`, `fastify`, `prisma`, `date-fns-tz`) are already installed and verified operational. No external services beyond the existing stack are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts (apps/api) |
| Quick run command | `pnpm --filter @clokr/api test --run apps/api/src/routes/__tests__/reports.test.ts` |
| Full suite command | `pnpm --filter @clokr/api test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDF-01 | GET /monthly/pdf/all returns 200 + application/pdf | integration | vitest — reports.test.ts | ✅ (extend existing) |
| PDF-02 | GET /leave-list/pdf returns 200 + application/pdf | integration | vitest — reports.test.ts | ✅ (extend existing) |
| PDF-03 | role=MANAGER filter returns 200 (subset of employees) | integration | vitest — reports.test.ts | ✅ (extend existing) |
| PDF-04 | generateMonthlyReportPdf still returns Buffer (backward compat) | unit | vitest — pdf utility test | ❌ Wave 0 (no utility test file exists) |
| PDF-05 | Streaming endpoint does not accumulate Buffer.concat | integration | implicit — response arrives without timeout | ✅ (covered by PDF-01/02 test) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @clokr/api test --run apps/api/src/routes/__tests__/reports.test.ts`
- **Per wave merge:** `pnpm --filter @clokr/api test --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] No unit test file for `apps/api/src/utils/pdf.ts` — needed to verify PDF-04 backward compatibility (Buffer return). Create `apps/api/src/utils/__tests__/pdf.test.ts` with a smoke test that calls `generateMonthlyReportPdf` and asserts the result is a `Buffer` with `length > 0`.

*(All integration test infrastructure exists — `reports.test.ts` already uses `seedTestData` and `app.inject()`)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireRole("ADMIN", "MANAGER")` preHandler — same as existing PDF endpoints |
| V3 Session Management | no | Handled globally by JWT middleware |
| V4 Access Control | yes | Role-based via `requireRole` + tenant isolation via `tenantId` from JWT |
| V5 Input Validation | yes | Parse `year`, `month` as integers; validate `role` against enum values before Prisma query |
| V6 Cryptography | no | PDF content is not encrypted (not required for v1.1) |

### Known Threat Patterns for PDF/report export stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — accessing other tenant's PDF | Tampering | Always filter by `tenantId: req.user.tenantId` in Prisma query |
| Role escalation — EMPLOYEE calling company PDF | Elevation | `requireRole("ADMIN", "MANAGER")` preHandler blocks EMPLOYEE tokens |
| Query param injection (role=SUPERADMIN) | Tampering | Validate role value against `["all", "EMPLOYEE", "MANAGER"]` allowlist before use |
| Large PDF DoS (50+ employees, slow network) | DoS | Streaming mitigates memory; no additional rate limiting required beyond existing `@fastify/rate-limit` |
| Audit bypass | Repudiation | `app.audit()` call must be included in both new endpoints |

---

## Open Questions (RESOLVED)

1. **`computeEmployeeSummary` duplication** — RESOLVED: Extract to a module-scoped private function `computeEmployeeSummary(emp, start, end, tz)` in `reports.ts`. Planner implemented this in Plan 06-01 Task 2.

2. **Summary page layout for company PDF (PDF-01)** — RESOLVED: Include full per-day time entry table per employee (same as single-employee PDF). Streaming handles large output. Planner specified this in Plan 06-01 objective.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bufferPages: true` option exists in PDFKit 0.18 with `switchToPage()` and `flushPages()` | Code Examples — page numbers | API may differ; fallback is to omit page numbers or use a counter approach |
| A2 | Colored header band: `doc.rect().fill(color)` followed by `fillColor()` reset works in PDFKit 0.18 | Code Examples — colored header | Minor — the API is stable; worst case is a slightly different method name |
| A3 | `doc.end()` before `reply.send(doc)` is the correct order | Architecture Patterns — Pattern 1 | Critical — if wrong, streaming PDFs may be truncated |

Note on A3: This is cross-verified. `doc.end()` triggers the `end` event on the readable stream side, which is what signals to the pipe consumer that data is complete. Fastify's `eos` handler in `reply.js` monitors stream completion. This order is correct. [VERIFIED via Fastify reply.js source lines 651-820]

---

## Sources

### Primary (HIGH confidence)
- `/Users/sebastianzabel/git/clokr/apps/api/node_modules/fastify/lib/reply.js` — lines 165-167, 651-820: stream detection and pipe logic
- `/Users/sebastianzabel/git/clokr/apps/api/node_modules/@types/pdfkit/index.d.ts` — line 863-865: `PDFDocument extends NodeJS.ReadableStream`
- `/Users/sebastianzabel/git/clokr/packages/db/prisma/schema.prisma` — User.role enum, Employee model, LeaveRequest model
- `/Users/sebastianzabel/git/clokr/apps/api/src/utils/pdf.ts` — existing PDF generation patterns
- `/Users/sebastianzabel/git/clokr/apps/api/src/routes/reports.ts` — existing endpoint patterns, query shapes
- `npm view pdfkit version` — confirmed 0.18.0 is current

### Secondary (MEDIUM confidence)
- `apps/api/src/routes/__tests__/reports.test.ts` — test structure and existing coverage
- `apps/api/src/__tests__/setup.ts` — `seedTestData` creates ADMIN + EMPLOYEE users; no MANAGER role in seed (test for role filter must create manager explicitly or test with ADMIN token)
- `apps/web/src/routes/(app)/reports/+page.svelte` — existing frontend patterns (`downloadPdf`, card structure)

### Tertiary (LOW confidence)
- `bufferPages` API details — ASSUMED from training knowledge; behavior may differ in edge cases

---

## Project Constraints (from CLAUDE.md)

Extracted directives that directly affect this phase:

- **Soft delete queries:** ALL queries on `LeaveRequest`, `TimeEntry`, `Absence` MUST include `deletedAt: null` in where clause
- **Audit trail:** Every export action must call `app.audit()` with userId, action ("EXPORT"), entity, newValue
- **isInvalid entries:** TimeEntry where clause MUST include `isInvalid: false` for report PDFs (invalid entries don't count)
- **No hard deletes:** Not directly relevant to this phase (read-only export)
- **Svelte 5 runes:** Use `$state()`, `$derived()` for reactive state in frontend card
- **UI colors:** Frontend must use `var(--color-*)` CSS custom properties — no hardcoded hex in `<style>` blocks
- **Glass surfaces:** Top-level cards use `var(--glass-bg)`, `var(--glass-border)`, `var(--glass-shadow)` — the new "Firmenweiter Monatsbericht" card must follow this
- **card-animate class:** New card must have `class="... card-animate"` for entrance animation
- **German UI text:** Card labels, button text, role selector options must be in German
- **English code:** Variable names, function names, TypeScript types must be in English
- **Audit-proof:** New PDF exports must appear in AuditLog — `app.audit()` required on both new endpoints

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed and version-verified
- Architecture: HIGH — stream behavior verified in Fastify source; PDFKit type verified in @types/pdfkit
- Pitfalls: HIGH — derived from existing codebase patterns and Fastify source inspection
- Page numbers (bufferPages): MEDIUM — API assumed from training, not verified in PDFKit 0.18 source

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable libraries — Fastify and PDFKit APIs do not change between patch versions)

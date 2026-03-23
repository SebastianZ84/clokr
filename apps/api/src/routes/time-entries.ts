import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { TimeEntrySource } from "@salon/db";

const clockInSchema = z.object({
  employeeId: z.string().uuid().optional(), // optional: Manager kann für andere stempeln
  nfcCardId: z.string().optional(),
  source: z.nativeEnum(TimeEntrySource).default("MANUAL"),
  note: z.string().optional(),
});

const clockOutSchema = z.object({
  breakMinutes: z.number().int().min(0).default(0),
  note: z.string().optional(),
});

const manualEntrySchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  breakMinutes: z.number().int().min(0).default(0),
  note: z.string().optional(),
  source: z.nativeEnum(TimeEntrySource).default("MANUAL"),
});

export async function timeEntryRoutes(app: FastifyInstance) {
  // POST /api/v1/time-entries/clock-in
  app.post("/clock-in", {
    schema: { tags: ["Zeiterfassung"], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (req, reply) => {
      const body = clockInSchema.parse(req.body);
      const user = req.user;

      // NFC: Mitarbeiter anhand Karten-ID ermitteln
      let employeeId = body.employeeId ?? user.employeeId;
      if (body.nfcCardId) {
        const emp = await app.prisma.employee.findUnique({
          where: { nfcCardId: body.nfcCardId },
        });
        if (!emp) return reply.code(404).send({ error: "NFC Karte nicht gefunden" });
        employeeId = emp.id;
      }

      if (!employeeId) return reply.code(400).send({ error: "Mitarbeiter nicht gefunden" });

      // Prüfen ob bereits eingestempelt
      const activeEntry = await app.prisma.timeEntry.findFirst({
        where: { employeeId, endTime: null },
      });
      if (activeEntry) {
        return reply.code(409).send({ error: "Bereits eingestempelt", entryId: activeEntry.id });
      }

      const now = new Date();
      const entry = await app.prisma.timeEntry.create({
        data: {
          employeeId,
          date: new Date(now.toISOString().split("T")[0]),
          startTime: now,
          source: body.source,
          note: body.note,
        },
      });

      await app.audit({
        userId: user.sub,
        action: "CLOCK_IN",
        entity: "TimeEntry",
        entityId: entry.id,
        newValue: entry,
        request: { ip: req.ip, headers: req.headers as Record<string, string> },
      });

      return { success: true, entry };
    },
  });

  // POST /api/v1/time-entries/:id/clock-out
  app.post("/:id/clock-out", {
    schema: { tags: ["Zeiterfassung"], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = clockOutSchema.parse(req.body);

      const entry = await app.prisma.timeEntry.findUnique({ where: { id } });
      if (!entry) return reply.code(404).send({ error: "Eintrag nicht gefunden" });
      if (entry.endTime) return reply.code(409).send({ error: "Bereits ausgestempelt" });

      const now = new Date();
      const updated = await app.prisma.timeEntry.update({
        where: { id },
        data: {
          endTime: now,
          breakMinutes: body.breakMinutes,
          note: body.note,
        },
      });

      // Überstundenkonto aktualisieren
      await updateOvertimeAccount(app, entry.employeeId);

      await app.audit({
        userId: req.user.sub,
        action: "CLOCK_OUT",
        entity: "TimeEntry",
        entityId: id,
        oldValue: entry,
        newValue: updated,
      });

      return { success: true, entry: updated };
    },
  });

  // GET /api/v1/time-entries  (eigene oder alle für Manager)
  app.get("/", {
    schema: { tags: ["Zeiterfassung"], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (req) => {
      const { from, to, employeeId } = req.query as {
        from?: string;
        to?: string;
        employeeId?: string;
      };

      const user = req.user;
      const isManager = ["ADMIN", "MANAGER"].includes(user.role);

      const entries = await app.prisma.timeEntry.findMany({
        where: {
          employeeId: isManager && employeeId ? employeeId : (user.employeeId ?? undefined),
          date: {
            gte: from ? new Date(from) : undefined,
            lte: to ? new Date(to) : undefined,
          },
        },
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { date: "desc" },
      });

      return entries;
    },
  });

  // POST /api/v1/time-entries  (manuelle Erfassung, nur Manager/Admin)
  app.post("/", {
    schema: { tags: ["Zeiterfassung"], security: [{ bearerAuth: [] }] },
    preHandler: requireRole("ADMIN", "MANAGER"),
    handler: async (req, reply) => {
      const body = manualEntrySchema.parse(req.body);

      const entry = await app.prisma.timeEntry.create({
        data: {
          employeeId: body.employeeId,
          date: new Date(body.date),
          startTime: new Date(body.startTime),
          endTime: new Date(body.endTime),
          breakMinutes: body.breakMinutes,
          note: body.note,
          source: "MANUAL",
          createdBy: req.user.sub,
        },
      });

      await updateOvertimeAccount(app, body.employeeId);

      await app.audit({
        userId: req.user.sub,
        action: "CREATE",
        entity: "TimeEntry",
        entityId: entry.id,
        newValue: entry,
      });

      return reply.code(201).send(entry);
    },
  });
}

// ── Hilfsfunktion: Überstundensaldo berechnen ─────────────────────────────────
async function updateOvertimeAccount(app: FastifyInstance, employeeId: string) {
  const schedule = await app.prisma.workSchedule.findUnique({ where: { employeeId } });
  if (!schedule) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const entries = await app.prisma.timeEntry.findMany({
    where: {
      employeeId,
      date: { gte: monthStart, lte: monthEnd },
      endTime: { not: null },
    },
  });

  const workedMinutes = entries.reduce((sum, e) => {
    if (!e.endTime) return sum;
    return sum + (e.endTime.getTime() - e.startTime.getTime()) / 60000 - e.breakMinutes;
  }, 0);

  const shouldMinutes = Number(schedule.weeklyHours) * 60 * 4; // Näherung, echte Berechnung im Service
  const diffHours = (workedMinutes - shouldMinutes) / 60;

  // Überstundenkonto aktualisieren
  await app.prisma.overtimeAccount.upsert({
    where: { employeeId },
    create: { employeeId, balanceHours: diffHours },
    update: { balanceHours: { increment: 0 } }, // wird im Monatsabschluss gesetzt
  });

  // Alert wenn > Threshold
  const account = await app.prisma.overtimeAccount.findUnique({ where: { employeeId } });
  const threshold = Number(schedule.overtimeThreshold);
  if (account && Number(account.balanceHours) >= threshold) {
    app.log.warn(`⚠️  Mitarbeiter ${employeeId} hat ${account.balanceHours}h Überstunden (Threshold: ${threshold}h)`);
    // TODO: Notification senden
  }
}

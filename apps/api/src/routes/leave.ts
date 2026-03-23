import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { LeaveRequestStatus } from "@salon/db";

const createRequestSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  halfDay: z.boolean().default(false),
  note: z.string().optional(),
});

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().optional(),
});

export async function leaveRoutes(app: FastifyInstance) {
  // POST /api/v1/leave/requests  – Urlaubsantrag stellen
  app.post("/requests", {
    schema: { tags: ["Urlaub"], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (req, reply) => {
      const body = createRequestSchema.parse(req.body);
      const employeeId = req.user.employeeId;
      if (!employeeId) return reply.code(400).send({ error: "Kein Mitarbeiter-Profil" });

      const start = new Date(body.startDate);
      const end = new Date(body.endDate);

      // Arbeitstage berechnen (ohne Wochenenden, TODO: Feiertage)
      const days = calculateWorkDays(start, end, body.halfDay);

      // Resturlaub prüfen
      const year = start.getFullYear();
      const entitlement = await app.prisma.leaveEntitlement.findUnique({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: body.leaveTypeId, year } },
      });

      if (!entitlement) return reply.code(400).send({ error: "Kein Urlaubsanspruch für dieses Jahr" });

      const available = Number(entitlement.totalDays) + Number(entitlement.carriedOverDays) - Number(entitlement.usedDays);
      if (days > available) {
        return reply.code(400).send({
          error: "Nicht genug Resturlaub",
          available,
          requested: days,
        });
      }

      // Überschneidungen prüfen
      const overlap = await app.prisma.leaveRequest.findFirst({
        where: {
          employeeId,
          status: { in: ["PENDING", "APPROVED"] },
          OR: [
            { startDate: { lte: end }, endDate: { gte: start } },
          ],
        },
      });
      if (overlap) return reply.code(409).send({ error: "Überschneidung mit bestehendem Antrag" });

      const request = await app.prisma.leaveRequest.create({
        data: {
          employeeId,
          leaveTypeId: body.leaveTypeId,
          startDate: start,
          endDate: end,
          days,
          halfDay: body.halfDay,
          note: body.note,
        },
        include: { leaveType: true },
      });

      await app.audit({
        userId: req.user.sub,
        action: "CREATE",
        entity: "LeaveRequest",
        entityId: request.id,
        newValue: request,
      });

      return reply.code(201).send(request);
    },
  });

  // GET /api/v1/leave/requests  – Anträge abrufen
  app.get("/requests", {
    schema: { tags: ["Urlaub"], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (req) => {
      const user = req.user;
      const { status, employeeId, year } = req.query as {
        status?: LeaveRequestStatus;
        employeeId?: string;
        year?: string;
      };

      const isManager = ["ADMIN", "MANAGER"].includes(user.role);

      return app.prisma.leaveRequest.findMany({
        where: {
          employeeId: isManager && employeeId ? employeeId : (isManager ? undefined : (user.employeeId ?? undefined)),
          status: status ?? undefined,
          startDate: year ? { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } : undefined,
          ...(isManager && !employeeId
            ? { employee: { tenantId: user.tenantId } }
            : {}),
        },
        include: {
          employee: { select: { firstName: true, lastName: true } },
          leaveType: true,
        },
        orderBy: { createdAt: "desc" },
      });
    },
  });

  // PATCH /api/v1/leave/requests/:id/review  – Genehmigen / Ablehnen
  app.patch("/requests/:id/review", {
    schema: { tags: ["Urlaub"], security: [{ bearerAuth: [] }] },
    preHandler: requireRole("ADMIN", "MANAGER"),
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = reviewSchema.parse(req.body);

      const existing = await app.prisma.leaveRequest.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: "Antrag nicht gefunden" });
      if (existing.status !== "PENDING") return reply.code(409).send({ error: "Antrag bereits bearbeitet" });

      const updated = await app.prisma.leaveRequest.update({
        where: { id },
        data: {
          status: body.status,
          reviewedBy: req.user.sub,
          reviewedAt: new Date(),
          reviewNote: body.reviewNote,
        },
      });

      // Bei Genehmigung: UsedDays erhöhen
      if (body.status === "APPROVED") {
        const year = existing.startDate.getFullYear();
        await app.prisma.leaveEntitlement.updateMany({
          where: {
            employeeId: existing.employeeId,
            leaveTypeId: existing.leaveTypeId,
            year,
          },
          data: { usedDays: { increment: Number(existing.days) } },
        });
      }

      await app.audit({
        userId: req.user.sub,
        action: body.status === "APPROVED" ? "APPROVE" : "REJECT",
        entity: "LeaveRequest",
        entityId: id,
        oldValue: existing,
        newValue: updated,
      });

      return updated;
    },
  });

  // DELETE /api/v1/leave/requests/:id  – Antrag zurückziehen
  app.delete("/requests/:id", {
    schema: { tags: ["Urlaub"], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await app.prisma.leaveRequest.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: "Antrag nicht gefunden" });

      const isOwner = existing.employeeId === req.user.employeeId;
      const isManager = ["ADMIN", "MANAGER"].includes(req.user.role);
      if (!isOwner && !isManager) return reply.code(403).send({ error: "Forbidden" });

      if (!["PENDING", "APPROVED"].includes(existing.status)) {
        return reply.code(409).send({ error: "Antrag kann nicht mehr zurückgezogen werden" });
      }

      await app.prisma.leaveRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      // Urlaub wieder gutschreiben wenn genehmigt war
      if (existing.status === "APPROVED") {
        await app.prisma.leaveEntitlement.updateMany({
          where: {
            employeeId: existing.employeeId,
            leaveTypeId: existing.leaveTypeId,
            year: existing.startDate.getFullYear(),
          },
          data: { usedDays: { decrement: Number(existing.days) } },
        });
      }

      return { success: true };
    },
  });

  // GET /api/v1/leave/entitlements/:employeeId
  app.get("/entitlements/:employeeId", {
    schema: { tags: ["Urlaub"], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (req) => {
      const { employeeId } = req.params as { employeeId: string };
      const { year } = req.query as { year?: string };

      return app.prisma.leaveEntitlement.findMany({
        where: {
          employeeId,
          year: year ? parseInt(year) : undefined,
        },
        include: { leaveType: true },
      });
    },
  });
}

function calculateWorkDays(start: Date, end: Date, halfDay: boolean): number {
  if (halfDay) return 0.5;
  let days = 0;
  const current = new Date(start);
  while (current <= end) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) days++;
    current.setDate(current.getDate() + 1);
  }
  return days;
}

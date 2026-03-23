import { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/auth";

export async function reportRoutes(app: FastifyInstance) {
  // GET /api/v1/reports/monthly?employeeId=&year=&month=
  app.get("/monthly", {
    schema: { tags: ["Reporting"], security: [{ bearerAuth: [] }] },
    preHandler: requireRole("ADMIN", "MANAGER"),
    handler: async (req) => {
      const { employeeId, year, month } = req.query as {
        employeeId?: string;
        year: string;
        month: string;
      };

      const y = parseInt(year);
      const m = parseInt(month) - 1;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);

      const where = {
        date: { gte: start, lte: end },
        ...(employeeId ? { employeeId } : { employee: { tenantId: req.user.tenantId } }),
      };

      const entries = await app.prisma.timeEntry.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
        orderBy: [{ employee: { lastName: "asc" } }, { date: "asc" }],
      });

      // Gruppieren nach Mitarbeiter
      const byEmployee = entries.reduce(
        (acc, e) => {
          const key = e.employeeId;
          if (!acc[key]) {
            acc[key] = {
              employee: e.employee,
              entries: [],
              totalWorkedMinutes: 0,
              totalBreakMinutes: 0,
              daysWorked: 0,
            };
          }
          const worked = e.endTime
            ? (e.endTime.getTime() - e.startTime.getTime()) / 60000 - e.breakMinutes
            : 0;
          acc[key].entries.push(e);
          acc[key].totalWorkedMinutes += worked;
          acc[key].totalBreakMinutes += e.breakMinutes;
          acc[key].daysWorked += 1;
          return acc;
        },
        {} as Record<string, {
          employee: { firstName: string; lastName: string; employeeNumber: string };
          entries: typeof entries;
          totalWorkedMinutes: number;
          totalBreakMinutes: number;
          daysWorked: number;
        }>
      );

      return Object.values(byEmployee).map((d) => ({
        ...d,
        totalWorkedHours: (d.totalWorkedMinutes / 60).toFixed(2),
        totalBreakHours: (d.totalBreakMinutes / 60).toFixed(2),
      }));
    },
  });

  // GET /api/v1/reports/leave-overview?year=
  app.get("/leave-overview", {
    schema: { tags: ["Reporting"], security: [{ bearerAuth: [] }] },
    preHandler: requireRole("ADMIN", "MANAGER"),
    handler: async (req) => {
      const { year } = req.query as { year: string };
      const y = parseInt(year ?? new Date().getFullYear().toString());

      const entitlements = await app.prisma.leaveEntitlement.findMany({
        where: {
          year: y,
          employee: { tenantId: req.user.tenantId },
        },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
          leaveType: true,
        },
      });

      return entitlements.map((e) => ({
        employee: e.employee,
        leaveType: e.leaveType,
        year: e.year,
        totalDays: Number(e.totalDays),
        carriedOverDays: Number(e.carriedOverDays),
        usedDays: Number(e.usedDays),
        remainingDays: Number(e.totalDays) + Number(e.carriedOverDays) - Number(e.usedDays),
      }));
    },
  });

  // GET /api/v1/reports/datev?year=&month=  – DATEV LODAS Export
  app.get("/datev", {
    schema: { tags: ["Reporting"], security: [{ bearerAuth: [] }] },
    preHandler: requireRole("ADMIN"),
    handler: async (req, reply) => {
      const { year, month } = req.query as { year: string; month: string };
      const y = parseInt(year);
      const m = parseInt(month) - 1;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);

      const employees = await app.prisma.employee.findMany({
        where: { tenantId: req.user.tenantId, exitDate: null },
        include: {
          workSchedule: true,
          timeEntries: {
            where: { date: { gte: start, lte: end }, endTime: { not: null } },
          },
          leaveEntitlements: {
            where: { year: y },
            include: { leaveType: true },
          },
          absences: {
            where: { startDate: { gte: start }, endDate: { lte: end } },
          },
        },
      });

      // DATEV LODAS CSV Format
      const lines: string[] = [];
      lines.push("Personalnummer;Lohnart;Menge;Einheit;Monat;Jahr");

      for (const emp of employees) {
        const workedMinutes = emp.timeEntries.reduce((sum, e) => {
          if (!e.endTime) return sum;
          return sum + (e.endTime.getTime() - e.startTime.getTime()) / 60000 - e.breakMinutes;
        }, 0);
        const workedHours = (workedMinutes / 60).toFixed(2);

        const sickDays = emp.absences
          .filter((a) => a.type === "SICK")
          .reduce((sum, a) => sum + Number(a.days), 0);

        const vacationUsed = emp.leaveEntitlements
          .filter((le) => le.leaveType.isPaid)
          .reduce((sum, le) => sum + Number(le.usedDays), 0);

        // Lohnart 100 = Normalstunden
        lines.push(`${emp.employeeNumber};100;${workedHours};Std;${month};${year}`);
        // Lohnart 200 = Krankheitstage
        if (sickDays > 0) lines.push(`${emp.employeeNumber};200;${sickDays};Tag;${month};${year}`);
        // Lohnart 300 = Urlaubstage
        if (vacationUsed > 0) lines.push(`${emp.employeeNumber};300;${vacationUsed};Tag;${month};${year}`);
      }

      await app.audit({
        userId: req.user.sub,
        action: "EXPORT",
        entity: "Report",
        newValue: { type: "DATEV", year, month },
      });

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="datev-${year}-${month}.csv"`);
      return lines.join("\n");
    },
  });
}

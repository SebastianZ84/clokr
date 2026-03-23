import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "../middleware/auth";

const createEmployeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employeeNumber: z.string().min(1),
  hireDate: z.string().datetime(),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).default("EMPLOYEE"),
  weeklyHours: z.number().positive().default(40),
  nfcCardId: z.string().optional(),
});

export async function employeeRoutes(app: FastifyInstance) {
  // GET /api/v1/employees
  app.get("/", {
    schema: { tags: ["Mitarbeiter"], security: [{ bearerAuth: [] }] },
    preHandler: requireRole("ADMIN", "MANAGER"),
    handler: async (req) => {
      return app.prisma.employee.findMany({
        where: { tenantId: req.user.tenantId },
        include: {
          user: { select: { email: true, role: true, isActive: true, lastLoginAt: true } },
          workSchedule: true,
          overtimeAccount: { select: { balanceHours: true } },
        },
        orderBy: { lastName: "asc" },
      });
    },
  });

  // GET /api/v1/employees/:id
  app.get("/:id", {
    schema: { tags: ["Mitarbeiter"], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const user = req.user;

      // Mitarbeiter darf nur eigenes Profil sehen
      if (user.role === "EMPLOYEE" && user.employeeId !== id) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const employee = await app.prisma.employee.findUnique({
        where: { id },
        include: {
          user: { select: { email: true, role: true, isActive: true } },
          workSchedule: true,
          overtimeAccount: true,
          leaveEntitlements: { include: { leaveType: true } },
        },
      });

      if (!employee) return reply.code(404).send({ error: "Mitarbeiter nicht gefunden" });
      return employee;
    },
  });

  // POST /api/v1/employees
  app.post("/", {
    schema: { tags: ["Mitarbeiter"], security: [{ bearerAuth: [] }] },
    preHandler: requireRole("ADMIN"),
    handler: async (req, reply) => {
      const body = createEmployeeSchema.parse(req.body);

      const passwordHash = await bcrypt.hash(body.password, 12);

      const result = await app.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: body.email,
            passwordHash,
            role: body.role,
          },
        });

        const employee = await tx.employee.create({
          data: {
            tenantId: req.user.tenantId,
            userId: user.id,
            firstName: body.firstName,
            lastName: body.lastName,
            employeeNumber: body.employeeNumber,
            hireDate: new Date(body.hireDate),
            nfcCardId: body.nfcCardId,
          },
        });

        await tx.workSchedule.create({
          data: {
            employeeId: employee.id,
            weeklyHours: body.weeklyHours,
            validFrom: new Date(body.hireDate),
          },
        });

        await tx.overtimeAccount.create({
          data: { employeeId: employee.id, balanceHours: 0 },
        });

        return { user, employee };
      });

      await app.audit({
        userId: req.user.sub,
        action: "CREATE",
        entity: "Employee",
        entityId: result.employee.id,
        newValue: { ...result.employee, email: body.email },
      });

      return reply.code(201).send(result.employee);
    },
  });
}

import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/login
  app.post("/login", {
    schema: {
      tags: ["Auth"],
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
    },
    handler: async (req, reply) => {
      const { email, password } = loginSchema.parse(req.body);

      const user = await app.prisma.user.findUnique({
        where: { email },
        include: { employee: true },
      });

      if (!user || !user.isActive) {
        return reply.code(401).send({ error: "Ungültige Anmeldedaten" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        await app.audit({ action: "LOGIN_FAILED", entity: "User", entityId: user.id });
        return reply.code(401).send({ error: "Ungültige Anmeldedaten" });
      }

      const payload = {
        sub: user.id,
        role: user.role,
        tenantId: user.employee?.tenantId ?? "",
        employeeId: user.employee?.id,
      };

      const accessToken = app.jwt.sign(payload);
      const refreshToken = app.jwt.sign(payload, { expiresIn: "7d" });

      // Refresh Token speichern
      await app.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Letzten Login aktualisieren
      await app.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await app.audit({
        userId: user.id,
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        request: { ip: req.ip, headers: req.headers as Record<string, string> },
      });

      return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
    },
  });

  // POST /api/v1/auth/refresh
  app.post("/refresh", {
    schema: { tags: ["Auth"] },
    handler: async (req, reply) => {
      const { refreshToken } = refreshSchema.parse(req.body);

      const stored = await app.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: { include: { employee: true } } },
      });

      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        return reply.code(401).send({ error: "Ungültiger Refresh Token" });
      }

      // Rotate refresh token
      await app.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      const payload = {
        sub: stored.user.id,
        role: stored.user.role,
        tenantId: stored.user.employee?.tenantId ?? "",
        employeeId: stored.user.employee?.id,
      };

      const newAccessToken = app.jwt.sign(payload);
      const newRefreshToken = app.jwt.sign(payload, { expiresIn: "7d" });

      await app.prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: stored.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    },
  });

  // POST /api/v1/auth/logout
  app.post("/logout", {
    schema: { tags: ["Auth"] },
    handler: async (req, reply) => {
      const { refreshToken } = refreshSchema.parse(req.body);
      await app.prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      });
      return { success: true };
    },
  });
}

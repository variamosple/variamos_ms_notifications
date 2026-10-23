import os from "node:os";
import { Controller, Get, HttpStatus, Logger, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { InjectDataSource } from "@nestjs/typeorm";
import type { Response } from "express";
import { DataSource } from "typeorm";
import { SkipUserAccessCheck } from "../Auth/SkipUserAccessCheck.js";

@Controller("health")
@SkipUserAccessCheck()
@SkipThrottle()
export class HealthController {
  private readonly startTime = Date.now();
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  async getHealth(@Res() res: Response): Promise<void> {
    const reqStart = Date.now();
    let dbStatus: "UP" | "DOWN" = "UP";
    let dbLatencyMs = 0;

    try {
      const t0 = Date.now();
      await this.dataSource.query("SELECT 1");
      dbLatencyMs = Date.now() - t0;
    } catch (error) {
      dbStatus = "DOWN";
      // The detail of the driver (host, port, user) stays in the log:
      // this route is public (T-16, CA-NT-07).
      this.logger.warn(`Database check failed: ${(error as Error).message}`);
    }

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const checks = {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      memory: {
        usedMb: Math.round(usedMemory / (1024 * 1024)),
        totalMb: Math.round(totalMemory / (1024 * 1024)),
        percentage: Number(((usedMemory / totalMemory) * 100).toFixed(1)),
      },
    };

    const overallStatus = dbStatus === "UP" ? "UP" : "DEGRADED";
    const statusCode =
      overallStatus === "UP" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    res.status(statusCode).json({
      status: overallStatus,
      serviceName: "variamos_ms_notifications",
      version: process.env.npm_package_version || "1.0.0",
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - reqStart,
      checks,
    });
  }
}

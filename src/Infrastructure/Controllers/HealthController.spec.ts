import { Logger } from "@nestjs/common";
import type { Response } from "express";
import type { DataSource } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { HealthController } from "./HealthController.js";

interface HealthJsonResult {
  status: string;
  serviceName: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  responseTimeMs: number;
  checks: {
    database: {
      status: string;
      latencyMs: number;
    };
    memory: {
      usedMb: number;
      totalMb: number;
      percentage: number;
    };
  };
}

describe("HealthController", () => {
  it("should return UP when database query succeeds", async () => {
    const mockDataSource = {
      query: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as DataSource;

    const controller = new HealthController(mockDataSource);

    let statusResult = 0;
    let jsonResult: HealthJsonResult = {} as HealthJsonResult;

    const mockResponse = {
      status: (code: number) => {
        statusResult = code;
        return {
          json: (data: HealthJsonResult) => {
            jsonResult = data;
          },
        };
      },
    } as unknown as Response;

    await controller.getHealth(mockResponse);

    expect(statusResult).toBe(200);
    expect(jsonResult.status).toBe("UP");
    expect(jsonResult.serviceName).toBe("variamos_ms_notifications");
    expect(jsonResult.checks.database.status).toBe("UP");
    expect(jsonResult.checks.memory.percentage).toBeDefined();
  });

  it("should return DEGRADED with 503 when database query fails, without the driver message", async () => {
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => {});
    const mockDataSource = {
      query: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as unknown as DataSource;

    const controller = new HealthController(mockDataSource);

    let statusResult = 0;
    let jsonResult: HealthJsonResult = {} as HealthJsonResult;

    const mockResponse = {
      status: (code: number) => {
        statusResult = code;
        return {
          json: (data: HealthJsonResult) => {
            jsonResult = data;
          },
        };
      },
    } as unknown as Response;

    await controller.getHealth(mockResponse);

    expect(statusResult).toBe(503);
    expect(jsonResult.status).toBe("DEGRADED");
    expect(jsonResult.checks.database.status).toBe("DOWN");
    expect(jsonResult.checks.database).not.toHaveProperty("message");
    expect(JSON.stringify(jsonResult)).not.toContain("Connection refused");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Connection refused"),
    );
    warn.mockRestore();
  });

  // The check after each deployment reads serviceName, status and
  // uptimeSeconds; the monitoring reads the whole contract (EV-108)
  it.each([
    ["reachable", vi.fn().mockResolvedValue([{ "?column?": 1 }])],
    ["unreachable", vi.fn().mockRejectedValue(new Error("refused"))],
  ])(
    "keeps the shared /health contract when the database is %s",
    async (_case, query) => {
      const warn = vi
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => {});
      const controller = new HealthController({
        query,
      } as unknown as DataSource);
      const status = vi.fn();
      const json = vi.fn();
      status.mockReturnValue({ json });

      await controller.getHealth({ status } as unknown as Response);

      expect([200, 503]).toContain(status.mock.calls[0][0]);
      const body = json.mock.calls[0][0] as HealthJsonResult;
      expect(body).toMatchObject({
        serviceName: "variamos_ms_notifications",
        status: expect.stringMatching(/^(UP|DEGRADED|DOWN)$/),
        version: expect.any(String),
        timestamp: expect.any(String),
        checks: expect.any(Object),
      });
      expect(Number.isInteger(body.uptimeSeconds)).toBe(true);
      expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
      warn.mockRestore();
    },
  );
});

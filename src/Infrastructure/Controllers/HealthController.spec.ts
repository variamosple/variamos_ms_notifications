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
      message?: string;
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

  it("should return DEGRADED with 503 when database query fails", async () => {
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
    expect(jsonResult.checks.database.message).toBe("Connection refused");
  });
});

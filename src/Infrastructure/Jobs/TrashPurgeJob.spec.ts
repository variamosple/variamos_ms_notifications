import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import type { PurgeTrashUseCase } from "../../UseCases/PurgeTrashUseCase.js";
import { TrashPurgeJob } from "./TrashPurgeJob.js";

const SCHEDULE = { firstRunMs: 1_000, everyMs: 10_000 };

describe("TrashPurgeJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("purges after the start, then at each interval, until shutdown", async () => {
    const purge = mock<PurgeTrashUseCase>();
    purge.execute.mockResolvedValue(0);
    const job = new TrashPurgeJob(purge, SCHEDULE);

    job.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(999);
    expect(purge.execute).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(purge.execute).toHaveBeenCalledTimes(2);

    job.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(50_000);
    expect(purge.execute).toHaveBeenCalledTimes(2);
  });

  it("logs what it deleted, and goes on after a failure", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    const error = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});
    const purge = mock<PurgeTrashUseCase>();
    purge.execute
      .mockRejectedValueOnce(new Error("database down"))
      .mockResolvedValueOnce(3);
    const job = new TrashPurgeJob(purge, SCHEDULE);

    job.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(10_000);
    job.onApplicationShutdown();

    expect(error).toHaveBeenCalledWith(
      "Could not empty the old trash",
      expect.stringContaining("database down"),
    );
    expect(log).toHaveBeenCalledWith(
      "Deleted 3 notification(s) in the trash for more than 30 days.",
    );
  });
});

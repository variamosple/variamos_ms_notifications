import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import {
  PurgeTrashUseCase,
  TRASH_RETENTION_DAYS,
} from "../../UseCases/PurgeTrashUseCase.js";

export const TRASH_PURGE_SCHEDULE = {
  // Once the service has settled after a start
  firstRunMs: 60_000,
  everyMs: 24 * 60 * 60 * 1000,
};

export const TRASH_PURGE_SCHEDULE_TOKEN = Symbol("TRASH_PURGE_SCHEDULE");

/**
 * Empties the old trash once a day (ADM-N16). The timers do not keep the
 * process alive, and stop when the application shuts down.
 */
@Injectable()
export class TrashPurgeJob
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TrashPurgeJob.name);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly purgeTrash: PurgeTrashUseCase,
    @Inject(TRASH_PURGE_SCHEDULE_TOKEN)
    private readonly schedule: typeof TRASH_PURGE_SCHEDULE,
  ) {}

  public onApplicationBootstrap(): void {
    this.plan(this.schedule.firstRunMs);
  }

  public onApplicationShutdown(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Runs one purge; a failure is logged and the next one still runs. */
  public async run(): Promise<void> {
    try {
      const deleted = await this.purgeTrash.execute();
      if (deleted > 0) {
        this.logger.log(
          `Deleted ${deleted} notification(s) in the trash for more than ${TRASH_RETENTION_DAYS} days.`,
        );
      }
    } catch (error) {
      this.logger.error(
        "Could not empty the old trash",
        error instanceof Error ? error.stack : "unknown failure",
      );
    }
  }

  private plan(delayMs: number): void {
    this.timer = setTimeout(() => {
      void this.run().finally(() => {
        if (this.timer) this.plan(this.schedule.everyMs);
      });
    }, delayMs);
    this.timer.unref();
  }
}

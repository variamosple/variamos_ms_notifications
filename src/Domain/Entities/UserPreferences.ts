export class UserPreferences {
  constructor(
    public readonly userId: string,
    public emailEnabled: boolean,
    public inAppEnabled: boolean,
    public mutedEventTypes: string[],
  ) {}

  public isMuted(eventType: string): boolean {
    return this.mutedEventTypes.includes(eventType);
  }

  public enableEmail(): void {
    this.emailEnabled = true;
  }

  public disableEmail(): void {
    this.emailEnabled = false;
  }

  public enableInApp(): void {
    this.inAppEnabled = true;
  }

  public disableInApp(): void {
    this.inAppEnabled = false;
  }

  public muteEventType(eventType: string): void {
    if (!this.mutedEventTypes.includes(eventType)) {
      this.mutedEventTypes.push(eventType);
    }
  }

  public unmuteEventType(eventType: string): void {
    this.mutedEventTypes = this.mutedEventTypes.filter((t) => t !== eventType);
  }
}

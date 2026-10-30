export class UserPreferences {
  private muted: string[];

  // The muted event types are template keys (Notification.templateKey)
  constructor(
    public readonly userId: string,
    private email: boolean,
    private inApp: boolean,
    mutedEventTypes: string[],
  ) {
    this.muted = [...mutedEventTypes];
  }

  // A user without saved preferences: every channel on, nothing muted
  public static defaultsFor(userId: string): UserPreferences {
    return new UserPreferences(userId, true, true, []);
  }

  public get emailEnabled(): boolean {
    return this.email;
  }

  public get inAppEnabled(): boolean {
    return this.inApp;
  }

  public get mutedEventTypes(): readonly string[] {
    return this.muted;
  }

  public isMuted(eventType: string): boolean {
    return this.muted.includes(eventType);
  }

  public enableEmail(): void {
    this.email = true;
  }

  public disableEmail(): void {
    this.email = false;
  }

  public enableInApp(): void {
    this.inApp = true;
  }

  public disableInApp(): void {
    this.inApp = false;
  }

  public muteEventType(eventType: string): void {
    if (!this.muted.includes(eventType)) {
      this.muted.push(eventType);
    }
  }

  public unmuteEventType(eventType: string): void {
    this.muted = this.muted.filter((t) => t !== eventType);
  }

  public muteOnly(eventTypes: string[]): void {
    this.muted = [...eventTypes];
  }
}

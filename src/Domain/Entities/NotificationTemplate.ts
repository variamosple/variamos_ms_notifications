import { JsonValue } from "./JsonValue.js";

export class NotificationTemplate {
  constructor(
    public readonly key: string,
    public readonly titleTemplate: string,
    public readonly bodyTemplate: string,
    public readonly createdAt: Date,
  ) {}

  /**
   * Replaces placeholders like {{variable}} with their provided values.
   */
  public render(variables: Record<string, JsonValue>): {
    title: string;
    body: string;
  } {
    const title = this.replacePlaceholders(this.titleTemplate, variables);
    const body = this.replacePlaceholders(this.bodyTemplate, variables);
    return { title, body };
  }

  private replacePlaceholders(
    template: string,
    variables: Record<string, JsonValue>,
  ): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return key in variables ? String(variables[key]) : match;
    });
  }
}

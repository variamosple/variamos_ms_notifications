// Tokens of the ports injected by NestJS. Named once, here: a misspelt token
// fails the build instead of the start of the application.
export const NOTIFICATION_REPOSITORY = "INotificationRepository";
export const USER_PREFERENCES_REPOSITORY = "IUserPreferencesRepository";
export const NOTIFICATION_TEMPLATE_REPOSITORY =
  "INotificationTemplateRepository";
export const USER_SERVICE = "IUserService";
export const NOTIFICATION_CHANNEL = "INotificationChannel";

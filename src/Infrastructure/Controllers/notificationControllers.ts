import { NotificationController } from "./NotificationController.js";
import { NotificationPreferencesController } from "./NotificationPreferencesController.js";
import { NotificationTrashController } from "./NotificationTrashController.js";

/**
 * The controllers of /notifications. They share the path and split the use
 * cases, so that none receives more than four of them.
 */
export const NOTIFICATION_CONTROLLERS = [
  NotificationController,
  NotificationTrashController,
  NotificationPreferencesController,
];

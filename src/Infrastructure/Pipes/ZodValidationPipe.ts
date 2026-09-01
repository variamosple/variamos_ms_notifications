import {
  type ArgumentMetadata,
  BadRequestException,
  type PipeTransform,
} from "@nestjs/common";
import { ZodError, type ZodSchema } from "zod";

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  public transform(value: unknown, metadata?: ArgumentMetadata): unknown {
    if (
      metadata?.type &&
      metadata.type !== "body" &&
      metadata.type !== "custom"
    ) {
      return value;
    }

    let parsedValue = value;
    if (typeof value === "string") {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    try {
      return this.schema.parse(parsedValue);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      throw new BadRequestException("Validation failed");
    }
  }
}

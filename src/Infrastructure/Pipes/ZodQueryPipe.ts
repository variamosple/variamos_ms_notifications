import { BadRequestException, type PipeTransform } from "@nestjs/common";
import { ZodError, type ZodSchema } from "zod";

/**
 * Validates and converts a whole query string object with a Zod schema;
 * an invalid value answers 400 instead of falling back to a default.
 */
export class ZodQueryPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  public transform(value: unknown): unknown {
    try {
      return this.schema.parse(value ?? {});
    } catch (error) {
      throw new BadRequestException({
        message: "Invalid query parameters",
        errors: error instanceof ZodError ? error.errors : undefined,
      });
    }
  }
}

import type { QueryRunner } from "typeorm";

// Migrations follow DATABASE_SCHEMA instead of naming a schema
export function qualifiedName(queryRunner: QueryRunner, name: string): string {
  const schema = queryRunner.connection.driver.schema ?? "public";
  return `"${schema}"."${name}"`;
}

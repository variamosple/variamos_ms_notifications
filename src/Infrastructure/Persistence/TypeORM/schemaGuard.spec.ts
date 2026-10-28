import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// The schema changes only through the versioned migrations (EV-79 lot 1):
// synchronize drops the columns and indexes it does not know, dropSchema
// deletes everything. Outside the migrations, none of these may come back.
const ROOT = join(import.meta.dirname, "../../..");
const MIGRATIONS = "Infrastructure/Persistence/TypeORM/Migrations/";

const FORBIDDEN: [string, RegExp][] = [
  // Only "synchronize: false" is allowed, not a value read at run time
  ["synchronize other than false", /\bsynchronize\s*:(?!\s*false\b)/],
  ["synchronize()", /\.synchronize\s*\(/],
  ["dropSchema other than false", /\bdropSchema\s*:(?!\s*false\b)/],
  [
    "query runner schema change",
    /\b(dropDatabase|dropSchema|dropTable|dropColumns?|changeColumns?|renameColumn|renameTable|clearTable)\s*\(/,
  ],
  // SQL is written in capitals here; "truncate" may be an English word
  ["destructive SQL", /\b(DROP\s+(TABLE|COLUMN|SCHEMA)|TRUNCATE)\b/],
];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name)
      ? [path]
      : [];
  });

// Comments may name what is forbidden, to explain why
const withoutComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("schema guard (EV-79)", () => {
  const files = sourceFiles(ROOT)
    .map((path) => relative(ROOT, path))
    .filter((path) => !path.startsWith(MIGRATIONS));

  it("scans the source code", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain("app.module.ts");
  });

  it.each(FORBIDDEN)(
    "finds no %s outside the migrations",
    (_label, pattern) => {
      const found = files.filter((path) =>
        pattern.test(withoutComments(readFileSync(join(ROOT, path), "utf8"))),
      );
      expect(found).toEqual([]);
    },
  );

  it.each([
    ["synchronize: true,"],
    ['synchronize: process.env.DB_SYNC === "true",'],
    ["await dataSource.synchronize();"],
    ["dropSchema: true,"],
    ['await queryRunner.dropColumn("notifications", "title");'],
    ['await manager.query("TRUNCATE variamos.notifications");'],
  ])("would catch %s", (code) => {
    expect(FORBIDDEN.some(([, pattern]) => pattern.test(code))).toBe(true);
  });

  it("allows synchronize: false", () => {
    expect(
      FORBIDDEN.some(([, pattern]) => pattern.test("synchronize: false,")),
    ).toBe(false);
  });
});

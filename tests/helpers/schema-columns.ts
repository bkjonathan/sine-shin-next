// Prints every "table.column" the Drizzle schema declares, as a JSON array
// (AUDIT.md F-33). Run it with tsx, which understands the schema's TypeScript and
// its "@/..." imports: node_modules/.bin/tsx tests/helpers/schema-columns.ts

import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../../src/db/schema";

const found: string[] = [];
for (const value of Object.values(schema)) {
  if (!is(value, PgTable)) continue;
  const { name, columns } = getTableConfig(value);
  for (const column of columns) found.push(`${name}.${column.name}`);
}
console.log(JSON.stringify(found.sort()));

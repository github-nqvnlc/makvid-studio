// Apply pending SQL migrations: pnpm db:migrate (uses DATABASE_URL).
import { migrate } from "../src/index";

const applied = await migrate(process.env.DATABASE_URL);
process.stdout.write(applied.length ? `applied: ${applied.join(", ")}\n` : "database is up to date\n");

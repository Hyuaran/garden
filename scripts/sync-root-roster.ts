import { syncRootRoster } from "../src/app/root/_lib/roster-sync.server";

async function main() {
  const apply = process.argv.includes("--apply");
  const result = await syncRootRoster({ dryRun: !apply });
  console.table([{
    mode: apply ? "APPLY" : "DRY-RUN",
    roster: result.rosterRecords,
    created: result.created,
    updated: result.updated,
    accountsCreated: result.accountsCreated,
    accountsReused: result.accountsReused,
    authBanned: result.authBanned,
    authUnbanned: result.authUnbanned,
    errors: result.errors.length,
  }]);
  if (result.errors.length) {
    console.log("Errors:");
    for (const error of result.errors) console.log(`- ${error}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

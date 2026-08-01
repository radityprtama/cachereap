// Shared mutable run state (bash equivalents: AUTO_YES / DRY_RUN).
export const runState = {
  dryRun: false,
  autoYes: false,
};

export function setRunMode(dryRun: boolean, autoYes: boolean): void {
  runState.dryRun = dryRun;
  runState.autoYes = autoYes;
}

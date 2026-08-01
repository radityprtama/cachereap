export function assertLinux(): void {
  if (process.platform !== "linux") {
    console.error("big-cleanup hanya mendukung Linux.");
    process.exit(1);
  }
}

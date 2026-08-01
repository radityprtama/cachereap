export function assertLinux(): void {
  if (process.platform !== "linux") {
    console.error("cachereap hanya mendukung Linux.");
    process.exit(1);
  }
}

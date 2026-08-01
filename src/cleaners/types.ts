export interface CleanContext {
  projectDir: string;
  staleDays: number;
}

export interface Cleaner {
  key: string;
  icon: string;
  title: string;
  run(ctx: CleanContext): Promise<void>;
}

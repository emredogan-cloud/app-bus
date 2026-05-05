import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImportService } from './import.service.js';
import { IettImporter } from './iett.importer.js';
import { EgoImporter } from './ego.importer.js';
import type { StaticImporter } from './importer.types.js';

/**
 * Runs daily at 02:30 Europe/Istanbul (off-peak for both IBB and EGO data hosts).
 * Each operator is imported independently — one failure doesn't block the others.
 */
@Injectable()
export class ImportCron {
  private readonly log = new Logger(ImportCron.name);

  constructor(
    private readonly importer: ImportService,
    private readonly iett: IettImporter,
    private readonly ego: EgoImporter,
  ) {}

  @Cron('0 30 2 * * *', { timeZone: 'Europe/Istanbul' })
  async run(): Promise<void> {
    const sources: StaticImporter[] = [this.iett, this.ego];
    for (const src of sources) {
      try {
        const fetched = await src.fetch();
        await this.importer.runImport(src.operatorCode, fetched);
      } catch (err) {
        // Log + continue. import_runs row records the failure for observability.
        this.log.error(`${src.operatorCode} import failed: ${(err as Error).message}`);
      }
    }
  }
}

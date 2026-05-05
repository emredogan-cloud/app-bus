import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ImportService } from './import.service.js';
import { IettImporter } from './iett.importer.js';
import { EgoImporter } from './ego.importer.js';
import { EshotImporter, BurulasImporter, AntalyaImporter } from './multi-city-importers.js';
import type { StaticImporter } from './importer.types.js';

/**
 * Runs daily at 02:30 Europe/Istanbul. Per-operator failures are isolated —
 * Phase 10 added IZM/BUR/ANT, all behind their own env-configured GTFS URLs.
 */
@Injectable()
export class ImportCron {
  private readonly log = new Logger(ImportCron.name);
  private readonly sources: StaticImporter[];

  constructor(
    private readonly importer: ImportService,
    iett: IettImporter,
    ego: EgoImporter,
    @Inject(EshotImporter) eshot: StaticImporter,
    @Inject(BurulasImporter) burulas: StaticImporter,
    @Inject(AntalyaImporter) antalya: StaticImporter,
  ) {
    this.sources = [iett, ego, eshot, burulas, antalya];
  }

  @Cron('0 30 2 * * *', { timeZone: 'Europe/Istanbul' })
  async run(): Promise<void> {
    for (const src of this.sources) {
      try {
        const fetched = await src.fetch();
        await this.importer.runImport(src.operatorCode, fetched);
      } catch (err) {
        this.log.error(`${src.operatorCode} import failed: ${(err as Error).message}`);
      }
    }
  }
}

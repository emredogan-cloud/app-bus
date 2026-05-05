import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CitiesController } from './http/cities.controller.js';
import { RoutesController } from './http/routes.controller.js';
import { StopsController } from './http/stops.controller.js';
import { SearchController } from './http/search.controller.js';
import { TransitQueryService } from './transit-query.service.js';
import { ImportService } from './import/import.service.js';
import { IettImporter } from './import/iett.importer.js';
import { EgoImporter } from './import/ego.importer.js';
import { ImportCron } from './import/import.cron.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CitiesController, RoutesController, StopsController, SearchController],
  providers: [TransitQueryService, ImportService, IettImporter, EgoImporter, ImportCron],
  exports: [TransitQueryService, ImportService, IettImporter, EgoImporter],
})
export class TransitModule {}

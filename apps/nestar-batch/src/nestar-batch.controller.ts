import { Controller, Get, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { NestarBatchService } from "./nestar-batch.service";
import {
  BATCH_ROLLBACK,
  BATCH_TIMEZONE,
  BATCH_TOP_PRODUCTS,
  BATCH_TOP_SELLERS,
} from "./lib/config";

@Controller()
export class NestarBatchController {
  private logger: Logger = new Logger("BatchController");
  //Bu NestarBatchController serverda avtomatik ravishda ma'lum vaqtda ishlarni bajarish uchun yozilgan.
  constructor(private readonly nestarBatchService: NestarBatchService) {}

  // Har kuni 01:00:00 da ishlaydi
  @Cron("0 0 1 * * *", { timeZone: BATCH_TIMEZONE, name: BATCH_ROLLBACK })
  public async batchRollback() {
    try {
      this.logger["context"] = BATCH_ROLLBACK;
      this.logger.debug("EXECUTED!");

      await this.nestarBatchService.batchRollback();
    } catch (error) {
      this.logger.error(error);
    }
  }

  // Har kuni 01:00:20 da ishlaydi
  @Cron("20 0 1 * * *", { timeZone: BATCH_TIMEZONE, name: BATCH_TOP_PRODUCTS })
  public async batchTopProducts() {
    try {
      this.logger["context"] = BATCH_TOP_PRODUCTS;
      this.logger.debug("EXECUTED!");

      await this.nestarBatchService.batchTopProducts();
    } catch (error) {
      this.logger.error(error);
    }
  }

  // Har kuni 01:00:40 da ishlaydi
  @Cron("40 0 1 * * *", { timeZone: BATCH_TIMEZONE, name: BATCH_TOP_SELLERS })
  public async batchTopSellers() {
    try {
      this.logger["context"] = BATCH_TOP_SELLERS;
      this.logger.debug("EXECUTED!");

      await this.nestarBatchService.batchTopSellers();
    } catch (error) {
      this.logger.error(error);
    }
  }

  @Cron("0 */5 * * * *", { timeZone: BATCH_TIMEZONE, name: "WISHLIST_ALERTS" })
  async wishlistAlerts() {
    try {
      await this.nestarBatchService.batchWishlistAlerts();
    } catch (error) {
      this.logger.error(error);
    }
  }
  @Get()
  getHello(): string {
    return this.nestarBatchService.getHello();
  }
}

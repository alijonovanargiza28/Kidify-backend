import { ConfigModule } from '@nestjs/config';
ConfigModule.forRoot();
export const BATCH_TIMEZONE = process.env.BATCH_TIMEZONE ?? 'Asia/Tashkent';
// BATCH CONSTANTS

export const BATCH_ROLLBACK = 'BATCH_ROLLBACK';
export const BATCH_TOP_PRODUCTS = 'BATCH_TOP_PRODUCTS';
export const BATCH_TOP_SELLERS = 'BATCH_TOP_SELLERS';

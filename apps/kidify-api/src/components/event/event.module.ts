import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import EventSchema from '../../schemas/Event.model';
import { EventService } from './event.service';
import { EventResolver } from './event.resolver';
@Module({
	imports: [AuthModule, MongooseModule.forFeature([{ name: 'Event', schema: EventSchema }])],
	providers: [EventService, EventResolver],
	exports: [EventService],
})
export class EventModule {}

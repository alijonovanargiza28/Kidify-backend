import { AuthModule } from '../components/auth/auth.module';
import { MessageModule } from '../components/message/message.module';
import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';

@Module({
	imports: [AuthModule, MessageModule],
	providers: [SocketGateway],
})
export class SocketModule {}

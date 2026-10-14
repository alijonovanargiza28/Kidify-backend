import { ProductModule } from "../product/product.module";
import { ChatStateSchema, ChatQuotaSchema } from "./chat-state.model";
import OrderSchema from "../../schemas/Order.model";
import { ChatAssistantService } from "./chat-assistant.service";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import MessageSchema from "../../schemas/Message.model";
import ProductSchema from "../../schemas/Product.model";
import MemberSchema from "../../schemas/Member.model";
import { MessageService } from "./message.service";
import { MessageResolver } from "./message.resolver";
@Module({
  imports: [
    ProductModule,
    AuthModule,
    MongooseModule.forFeature([
      { name: "Message", schema: MessageSchema },
      { name: "ChatState", schema: ChatStateSchema },
      { name: "ChatQuota", schema: ChatQuotaSchema },
      { name: "Order", schema: OrderSchema },
      { name: "Product", schema: ProductSchema },
      { name: "Member", schema: MemberSchema },
    ]),
  ],
  providers: [MessageService, MessageResolver, ChatAssistantService],
  exports: [MessageService, ChatAssistantService],
})
export class MessageModule {}

import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import AddressSchema from "../../schemas/Address.model";
import { AuthModule } from "../auth/auth.module";
import { AddressService } from "./address.service";
import { AddressResolver } from "./address.resolver";
@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: "Address", schema: AddressSchema }]),
  ],
  providers: [AddressService, AddressResolver],
  exports: [AddressService],
})
export class AddressModule {}

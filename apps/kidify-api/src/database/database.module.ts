import { Module } from "@nestjs/common";
import { InjectConnection, MongooseModule } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { mongoUri } from "./../libs/runtime";

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: mongoUri(),
        autoIndex: process.env.NODE_ENV !== "production",
        autoCreate: process.env.NODE_ENV !== "production",
        serverSelectionTimeoutMS: 10000,
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {
  constructor(@InjectConnection() connection: Connection) {
    if (connection.readyState === 1) {
      console.log(
        `MongoDB is connected into ${process.env.NODE_ENV === "production" ? "production" : "development"} db`,
      );
    } else {
      console.log("DB is not connected!");
    }
  }
}

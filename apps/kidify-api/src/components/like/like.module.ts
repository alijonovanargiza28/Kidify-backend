import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { LikeService } from './like.service';
import LikeSchema from "../../schemas/Like.model";

@Module({
  imports:[
     MongooseModule.forFeature([
        { name: "like", 
            schema:LikeSchema
         }
        ]),
    ],
    providers:[LikeService],
    exports:[LikeService]
})
export class LikeModule {}

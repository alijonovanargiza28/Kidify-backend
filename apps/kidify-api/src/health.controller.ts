import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}
  @Get() live() {
    return { status: "ok" };
  }
  @Get("ready") async ready() {
    if (this.connection.readyState !== 1 || !this.connection.db)
      throw new ServiceUnavailableException("NOT_READY");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.connection.db.admin().command({ ping: 1, maxTimeMS: 1000 }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 1500);
        }),
      ]);
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException("NOT_READY");
    } finally {
      clearTimeout(timer);
    }
  }
}

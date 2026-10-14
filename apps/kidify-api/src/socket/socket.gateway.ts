import { OnModuleDestroy } from "@nestjs/common";
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, WebSocket } from "ws";
import { IncomingMessage } from "http";

import { AuthService } from "../components/auth/auth.service";
import { authOrigins } from "../components/auth/auth-http";
import { MessageService } from "../components/message/message.service";
import { ChatAssistantService } from "../components/message/chat-assistant.service";
import { MessageInput } from "../components/message/message";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

@WebSocketGateway({ maxPayload: 16384 })
export class SocketGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private authenticated = new Map<
    WebSocket,
    { memberId: string; token: string }
  >();
  private authTimers = new Map<WebSocket, ReturnType<typeof setTimeout>>();
  private streams = new Map<WebSocket, AbortController>();
  private alive = new WeakMap<WebSocket, boolean>();
  private sweep?: ReturnType<typeof setInterval>;
  constructor(
    private auth: AuthService,
    private messages: MessageService,
    private assistant: ChatAssistantService,
  ) {}
  private emit(
    client: WebSocket,
    event: string,
    data: any,
    requestId?: string,
  ) {
    if (client.readyState === WebSocket.OPEN)
      client.send(
        JSON.stringify({ event, data, ...(requestId ? { requestId } : {}) }),
      );
  }
  async afterInit() {
    this.messages.onMessage = async (message) => {
      await this.broadcast(
        "newMessage",
        message,
        message.scope === "GLOBAL"
          ? undefined
          : [String(message.senderId), String(message.receiverId)],
        message.scope === "GLOBAL",
      );
      await this.sendCounts();
    };
    this.messages.onRead = async (data) => {
      await this.broadcast("readReceipt", data, [
        data.senderId,
        data.receiverId,
      ]);
      await this.sendCounts();
    };
    this.sweep = setInterval(() => void this.checkSessions(), 30000);
    this.sweep.unref();
  }
  handleConnection(client: WebSocket, request: IncomingMessage) {
    if (!authOrigins().includes(request?.headers.origin || "")) {
      client.close(1008, "Origin denied");
      return;
    }
    this.alive.set(client, true);
    client.on("pong", () => this.alive.set(client, true));
    this.authTimers.set(
      client,
      setTimeout(() => {
        if (!this.authenticated.has(client))
          client.close(1008, "Authentication required");
      }, 10000),
    );
  }
  handleDisconnect(client: WebSocket) {
    const id = this.authenticated.get(client)?.memberId;
    this.authenticated.delete(client);
    clearTimeout(this.authTimers.get(client));
    this.authTimers.delete(client);
    this.streams.get(client)?.abort();
    this.streams.delete(client);
    if (id && ![...this.authenticated.values()].some((x) => x.memberId === id))
      void this.broadcast("presence", { memberId: id, online: false });
  }
  private async actor(client: WebSocket) {
    const identity = this.authenticated.get(client);
    if (!identity) throw new Error("UNAUTHORIZED");
    try {
      return await this.auth.verifyToken(identity.token);
    } catch {
      this.emit(client, "authRequired", null);
      throw new Error("UNAUTHORIZED");
    }
  }
  private async checkSessions() {
    for (const [client, session] of this.authenticated) {
      if (this.alive.get(client) === false) {
        client.terminate();
        continue;
      }
      this.alive.set(client, false);
      client.ping();
      try {
        await this.auth.verifyToken(session.token);
      } catch {
        this.emit(client, "authRequired", null);
        client.close(4001, "Refresh authentication");
      }
    }
  }
  private async broadcast(
    event: string,
    data: any,
    recipients?: string[],
    global = false,
  ) {
    for (const [client, session] of this.authenticated) {
      if (recipients && !recipients.includes(session.memberId)) continue;
      try {
        await this.auth.verifyToken(session.token);
        if (global) await this.messages.globalAccess(session.memberId);
        this.emit(client, event, data);
      } catch {
        /* Never deliver private data to an expired or revoked session. */
      }
    }
  }
  private async sendCounts() {
    for (const [client, session] of this.authenticated) {
      try {
        await this.actor(client);
        this.emit(
          client,
          "counts",
          await this.messages.counts(session.memberId),
        );
      } catch {}
    }
  }
  @SubscribeMessage("authenticate") async authenticate(
    client: WebSocket,
    payload: { token: string },
  ) {
    try {
      if (typeof payload?.token !== "string" || payload.token.length > 4096)
        throw new Error();
      const actor = await this.auth.verifyToken(payload.token),
        id = String(actor._id);
      const previous = this.authenticated.get(client);
      if (previous && previous.memberId !== id) throw new Error();
      this.authenticated.set(client, { memberId: id, token: payload.token });
      clearTimeout(this.authTimers.get(client));
      this.authTimers.delete(client);
      this.emit(client, "authenticated", {
        online: [
          ...new Set([...this.authenticated.values()].map((x) => x.memberId)),
        ],
        counts: await this.messages.counts(id),
      });
      await this.broadcast("presence", { memberId: id, online: true });
    } catch {
      this.emit(client, "authRequired", null);
      client.close(4001, "Authentication required");
    }
  }
  @SubscribeMessage("sendMessage") async sendMessage(
    client: WebSocket,
    payload: MessageInput,
  ) {
    try {
      const actor = await this.actor(client),
        input = plainToInstance(MessageInput, payload);
      await validateOrReject(input, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      return {
        event: "messageSent",
        data: await this.messages.send(actor, input),
      };
    } catch {
      return { error: "MESSAGE_REJECTED" };
    }
  }
  @SubscribeMessage("chat") async chat(client: WebSocket, payload: any) {
    const requestId =
      typeof payload?.requestId === "string" && payload.requestId.length <= 80
        ? payload.requestId
        : "";
    if (!requestId) return;
    try {
      const actor = await this.actor(client),
        memberId = String(actor._id);
      await this.messages.quota(memberId, "events", 180, 60000);
      const { action, peerId, before, through, text, clientMessageId } =
        payload;
      for (const value of [peerId, before, through])
        if (
          value !== undefined &&
          (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
        )
          throw new Error("INVALID_MESSAGE");
      let result: any;
      switch (action) {
        case "history":
          result = await this.messages.history(memberId, peerId, before);
          break;
        case "conversations":
          result = await this.messages.conversations(memberId, before);
          break;
        case "counts":
          result = await this.messages.counts(memberId);
          break;
        case "contacts":
          if (typeof payload.search !== "string" || payload.search.length > 80)
            throw new Error("INVALID_MESSAGE");
          result = await this.messages.contacts(
            payload.search,
            payload.csOnly === true,
          );
          break;
        case "send":
          if (
            typeof text !== "string" ||
            !text.trim() ||
            text.length > 3000 ||
            typeof clientMessageId !== "string" ||
            !/^[\w-]{16,80}$/.test(clientMessageId)
          )
            throw new Error("INVALID_MESSAGE");
          result = peerId
            ? await this.messages.decorate(
                (
                  await this.messages.send(actor, {
                    receiverId: peerId,
                    text,
                    clientMessageId,
                  })
                ).toObject(),
              )
            : await this.messages.globalSend(actor, text, clientMessageId);
          break;
        case "read":
          result = await this.messages.markRead(memberId, peerId, through);
          break;
        case "typing":
          await this.messages.quota(memberId, "typing", 30, 60000);
          if (!peerId) await this.messages.globalAccess(memberId, true);
          await this.broadcast(
            "typing",
            {
              memberId,
              peerId,
              nickname: actor.memberNick,
              active: payload.active === true,
            },
            peerId ? [peerId] : undefined,
            !peerId,
          );
          result = true;
          break;
        case "moderate":
          if (
            !["delete", "mute", "block", "unblock"].includes(
              payload.operation,
            ) ||
            typeof payload.target !== "string" ||
            !/^[a-f\d]{24}$/i.test(payload.target)
          )
            throw new Error("INVALID_MESSAGE");
          result = await this.messages.moderate(
            actor,
            payload.operation,
            payload.target,
          );
          await this.broadcast("moderation", {
            operation: payload.operation,
            target: payload.target,
          });
          await this.sendCounts();
          break;
        case "ai": {
          if (this.streams.has(client)) throw new Error("RATE_LIMITED");
          if (
            typeof text !== "string" ||
            !text.trim() ||
            text.length > 1000 ||
            !["en", "ko", "uz"].includes(payload.locale) ||
            (payload.quickAction &&
              !["products", "orders", "shipping", "recommendations"].includes(
                payload.quickAction,
              ))
          )
            throw new Error("INVALID_MESSAGE");
          const controller = new AbortController();
          this.streams.set(client, controller);
          const timeout = setTimeout(() => controller.abort(), process.env.CHAT_AI_PROVIDER === "ollama" ? 120000 : 45000);
          try {
            result = await this.assistant.answer(
              actor,
              { text, locale: payload.locale, action: payload.quickAction },
              (event, data) => this.emit(client, event, data, requestId),
              controller.signal,
            );
          } finally {
            clearTimeout(timeout);
            this.streams.delete(client);
          }
          break;
        }
        default:
          throw new Error("INVALID_MESSAGE");
      }
      this.emit(client, "result", result, requestId);
    } catch (e) {
      const allowed = [
        "UNAUTHORIZED",
        "RATE_LIMITED",
        "CHAT_RESTRICTED",
        "AI_UNAVAILABLE",
        "AI_NOT_CONFIGURED",
        "AI_PROVIDER_ERROR",
        "AI_PROVIDER_LIMIT",
        "AI_SEARCH_FAILED",
        "INVALID_SEARCH",
        "FORBIDDEN",
        "INVALID_MESSAGE",
        "SELF_MESSAGE_DENIED",
        "RECEIVER_NOT_FOUND",
      ];
      this.emit(
        client,
        "chatError",
        { code: allowed.includes(e?.message) ? e.message : "MESSAGE_REJECTED" },
        requestId,
      );
    }
  }
  onModuleDestroy() {
    clearInterval(this.sweep);
    this.authTimers.forEach(clearTimeout);
    this.streams.forEach((c) => c.abort());
    this.authenticated.clear();
    this.messages.onMessage = undefined;
    this.messages.onRead = undefined;
  }
}

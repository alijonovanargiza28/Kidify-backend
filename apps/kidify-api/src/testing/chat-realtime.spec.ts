import { MessageService } from "../components/message/message.service";
import { SocketGateway } from "../socket/socket.gateway";
import { MemberType } from "../libs/enums/member.enum";
import { Types } from "mongoose";
import { Test } from "@nestjs/testing";
import { AuthService } from "../components/auth/auth.service";
import { ChatAssistantService } from "../components/message/chat-assistant.service";
import { WsAdapter } from "@nestjs/platform-ws";
import { WebSocket } from "ws";
const a = "000000000000000000000001",
  b = "000000000000000000000002",
  c = "000000000000000000000003";
describe("chat persistence boundaries (isolated models, no database writes)", () => {
  it("private history scopes both directions to caller, and cursor limits history", async () => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    const model = { find: jest.fn().mockReturnValue(query) };
    const service = new MessageService(
      {} as any,
      {} as any,
      model as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await service.history(a, b, c);
    expect(model.find).toHaveBeenCalledWith({
      deletedAt: null,
      _id: { $lt: new Types.ObjectId(c) },
      $or: [
        { senderId: new Types.ObjectId(a), receiverId: new Types.ObjectId(b) },
        { senderId: new Types.ObjectId(b), receiverId: new Types.ObjectId(a) },
      ],
    });
    expect(query.limit).toHaveBeenCalledWith(31);
  });
  it("duplicate message ID returns persisted message without another notification/write", async () => {
    const saved = {
      senderId: a,
      receiverId: b,
      clientMessageId: "same-request-1234",
    };
    const model = {
        findOne: jest.fn().mockResolvedValue(saved),
        create: jest.fn(),
      },
      members = {
        findOne: jest.fn().mockResolvedValue({ _id: b, memberType: "USER" }),
      },
      notifications = { send: jest.fn() };
    const service = new MessageService(
      {} as any,
      {} as any,
      model as any,
      members as any,
      {} as any,
      notifications as any,
    );
    expect(
      await service.send({ _id: a } as any, {
        receiverId: b,
        text: "Hello",
        clientMessageId: "same-request-1234",
      }),
    ).toBe(saved);
    expect(model.create).not.toHaveBeenCalled();
    expect(notifications.send).not.toHaveBeenCalled();
  });
  it("blocks muted and blocked global writers, but allows unmuted readers", async () => {
    const states = {
      findOne: jest
        .fn()
        .mockResolvedValue({ mutedUntil: new Date(Date.now() + 10000) }),
    };
    const service = new MessageService(
      states as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(service.globalAccess(a, true)).rejects.toThrow(
      "CHAT_RESTRICTED",
    );
    await expect(service.globalAccess(a)).resolves.toBeUndefined();
    states.findOne.mockResolvedValue({ blocked: true } as any);
    await expect(service.globalAccess(a)).rejects.toThrow("CHAT_RESTRICTED");
  });
  it("only admin may moderate; deletion targets GLOBAL messages only", async () => {
    const model = { findOneAndUpdate: jest.fn().mockResolvedValue({ _id: c }) };
    const service = new MessageService(
      {} as any,
      {} as any,
      model as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      service.moderate({ memberType: MemberType.USER } as any, "delete", c),
    ).rejects.toThrow("FORBIDDEN");
    await service.moderate(
      { memberType: MemberType.ADMIN } as any,
      "delete",
      c,
    );
    expect(model.findOneAndUpdate.mock.calls[0][0]).toEqual({
      _id: c,
      scope: "GLOBAL",
    });
  });
  it("read receipts update only incoming messages through displayed cursor", async () => {
    const model = {
        updateMany: jest.fn(),
        countDocuments: jest.fn().mockResolvedValue(0),
      },
      notifications = { readChat: jest.fn() };
    const service = new MessageService(
      {} as any,
      {} as any,
      model as any,
      {} as any,
      {} as any,
      notifications as any,
    );
    service.onRead = jest.fn();
    await service.markRead(a, b, c);
    expect(model.updateMany.mock.calls[0][0]).toEqual({
      senderId: new Types.ObjectId(b),
      receiverId: new Types.ObjectId(a),
      isRead: false,
      _id: { $lte: new Types.ObjectId(c) },
    });
    expect(service.onRead).toHaveBeenCalledWith({
      senderId: b,
      receiverId: a,
      through: c,
    });
  });
});
describe("real WebSocket transport with isolated auth/message fixtures", () => {
  let app: any, port: number, messages: any, sockets: WebSocket[];
  const inbox = new Map<WebSocket, any[]>();
  const waitFor = async (socket: WebSocket, event: string) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const list = inbox.get(socket)!;
      const index = list.findIndex((x) => x.event === event);
      if (index >= 0) return list.splice(index, 1)[0];
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`Missing ${event}`);
  };
  const connect = async (id: string) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`, {
      origin: "http://localhost:3016",
    });
    sockets.push(socket);
    inbox.set(socket, []);
    socket.on("message", (raw) =>
      inbox.get(socket)!.push(JSON.parse(String(raw))),
    );
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    socket.send(JSON.stringify({ event: "authenticate", data: { token: id } }));
    await waitFor(socket, "authenticated");
    return socket;
  };
  beforeEach(async () => {
    sockets = [];
    messages = {
      quota: jest.fn(),
      counts: async () => ({ private: 0, global: 0 }),
      globalAccess: jest.fn(),
      history: jest.fn().mockResolvedValue({ messages: [], hasMore: false }),
    };
    const module = await Test.createTestingModule({
      providers: [
        SocketGateway,
        {
          provide: AuthService,
          useValue: {
            verifyToken: async (token: string) => {
              if (![a, b, c].includes(token)) throw new Error();
              return {
                _id: token,
                memberNick: "Test actor",
                memberType: "USER",
              };
            },
          },
        },
        { provide: MessageService, useValue: messages },
        { provide: ChatAssistantService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0, "127.0.0.1");
    port = app.getHttpServer().address().port;
  });
  afterEach(async () => {
    sockets.forEach((s) => s.terminate());
    await app.close();
    inbox.clear();
  });
  it("broadcasts global messages and isolates private messages from a third participant", async () => {
    const one = await connect(a),
      two = await connect(b),
      outsider = await connect(c);
    await messages.onMessage({
      _id: "private",
      senderId: a,
      receiverId: b,
      text: "Private",
    });
    expect((await waitFor(one, "newMessage")).data.text).toBe("Private");
    expect((await waitFor(two, "newMessage")).data.text).toBe("Private");
    expect(inbox.get(outsider)!.some((x) => x.event === "newMessage")).toBe(
      false,
    );
    await messages.onMessage({
      _id: "global",
      senderId: a,
      scope: "GLOBAL",
      text: "Global",
    });
    expect((await waitFor(outsider, "newMessage")).data.scope).toBe("GLOBAL");
  });
  it("routes typing and read receipts only to private participants; reconnect authenticates again", async () => {
    const one = await connect(a),
      two = await connect(b),
      outsider = await connect(c);
    one.send(
      JSON.stringify({
        event: "chat",
        data: {
          requestId: "typing-1",
          action: "typing",
          peerId: b,
          active: true,
        },
      }),
    );
    expect((await waitFor(two, "typing")).data.memberId).toBe(a);
    expect(inbox.get(outsider)!.some((x) => x.event === "typing")).toBe(false);
    await messages.onRead({ senderId: a, receiverId: b, through: c });
    expect((await waitFor(one, "readReceipt")).data.through).toBe(c);
    one.close();
    await new Promise<void>((r) => one.once("close", () => r()));
    const reconnected = await connect(a);
    expect(reconnected.readyState).toBe(WebSocket.OPEN);
  });
  it("rejects unauthenticated events before database access", async () => {
 const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin: 'http://localhost:3016' });
 sockets.push(socket); inbox.set(socket, []); socket.on('message', raw => inbox.get(socket)!.push(JSON.parse(String(raw))));
 await new Promise<void>(resolve => socket.once('open', () => resolve()));
 socket.send(JSON.stringify({ event: 'chat', data: { requestId: 'unauthenticated', action: 'history', peerId: b } }));
 expect((await waitFor(socket, 'chatError')).data.code).toBe('UNAUTHORIZED');
 expect(messages.history).not.toHaveBeenCalled();
});
it("rejects an untrusted WebSocket origin", async () => {
 const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin: 'https://untrusted.invalid' }); sockets.push(socket);
 const code = await new Promise<number>(resolve => socket.once('close', value => resolve(value)));
 expect(code).toBe(1008);
});
  it("rejects malformed events before database history access", async () => {
    const one = await connect(a);
    one.send(
      JSON.stringify({
        event: "chat",
        data: { requestId: "bad", action: "history", peerId: { $ne: null } },
      }),
    );
    expect((await waitFor(one, "chatError")).data.code).toBe("INVALID_MESSAGE");
    expect(messages.history).not.toHaveBeenCalled();
  });
});

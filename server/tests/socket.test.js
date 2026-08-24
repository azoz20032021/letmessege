'use strict';

const http = require('http');
const { io: ioClient } = require('socket.io-client');

const app = require('../src/app');
const events = require('../src/socket/events');
const presence = require('../src/socket/presence');
const { initSocket } = require('../src/socket');
const { setIO } = require('../src/socket/io');
const { makeUser, authed, makeConversation } = require('./helpers');

let httpServer;
let ioServer;
let baseUrl;
const openClients = [];

/**
 * Connects an authenticated socket.io client.
 *
 * Resolves on the server's `connected` handshake payload rather than the
 * transport-level `connect` event — the server emits it immediately, so
 * resolving earlier would let callers miss it.
 */
const connect = (token) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    openClients.push(socket);
    socket.once(events.CONNECTED, (payload) => {
      socket.handshakePayload = payload;
      resolve(socket);
    });
    socket.on('connect_error', reject);
  });

/** Resolves with the first payload of `event`, or rejects after `timeout` ms. */
const waitFor = (socket, event, timeout = 10000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

beforeAll(async () => {
  httpServer = http.createServer(app);
  ioServer = initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

afterEach(() => {
  openClients.splice(0).forEach((s) => s.disconnect());
  presence.reset();
});

afterAll(async () => {
  await new Promise((resolve) => ioServer.close(resolve));
  await new Promise((resolve) => httpServer.close(resolve));
  setIO(null);
});

describe('socket handshake', () => {
  it('accepts a connection with a valid token', async () => {
    const alice = await makeUser();
    const socket = await connect(alice.token);
    const payload = socket.handshakePayload;

    expect(socket.connected).toBe(true);
    expect(payload.userId).toBe(alice.id);
  });

  it('refuses a connection without a token', async () => {
    await expect(connect(undefined)).rejects.toThrow(/UNAUTHORIZED/);
  });

  it('refuses a forged token', async () => {
    await expect(connect('header.payload.signature')).rejects.toThrow(/UNAUTHORIZED/);
  });
});

describe('presence', () => {
  it('tells existing clients when a user comes online', async () => {
    const alice = await makeUser();
    const bob = await makeUser();

    const aliceSocket = await connect(alice.token);

    const onlineEvent = waitFor(aliceSocket, events.USER_ONLINE);
    await connect(bob.token);

    expect((await onlineEvent).userId).toBe(bob.id);
  });

  it('announces offline only after the last device disconnects', async () => {
    const alice = await makeUser();
    const bob = await makeUser();

    const watcher = await connect(alice.token);

    const phone = await connect(bob.token);
    const laptop = await connect(bob.token);

    let wentOffline = false;
    watcher.on(events.USER_OFFLINE, () => {
      wentOffline = true;
    });

    phone.disconnect();
    await new Promise((r) => setTimeout(r, 300));
    expect(wentOffline).toBe(false); // laptop is still connected

    const offline = waitFor(watcher, events.USER_OFFLINE);
    laptop.disconnect();
    expect((await offline).userId).toBe(bob.id);
  });
});

describe('realtime messaging', () => {
  it('delivers a message to the other member in the room', async () => {
    const alice = await makeUser({ name: 'Alice' });
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    const incoming = waitFor(bobSocket, events.MESSAGE_NEW);
    const ack = await new Promise((resolve) =>
      aliceSocket.emit(
        events.MESSAGE_SEND,
        { conversationId: chat._id, text: 'ping', tempId: 'tmp-1' },
        resolve
      )
    );

    expect(ack.success).toBe(true);
    expect(ack.tempId).toBe('tmp-1');

    const received = await incoming;
    expect(received.message.text).toBe('ping');
    expect(received.message.sender.name).toBe('Alice');
  });

  it('persists a socket message so it shows up over REST', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const aliceSocket = await connect(alice.token);

    await new Promise((resolve) =>
      aliceSocket.emit(events.MESSAGE_SEND, { conversationId: chat._id, text: 'saved' }, resolve)
    );

    const res = await authed(bob.token).get(`/api/conversations/${chat._id}/messages`);
    expect(res.body.data.messages.at(-1).text).toBe('saved');
  });

  it('refuses to post into a conversation the user is not a member of', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const outsider = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const socket = await connect(outsider.token);

    const ack = await new Promise((resolve) =>
      socket.emit(events.MESSAGE_SEND, { conversationId: chat._id, text: 'intruder' }, resolve)
    );

    expect(ack.success).toBe(false);
    expect(ack.code).toBe('NOT_MEMBER');
  });

  it('rejects an empty message', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const socket = await connect(alice.token);

    const ack = await new Promise((resolve) =>
      socket.emit(events.MESSAGE_SEND, { conversationId: chat._id, text: '' }, resolve)
    );

    expect(ack.success).toBe(false);
    expect(ack.code).toBe('VALIDATION_ERROR');
  });
});

describe('typing indicator', () => {
  it('broadcasts start and stop to the other member but not the sender', async () => {
    const alice = await makeUser({ name: 'Alice' });
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    let echoedToSender = false;
    aliceSocket.on(events.TYPING_UPDATE, () => {
      echoedToSender = true;
    });

    const started = waitFor(bobSocket, events.TYPING_UPDATE);
    aliceSocket.emit(events.TYPING_START, { conversationId: chat._id });

    const startPayload = await started;
    expect(startPayload).toMatchObject({ userId: alice.id, name: 'Alice', isTyping: true });

    const stopped = waitFor(bobSocket, events.TYPING_UPDATE);
    aliceSocket.emit(events.TYPING_STOP, { conversationId: chat._id });
    expect((await stopped).isTyping).toBe(false);

    expect(echoedToSender).toBe(false);
  });

  it('clears the typing state automatically once a message is sent', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    aliceSocket.emit(events.TYPING_START, { conversationId: chat._id });
    await waitFor(bobSocket, events.TYPING_UPDATE);

    const cleared = waitFor(bobSocket, events.TYPING_UPDATE);
    aliceSocket.emit(events.MESSAGE_SEND, { conversationId: chat._id, text: 'done typing' });

    expect((await cleared).isTyping).toBe(false);
  });
});

describe('read receipts', () => {
  it('notifies the room when a member reads the conversation', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);

    await new Promise((resolve) =>
      aliceSocket.emit(events.MESSAGE_SEND, { conversationId: chat._id, text: 'read me' }, resolve)
    );

    const readEvent = waitFor(aliceSocket, events.MESSAGE_READ);
    bobSocket.emit(events.MESSAGE_READ, { conversationId: chat._id });

    const payload = await readEvent;
    expect(payload.userId).toBe(bob.id);
    expect(payload.conversationId).toBe(String(chat._id));

    const list = await authed(bob.token).get('/api/conversations');
    expect(list.body.data.conversations[0].unreadCount).toBe(0);
  });
});

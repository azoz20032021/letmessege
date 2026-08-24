'use strict';

const { makeUser, authed, makeConversation } = require('./helpers');

const send = (token, conversationId, body) =>
  authed(token).post(`/api/conversations/${conversationId}/messages`).send(body);

describe('POST /api/conversations/:id/messages', () => {
  it('stores a text message and updates the conversation preview', async () => {
    const alice = await makeUser({ name: 'Alice' });
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const res = await send(alice.token, chat._id, { text: 'Hello Bob 👋' });

    expect(res.status).toBe(201);
    expect(res.body.data.message.text).toBe('Hello Bob 👋');
    expect(res.body.data.message.sender.name).toBe('Alice');

    const list = await authed(alice.token).get('/api/conversations');
    expect(list.body.data.conversations[0].lastMessage.text).toBe('Hello Bob 👋');
  });

  it('rejects an empty message with no attachments', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const res = await send(alice.token, chat._id, { text: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('classifies an image attachment as an image message', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const res = await send(alice.token, chat._id, {
      attachments: [
        { url: 'https://cdn.test/photo.png', name: 'photo.png', mimeType: 'image/png', size: 2048 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.message.type).toBe('image');
  });

  it('blocks a non-member from posting', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const outsider = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    const res = await send(outsider.token, chat._id, { text: 'let me in' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/conversations/:id/messages', () => {
  it('returns messages oldest first and paginates with a cursor', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    for (let i = 1; i <= 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await send(alice.token, chat._id, { text: `message ${i}` });
    }

    const page = await authed(alice.token).get(
      `/api/conversations/${chat._id}/messages?limit=2`
    );

    expect(page.status).toBe(200);
    expect(page.body.data.messages).toHaveLength(2);
    expect(page.body.data.hasMore).toBe(true);
    expect(page.body.data.messages[0].text).toBe('message 4');
    expect(page.body.data.messages[1].text).toBe('message 5');

    const older = await authed(alice.token).get(
      `/api/conversations/${chat._id}/messages?limit=2&before=${encodeURIComponent(
        page.body.data.nextCursor
      )}`
    );
    expect(older.body.data.messages.map((m) => m.text)).toEqual(['message 2', 'message 3']);
  });
});

describe('unread counts', () => {
  it('counts incoming messages and clears them once the room is read', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    await send(alice.token, chat._id, { text: 'one' });
    await send(alice.token, chat._id, { text: 'two' });

    const before = await authed(bob.token).get('/api/conversations');
    expect(before.body.data.conversations[0].unreadCount).toBe(2);

    await authed(bob.token).post(`/api/conversations/${chat._id}/read`);

    const after = await authed(bob.token).get('/api/conversations');
    expect(after.body.data.conversations[0].unreadCount).toBe(0);
  });

  it('never counts the sender own messages as unread', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    await send(alice.token, chat._id, { text: 'my own message' });

    const res = await authed(alice.token).get('/api/conversations');
    expect(res.body.data.conversations[0].unreadCount).toBe(0);
  });
});

describe('editing and deleting', () => {
  it('lets the sender edit their message and stamps editedAt', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });
    const sent = await send(alice.token, chat._id, { text: 'typo heer' });

    const res = await authed(alice.token)
      .patch(`/api/messages/${sent.body.data.message._id}`)
      .send({ text: 'typo here' });

    expect(res.status).toBe(200);
    expect(res.body.data.message.text).toBe('typo here');
    expect(res.body.data.message.editedAt).not.toBeNull();
  });

  it('stops another user from editing someone else message', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });
    const sent = await send(alice.token, chat._id, { text: 'mine' });

    const res = await authed(bob.token)
      .patch(`/api/messages/${sent.body.data.message._id}`)
      .send({ text: 'hijacked' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_SENDER');
  });

  it('soft deletes a message so the thread keeps its shape', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });
    const sent = await send(alice.token, chat._id, { text: 'oops' });

    const res = await authed(alice.token).delete(`/api/messages/${sent.body.data.message._id}`);
    expect(res.status).toBe(200);

    const list = await authed(bob.token).get(`/api/conversations/${chat._id}/messages`);
    const deleted = list.body.data.messages.find((m) => m._id === sent.body.data.message._id);
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.text).toBe('');
  });
});

describe('GET /api/messages/search', () => {
  it('finds messages across the caller conversations only', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const carol = await makeUser();

    const mine = await makeConversation(alice.token, { memberIds: [bob.id] });
    const theirs = await makeConversation(bob.token, { memberIds: [carol.id] });

    await send(alice.token, mine._id, { text: 'the deployment pipeline is green' });
    await send(bob.token, theirs._id, { text: 'secret deployment notes' });

    const res = await authed(alice.token).get('/api/messages/search?q=deployment');

    expect(res.status).toBe(200);
    expect(res.body.data.results).toHaveLength(1);
    expect(res.body.data.results[0].text).toContain('pipeline');
  });

  it('treats regex characters in the query as literal text', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const chat = await makeConversation(alice.token, { memberIds: [bob.id] });

    await send(alice.token, chat._id, { text: 'price is 20$ (final)' });
    await send(alice.token, chat._id, { text: 'unrelated message' });

    const res = await authed(alice.token).get(
      `/api/messages/search?q=${encodeURIComponent('20$ (final)')}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.results).toHaveLength(1);
  });

  it('requires a search term', async () => {
    const alice = await makeUser();

    const res = await authed(alice.token).get('/api/messages/search?q=');

    expect(res.status).toBe(400);
  });
});

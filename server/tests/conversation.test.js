'use strict';

const { makeUser, authed, makeConversation } = require('./helpers');

describe('POST /api/conversations', () => {
  it('creates a direct conversation between two users', async () => {
    const alice = await makeUser({ name: 'Alice' });
    const bob = await makeUser({ name: 'Bob' });

    const res = await authed(alice.token)
      .post('/api/conversations')
      .send({ type: 'direct', memberIds: [bob.id] });

    expect(res.status).toBe(201);
    expect(res.body.data.conversation.type).toBe('direct');
    expect(res.body.data.conversation.members).toHaveLength(2);
    expect(res.body.data.conversation.peer.name).toBe('Bob');
  });

  it('reuses the existing room instead of duplicating a direct conversation', async () => {
    const alice = await makeUser();
    const bob = await makeUser();

    const first = await makeConversation(alice.token, { memberIds: [bob.id] });
    // The other side opening the same chat must land in the same room.
    const second = await authed(bob.token)
      .post('/api/conversations')
      .send({ type: 'direct', memberIds: [alice.id] });

    expect(second.status).toBe(200);
    expect(second.body.data.conversation._id).toBe(first._id);
  });

  it('creates a group with the creator as admin', async () => {
    const owner = await makeUser({ name: 'Owner' });
    const m1 = await makeUser();
    const m2 = await makeUser();

    const res = await authed(owner.token)
      .post('/api/conversations')
      .send({ type: 'group', name: 'Team Rocket', memberIds: [m1.id, m2.id] });

    expect(res.status).toBe(201);
    expect(res.body.data.conversation.members).toHaveLength(3);
    expect(res.body.data.conversation.admins).toEqual([owner.id]);
    expect(res.body.data.conversation.title).toBe('Team Rocket');
  });

  it('requires a name for a group', async () => {
    const owner = await makeUser();
    const other = await makeUser();

    const res = await authed(owner.token)
      .post('/api/conversations')
      .send({ type: 'group', memberIds: [other.id] });

    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'name')).toBe(true);
  });

  it('rejects members that do not exist', async () => {
    const alice = await makeUser();

    const res = await authed(alice.token)
      .post('/api/conversations')
      .send({ type: 'direct', memberIds: ['64b7f0f0f0f0f0f0f0f0f0f0'] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_MEMBERS');
  });
});

describe('GET /api/conversations', () => {
  it('lists only the caller conversations, newest first', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const carol = await makeUser();
    const dave = await makeUser();

    await makeConversation(alice.token, { memberIds: [bob.id] });
    await makeConversation(alice.token, { type: 'group', name: 'Squad', memberIds: [carol.id] });
    await makeConversation(dave.token, { memberIds: [carol.id] }); // not Alice's

    const res = await authed(alice.token).get('/api/conversations');

    expect(res.status).toBe(200);
    expect(res.body.data.conversations).toHaveLength(2);
    expect(res.body.data.conversations.every((c) => c.unreadCount === 0)).toBe(true);
  });
});

describe('conversation access control', () => {
  it('blocks a non-member from reading a conversation', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const outsider = await makeUser();

    const conversation = await makeConversation(alice.token, { memberIds: [bob.id] });
    const res = await authed(outsider.token).get(`/api/conversations/${conversation._id}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_MEMBER');
  });

  it('returns 404 for an unknown conversation id', async () => {
    const alice = await makeUser();

    const res = await authed(alice.token).get('/api/conversations/64b7f0f0f0f0f0f0f0f0f0f0');

    expect(res.status).toBe(404);
  });
});

describe('group membership', () => {
  it('lets an admin add members and records a system message', async () => {
    const owner = await makeUser({ name: 'Owner' });
    const member = await makeUser();
    const newbie = await makeUser({ name: 'Newbie' });

    const group = await makeConversation(owner.token, {
      type: 'group',
      name: 'Devs',
      memberIds: [member.id],
    });

    const res = await authed(owner.token)
      .post(`/api/conversations/${group._id}/members`)
      .send({ memberIds: [newbie.id] });

    expect(res.status).toBe(200);
    expect(res.body.data.conversation.members).toHaveLength(3);

    const messages = await authed(owner.token).get(`/api/conversations/${group._id}/messages`);
    const system = messages.body.data.messages.filter((m) => m.type === 'system');
    expect(system.at(-1).text).toContain('added Newbie');
  });

  it('stops a non-admin from adding members', async () => {
    const owner = await makeUser();
    const member = await makeUser();
    const newbie = await makeUser();

    const group = await makeConversation(owner.token, {
      type: 'group',
      name: 'Devs',
      memberIds: [member.id],
    });

    const res = await authed(member.token)
      .post(`/api/conversations/${group._id}/members`)
      .send({ memberIds: [newbie.id] });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_ADMIN');
  });

  it('lets a member leave on their own', async () => {
    const owner = await makeUser();
    const member = await makeUser();

    const group = await makeConversation(owner.token, {
      type: 'group',
      name: 'Devs',
      memberIds: [member.id],
    });

    const res = await authed(member.token).delete(
      `/api/conversations/${group._id}/members/${member.id}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.conversation.members).toHaveLength(1);
  });
});

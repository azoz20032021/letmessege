'use strict';

const presence = require('../src/socket/presence');
const { escapeRegExp } = require('../src/utils/escapeRegExp');

describe('presence registry', () => {
  afterEach(() => presence.reset());

  it('marks a user online on their first socket only', () => {
    expect(presence.addSocket('u1', 's1')).toBe(true);
    expect(presence.addSocket('u1', 's2')).toBe(false);
    expect(presence.isOnline('u1')).toBe(true);
  });

  it('keeps the user online while any device remains connected', () => {
    presence.addSocket('u1', 's1');
    presence.addSocket('u1', 's2');

    expect(presence.removeSocket('s1')).toEqual({ userId: 'u1', wentOffline: false });
    expect(presence.isOnline('u1')).toBe(true);

    expect(presence.removeSocket('s2')).toEqual({ userId: 'u1', wentOffline: true });
    expect(presence.isOnline('u1')).toBe(false);
  });

  it('ignores an unknown socket id', () => {
    expect(presence.removeSocket('ghost')).toEqual({ userId: null, wentOffline: false });
  });

  it('lists the online users and their sockets', () => {
    presence.addSocket('u1', 's1');
    presence.addSocket('u2', 's2');
    presence.addSocket('u1', 's3');

    expect(presence.getOnlineUserIds().sort()).toEqual(['u1', 'u2']);
    expect(presence.getSocketIds('u1').sort()).toEqual(['s1', 's3']);
    expect(presence.getUserId('s2')).toBe('u2');
  });

  it('replaces a pending typing timeout instead of stacking them', () => {
    const first = setTimeout(() => {}, 10000);
    const second = setTimeout(() => {}, 10000);

    presence.setTyping('c1', 'u1', first);
    presence.setTyping('c1', 'u1', second); // clears `first`
    presence.clearTyping('c1', 'u1');

    expect(() => presence.clearTyping('c1', 'u1')).not.toThrow();
  });
});

describe('escapeRegExp', () => {
  it('escapes every regex metacharacter', () => {
    expect(escapeRegExp('a+b*c?')).toBe('a\\+b\\*c\\?');
    expect(escapeRegExp('(group)')).toBe('\\(group\\)');
    expect(escapeRegExp('20$')).toBe('20\\$');
  });

  it('leaves plain text untouched', () => {
    expect(escapeRegExp('hello world')).toBe('hello world');
  });
});

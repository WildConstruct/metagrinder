import path from 'path';

describe('psgStorage helpers', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('short-circuits when supabase client is null', async () => {
    jest.doMock(path.resolve(__dirname, '../utils/supabaseClient.ts'), () => ({
      supabase: null
    }));
    const { listUserGraphs, getUserGraph, putUserGraph } = await import(
      '../utils/psgStorage'
    );

    const list = await listUserGraphs('user1');
    expect(list.ok).toBe(false);
    if (!list.ok) {
      expect(list.error.message).toMatch(/not configured/i);
    }

    const get = await getUserGraph('user1', 'a.psg');
    expect(get.ok).toBe(false);

    const put = await putUserGraph('user1', 'a.psg', '{}');
    expect(put.ok).toBe(false);
  });

  test('listUserGraphs calls list with correct prefix and filters .psg', async () => {
    const listMock = jest.fn().mockResolvedValue({
      data: [
        { name: 'a.psg' },
        { name: 'b.txt' },
        { name: 'c.PSG' } // should be excluded (case-sensitive)
      ],
      error: null
    });
    const fromMock = jest.fn(() => ({ list: listMock }));

    jest.doMock(path.resolve(__dirname, '../utils/supabaseClient.ts'), () => ({
      supabase: { storage: { from: fromMock } }
    }));

    const { listUserGraphs } = await import('../utils/psgStorage');
    const res = await listUserGraphs('user42');

    expect(fromMock).toHaveBeenCalledWith('graphs');
    expect(listMock).toHaveBeenCalledWith(
      'users/user42/graphs/',
      expect.objectContaining({ limit: 100 })
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.map(x => x.name)).toEqual(['a.psg']);
    }
  });

  test('getUserGraph downloads correct path and returns text', async () => {
    const json = JSON.stringify({ x: 1 });
    // Return raw JSON string to avoid Blob/Text polyfill variability
    const downloadMock = jest
      .fn()
      .mockResolvedValue({ data: json, error: null });
    const fromMock = jest.fn(() => ({ download: downloadMock }));

    jest.doMock(path.resolve(__dirname, '../utils/supabaseClient.ts'), () => ({
      supabase: { storage: { from: fromMock } }
    }));

    const { getUserGraph } = await import('../utils/psgStorage');
    const res = await getUserGraph('me', 'graph.psg');

    expect(fromMock).toHaveBeenCalledWith('graphs');
    expect(downloadMock).toHaveBeenCalledWith('users/me/graphs/graph.psg');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(JSON.parse(res.data)).toEqual({ x: 1 });
    }
  });

  test('putUserGraph uploads with application/json and upsert true', async () => {
    const uploadMock = jest.fn().mockResolvedValue({ data: null, error: null });
    const fromMock = jest.fn(() => ({ upload: uploadMock }));

    jest.doMock(path.resolve(__dirname, '../utils/supabaseClient.ts'), () => ({
      supabase: { storage: { from: fromMock } }
    }));

    const { putUserGraph } = await import('../utils/psgStorage');
    const payload = JSON.stringify({ nodes: [], edges: [] });
    const res = await putUserGraph('u7', 'n.psg', payload);

    expect(fromMock).toHaveBeenCalledWith('graphs');
    expect(uploadMock).toHaveBeenCalled();

    const args = uploadMock.mock.calls[0];
    expect(args[0]).toBe('users/u7/graphs/n.psg');
    const sentBlob: Blob = args[1];
    const opts = args[2];

    expect(opts).toEqual(
      expect.objectContaining({ upsert: true, contentType: 'application/json' })
    );
    expect(sentBlob).toBeInstanceOf(Blob);
    expect(sentBlob.type).toBe('application/json');
    const expectedSize = new Blob([payload], { type: 'application/json' }).size;
    expect(sentBlob.size).toBe(expectedSize);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.path).toBe('users/u7/graphs/n.psg');
    }
  });
});

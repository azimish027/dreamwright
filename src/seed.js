/* seed.js —— 合并版示例数据：一个示例企划（分支树/条目/目标打卡/灵感/模板）
   + 三页文稿与草稿纸（预设标签、标记、逻辑线、便签） */
const IP2SEED = (function () {
  function newState() {
    return {
      version: 3,
      projects: [], nodes: [], entries: [], goals: [], logs: [], ideas: [], templates: [], relations: [],
      pages: [], tags: [], annos: [], lines: [], strokes: [], notes: [],
      chapters: [], assets: [], assetCats: [], blocks: [], edges: [], layouts: [], aiThreads: []
    };
  }

  function findAll(segments, word) {
    const res = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      let from = 0, k;
      while ((k = seg.indexOf(word, from)) !== -1) {
        res.push({ seg: i, start: k, end: k + word.length });
        from = k + word.length;
      }
    }
    return res;
  }

  function build() {
    const s = newState();
    const now = Date.now();
    const DAY = 86400000;

    // ---------- 模板 ----------
    const tpl = (id, name, scope, fields, color) => s.templates.push({ id, name, scope, fields, color, builtin: true, created: now });
    tpl('tp-char', '角色卡', 'entry', [
      { key: 'role', label: '身份 / 定位' }, { key: 'look', label: '外貌特征' },
      { key: 'want', label: '想要什么' }, { key: 'fear', label: '怕什么' },
      { key: 'arc', label: '弧光走向' }, { key: 'secret', label: '不可说的秘密' }
    ], '#f082b4');
    tpl('tp-place', '地点设定', 'entry', [
      { key: 'where', label: '位置 / 归属' }, { key: 'mood', label: '氛围气质' },
      { key: 'rule', label: '此地规矩' }, { key: 'hook', label: '可埋的钩子' }
    ], '#6ea8ff');
    tpl('tp-group', '势力 / 组织', 'entry', [
      { key: 'aim', label: '诉求' }, { key: 'power', label: '实力与手段' },
      { key: 'inside', label: '内部派系' }, { key: 'gap', label: '破绽' }
    ], '#9ad37c');
    tpl('tp-event', '事件 / 章节', 'entry', [
      { key: 'when', label: '时间点' }, { key: 'who', label: '涉及人物' },
      { key: 'what', label: '发生了什么' }, { key: 'why', label: '为何重要' }
    ], '#f0b35c');

    // 骨架模板（建企划时自动长出分支）
    tpl('sk-novel', '小说企划', 'skeleton', [
      { key: 'b1', label: '世界观' }, { key: 'b2', label: '人物档案' },
      { key: 'b3', label: '主线剧情' }, { key: 'b4', label: '分卷大纲' },
      { key: 'b5', label: '资料与素材' }
    ], '#8f86e6');
    tpl('sk-game', '游戏企划', 'skeleton', [
      { key: 'b1', label: '世界观' }, { key: 'b2', label: '角色设定' },
      { key: 'b3', label: '核心玩法' }, { key: 'b4', label: '关卡 / 章节' },
      { key: 'b5', label: '美术与音乐' }
    ], '#6ea8ff');
    tpl('sk-oc', 'OC 合集', 'skeleton', [
      { key: 'b1', label: '角色卡' }, { key: 'b2', label: '关系网' },
      { key: 'b3', label: '碎片与灵感' }
    ], '#f082b4');

    // ---------- 企划 ----------
    const pj = { id: 'pj1', name: '长歌行（示例）', desc: '仙侠长篇 · 修行与执念', color: '#8f86e6', skel: 'sk-novel', created: now - 30 * DAY, updated: now - 3600000 };
    s.projects.push(pj);

    const nd = (id, parent, name, order) => s.nodes.push({ id, pid: pj.id, parent: parent || '', name, order, created: now - 20 * DAY });
    nd('n1', '', '世界观', 0);
    nd('n2', '', '人物档案', 1);
    nd('n3', '', '主线剧情', 2);
    nd('n4', '', '分卷大纲', 3);
    nd('n11', 'n1', '地理与势力', 0);
    nd('n12', 'n1', '修行体系', 1);

    const en = (id, nodeId, title, body, fields, tplId) => {
      const o = { id, pid: pj.id, nodeId: nodeId || '', title, body: body || '', fields: fields || {},
        tags: [], tplId: tplId || null, date: '', created: now - 15 * DAY, updated: now - 2 * DAY };
      s.entries.push(o); return o;
    };
    en('e1', 'n2', '沈既明', '主角。为父报仇的执念推着他走，孤僻寡言，不信人。', {
      role: '主角 · 查案者', look: '瘦高，左手虎口有旧茧',
      want: '查清父亲之死的真相', fear: '真相指向自己敬重的人',
      arc: '从"不信任何人"到"愿意把背后交给陆挽"，中途会回落一次',
      secret: '父亲那句叮嘱，他其实记不清是谁先说的'
    }, 'tp-char');
    en('e2', 'n2', '陆挽', '女主角之一。消息灵通的渡口船家女，眼睛里有"灯"的意象。', {
      role: '女主 · 引灯人', look: '左腕一道旧疤',
      want: '把某个旧案翻出来', fear: '被她护着的人替她担罪',
      arc: '从隐瞒到坦白，坦白的代价是失去沈既明的信任',
      secret: '她知道卷宗是谁烧的'
    }, 'tp-char');
    en('e3', 'n11', '青石巷', '城里最老的巷子，卖灯花的摊子常年不挪。', {
      where: '城西 · 临渡口', mood: '潮湿、昏黄、总像有雾',
      rule: '入夜后不打更', hook: '卖灯老人似乎认得沈既明'
    }, 'tp-place');
    en('e4', 'n11', '雾隐渡口', '水路与陆路的交界，消息的集散地。', {
      where: '城外 · 水路', mood: '风大，夜里全是灯',
      rule: '不问来处，只问去处', hook: '三年前被烧的卷宗曾从这里运走'
    }, 'tp-place');
    en('e5', 'n12', '修行体系 · 剑修与丹修', '两条路：一条向外斩，一条向内养。', {
      aim: '暂略', power: '暂略', inside: '剑修分三宗', gap: '暂略'
    }, 'tp-group');
    en('e6', 'n3', '主线 · 卷一转折', '渡口之夜，沈既明第一次主动说出灯花的事。', {
      when: '卷一 · 第 3 章', who: '沈既明 / 陆挽',
      what: '合作成立，信任开始', why: '这是弧光回落前必须先建立的东西'
    }, 'tp-event');

    // 时间线示例：给事件条目排上虚构纪年（排序靠字符串，年份用两位数字）
    const ev1 = en('e7', 'n3', '旧案 · 卷宗被烧', '三年前的冬天，雾隐渡口运出的一批卷宗在半路被烧，线索就此断掉。', {
      when: '卷宗被烧', who: '陆挽（知情）', what: '线索断裂', why: '整个故事的源头事件'
    }, 'tp-event');
    ev1.date = '天启 01 · 冬';
    const ev2 = en('e8', 'n3', '沈父之死', '沈既明父亲死于一场"意外"，留下一句叮嘱，他记了很多年。', {
      when: '父亲亡故', who: '沈既明 / 父亲', what: '执念的起点', why: '弧光的发动机'
    }, 'tp-event');
    ev2.date = '天启 04 · 秋';
    const ev3 = en('e9', 'n3', '渡口之夜', '沈既明与陆挽在渡口达成合作——主线正式起步。', {
      when: '卷一 · 第 3 章', who: '沈既明 / 陆挽', what: '合作成立', why: '信任建立，之后才有回落'
    }, 'tp-event');
    ev3.date = '天启 07 · 春';
    ev3.body += '（对应第 3 章正文，已在页面里标了「意象 · 灯」）';

    // ---------- 关系网 ----------
    s.relations.push({ id: 'r1', pid: pj.id, a: 'e1', b: 'e2', label: '合作 · 各怀目的', dir: 'two', created: now - 10 * DAY });
    s.relations.push({ id: 'r2', pid: pj.id, a: 'e2', b: 'e3', label: '常驻', dir: 'one', created: now - 10 * DAY });

    // ---------- 目标与打卡 ----------
    const g1 = { id: 'g1', pid: pj.id, title: '每日码字', cadence: 'daily', mode: 'amount', target: 1000, unit: '字', created: now - 20 * DAY };
    const g2 = { id: 'g2', pid: pj.id, title: '每周整理设定', cadence: 'weekly', mode: 'count', target: 3, unit: '条', created: now - 20 * DAY };
    const g3 = { id: 'g3', pid: pj.id, title: '本月累计码字', cadence: 'monthly', mode: 'amount', target: 30000, unit: '字', created: now - 20 * DAY };
    const g4 = { id: 'g4', pid: '', title: '今日也动笔了吗', cadence: 'daily', mode: 'count', target: 1, unit: '次', created: now - 20 * DAY };
    s.goals.push(g1, g2, g3, g4);

    const d = (n) => { const x = new Date(now - n * DAY); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    const lg = (gid, date, v) => s.logs.push({ id: 'l' + s.logs.length, goalId: gid, date, value: v });
    lg('g1', d(6), 1200); lg('g1', d(5), 900); lg('g1', d(4), 1500); lg('g1', d(3), 400);
    lg('g1', d(2), 1100); lg('g1', d(1), 1300); lg('g1', d(0), 800);
    lg('g3', d(6), 1200); lg('g3', d(5), 900); lg('g3', d(4), 1500); lg('g3', d(3), 400);
    lg('g3', d(2), 1100); lg('g3', d(1), 1300); lg('g3', d(0), 800);
    lg('g2', d(5), 3); lg('g2', d(1), 2);
    lg('g4', d(1), 1); lg('g4', d(0), 1);

    // ---------- 灵感 ----------
    s.ideas.push(
      { id: 'i1', text: '渡口夜戏：让沈既明先看见灯，再看见陆挽。先有光，才有人。', tags: ['意象 · 灯', '人物 · 沈既明'], created: now - 3 * DAY, history: [] },
      { id: 'i2', text: '如果卖灯老人其实就是当年那个送信的人呢？——这样第 2 卷的呼应就有了着力点。', tags: ['伏笔 · 父亲的话'], created: now - 2 * DAY, history: [] },
      { id: 'i3', text: '陆挽的疤：到底是在渡口那晚留下的，还是更早？两条时间线要定死一个。', tags: ['人物 · 陆挽', '待定'], created: now - 1 * DAY, history: [] }
    );

    // ---------- 页面（看稿 / 草稿） ----------
    const pg = (id, name, kind, isDraft, segs) => {
      s.pages.push({ id, pid: pj.id, name, kind, isDraft, segments: segs, created: now - 5 * DAY + s.pages.length * 1000, updated: now - 4 * DAY + s.pages.length * 1000 });
    };
    pg('d0', '第 3 章 · 夜访青石巷', 'doc', false, [
      '暮色压城的时候，沈既明第三次路过青石巷口。',
      '巷口的灯花摊还在，卖灯的老人眯着眼，仿佛认得他，又仿佛从来不认识。他想起陆挽说过，雾隐渡口的灯笼都是从这里买的。',
      '沈既明没有进巷。他折去了渡口，风从水面刮来，他忽然想起小时候父亲说过的那句话，那句话他记了很多年，却始终想不起是谁先说的。',
      '陆挽在渡口等他。她说：你想查的旧案，卷宗在三年前就被人烧了。沈既明盯着她的眼睛，那里面有一盏小小的灯，像灯花摊上的那一盏。'
    ]);
    pg('d1', '人物弧光 · 沈既明（草稿）', 'doc', true, [
      '弧光起点：为父报仇的执念，孤僻寡言，不信任何人。',
      '节点一（本卷）：与陆挽合作查旧案，开始信任——第3章渡口之夜是关键转折，他主动告诉她灯花的事。',
      '节点二（待写）：得知父亲之死另有隐情后，怀疑陆挽也在隐瞒什么，弧光可能回落。',
      '终点（预想）：放下仇恨，但保留一点执拗。注意：要把灯花作为贯穿意象回收。',
      '疑点未决：父亲那句叮嘱到底是谁先说的？须在 40 章前回收，否则断线。'
    ]);
    pg('d2', '陆挽 · 细节备忘（草稿）', 'doc', true, [
      '陆挽眼睛里有"灯"的意象：灯花摊的灯、渡口的灯、回忆里的灯——她是沈既明这条线的"引灯人"。',
      '她的秘密：知道卷宗是谁烧的，但暂时不能说破。',
      '设定矛盾检查：她左腕的疤在第三章出现两次（渡口段落），需确认时间线不冲突。'
    ]);
    pg('d3', '随手草稿纸', 'sheet', true, ['']);
    pg('db1', '剧情推演画布', 'board', true, ['']);

    // ---------- 标签 ----------
    const tg = (id, name, color) => s.tags.push({ id, name, color });
    tg('t1', '地点 · 青石巷', '#f0b35c');
    tg('t2', '意象 · 灯', '#f082b4');
    tg('t3', '人物 · 沈既明', '#6ea8ff');
    tg('t4', '伏笔 · 父亲的话', '#c2a1ff');

    // ---------- 标记 ----------
    const segOf = (id, i) => (s.pages.find(p => p.id === id).segments[i] || '');
    const add = (pageId, seg, start, end, kind, tagId) => {
      s.annos.push({ id: 'a' + s.annos.length + '_' + seg + '_' + start, pageId, seg, start, end,
        kind, tagId, color: (s.tags.find(t => t.id === tagId) || {}).color,
        text: segOf(pageId, seg).slice(start, end), created: now - s.annos.length * 6000 });
    };
    findAll(s.pages[0].segments, '青石巷').forEach(r => add('d0', r.seg, r.start, r.end, 'hl', 't1'));
    findAll(s.pages[0].segments, '灯').slice(0, 6).forEach(r => add('d0', r.seg, r.start, r.end, 'hl', 't2'));
    findAll(s.pages[0].segments, '沈既明').slice(0, 4).forEach(r => add('d0', r.seg, r.start, r.end, 'hl', 't3'));
    findAll(s.pages[1].segments, '谁先说的').forEach(r => add('d1', r.seg, r.start, r.end, 'ul', 't4'));
    const fLine = findAll(s.pages[0].segments, '父亲说');
    if (fLine.length) { const r = fLine[0]; add('d0', r.seg, r.start, r.end, 'hl', 't4'); }
    const fLast = findAll(s.pages[1].segments, '回收');
    if (fLast.length) { const r = fLast[0]; add('d1', r.seg, r.start, r.end, 'ul', 't4'); }

    // ---------- 逻辑线 ----------
    s.lines.push({ id: 'l1', name: '灯 · 意象回收线', color: '#f082b4',
      nodes: [{ kind: 'tag', ref: 't2', label: '第 3 章 灯意象' }, { kind: 'tag', ref: 't4', label: '父亲的话（伏笔）' }, { kind: 'tag', ref: 't3', label: '沈既明弧光点' }] });
    s.lines.push({ id: 'l2', name: '青石巷 地点串', color: '#f0b35c',
      nodes: [{ kind: 'tag', ref: 't1', label: '青石巷出现处' }] });

    // ---------- 便签 ----------
    s.notes.push({ id: 'n1', pageId: 'd0', x: 520, y: 60, w: 190, h: 96,
      text: '渡口夜景：风、灯、旧话。这里想埋一句伏笔：灯花摊老人认得沈既明——第 2 卷呼应。', color: 'n-y', active: true });
    s.notes.push({ id: 'n2', pageId: 'd3', x: 60, y: 80, w: 200, h: 80,
      text: '随手纸：先在下面涂一下渡口的画面布局，再决定正文怎么写。', color: 'n-blue', active: true });

    // ---------- v3：资产分类与资产 ----------
    const acat = (id, name, color, order) => s.assetCats.push({ id, name, color, order });
    acat('ac1', '人物', '#6ea8ff', 0);
    acat('ac2', '地点', '#1D9E75', 1);
    acat('ac3', '道具', '#f0b35c', 2);
    acat('ac4', '参考资料', '#c2a1ff', 3);
    acat('ac5', '外部工具', '#888780', 4);

    const asset = (id, name, cat, kind, body, pid, tags) => s.assets.push({
      id, name, cat, kind, body: body || '', fields: {}, tags: tags || [],
      pid: pid || null, created: now - 20 * DAY, updated: now - 2 * DAY
    });
    asset('as1', '沈既明', 'ac1', '人物', '男主。渡口长大，执念系修士。口头禅：别急。', 'pj1', ['主角']);
    asset('as2', '青石巷', 'ac2', '地点', '开篇场景。雨天有灯，尽头是渡口。', 'pj1', ['开篇']);
    asset('as3', '铜灯', 'ac3', '道具', '贯穿全书的意象，第 2 卷要回收。', 'pj1', ['意象']);
    asset('as4', '唐代市井考据', 'ac4', '参考资料', '笔记：坊市制度、宵禁时间、渡口税制。', 'pj1', ['考据']);
    asset('as5', '押韵查询 · 韵典', 'ac5', '外部工具', 'https://ytenx.org/', null, ['写诗']);
    asset('as6', '角色名生成器', 'ac5', '外部工具', '批量取名用，避免重名。', null, ['工具']);

    // ---------- v3：章节树 ----------
    const ch = (id, parent, kind, name, status, words, summary, tags) => s.chapters.push({
      id, pid: 'pj1', parent: parent || '', kind, name, order: s.chapters.length,
      status, words, summary: summary || '', chars: [], tags: tags || [],
      created: now - 25 * DAY, updated: now - DAY
    });
    ch('c_act1', '', 'act', '第一卷 · 渡口', 'draft', 0, '少年离乡，灯第一次亮。');
    ch('c1', 'c_act1', 'chapter', '第 1 章 青石巷', 'done', 4200, '雨天出场，埋下父亲的话。', ['开篇']);
    ch('c2', 'c_act1', 'chapter', '第 2 章 渡口的灯', 'done', 3800, '铜灯第一次出现，沈既明与老人对话。', ['意象']);
    ch('c3', 'c_act1', 'chapter', '第 3 章 谁先说的', 'revise', 3600, '回忆段落，与开篇台词呼应。', ['伏笔']);
    ch('c4', 'c_act1', 'chapter', '第 4 章 雨夜出城', 'draft', 2100, '出城，第一卷收束。');
    ch('c_act2', '', 'act', '第二卷 · 山中', 'outline', 0, '修行与代价。');
    ch('c5', 'c_act2', 'chapter', '第 5 章 入山门', 'outline', 0, '新人物登场。');
    ch('c6', 'c_act2', 'chapter', '第 6 章 灯灭', 'idea', 0, '铜灯熄灭，伏笔回收点。', ['意象', '伏笔']);

    // ---------- v3：画布块（挂在「剧情推演画布」上） ----------
    const bp = 'db1';
    const blk = (id, type, x, y, w, h, text, color, ref) => s.blocks.push({
      id, pageId: bp, type, x, y, w, h, text: text || '', src: '', ref: ref || null,
      color: color || '', z: s.blocks.length, created: now, updated: now
    });
    blk('b1', 'text', 80, 60, 240, 120, '渡口夜景：风、灯、旧话。先画布局再写正文。', '');
    blk('b2', 'card', 380, 90, 220, 100, '', '', 'as2');
    blk('b3', 'sticky', 120, 260, 180, 100, '灯要在这里第一次亮 —— 和第 6 章的灯灭对应。', 'n-y');
    blk('b4', 'card', 380, 260, 220, 100, '', '', 'as3');
    s.edges.push({ id: 'e1', pageId: bp, from: 'b1', to: 'b3', label: '伏笔', color: '#f082b4', created: now });
    s.edges.push({ id: 'e2', pageId: bp, from: 'b3', to: 'b4', label: '对应', color: '#c2a1ff', created: now });

    return s;
  }

  return { build };
})();

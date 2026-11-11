module.exports = function addDuoCharacters(project) {
  const object = id => project.objects.find(item => item.id === id);
  const picture = (id, art, dimension = { width: 100, height: 100 }) => ({
    id, name: id, fileurl: `assets/${art}.svg`,
    dimension, imageType: 'svg', pngFallback: false,
  });
  const roster = [
    {
      id: 38, base: 'phage/core', attack: 'phage/swipe', skill: 'phage/dormant', ultimate: 'phage/mark',
      forms: ['phage/needle', 'phage/armor', 'phage/dormant'],
      text: ['파지', '잠복하는 군체', '용균 기록', '꼬리가 적에게 닿아 피해를 줄 때마다 기록이 쌓입니다.',
        '꼬리 타격', '꼬리를 크게 휘둘러 앞에 있는 적을 후려칩니다.',
        '휴면 상태', '몸을 굳혀 공격을 버팁니다. 깨어날 때 체력과 마나를 조금 회복합니다.',
        '용균현상', '기록을 소모해 적을 쫓는 군체를 부릅니다. 기록이 많을수록 더 많이 몰려듭니다.'],
    },
    {
      id: 39, base: 'banana/body', attack: 'banana/peel', skill: 'banana/slide', ultimate: 'banana/pile',
      forms: [], battle: 'banana/core',
      text: ['스파이크', '전투 공병', '지형 활용', '발판이 무너지면 마름쇠도 아래로 떨어집니다.',
        '쇠못 투척', '빙글빙글 도는 쇠못을 포물선으로 던집니다.',
        '어깨치기', '어깨를 앞세워 돌진하고, 부딪힌 적을 멀리 밀쳐냅니다.',
        '마름쇠 살포', '주변에 마름쇠를 흩뿌립니다. 밟은 적은 튕겨 나가고 잠시 발이 느려집니다.'],
    },
    {
      id: 40, base: 'thorn/body', attack: 'thorn/sweep', skill: 'thorn/guard', ultimate: 'thorn/smoke',
      forms: ['thorn/guard'],
      text: ['체인', '쌍절곤 격투가', '되치기', '발이 빠른 대신 체력이 조금씩 닳습니다. 얻어맞으면 20% 확률로 두 배로 갚아줍니다.',
        '쌍절곤', '쌍절곤을 몸 주위로 휘둘러 닿는 적을 때립니다.',
        '교차 가드', '방어 태세를 취해 3초 동안 피해 반사 확률을 40%로 높입니다.',
        '연막 난타', '연막에 휘말린 적을 가둡니다. 연막 속에서 가까이 붙으면 연달아 때립니다.'],
    },
    {
      id: 41, base: 'octopus/body', attack: 'octopus/tentacle', skill: 'octopus/grapple', ultimate: 'octopus/dream',
      forms: [],
      text: ['꿈을 꾸는 문어', '꿈속의 촉수', '빨판', '촉수 끝에 걸린 적을 몸 쪽으로 끌어당깁니다.',
        '촉수 찰싹', '팔을 뻗어 몸 주위를 한 바퀴 휘두릅니다.',
        '빨판 점프', '촉수를 지형에 붙여 몸을 당깁니다. 점프하면 빨판을 떼고 튀어 오릅니다.',
        '꿈속의 문어', '꿈에서 튀어나온 커다란 촉수 세 개가 양옆과 위를 차례로 내리칩니다.'],
    },
    {
      id: 42, base: 'zealot/body', attack: 'zealot/ember', skill: 'zealot/rocket', ultimate: 'zealot/burst',
      forms: [],
      text: ['광신도', '도화선의 불씨', '점화', '성냥불이 폭죽에 닿으면 도화선에 불이 붙습니다.',
        '성냥불', '불씨를 튕겨 앞에 있는 적을 태웁니다.',
        '제단', '바닥에 폭죽을 놓습니다. 성냥불로 맞히면 도화선에 불이 붙습니다.',
        '불꽃놀이', '앞에 폭죽을 늘어놓고 차례로 터뜨립니다. 먼저 놓아둔 폭죽에도 불이 옮겨붙습니다.'],
    },
  ];
  const labels = ['5pvu', 'xxgw', 'of7a', 'dw8v', 'twcx', 'wynm', 'x7mx', 'gsve', '74ed', '9m7u'];
  const tile = object('ncwe'), stacks = JSON.parse(tile.script);
  const init = stacks.find(stack => stack[0]?.id === 'ndxn');
  for (const fighter of roster) {
    const index = fighter.id - 1;
    for (const [i, key] of labels.entries()) {
      const list = project.variables.find(v => v.id === key).array;
      list[index] = { ...list[index - 1], data: fighter.text[i] };
    }
    for (const id of ['j5y7', 'zyy3', 'n230', 'ocqj', 'afvb', '8svk']) {
      const pictures = object(id).sprite.pictures;
      // Use Michael's original-size slot. Collie's preview includes extra padding for its spikes.
      const dimension = pictures[35].dimension;
      const asset = art => ['afvb', '8svk'].includes(id) ? art.replace('/', '/profile-') : art;
      pictures.splice(index, 0, picture(fighter.base, asset(fighter.base), dimension));
      if (id !== 'j5y7' && id !== 'zyy3')
        pictures.push(...fighter.forms.map(art => picture(art, asset(art), dimension)));
      if (fighter.battle && ['n230', 'ocqj'].includes(id))
        pictures.push(picture(fighter.battle, fighter.battle, dimension));
    }
    for (const [id, art] of [['pyez', fighter.attack], ['o9rj', fighter.skill], ['4ffm', fighter.ultimate]]) {
      const pictures = object(id).sprite.pictures;
      pictures.splice(index, 0, picture(art, art + '-icon', pictures[index - 1].dimension));
    }
    const portrait = fighter.base.split('/')[0] + '/portrait';
    tile.sprite.pictures[index - 32] = picture(`duo-select-${fighter.id}`, portrait, tile.sprite.pictures[4].dimension);
    init.push({
      id: `duo-select-create-${fighter.id}`, type: 'create_clone', params: ['self', null], statements: [],
    });
  }
  for (const id of ['n230', 'ocqj']) {
    const pictures = object(id).sprite.pictures;
    pictures.push(picture('thorn/bare', 'thorn/bare', pictures[35].dimension));
    pictures.push(picture('thorn/guard-bare', 'thorn/guard', pictures[35].dimension));
  }
  const art = ['phage/core', 'phage/swipe', 'phage/mark', 'banana/peel', 'banana/slide', 'banana/pile', 'banana/return',
    'banana/held', 'thorn/sweep', 'thorn/weapon', 'thorn/weapon-folded', 'thorn/reflect-impact',
    'octopus/tentacle', 'octopus/dream-tentacle', 'zealot/candle', 'zealot/ember', 'zealot/rocket', 'zealot/lit', 'zealot/burst'];
  object('hb4u').sprite.pictures.push(...art.map(id => picture(id, id)));
  const cloneSetup = stacks.find(stack => stack.some(block => block.id === '7exj'));
  cloneSetup.push({
    id: 'duo-select-next-row', type: '_if',
    params: [{ type: 'boolean_basic_operator', params: [{ type: 'get_variable', params: ['eti2', null] }, 'GREATER', 40] }],
    statements: [[
      { id: 'duo-select-wrap-x', type: 'move_x', params: [-320, null], statements: [] },
      { id: 'duo-select-wrap-y', type: 'move_y', params: [-40, null], statements: [] },
    ]],
  });
  tile.script = JSON.stringify(stacks);

  const max = roster.at(-1).id;
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'calc_rand' && node.params?.[3]?.params?.[0] === 37)
      node.params[3].params[0] = max;
    if (String(node.id).startsWith('selector-wrap-') && node.type === '_if')
      node.params[0].params[2].params[0] = max + 1;
    Object.values(node).forEach(visit);
  };
  for (const id of ['yvxw', '3y3g', 'k089', '646h', 'a091', 'ncwe']) {
    const item = object(id), script = JSON.parse(item.script);
    visit(script);
    item.script = JSON.stringify(script);
  }
};

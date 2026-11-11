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
      text: ['파지', '잠복하는 군체', '용균 기록', '기본공격의 피해를 최대 5회까지 기록합니다.',
        '꼬리 타격', '정면으로 꼬리를 후려칩니다.',
        '휴면 상태', '2.5초동안 굳으며 무적 상태가 됩니다.',
        '용균현상', '기록을 바탕으로 군체를 소환합니다.'],
    },
    {
      id: 39, base: 'banana/body', attack: 'banana/peel', skill: 'banana/slide', ultimate: 'banana/pile',
      forms: [], battle: 'banana/core',
      text: ['스파이크', '전투 공병', '지형 활용', '설치된 마름쇠는 바닥이 사라지면 떨어집니다.',
        '쇠못 투척', '마름쇠를 포물선으로 던져 피해를 줍니다.',
        '어깨치기', '앞으로 돌진하며 부딪힌 적을 밀쳐냅니다.',
        '마름쇠 살포', '30초간 유지되는 마름쇠를 뿌려 밟은 적에게 피해를 주고 밀쳐내며 둔화시킵니다.'],
    },
    {
      id: 40, base: 'thorn/body', attack: 'thorn/sweep', skill: 'thorn/guard', ultimate: 'thorn/smoke',
      forms: ['thorn/guard'], battle: 'thorn/core',
      text: ['너클', '쌍철권 격투가', '되치기', '이동 속도가 20% 빠르며 2초마다 HP를 1 잃습니다. 피격 시 20% 확률로 잃은 HP의 두 배를 상대에게 돌려줍니다.',
        '쌍철권', '두 철권을 몸 주위로 돌려 주변 적에게 피해를 줍니다.',
        '철권 가드', '양 철권으로 몸을 가려 3초 동안 피해 반사 확률을 40%로 높입니다.',
        '연막 난타', '3초간 연막을 펼쳐 범위 안의 적을 가두고, 가까이 붙은 적에게 연속으로 피해를 줍니다.'],
    },
    {
      id: 41, base: 'octopus/body', attack: 'octopus/tentacle', skill: 'octopus/grapple', ultimate: 'octopus/dream',
      forms: [],
      text: ['꿈을 꾸는 문어', '꿈속의 촉수', '빨판', '촉수 끝에 맞은 적을 살짝 끌어당깁니다.',
        '촉수 찰싹', '정면으로 촉수를 뻗어 피해 5를 줍니다.',
        '빨판 점프', 'MP 24. 지형에 촉수를 붙입니다. 점프로 놓습니다.',
        '꿈속의 문어', 'MP 60. 왼쪽·오른쪽·위로 촉수가 차례로 솟습니다.'],
    },
    {
      id: 42, base: 'zealot/body', attack: 'zealot/ember', skill: 'zealot/rocket', ultimate: 'zealot/burst',
      forms: [],
      text: ['광신도', '도화선의 불씨', '점화', '성냥불로 자기 폭죽에 불을 붙입니다.',
        '성냥불', '불씨를 던져 피해 4를 줍니다.',
        '제단', 'MP 22. 폭죽을 최대 세 개 놓습니다.',
        '불꽃놀이', 'MP 60. 폭죽을 차례로 터뜨립니다. 최대 두 번 적중.'],
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
  const art = ['phage/core', 'phage/swipe', 'phage/mark', 'banana/peel', 'banana/slide', 'banana/pile', 'banana/return',
    'banana/held', 'thorn/sweep', 'thorn/fist', 'octopus/tentacle', 'octopus/dream-tentacle',
    'zealot/candle', 'zealot/ember', 'zealot/rocket', 'zealot/lit', 'zealot/burst'];
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

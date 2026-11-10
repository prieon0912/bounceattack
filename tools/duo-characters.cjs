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
      forms: [],
      text: ['스파이크', '전투 공병', '지형 활용', '설치된 마름쇠는 바닥이 사라지면 떨어집니다.',
        '쇠못 투척', '마름쇠를 포물선으로 던져 피해를 줍니다.',
        '어깨치기', '앞으로 돌진하며 부딪힌 적을 밀쳐냅니다.',
        '마름쇠 살포', '마름쇠를 뿌려 밟은 적을 밀쳐내고 둔화시킵니다.'],
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
      const pictures = object(id).sprite.pictures, dimension = pictures[index - 1].dimension;
      pictures.splice(index, 0, picture(fighter.base, fighter.base, dimension));
      if (id !== 'j5y7' && id !== 'zyy3')
        pictures.push(...fighter.forms.map(art => picture(art, art, dimension)));
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
  const art = ['phage/core', 'phage/swipe', 'phage/mark', 'banana/peel', 'banana/slide', 'banana/pile', 'banana/return'];
  object('hb4u').sprite.pictures.push(...art.map(id => picture(id, id)));
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

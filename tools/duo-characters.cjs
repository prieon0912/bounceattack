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
      text: ['미스테리오파지', '잠복하는 군체', '용균 기록', '평타 피해를 최대 5회까지 기록합니다.',
        '꼬리 타격', '정면 중근거리를 꼬리로 후려칩니다.',
        '휴면상태', 'MP 10. 2.5초간 굳어 무적. 해제 시 MP 14 회복.',
        '용균현상', 'MP 52. 평타 기록을 표시하고 5회에 군체를 부릅니다.'],
    },
    {
      id: 39, base: 'banana/body', attack: 'banana/peel', skill: 'banana/slide', ultimate: 'banana/pile',
      forms: [],
      text: ['누군가에게버려진바나나껍질하나', '길을 어지럽히는 껍질', '바닥 주의', '설치된 껍질은 바닥이 사라지면 떨어집니다.',
        '껍질 투척', '껍질을 포물선으로 던져 피해를 줍니다.',
        '껍질 미끄럼', 'MP 22. 앞으로 미끄러지며 한 번 밀쳐냅니다.',
        '껍질 더미', 'MP 55. 지면에 껍질을 6개까지 뿌립니다.'],
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
      pictures.splice(index, 0, picture(art, art, pictures[index - 1].dimension));
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

module.exports = function addEcola(project) {
  const object = id => project.objects.find(item => item.id === id);
  const picture = (id, art, dimension = { width: 100, height: 100 }) => ({
    id, name: id, fileurl: `assets/ecola/${art}.svg`,
    dimension, imageType: 'svg', pngFallback: false,
  });
  const labels = {
    '5pvu': '콜리', xxgw: '분열하는 변이체', of7a: '형태 적응',
    dw8v: '진화 결과에 따라 몸과 능력치가 바뀝니다.',
    twcx: '세포질 발사', wynm: '진화 형태에 따른 세포질을 발사합니다.',
    x7mx: '양분 흡수', gsve: '2초 동안 이동 속도가 감소하며 MP를 추가적으로 획득합니다.',
    '74ed': '진화', '9m7u': '자신의 다른 진화 형태로 형태를 변경합니다.',
  };
  for (const [id, data] of Object.entries(labels)) {
    const list = project.variables.find(v => v.id === id).array;
    list[36] = { ...list[35], data };
  }
  const forms = ['base', 'flagella', 'cannon', 'shell', 'spore', 'wilt'];
  for (const id of ['j5y7', 'zyy3', 'n230', 'ocqj', 'afvb', '8svk']) {
    const pictures = object(id).sprite.pictures;
    const dimension = pictures[35].dimension;
    const art = form => ['afvb', '8svk'].includes(id) ? 'profile-' + form : ['j5y7', 'zyy3'].includes(id) ? 'preview' : form;
    const baseArt = art('base');
    const baseDimension = baseArt === 'preview'
      ? { ...dimension, width: dimension.width * 1.2, height: dimension.height * 1.2 }
      : dimension;
    pictures.splice(36, 0, picture('ecola-base', baseArt, baseDimension));
    if (!['j5y7', 'zyy3'].includes(id))
      pictures.push(...forms.slice(1).map(form => picture('ecola-' + form, art(form), dimension)));
  }
  for (const [id, art] of [['o9rj', 'absorb'], ['4ffm', 'evolve'], ['pyez', 'attack']]) {
    const pictures = object(id).sprite.pictures;
    pictures.splice(36, 0, picture('ecola-' + art, art, pictures[35].dimension));
  }
  object('hb4u').sprite.pictures.push(
    ...forms.map(form => picture('ecola-' + form, form)),
    ...forms.map(form => picture('ecola-shot-' + form, 'shot-' + form)),
    picture('ecola-pulse', 'pulse'),
  );
  const tile = object('ncwe');
  tile.sprite.pictures[4] = picture('ecola-select', 'select', tile.sprite.pictures[3].dimension);
  const stacks = JSON.parse(tile.script);
  stacks.find(stack => stack[0]?.id === 'ndxn').push({
    id: 'ecola-select-create', type: 'create_clone', params: ['self', null], statements: [],
  });
  tile.script = JSON.stringify(stacks);
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'calc_rand' && node.params?.[3]?.params?.[0] === 36)
      node.params[3].params[0] = 37;
    if (String(node.id).startsWith('selector-wrap-') && node.type === '_if')
      node.params[0].params[2].params[0] = 38;
    Object.values(node).forEach(visit);
  };
  for (const id of ['yvxw', '3y3g', 'k089', '646h', 'a091', 'ncwe']) {
    const item = object(id), script = JSON.parse(item.script);
    visit(script);
    item.script = JSON.stringify(script);
  }
};

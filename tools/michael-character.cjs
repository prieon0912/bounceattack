module.exports = function addMichael(project) {
  const object = id => project.objects.find(item => item.id === id);
  const picture = (id, art, dimension = { width: 100, height: 100 }) => ({
    id, name: id, fileurl: 'assets/michael/' + art + '.svg',
    dimension, imageType: 'svg',
  });
  const labels = {
    '5pvu':'마이클', xxgw:'올라운더', of7a:'랜덤 종목',
    dw8v:'경기 시작 시 농구, 축구, 야구 중 한 종목이 무작위로 결정됩니다.',
    twcx:'기본기', wynm:'바운스 패스, 인스텝 킥, 배트 스윙 중 현재 종목의 공격을 사용합니다.',
    x7mx:'공격 전술', gsve:'레이업, 감아차기, 토스 배팅 중 현재 종목의 기술을 사용합니다.',
    '74ed':'올스타', '9m7u':'종목에 따라 튕기는 공을 5개, 6개 또는 7개 날립니다.',
  };
  for (const [id,data] of Object.entries(labels)) {
    const list = project.variables.find(v => v.id === id).array;
    list[35] = { ...list[34], data };
  }
  for (const [id,art] of Object.entries({
    j5y7:'body', zyy3:'body', n230:'body', ocqj:'body',
    o9rj:'skill', '4ffm':'ultimate', pyez:'attack', afvb:'profile-basketball', '8svk':'profile-basketball',
  })) {
    const pictures = object(id).sprite.pictures;
    pictures.splice(35,0,picture('michael-'+id,art,pictures[34].dimension));
  }
  for (const id of ['afvb','8svk']) {
    const pictures = object(id).sprite.pictures;
    for (const sport of ['football','baseball'])
      pictures.push(picture('michael-'+id+'-'+sport,'profile-'+sport,pictures[35].dimension));
  }
  for (const id of ['31us','mimn']) object(id).sprite.pictures.push(picture('michael-preview-'+id,'preview'));
  const effects = object('hb4u').sprite.pictures;
  for (const art of ['basketball','football','baseball','bat'])
    effects.push(picture('michael-'+art,art));
  const tile = object('ncwe');
  tile.sprite.pictures[3] = picture('michael-select','portrait',tile.sprite.pictures[2].dimension);
  const stacks = JSON.parse(tile.script);
  stacks.find(stack => stack[0]?.id === 'ndxn').push({
    id:'michael-select-create', type:'create_clone', params:['self',null], statements:[],
  });
  tile.script = JSON.stringify(stacks);
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'calc_rand' && node.params?.[3]?.params?.[0] === 35)
      node.params[3].params[0] = 36;
    if (String(node.id).startsWith('selector-wrap-') && node.type === '_if')
      node.params[0].params[2].params[0] = 37;
    Object.values(node).forEach(visit);
  };
  for (const id of ['yvxw','3y3g','k089','646h','a091','ncwe']) {
    const item = object(id), script = JSON.parse(item.script);
    visit(script);
    item.script = JSON.stringify(script);
  }
};

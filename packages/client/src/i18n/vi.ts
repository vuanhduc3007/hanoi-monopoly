/**
 * Every player-facing string lives here (CLAUDE.md). Card and character
 * descriptions are generated from the JSON effect data, so numbers stay in
 * sync with data/*.json.
 */
import { defaultData as D, type Effect, type GameEvent } from '@hanoi-monopoly/engine';

const nf = new Intl.NumberFormat('vi-VN');
export const money = (n: number) => `${nf.format(n)} ${D.economy.currency}`;
export const pct = (rate: number) => `${Math.round(rate * 100)}%`;

export const tileName = (ref: string) => D.ownables[ref]?.name ?? D.board.find((t) => t.ref === ref)?.name ?? ref;
export const groupName = (g: string) => D.groups[g]?.name ?? g;
export const charName = (id: string | null | undefined) => (id ? (D.characters[id]?.name ?? id) : 'Không nhân vật');
export const cardName = (id: string) => D.cards[id]?.name ?? id;

export const t = {
  appTitle: 'Cờ Tỷ Phú Hà Nội',
  tagline: 'Từ ven đô vào Phố cổ — đất càng gần Hồ Gươm càng đắt.',
  defaultName: (n: number) => `Người chơi ${n}`,
  spectator: 'Khán giả',
  bot: 'Bot',
  host: 'Chủ phòng',
  you: 'Bạn',

  // S1
  home: {
    yourName: 'Tên của bạn',
    create: 'Tạo phòng',
    joinCode: 'Mã phòng',
    join: 'Vào phòng',
    watch: 'Xem',
    howTo: 'Cách chơi',
    howToText: [
      `Mỗi lượt tung 2 xúc xắc, đi theo số bước. Qua ${D.board[0].name} nhận lương.`,
      'Dừng ở ô chưa có chủ: mua theo giá in hoặc từ chối để đấu giá.',
      'Sở hữu đủ nhóm màu để xây nhà, khách sạn và thu tiền thuê cao hơn.',
      'Thẻ Cơ hội, Cộng đồng và Hanoi Event có thể làm thay đổi cả bàn.',
      'Người cuối cùng không phá sản thắng (chế độ Nhanh: tài sản cao nhất khi hết giờ).',
    ],
    connecting: 'Đang kết nối…',
    reconnecting: 'Mất kết nối, đang nối lại…',
  },

  // S2
  lobby: {
    title: 'Phòng chờ',
    code: 'Mã phòng',
    copyLink: 'Sao chép link mời',
    copied: 'Đã sao chép',
    players: 'Người chơi',
    ready: 'Sẵn sàng',
    notReady: 'Chưa sẵn sàng',
    toggleReady: 'Sẵn sàng',
    cancelReady: 'Hủy sẵn sàng',
    start: 'Bắt đầu',
    waitingHost: 'Chờ chủ phòng bắt đầu…',
    settings: 'Cấu hình phòng',
    mode: 'Chế độ',
    modes: { classic: 'Truyền thống', quick: 'Nhanh' },
    characters: 'Nhân vật',
    scholarshipFund: 'Quỹ khuyến học',
    buildingLimit: 'Giới hạn 32 nhà / 12 khách sạn',
    maxPlayers: 'Số người tối đa',
    allowSpectators: 'Cho phép khán giả',
    on: 'Bật',
    off: 'Tắt',
    leave: 'Rời phòng',
    spectators: (n: number) => `${n} khán giả`,
    rename: 'Đổi tên',
  },

  // S3
  pick: {
    title: 'Chọn nhân vật',
    yourTurn: 'Đến lượt bạn chọn',
    waiting: (name: string) => `${name} đang chọn…`,
    order: 'Thứ tự chọn',
    passive: 'Nội tại',
    drawback: 'Điểm yếu',
    skill: 'Kỹ năng (1 lần/ván)',
    taken: (name: string) => `Đã chọn: ${name}`,
    choose: 'Chọn',
    turnOrder: 'Thứ tự lượt',
  },

  // S4
  board: {
    fund: 'Quỹ khuyến học',
    fundOff: 'Quỹ tắt',
    active: 'Đang hiệu lực',
    noEffects: 'Không có thẻ ⏳',
    decks: 'Bộ thẻ',
    dice: 'Xúc xắc',
    turn: (n: number) => `Lượt ${n}`,
    turnOf: (name: string) => `Lượt của ${name}`,
    log: 'Nhật ký',
    chat: 'Trò chuyện',
    send: 'Gửi',
    chatPlaceholder: 'Nhắn gì đó…',
    players: 'Người chơi',
    inJail: 'Đang ở Bãi giữ xe',
    bankrupt: 'Phá sản',
    disconnected: 'Mất kết nối',
    botPlaying: 'Bot đang chơi thay',
    assets: 'Tài sản',
    trade: 'Giao dịch',
    seconds: (n: number) => (n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : `${n}s`),
    until: (name: string) => `đến lượt kế của ${name}`,
    blockRent: 'đất của đối thủ không thu thuê',
    groupRent: (groups: string, mult: number) => `thuê ${groups} x${mult}`,
    deckNames: { chance: 'Cơ hội', community: 'Cộng đồng', event: 'Hanoi Event' },
  },

  // S5
  tile: {
    price: 'Giá mua',
    owner: 'Chủ',
    noOwner: 'Ngân hàng',
    rent: 'Tiền thuê',
    base: 'Đất trống',
    baseGroup: 'Đất trống (đủ nhóm)',
    house: (n: number) => `${n} nhà`,
    hotel: 'Khách sạn',
    buildCost: 'Giá xây',
    mortgage: 'Thế chấp',
    mortgaged: 'Đang thế chấp',
    buildings: 'Công trình',
    transportRent: (n: number) => `Sở hữu ${n} ô`,
    utilityRent: (n: number, mult: number) => `Sở hữu ${n} ô: ${mult} × tổng xúc xắc`,
    heritage: 'Di sản — không mua bán được',
    close: 'Đóng',
  },

  // S6
  act: {
    roll: 'Tung xúc xắc',
    endTurn: 'Kết thúc lượt',
    buy: (price: string) => `Mua (${price})`,
    decline: 'Đấu giá',
    buyPrompt: (tile: string) => `Mua ${tile}?`,
    auction: (tile: string) => `Đấu giá ${tile}`,
    highBid: (amount: string, who: string) => `Giá cao nhất: ${amount} — ${who}`,
    noBid: 'Chưa ai trả giá',
    bid: 'Trả giá',
    payFine: (fine: string) => `Nộp phạt ${fine}`,
    useJailCard: 'Dùng Giấy tờ xe',
    jailPrompt: 'Bạn đang ở Bãi giữ xe',
    postRoll: (sum: number) => `Bạn tung được ${sum}`,
    stepMinus: '−1 bước',
    stepPlus: '+1 bước',
    reroll: 'Chạy cuốc đêm (tung lại)',
    confirm: 'Đi',
    chooseCard: 'Chọn 1 trong 2 thẻ',
    rentDue: (tile: string, owner: string, amount: string) => `Bạn dừng ở ${tile} của ${owner}: phải trả ${amount}`,
    payRent: (amount: string) => `Trả tiền (${amount})`,
    rentDiscountUse: (amount: string) => `Ăn vạ: chỉ trả ${amount}`,
    flipHint: 'Bấm vào lá bài giữa bàn để lật thẻ',
    moving: 'Đang di chuyển…',
    useSkill: 'Dùng kỹ năng',
    skip: 'Bỏ qua',
    eventCancel: (card: string) => `Dùng Giải hạn để hủy "${card}" với bạn?`,
    liquidation: (amount: string, cash: string) => `Bạn cần trả ${amount} nhưng chỉ có ${cash}. Bán nhà, thế chấp hoặc giao dịch.`,
    payDebt: 'Trả nợ',
    bankrupt: 'Tuyên bố phá sản',
    inherit: (tile: string) => `Bạn nhận ${tile} đang thế chấp`,
    inheritUnmortgage: (cost: string) => `Chuộc ngay (${cost})`,
    inheritKeep: (cost: string) => `Giữ thế chấp, trả lãi ${cost}`,
    waitingFor: (name: string) => `Đang chờ ${name}…`,
    skills: 'Kỹ năng',
    chooseTarget: 'Chọn đối thủ',
    chooseGroup: 'Chọn nhóm màu',
    skillUsed: 'Đã dùng kỹ năng',
  },

  // S7
  trade: {
    title: 'Giao dịch',
    with: 'Với',
    youGive: 'Bạn đưa',
    youGet: 'Bạn nhận',
    cash: 'Tiền',
    jailCard: 'Giấy tờ xe (CH11)',
    unmortgageNow: 'Chuộc ngay',
    send: 'Gửi đề nghị',
    incoming: 'Đề nghị gửi đến bạn',
    outgoing: 'Đề nghị bạn đã gửi',
    accept: 'Chấp nhận',
    reject: 'Từ chối',
    cancel: 'Hủy',
    none: 'Không có',
    from: (name: string) => `${name} đề nghị`,
    expires: 'Tự hủy sau 30 giây',
    close: 'Đóng',
  },

  // S8
  assets: {
    title: 'Quản lý tài sản',
    build: 'Xây',
    sell: 'Bán',
    mortgage: 'Thế chấp',
    unmortgage: 'Chuộc',
    nothing: 'Bạn chưa có tài sản.',
    onlyYourTurn: 'Chỉ xây, bán, thế chấp trong lượt của bạn.',
    close: 'Đóng',
    transport: 'Giao thông',
    utility: 'Tiện ích',
    buildHotel: 'Lên khách sạn',
    rulesTitle: 'Khi nào được xây nhà?',
    rules: (housesForHotel: number) => [
      'Phải sở hữu ĐỦ cả nhóm màu (ví dụ cả 2 ô nâu, hoặc cả 3 ô hồng). Mua thêm hoặc đổi đất với người khác để gom đủ nhóm.',
      'Không ô nào trong nhóm đang thế chấp.',
      'Chỉ xây trong lượt của bạn — bất cứ lúc nào trong lượt, không cần đứng trên ô đó. Mở "Tài sản" để xây.',
      'Xây đều: các ô cùng nhóm chênh nhau tối đa 1 nhà. Muốn xây nhà thứ 2 ở một ô thì các ô khác trong nhóm phải có ít nhất 1 nhà.',
      `Đủ ${housesForHotel} nhà trên mọi ô của nhóm thì được nâng lên khách sạn.`,
      'Mỗi lần xây trả giá xây của ô; bán lại được một nửa.',
    ],
    why: {
      notYourTurn: 'Chỉ xây trong lượt của bạn',
      notBuildable: 'Ô này không xây được',
      notOwner: 'Không phải đất của bạn',
      needFullGroup: 'Cần sở hữu đủ cả nhóm màu',
      groupMortgaged: 'Có ô trong nhóm đang thế chấp',
      frozen: 'Đang bị "Đóng băng thị trường BĐS"',
      maxLevel: 'Đã xây tối đa',
      buildEvenly: 'Phải xây đều: xây các ô khác trong nhóm trước',
      noCash: 'Không đủ tiền',
      noHousesLeft: 'Ngân hàng hết nhà',
      noHotelsLeft: 'Ngân hàng hết khách sạn',
    } as Record<string, string>,
  },

  // S9
  over: {
    title: 'Kết thúc ván',
    winner: (name: string) => `${name} thắng!`,
    rank: 'Hạng',
    score: 'Tài sản',
    stats: 'Thống kê',
    bestTile: 'Ô sinh lời nhất',
    rentPaid: 'Tổng thuê đã trả',
    rentEarned: 'Tổng thuê đã thu',
    rematch: 'Chơi lại',
    home: 'Về trang chủ',
    bankruptAt: 'Phá sản',
  },

  errors: {
    ROOM_FULL: 'Phòng đã đủ người.',
    GAME_STARTED: 'Ván đã bắt đầu.',
    NO_SPECTATORS: 'Phòng không cho khán giả.',
    NOT_HOST: 'Chỉ chủ phòng làm được việc này.',
    NOT_READY: 'Còn người chưa sẵn sàng.',
    NOT_ENOUGH_PLAYERS: 'Cần ít nhất 2 người chơi.',
    BAD_CONFIG: 'Cấu hình không hợp lệ.',
    BAD_MESSAGE: 'Yêu cầu không hợp lệ.',
    NOT_YOUR_PICK: 'Chưa đến lượt bạn chọn.',
    CHARACTER_TAKEN: 'Nhân vật đã có người chọn.',
    NOT_A_PLAYER: 'Bạn đang là khán giả.',
    BOT_CONTROLLED: 'Bot đang chơi thay bạn đến hết ván.',
    WRONG_PHASE: 'Không làm được lúc này.',
    RULE: 'Không hợp lệ theo luật.',
    RATE_LIMIT: 'Gửi chậm lại một chút.',
    INTERNAL: 'Lỗi máy chủ.',
    CONNECT: 'Không vào được phòng. Kiểm tra mã phòng.',
  } as Record<string, string>,

  sound: { mute: 'Tắt tiếng', unmute: 'Bật tiếng' },
  celebrate: {
    bought: (name: string, tile: string) => `${name} mua ${tile}`,
    house: (name: string, tile: string) => `${name} xây nhà ở ${tile}`,
    hotel: (name: string, tile: string) => `${name} lên khách sạn ở ${tile}`,
  },
  pick3d: 'Xem nhân vật',
  cardDraw: {
    title: 'Rút thẻ',
    flip: 'Bấm vào lá bài để lật!',
    waiting: (name: string) => `${name} đang rút thẻ…`,
  },
  arrest: {
    title: '🚨 CSGT thổi còi!',
    body: (name: string) => `${name} bị giữ xe — về Bãi giữ xe vi phạm`,
  },
  money: {
    rent: (tile: string) => `Thuê ${tile}`,
    jailFine: 'Phạt ra Bãi giữ xe',
    fee: 'Phí',
    salary: 'Lương',
    bought: (tile: string) => `Mua ${tile}`,
    built: 'Xây nhà',
    bank: 'Ngân hàng',
    fund: 'Quỹ khuyến học',
    mortgage: 'Thế chấp',
  },
  mobile: { zoomIn: 'Phóng to bàn cờ', zoomOut: 'Thu nhỏ bàn cờ', more: 'Người chơi · Nhật ký · Trò chuyện', less: 'Thu gọn' },
  botReason: { disconnect: 'mất kết nối', afk: 'treo máy', left: 'đã rời ván' } as Record<string, string>,
  clockKind: {
    roll: 'Tung',
    buy: 'Quyết định',
    decision: 'Quyết định',
    auction: 'Đấu giá',
    turn: 'Lượt',
    liquidation: 'Thanh lý',
    pick: 'Chọn',
  } as Record<string, string>,
};

// ---------------------------------------------------------------- descriptions from data

const list = (ids: string[]) => ids.map(tileName).join(', ');
const groups = (gs: string[]) => gs.map((g) => `nhóm ${groupName(g)}`).join(', ');
const target = (e: Effect) => [e.properties ? list(e.properties) : '', e.groups ? groups(e.groups) : ''].filter(Boolean).join(', ');
const charList = (ids: string[]) => ids.map((i) => charName(i)).join(', ');

/** Vietnamese description of a card effect (from cards.json). */
export function describeEffect(e: Effect): string {
  switch (e.type) {
    case 'move_to':
      return e.position === 0 ? `Đi đến ${D.board[0].name}, nhận lương` : `Đi đến ${D.board[e.position].name} (${e.position})`;
    case 'move_to_nearest':
      return e.target === 'transport'
        ? `Đi đến ô giao thông gần nhất phía trước; có chủ thì trả gấp ${e.rentMultiplier}, chưa có thì được mua`
        : `Đi đến ô tiện ích gần nhất phía trước; có chủ thì tung xúc xắc, trả ${e.rollRentMultiplier} × tổng`;
    case 'move_relative':
      return `Lùi ${-e.steps} ô (không nhận lương)`;
    case 'go_to_jail':
      return 'Vào Bãi giữ xe';
    case 'jail_free_card':
      return 'Giữ lại; ra Bãi giữ xe miễn phí; giao dịch được';
    case 'gain':
      return `Nhận ${money(e.amount)}`;
    case 'pay_bank':
      return `Trả ${money(e.amount)}`;
    case 'repairs':
      return `Trả ${money(e.perHouse)}/nhà, ${money(e.perHotel)}/khách sạn`;
    case 'pay_each_player':
      return `Trả mỗi người chơi ${money(e.amount)}`;
    case 'collect_from_each':
      return `Mỗi người chơi chuyển bạn ${money(e.amount)}`;
    case 'bank_pays_all':
      return `Ngân hàng lì xì mỗi người ${money(e.amount)}`;
    case 'rent_multiplier':
      return `Thuê ${target(e)} ${e.multiplier === 2 ? 'x2' : `+${Math.round((e.multiplier - 1) * 100)}%`}`;
    case 'repairs_all':
      return e.perHouse ? `Mỗi chủ trả ${money(e.perHouse)}/nhà, ${money(e.perHotel)}/khách sạn` : `Mỗi chủ trả ${money(e.perHotel)}/khách sạn`;
    case 'bank_pays_owners':
      return `Ngân hàng trả ${money(e.amountPerProperty)} cho chủ mỗi ô ${list(e.properties)}`;
    case 'single_die':
      return `Mọi người tung 1 xúc xắc (không có đôi); người trong Bãi giữ xe vẫn tung 2. ${charList(e.immune)} miễn`;
    case 'all_pay_owner':
      return `Mỗi người trả ${money(e.amount)} cho chủ ${tileName(e.property)}`;
    case 'pay_percent_cash':
      return `Mỗi người nộp ${pct(e.percent)} tiền mặt (làm tròn xuống hàng chục)${
        e.overrides ? `; ${Object.entries(e.overrides).map(([c, p]) => `${charName(c)} ${pct(p as number)}`).join(', ')}` : ''
      }`;
    case 'owners_pay_bank':
      return `Chủ ${groups(e.groups)} trả ${money(e.amountPerProperty)} mỗi ô sở hữu`;
    case 'unmortgage_interest':
      return e.value === 0 ? 'Chuộc thế chấp không mất lãi' : `Chuộc thế chấp mất ${pct(e.value)} lãi`;
    case 'build_freeze':
      return 'Không ai được xây mới';
    case 'landing_fee':
      return `Dừng ở ${list(e.properties)} trả thêm ${money(e.amount)} vào Quỹ${e.immune?.length ? `; ${charList(e.immune)} miễn` : ''}`;
    case 'each_roll_one_die':
      return e.then === 'go_to_jail'
        ? `Mỗi người tung 1 xúc xắc, ra ${e.onFace} thì vào Bãi giữ xe${e.immune?.length ? `; ${charList(e.immune)} miễn` : ''}`
        : `Mỗi người tung 1 xúc xắc, ra ${e.onFace} trả ${money(e.then.amount)} vào Quỹ`;
    case 'richest_cash_gain':
      return `Người nhiều tiền mặt nhất nhận ${money(e.amount)} (hòa thì chia đều)`;
    case 'composite':
      return (e.effects as Effect[]).map(describeEffect).join('; ');
    case 'bank_to_fund':
      return `thêm ${money(e.amount)} vào Quỹ`;
    case 'all_pay_character':
      return `Mỗi người trả ${money(e.amount)} cho ${charName(e.character)}; không có thì: ${describeEffect(e.fallback)}`;
    case 'all_pay':
      return `Mỗi người trả ${money(e.amount)} vào Quỹ${
        e.overrides ? `; ${Object.entries(e.overrides).map(([c, a]) => `${charName(c)} trả ${money(a as number)}`).join(', ')}` : ''
      }`;
    case 'drawer_gain':
      return `người rút nhận ${money(e.amount)}`;
    default:
      return e.type;
  }
}

export function describeCard(id: string): string {
  const c = D.cards[id];
  return `${describeEffect(c.effect)}${c.kind === 'duration' ? ' ⏳' : ''}`;
}

/** Vietnamese description of a character passive / drawback / skill entry. */
export function describeTrait(e: Effect): string {
  switch (e.type) {
    case 'go_salary':
      return `Lương ${money(e.value)}`;
    case 'purchase_discount':
      return `Mua ${e.properties ? list(e.properties) : groups(e.groups)} giảm ${pct(e.rate)}`;
    case 'event_override':
      return `${cardName(e.card)} (${e.card}) mất ${pct(e.percent)}`;
    case 'tax_override':
      return `${tileName(e.tax)} trả ${money(e.amount)}`;
    case 'bailout':
      return `Khi sắp phá sản, ngân hàng trả hộ tối đa ${money(e.maxAmount)} của khoản nợ`;
    case 'ignore_go_to_jail_tile':
      return 'Dừng ô CSGT thổi còi không bị vào Bãi giữ xe';
    case 'immune_events':
      return `Miễn ${(e.cards as string[]).join(', ')}`;
    case 'landing_fee':
      return `Dừng ở ${list(e.properties)} trả thêm ${money(e.amount)} phí phát thải (vào Quỹ)`;
    case 'rent_discount':
      return `Giảm ${pct(e.rate)} một lần trả tiền thuê`;
    case 'adjust_roll':
      return `Mỗi vòng 1 lần cộng hoặc trừ ${e.delta} bước sau khi tung${e.maxUses ? `, tối đa ${e.maxUses} lần/ván` : ''}`;
    case 'reroll':
      return 'Tung lại xúc xắc, dùng kết quả mới';
    case 'rent_bonus_from_bank':
      return `Nhận thêm ${pct(e.rate)} tiền thuê thu được (tối thiểu ${money(e.min)}) từ ngân hàng`;
    case 'card_payment_multiplier':
      return `Mọi khoản phải trả từ thẻ x${String(e.value).replace('.', ',')}`;
    case 'block_rent':
      return 'Chọn 1 đối thủ, đất của họ không thu thuê trong 1 vòng';
    case 'commission_on_opponent_bank_purchase':
      return `Nhận ${money(e.amount)} mỗi khi đối thủ mua đất từ ngân hàng (kể cả đấu giá)`;
    case 'no_hotels':
      return 'Không được lên khách sạn';
    case 'rent_multiplier':
      return `1 nhóm màu tùy chọn, thuê x${e.multiplier} trong 1 vòng (mọi chủ đều hưởng)`;
    case 'draw_two_choose_one':
      return 'Rút thẻ Cơ hội, Cộng đồng: rút 2 chọn 1';
    case 'forbidden_properties':
      return `Không được sở hữu ${list(e.properties)}`;
    case 'cancel_event_for_self':
      return 'Hủy hiệu ứng của 1 thẻ Event đối với bản thân';
    case 'park_bonus':
      return `Dừng Văn Miếu nhận thêm ${money(e.amount)} (${money(e.amountWhenFundOff)} khi Quỹ tắt)`;
    case 'starting_cash':
      return `Bắt đầu ${money(e.value)}`;
    case 'auto_salary_upgrade':
      return `Tự động: từ lần qua ô 0 thứ ${e.afterGoPasses}, lương ${money(e.value)}`;
    case 'free_jail_exit':
      return 'Ra Bãi giữ xe miễn phí';
    default:
      return e.type;
  }
}

export function describeCharacter(id: string) {
  const c = D.characters[id];
  return {
    name: c.name,
    passives: c.passives.map(describeTrait),
    drawbacks: c.drawbacks.length ? c.drawbacks.map(describeTrait) : ['Không'],
    skill: `${c.skill.name}: ${describeTrait(c.skill)}`,
  };
}

// ---------------------------------------------------------------- event log

export type NameOf = (playerId: string) => string;

export interface Who {
  name: NameOf;
  character: (playerId: string) => string | null;
}

const to = (target: unknown, name: NameOf): string => {
  const x = target as { kind: string; id?: string };
  if (x?.kind === 'player') return name(x.id!);
  if (x?.kind === 'fund') return 'Quỹ khuyến học';
  return 'ngân hàng';
};

const reasonText = (r: unknown): string => {
  const s = String(r);
  if (D.cards[s]) return ` (${cardName(s)})`;
  if (s === 'TAX1' || s === 'TAX2') return ` (${tileName(s)})`;
  if (s === 'jailFine') return ' (phạt ra Bãi giữ xe)';
  if (s === 'characterFee') return ' (phí phát thải)';
  if (s === 'inheritedMortgage') return ' (lãi thế chấp)';
  if (s === 'adjustStep') return ' (phí chỉnh bước)';
  if (D.ownables[s]) return ` (thuê ${tileName(s)})`;
  return '';
};

/** One log line per event, or null for events not worth showing. */
export function formatEvent(e: GameEvent, who: Who): string | null {
  const name = who.name;
  const p = e.player ? name(e.player as string) : '';
  switch (e.type) {
    case 'turnStarted':
      return `— ${p} bắt đầu lượt${e.inJail ? ' (đang ở Bãi giữ xe)' : ''}`;
    case 'diceRolled': {
      const dice = (e.dice as number[]).join(' + ');
      if (e.purpose === 'reroll') return `${p} tung lại: ${dice}`;
      if (e.purpose === 'utilityRent') return `${p} tung xúc xắc tính tiền điện nước: ${dice}`;
      if (typeof e.purpose === 'string' && D.cards[e.purpose]) return `${p} tung 1 xúc xắc: ${dice}`;
      return `${p} tung ${dice}`;
    }
    case 'stepAdjusted':
      return `${p} chỉnh ${(e.delta as number) > 0 ? '+' : ''}${e.delta} bước`;
    case 'tripleDoubles':
      return `${p} tung đôi 3 lần liên tiếp!`;
    case 'moved':
      return null;
    case 'landed':
      return `${p} dừng ở ${D.board[e.position as number].name}`;
    case 'salary':
      return `${p} qua ${D.board[0].name}, nhận lương ${money(e.amount as number)}`;
    case 'purchased':
      return `${p} mua ${tileName(e.propertyId as string)} giá ${money(e.price as number)}`;
    case 'purchaseDeclined':
      return `${p} không mua ${tileName(e.propertyId as string)}`;
    case 'auctionStarted':
      return `Đấu giá ${tileName(e.propertyId as string)}`;
    case 'bid':
      return `${p} trả ${money(e.amount as number)}`;
    case 'auctionEnded':
      return e.winner
        ? `${name(e.winner as string)} thắng đấu giá ${tileName(e.propertyId as string)} giá ${money(e.price as number)}`
        : `Không ai mua ${tileName(e.propertyId as string)}`;
    case 'dealt':
      return `${p} được chia ${tileName(e.propertyId as string)} (${money(e.price as number)})`;
    case 'rentDue':
      return null;
    case 'rentWaived':
      return e.why === 'mortgaged'
        ? `${tileName(e.propertyId as string)} đang thế chấp — không thu thuê`
        : e.why === 'blocked'
          ? `${tileName(e.propertyId as string)} bị Bóc phốt — không thu thuê`
          : null;
    case 'payment':
      return `${name(e.from as string)} trả ${to(e.to, name)} ${money(e.amount as number)}${reasonText(e.reason)}`;
    case 'paymentSkipped':
      return null;
    case 'gain':
      return `${p} nhận ${money(e.amount as number)}${reasonText(e.reason)}`;
    case 'rentBonus':
      return `${p} nhận thêm ${money(e.amount as number)} từ ngân hàng`;
    case 'commission':
      return `${p} nhận hoa hồng ${money(e.amount as number)}`;
    case 'fundCollected':
      return `${p} nhận toàn bộ Quỹ khuyến học: ${money(e.amount as number)}`;
    case 'fundDeposit':
      return `Ngân hàng góp ${money(e.amount as number)} vào Quỹ`;
    case 'cardDrawn':
      return `${p} rút thẻ "${cardName(e.cardId as string)}": ${describeCard(e.cardId as string)}`;
    case 'cardDrawing':
      return `${p} rút một thẻ ${t.board.deckNames[e.deck as 'chance']}…`;
    case 'cardKept':
      return `${p} giữ thẻ ${cardName(e.cardId as string)}`;
    case 'cardEffect':
      return null;
    case 'deckEmpty':
      return 'Bộ thẻ đã hết';
    case 'effectStarted':
      return null;
    case 'effectExpired':
      return null;
    case 'jailed':
      return `${p} vào Bãi giữ xe`;
    case 'leftJail':
      return `${p} ra Bãi giữ xe${e.how === 'doubles' ? ' nhờ tung đôi' : e.how === 'card' ? ' bằng Giấy tờ xe' : e.how === 'skill' ? ' (Xin nghỉ phép)' : ''}`;
    case 'stayedInJail':
      return `${p} chưa ra được Bãi giữ xe`;
    case 'goToJailIgnored':
      return `${p} được CSGT cho đi tiếp`;
    case 'built':
      return `${p} xây ${e.hotel ? 'khách sạn' : 'nhà'} ở ${tileName(e.propertyId as string)}`;
    case 'buildingSold':
      return `${p} bán công trình ở ${tileName(e.propertyId as string)}, nhận ${money(e.refund as number)}`;
    case 'mortgaged':
      return `${p} thế chấp ${tileName(e.propertyId as string)}, nhận ${money(e.amount as number)}`;
    case 'unmortgaged':
      return `${p} chuộc ${tileName(e.propertyId as string)} (${money(e.amount as number)})`;
    case 'tradeProposed':
      return `${name((e.trade as { from: string }).from)} đề nghị giao dịch với ${name((e.trade as { to: string }).to)}`;
    case 'tradeAccepted':
      return 'Giao dịch thành công';
    case 'tradeRejected':
      return 'Giao dịch bị từ chối';
    case 'tradeCancelled':
      return 'Giao dịch đã hủy';
    case 'debt':
      return `${p} thiếu tiền: cần ${money(e.amount as number)}`;
    case 'bankrupt':
      return `${p} phá sản!`;
    case 'skillUsed':
      return `${p} dùng kỹ năng ${D.characters[who.character(e.player as string) ?? '']?.skill.name ?? ''}`.trim();
    case 'skillTriggered':
      return `${p} tốt nghiệp — lương tăng`;
    case 'decisionRequired':
      return null;
    case 'gameCreated':
      return 'Ván mới bắt đầu';
    case 'gameOver':
      return 'Kết thúc ván';
    default:
      return null;
  }
}

export const ENGINE_EVENT_TYPES_HANDLED = [
  'turnStarted', 'diceRolled', 'stepAdjusted', 'tripleDoubles', 'moved', 'landed', 'salary', 'purchased',
  'purchaseDeclined', 'auctionStarted', 'bid', 'auctionEnded', 'dealt', 'rentDue', 'rentWaived', 'payment',
  'paymentSkipped', 'gain', 'rentBonus', 'commission', 'fundCollected', 'fundDeposit', 'cardDrawn', 'cardKept',
  'cardEffect', 'cardDrawing', 'deckEmpty', 'effectStarted', 'effectExpired', 'jailed', 'leftJail', 'stayedInJail',
  'goToJailIgnored', 'built', 'buildingSold', 'mortgaged', 'unmortgaged', 'tradeProposed', 'tradeAccepted',
  'tradeRejected', 'tradeCancelled', 'debt', 'bankrupt', 'skillUsed', 'skillTriggered', 'decisionRequired',
  'gameCreated', 'gameOver',
];

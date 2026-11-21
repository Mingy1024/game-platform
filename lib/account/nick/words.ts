import type { Locale } from "@/lib/i18n/locales";

/**
 * 隨機暱稱詞庫：形容詞＋名詞＋四位數，車站主題。
 *
 * 資料庫只存編號（players.nick_adj、nick_noun），所以：
 * - 只能在陣列「最後面」加新詞，不能刪除或調換順序，否則既有玩家的暱稱會變。
 * - 改翻譯沒關係，每種語言顯示自己的版本。
 *
 * 葡萄牙文的形容詞放在名詞後面，而且要和名詞的陰陽性一致；
 * 這裡的形容詞都挑不分陰陽性的字（pontual、veloz、feliz…），任何名詞都能配。
 */
type Word = Record<Locale, string>;

const w = (zhTW: string, zhCN: string, en: string, ja: string, ko: string, vi: string, pt: string): Word => ({
  "zh-TW": zhTW,
  "zh-CN": zhCN,
  en,
  ja,
  ko,
  vi,
  pt,
});

export const ADJECTIVES: readonly Word[] = [
  w("準點的", "准点的", "Punctual", "定刻の", "정시의", "Đúng Giờ", "Pontual"),
  w("飛快的", "飞快的", "Swift", "俊足の", "날쌘", "Nhanh Nhẹn", "Veloz"),
  w("開朗的", "开朗的", "Cheerful", "陽気な", "명랑한", "Vui Tươi", "Alegre"),
  w("溫柔的", "温柔的", "Gentle", "やさしい", "다정한", "Hiền Hòa", "Gentil"),
  w("開心的", "开心的", "Happy", "ごきげんな", "신나는", "Vui Vẻ", "Feliz"),
  w("勇敢的", "勇敢的", "Brave", "勇敢な", "용감한", "Dũng Cảm", "Valente"),
  w("閃亮的", "闪亮的", "Shiny", "ピカピカの", "반짝이는", "Lấp Lánh", "Brilhante"),
  w("忠實的", "忠实的", "Loyal", "忠実な", "충실한", "Trung Thành", "Leal"),
  w("耐心的", "耐心的", "Patient", "気長な", "느긋한", "Kiên Nhẫn", "Paciente"),
  w("認真的", "认真的", "Diligent", "まじめな", "성실한", "Chăm Chỉ", "Diligente"),
  w("靈巧的", "灵巧的", "Nimble", "身軽な", "재빠른", "Khéo Léo", "Ágil"),
  w("聰明的", "聪明的", "Clever", "かしこい", "똑똑한", "Thông Minh", "Inteligente"),
  w("穩重的", "稳重的", "Steady", "どっしりした", "든든한", "Vững Vàng", "Firme"),
  w("有力的", "有力的", "Mighty", "力持ちの", "힘센", "Mạnh Mẽ", "Forte"),
  w("年輕的", "年轻的", "Young", "若い", "젊은", "Trẻ Trung", "Jovem"),
  w("自在的", "自在的", "Carefree", "自由な", "자유로운", "Tự Do", "Livre"),
  w("輕快的", "轻快的", "Breezy", "軽やかな", "경쾌한", "Nhẹ Nhàng", "Leve"),
  w("優雅的", "优雅的", "Elegant", "優雅な", "우아한", "Thanh Lịch", "Elegante"),
  w("親切的", "亲切的", "Friendly", "親切な", "친절한", "Tử Tế", "Amável"),
  w("甜甜的", "甜甜的", "Sweet", "甘い", "달콤한", "Ngọt Ngào", "Doce"),
  w("活潑的", "活泼的", "Lively", "元気な", "활기찬", "Sôi Nổi", "Vibrante"),
  w("機警的", "机警的", "Watchful", "用心深い", "빈틈없는", "Cảnh Giác", "Vigilante"),
  w("大膽的", "大胆的", "Bold", "大胆な", "대담한", "Táo Bạo", "Audaz"),
  w("有禮的", "有礼的", "Polite", "礼儀正しい", "예의 바른", "Lịch Sự", "Cortês"),
  w("高貴的", "高贵的", "Noble", "気高い", "고귀한", "Cao Quý", "Nobre"),
  w("樸素的", "朴素的", "Humble", "素朴な", "소박한", "Giản Dị", "Simples"),
  w("堅持的", "坚持的", "Tenacious", "粘り強い", "끈기 있는", "Bền Bỉ", "Tenaz"),
  w("能幹的", "能干的", "Capable", "頼れる", "유능한", "Giỏi Giang", "Capaz"),
  w("知足的", "知足的", "Content", "満ち足りた", "만족한", "Mãn Nguyện", "Contente"),
  w("謙虛的", "谦虚的", "Modest", "謙虚な", "겸손한", "Khiêm Tốn", "Humilde"),
  w("藍色的", "蓝色的", "Blue", "青い", "파란", "Xanh Lam", "Azul"),
  w("綠色的", "绿色的", "Green", "緑の", "초록", "Xanh Lá", "Verde"),
];

export const NOUNS: readonly Word[] = [
  w("月台", "站台", "Platform", "ホーム", "승강장", "Sân Ga", "Plataforma"),
  w("車掌", "列车员", "Conductor", "車掌", "차장", "Trưởng Tàu", "Condutor"),
  w("便當", "便当", "Bento", "駅弁", "도시락", "Cơm Hộp", "Marmita"),
  w("號誌", "信号灯", "Signal", "信号", "신호등", "Đèn Tín Hiệu", "Sinal"),
  w("車票", "车票", "Ticket", "切符", "승차권", "Vé Tàu", "Bilhete"),
  w("鐵軌", "铁轨", "Rail", "レール", "레일", "Đường Ray", "Trilho"),
  w("火車頭", "火车头", "Locomotive", "機関車", "기관차", "Đầu Máy", "Locomotiva"),
  w("車廂", "车厢", "Carriage", "客車", "객차", "Toa Tàu", "Vagão"),
  w("站長", "站长", "Stationmaster", "駅長", "역장", "Trưởng Ga", "Chefe"),
  w("汽笛", "汽笛", "Whistle", "汽笛", "기적", "Còi Tàu", "Apito"),
  w("發車鈴", "发车铃", "Bell", "発車ベル", "발차 벨", "Chuông Ga", "Sino"),
  w("時鐘", "时钟", "Clock", "時計", "시계", "Đồng Hồ", "Relógio"),
  w("長椅", "长椅", "Bench", "ベンチ", "벤치", "Ghế Chờ", "Banco"),
  w("雨傘", "雨伞", "Umbrella", "傘", "우산", "Chiếc Ô", "Guarda-Chuva"),
  w("行李箱", "行李箱", "Suitcase", "スーツケース", "여행 가방", "Vali", "Mala"),
  w("路線圖", "线路图", "Route Map", "路線図", "노선도", "Bản Đồ", "Mapa"),
  w("隧道", "隧道", "Tunnel", "トンネル", "터널", "Đường Hầm", "Túnel"),
  w("鐵橋", "铁桥", "Bridge", "鉄橋", "철교", "Cầu Sắt", "Ponte"),
  w("提燈", "提灯", "Lantern", "ランプ", "랜턴", "Ngọn Đèn", "Lanterna"),
  w("鴿子", "鸽子", "Pigeon", "ハト", "비둘기", "Bồ Câu", "Pombo"),
  w("站貓", "站猫", "Station Cat", "駅ネコ", "역 고양이", "Mèo Ga", "Gato"),
  w("麻雀", "麻雀", "Sparrow", "スズメ", "참새", "Chim Sẻ", "Pardal"),
  w("飯糰", "饭团", "Rice Ball", "おにぎり", "주먹밥", "Cơm Nắm", "Bolinho"),
  w("熱茶", "热茶", "Tea", "お茶", "녹차", "Trà Nóng", "Chá"),
  w("紀念章", "纪念章", "Stamp", "駅スタンプ", "스탬프", "Con Dấu", "Carimbo"),
  w("時刻表", "时刻表", "Timetable", "時刻表", "시간표", "Lịch Tàu", "Horário"),
  w("剪票口", "检票口", "Turnstile", "改札", "개찰구", "Cửa Soát Vé", "Catraca"),
  w("轉轍器", "道岔", "Switch", "ポイント", "전철기", "Ghi Tàu", "Agulha"),
  w("集電弓", "受电弓", "Pantograph", "パンタグラフ", "팬터그래프", "Cần Lấy Điện", "Pantógrafo"),
  w("特快車", "特快", "Express", "特急", "특급", "Tàu Nhanh", "Expresso"),
  w("小火車", "小火车", "Little Train", "トロッコ", "꼬마 열차", "Tàu Nhỏ", "Trenzinho"),
  w("旅人", "旅人", "Traveler", "旅人", "나그네", "Lữ Khách", "Viajante"),
];

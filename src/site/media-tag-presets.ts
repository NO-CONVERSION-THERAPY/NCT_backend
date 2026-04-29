export type MediaTagPresetLanguage = 'en' | 'zh-CN' | 'zh-TW';

export type MediaTagPreset = {
  labels: Record<MediaTagPresetLanguage, string>;
  value: string;
};

export type MediaTagPresetGroup = {
  key: 'primary' | 'secondary';
  tags: MediaTagPreset[];
};

export const MEDIA_TAG_LIMIT = 20;

export const MEDIA_TAG_PRESET_GROUPS: MediaTagPresetGroup[] = [
  {
    key: 'primary',
    tags: [
      { value: 'r18', labels: { 'zh-CN': 'R18', 'zh-TW': 'R18', en: 'R18' } },
      { value: '校门', labels: { 'zh-CN': '校门', 'zh-TW': '校門', en: 'Gate' } },
      { value: '招牌', labels: { 'zh-CN': '招牌', 'zh-TW': '招牌', en: 'Signage' } },
      { value: '门牌', labels: { 'zh-CN': '门牌', 'zh-TW': '門牌', en: 'Address plate' } },
      { value: '外景', labels: { 'zh-CN': '外景', 'zh-TW': '外景', en: 'Exterior' } },
      { value: '内部环境', labels: { 'zh-CN': '内部环境', 'zh-TW': '內部環境', en: 'Interior' } },
      { value: '教室', labels: { 'zh-CN': '教室', 'zh-TW': '教室', en: 'Classroom' } },
      { value: '宿舍', labels: { 'zh-CN': '宿舍', 'zh-TW': '宿舍', en: 'Dormitory' } },
      { value: '食堂', labels: { 'zh-CN': '食堂', 'zh-TW': '食堂', en: 'Cafeteria' } },
      { value: '操场', labels: { 'zh-CN': '操场', 'zh-TW': '操場', en: 'Sports field' } },
      { value: '训练场', labels: { 'zh-CN': '训练场', 'zh-TW': '訓練場', en: 'Training ground' } },
      { value: '门禁', labels: { 'zh-CN': '门禁', 'zh-TW': '門禁', en: 'Access control' } },
      { value: '围墙', labels: { 'zh-CN': '围墙', 'zh-TW': '圍牆', en: 'Wall' } },
      { value: '监控设施', labels: { 'zh-CN': '监控设施', 'zh-TW': '監控設施', en: 'Surveillance' } },
      { value: '禁闭室', labels: { 'zh-CN': '禁闭室', 'zh-TW': '禁閉室', en: 'Isolation room' } },
      { value: '合同', labels: { 'zh-CN': '合同', 'zh-TW': '合約', en: 'Contract' } },
      { value: '收据', labels: { 'zh-CN': '收据', 'zh-TW': '收據', en: 'Receipt' } },
      { value: '宣传资料', labels: { 'zh-CN': '宣传资料', 'zh-TW': '宣傳資料', en: 'Promotional material' } },
      { value: '网页截图', labels: { 'zh-CN': '网页截图', 'zh-TW': '網頁截圖', en: 'Web screenshot' } },
      { value: '聊天记录', labels: { 'zh-CN': '聊天记录', 'zh-TW': '聊天記錄', en: 'Chat records' } },
      { value: '联系方式', labels: { 'zh-CN': '联系方式', 'zh-TW': '聯絡方式', en: 'Contact info' } },
      { value: '营业执照', labels: { 'zh-CN': '营业执照', 'zh-TW': '營業執照', en: 'Business license' } },
      { value: '法律文书', labels: { 'zh-CN': '法律文书', 'zh-TW': '法律文書', en: 'Legal document' } },
      { value: '新闻报道', labels: { 'zh-CN': '新闻报道', 'zh-TW': '新聞報導', en: 'News report' } },
    ],
  },
  {
    key: 'secondary',
    tags: [
      { value: '虚假宣传', labels: { 'zh-CN': '虚假宣传', 'zh-TW': '虛假宣傳', en: 'False advertising' } },
      { value: '冒充警察', labels: { 'zh-CN': '冒充警察', 'zh-TW': '冒充警察', en: 'Impersonating police' } },
      { value: '肢体暴力', labels: { 'zh-CN': '肢体暴力', 'zh-TW': '肢體暴力', en: 'Physical violence' } },
      { value: '工具暴力', labels: { 'zh-CN': '工具暴力', 'zh-TW': '工具暴力', en: 'Weapon violence' } },
      { value: '体罚', labels: { 'zh-CN': '体罚', 'zh-TW': '體罰', en: 'Corporal punishment' } },
      { value: '限制自由', labels: { 'zh-CN': '限制自由', 'zh-TW': '限制自由', en: 'Restriction of freedom' } },
      { value: '公开羞辱', labels: { 'zh-CN': '公开羞辱', 'zh-TW': '公開羞辱', en: 'Public humiliation' } },
      { value: '性暴力', labels: { 'zh-CN': '性暴力', 'zh-TW': '性暴力', en: 'Sexual violence' } },
      { value: '关禁闭', labels: { 'zh-CN': '关禁闭', 'zh-TW': '關禁閉', en: 'Solitary confinement' } },
      { value: '饮食限制', labels: { 'zh-CN': '饮食限制', 'zh-TW': '飲食限制', en: 'Food restriction' } },
      { value: '睡眠剥夺', labels: { 'zh-CN': '睡眠剥夺', 'zh-TW': '睡眠剝奪', en: 'Sleep deprivation' } },
      { value: '强迫服药', labels: { 'zh-CN': '强迫服药', 'zh-TW': '強迫服藥', en: 'Forced medication' } },
      { value: '性别扭转', labels: { 'zh-CN': '性别扭转', 'zh-TW': '性別扭轉', en: 'Gender conversion' } },
      { value: '精神控制', labels: { 'zh-CN': '精神控制', 'zh-TW': '精神控制', en: 'Psychological control' } },
      { value: '地址证明', labels: { 'zh-CN': '地址证明', 'zh-TW': '地址證明', en: 'Address proof' } },
      { value: '负责人信息', labels: { 'zh-CN': '负责人信息', 'zh-TW': '負責人資訊', en: 'Lead staff info' } },
      { value: '教官信息', labels: { 'zh-CN': '教官信息', 'zh-TW': '教官資訊', en: 'Instructor info' } },
      { value: '公开资料', labels: { 'zh-CN': '公开资料', 'zh-TW': '公開資料', en: 'Public material' } },
      { value: '现场拍摄', labels: { 'zh-CN': '现场拍摄', 'zh-TW': '現場拍攝', en: 'On-site shot' } },
      { value: '历史资料', labels: { 'zh-CN': '历史资料', 'zh-TW': '歷史資料', en: 'Historical material' } },
    ],
  },
];

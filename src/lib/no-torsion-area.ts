import chinaAreaData from 'china-area-data';

type AreaOption = {
  code: string;
  name: string;
};

type ValidatedProvinceAndCity = {
  provinceCode: string;
  provinceName: string;
  legacyProvinceName: string;
  cityCode: string;
  cityName: string;
};

type ValidatedCounty = {
  countyCode: string;
  countyName: string;
};

const legacyProvinceNameByCode: Record<string, string> = {
  '110000': '北京',
  '120000': '天津',
  '130000': '河北',
  '140000': '山西',
  '150000': '內蒙古',
  '210000': '遼寧',
  '220000': '吉林',
  '230000': '黑龍江',
  '310000': '上海',
  '320000': '江蘇',
  '330000': '浙江',
  '340000': '安徽',
  '350000': '福建',
  '360000': '江西',
  '370000': '山東',
  '410000': '河南',
  '420000': '湖北',
  '430000': '湖南',
  '440000': '廣東',
  '450000': '廣西',
  '460000': '海南',
  '500000': '重慶',
  '510000': '四川',
  '520000': '貴州',
  '530000': '雲南',
  '540000': '西藏',
  '610000': '陝西',
  '620000': '甘肅',
  '630000': '青海',
  '640000': '寧夏',
  '650000': '新疆',
  '710000': '臺灣',
  '810000': '香港',
  '820000': '澳門',
};

function toOption([code, name]: [string, string]): AreaOption {
  return { code, name };
}

function shouldFlattenToDistricts(entries: Array<[string, string]>): boolean {
  return (
    entries.length > 0
    && entries.every(
      ([, name]) => name === '市辖区' || name === '县',
    )
  );
}

function getProvinceOptions(): AreaOption[] {
  return Object.entries(chinaAreaData['86'] ?? {}).map(toOption);
}

function getCityOptionsForProvince(provinceCode: string): AreaOption[] {
  const cityEntries = Object.entries(chinaAreaData[provinceCode] ?? {});

  if (cityEntries.length === 0) {
    return [];
  }

  if (shouldFlattenToDistricts(cityEntries)) {
    return cityEntries.flatMap(([cityCode]) =>
      Object.entries(chinaAreaData[cityCode] ?? {}).map(toOption),
    );
  }

  return cityEntries.map(toOption);
}

function getCountyOptionsForCity(cityCode: string): AreaOption[] {
  return Object.entries(chinaAreaData[cityCode] ?? {})
    .filter(([, name]) => name !== '市辖区' && name !== '县')
    .map(toOption);
}

const provinceOptions = getProvinceOptions();
const cityOptionsByProvinceCode = Object.fromEntries(
  provinceOptions.map((province) => [
    province.code,
    getCityOptionsForProvince(province.code),
  ]),
);
const countiesByCityCode = Object.fromEntries(
  Object.values(cityOptionsByProvinceCode)
    .flat()
    .map((city) => [city.code, getCountyOptionsForCity(city.code)]),
);

export function validateProvinceAndCity(
  provinceCode: string,
  cityCode: string,
): ValidatedProvinceAndCity | null {
  const province = provinceOptions.find((item) => item.code === provinceCode);
  if (!province) {
    return null;
  }

  const city = (cityOptionsByProvinceCode[provinceCode] ?? []).find(
    (item) => item.code === cityCode,
  );
  if (!city) {
    return null;
  }

  return {
    provinceCode: province.code,
    provinceName: province.name,
    legacyProvinceName:
      legacyProvinceNameByCode[province.code] ?? province.name,
    cityCode: city.code,
    cityName: city.name,
  };
}

export function validateCountyForCity(
  cityCode: string,
  countyCode: string,
): ValidatedCounty | null {
  if (!countyCode) {
    return null;
  }

  const county = (countiesByCityCode[cityCode] ?? []).find(
    (item) => item.code === countyCode,
  );

  if (!county) {
    return null;
  }

  return {
    countyCode: county.code,
    countyName: county.name,
  };
}

export function validateProvinceCode(provinceCode: string): {
  provinceCode: string;
  provinceName: string;
  legacyProvinceName: string;
} | null {
  const province = provinceOptions.find((item) => item.code === provinceCode);

  if (!province) {
    return null;
  }

  return {
    provinceCode: province.code,
    provinceName: province.name,
    legacyProvinceName:
      legacyProvinceNameByCode[province.code] ?? province.name,
  };
}

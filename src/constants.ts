export type Gender = 'male' | 'female'
export const ACADEMIC_YEAR = '2019'
export const LEVELS = [
  { key: 1, en: 'Nuraniya', am: 'ኑራኒያ' }, { key: 2, en: 'Quran 1', am: 'ቁርአን 1' },
  { key: 3, en: 'Quran 2', am: 'ቁርአን 2' }, { key: 4, en: 'Hifz', am: 'ሂፍዝ' }]
export const levelId = (k: number, g: Gender) => `l${k}${g === 'male' ? 'm' : 'f'}`
export const levelName = (id: string) => {
  const l = LEVELS.find(x => x.key === Number(id?.[1])); return l ? `${l.en} · ${l.am}` : id }
export const DAYS = [['Monday','ሰኞ'],['Tuesday','ማክሰኞ'],['Wednesday','ረቡዕ'],['Thursday','ሐሙስ'],['Friday','አርብ'],['Saturday','ቅዳሜ'],['Sunday','እሁድ']]
export const FEE = { regular: 500, yetim: 0 }

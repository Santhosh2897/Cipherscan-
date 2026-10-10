import { SupportedLanguage, TranslationKey } from '../types';
import { en } from './en';
import { hi } from './hi';
import { mr } from './mr';
import { ta } from './ta';
import { te } from './te';
import { bn } from './bn';
import { ko } from './ko';

export const translations: Record<SupportedLanguage, Record<TranslationKey, string>> = {
  en,
  hi,
  mr,
  ta,
  te,
  bn,
  ko,
};

export { en, hi, mr, ta, te, bn, ko };

import { SupportedLanguage, TranslationKey } from '../types';
import { en } from './en';
import { hi } from './hi';
import { mr } from './mr';
import { ta } from './ta';
import { te } from './te';
import { bn } from './bn';

export const translations: Record<SupportedLanguage, Record<TranslationKey, string>> = {
  en,
  hi,
  mr,
  ta,
  te,
  bn,
};

export { en, hi, mr, ta, te, bn };

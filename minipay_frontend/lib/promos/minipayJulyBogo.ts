/** MiniPay — Buy 1 Perk, Get 1 Free (backend BOGO). Shown on home & discovery surfaces, not the shop. */

export const MINIPAY_JULY_BOGO_MONTH_KEY = '2026-07';

export const MINIPAY_JULY_BOGO_HEADLINE = 'Perk bonus';
export const MINIPAY_JULY_BOGO_MESSAGE = 'Buy 1 Perk, Get 1 Free';
export const MINIPAY_JULY_BOGO_SUBLINE = 'Pay with USDT in the Perk Shop — your free perk lands right after checkout.';
export const MINIPAY_JULY_BOGO_FOOTNOTE = 'No code needed. Your bonus perk is delivered automatically.';
export const MINIPAY_JULY_BOGO_CTA = 'Shop perks';
export const MINIPAY_JULY_BOGO_SHOP_HREF = '/game-shop';

export const MINIPAY_JULY_BOGO_DISMISS_KEY = 'tycoon_minipay_bogo_promo_dismissed';

/** Set false to hide promo banners everywhere. BOGO claim on purchase can stay enabled separately. */
export const MINIPAY_JULY_BOGO_PROMO_UI_ENABLED = true;

export function isMinipayJulyBogoPromoActive(): boolean {
  return MINIPAY_JULY_BOGO_PROMO_UI_ENABLED;
}

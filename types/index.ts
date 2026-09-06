// 統一類型定義

// 食品相關類型
export interface Food {
  $id: string;
  name: string;
  amount: number;
  todate: string;
  photo: string;
  price?: number;
  shop?: string;
  photohash?: string;
}

export interface FoodFormData {
  name: string;
  amount: number;
  todate: string;
  photo: string;
  price?: number;
  shop?: string;
  photohash?: string;
}

export interface FoodDetail {
  id: string;
  name: string;
  daysRemaining: number;
  expireDate: string;
}

// 訂閱相關類型
export interface Subscription {
  $id: string;
  name: string;
  site?: string;
  price: number;
  nextdate?: string;
  note?: string;
  account?: string;
  currency?: string;
  continue?: boolean;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface SubscriptionFormData {
  name: string;
  site?: string;
  price: number;
  nextdate?: string;
  note?: string;
  account?: string;
  currency?: string;
  continue?: boolean;
}

export interface SubscriptionDetail {
  id: string;
  name: string;
  site: string;
  daysRemaining: number;
  nextDate: string;
  price: number;
}

// 試用／首購管理：一筆代表「一個服務 × 一個帳號」
export type TrialStatus = "tried" | "untried";
export type PurchaseStatus = "purchased" | "not_purchased" | "unavailable";

export interface TrialPurchase {
  $id: string;
  name: string;
  eventDate?: string;
  firstPurchasePrice: number;
  regularPrice: number;
  account?: string;
  note?: string;
  trialStatus: TrialStatus;
  purchaseStatus: PurchaseStatus;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface TrialPurchaseFormData {
  name: string;
  eventDate?: string;
  firstPurchasePrice: number;
  regularPrice: number;
  account?: string;
  note?: string;
  trialStatus: TrialStatus;
  purchaseStatus: PurchaseStatus;
}

// 購物清單：一筆代表「一個要買的商品 × 預定購買資訊」
export interface ShoppingItem {
  $id: string;
  name: string;
  plannedDate?: string;
  price?: number;
  currency?: string;
  quantity?: number;
  shop?: string;
  // 取貨方式：門市購買／超商取貨付款／宅配等，或自行輸入其他方式
  pickupMethod?: string;
  // 商品圖片：Appwrite Storage 網址或任意外部圖片網址
  imageUrl?: string;
  account?: string;
  note?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface ShoppingItemFormData {
  name: string;
  plannedDate?: string;
  price?: number;
  currency?: string;
  quantity?: number;
  shop?: string;
  pickupMethod?: string;
  imageUrl?: string;
  account?: string;
  note?: string;
}

// 重灌軟體管理
export type ReinstallSystem = "win" | "mac";
export type ReinstallSoftwareType = "trial" | "free" | "paid";
export type ReinstallLicenseType = "none" | "paid_serial";
export type ReinstallSubscriptionPeriodUnit = "year" | "month";
export type ReinstallSubscriptionCurrency = "TWD" | "USD" | "JPY" | "CNY";

export interface ReinstallSoftware {
  $id: string;
  name: string;
  system: ReinstallSystem;
  softwareType: ReinstallSoftwareType;
  licenseType: ReinstallLicenseType;
  serial?: string;
  viewPassword?: string;
  subscriptionSoftware: boolean;
  subscriptionPeriod?: string;
  subscriptionPrice: number;
  subscriptionCurrency: ReinstallSubscriptionCurrency;
  site?: string;
  note?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface ReinstallSoftwareFormData {
  name: string;
  system: ReinstallSystem;
  softwareType: ReinstallSoftwareType;
  licenseType: ReinstallLicenseType;
  serial?: string;
  viewPassword?: string;
  subscriptionSoftware: boolean;
  subscriptionPeriodCount: number;
  subscriptionPeriodUnit: ReinstallSubscriptionPeriodUnit;
  subscriptionPrice: number;
  subscriptionCurrency: ReinstallSubscriptionCurrency;
  site?: string;
  note?: string;
}

// 額度管理：一筆代表「一個服務 × 一個帳號」
export type QuotaServiceType = "general" | "ai";

export interface Quota {
  $id: string;
  name: string;
  serviceType: QuotaServiceType;
  account?: string;
  quotaRemaining: number;
  /** 額度剩餘點數：與「次數」並列的另一種計量（點數 / 積分制方案） */
  quotaPoints?: number;
  /** LitMedia 每日簽到的帳號槽位（1–33 或槽位名），空的代表不自動帶入點數 */
  litmediaAccount?: string;
  /** 點數量測時刻：上一次簽到成功的時間，與 $updatedAt（寫入時間）不同 */
  pointsSyncedAt?: string;
  quotaRatio?: number;
  quotaExpiry?: string;
  /** 5 小時／一週比例的量測時刻：只有自動更新成功才會寫，手填或只換 token 都不會有 */
  usageSyncedAt?: string;
  ratio5h?: number;
  expiry5h?: string;
  ratioWeek?: number;
  expiryWeek?: string;
  ratioMonth?: number;
  expiryMonth?: string;
  /** 「使用重置」機會的剩餘次數：ChatGPT Plus 讓 5 小時／一週用量提早歸零重算的獨立機會，跟 quotaRemaining（付費超額積分）是兩回事 */
  resetCreditsBalance?: number;
  /** 上面那次機會的到期時間（`YYYY-MM-DD HH:mm`，台北時間），過了就作廢 */
  resetCreditsExpiry?: string;
  note?: string;
  /** API 不回傳明文 accessToken，只給是否存在與末 4 碼提示 */
  hasAccessToken?: boolean;
  accessTokenHint?: string;
  /**
   * 憑證格式判斷出来的來源（不含任何明文，只是一個標籤），用于畫面決定要顯示
   * 哪些方案卡片（Grok 只有一週共用額度池，沒有 5 小時／一月視窗）。辨不出來就是空字串。
   */
  accessTokenProvider?: "claude" | "grok" | "chatgpt" | "";
  $createdAt?: string;
  $updatedAt?: string;
}

export interface QuotaFormData {
  name: string;
  serviceType: QuotaServiceType;
  account?: string;
  quotaRemaining: number;
  quotaPoints?: number;
  litmediaAccount?: string;
  quotaRatio?: number;
  quotaExpiry?: string;
  ratio5h?: number;
  expiry5h?: string;
  ratioWeek?: number;
  expiryWeek?: string;
  ratioMonth?: number;
  expiryMonth?: string;
  resetCreditsBalance?: number;
  resetCreditsExpiry?: string;
  note?: string;
  /** 新填入的 accessToken 或整份 session.json；留空代表不變更 */
  accessToken?: string;
  /** 送出時要清除既有 accessToken */
  clearAccessToken?: boolean;
}

// 鋒兄Tube：一筆代表「一個追蹤的 YouTube / Bilibili 頻道」
export interface FengbroTubeChannel {
  $id: string;
  alias: string;
  sourceUrl: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface FengbroTubeChannelFormData {
  alias: string;
  sourceUrl: string;
}

// 鋒兄金融：一筆代表「一個自訂追蹤標的（provider + symbol 唯一）」
export type FinanceCustomProvider = "cnbc" | "yahoo";
export type FinanceCustomGroup = "korea" | "japan" | "taiwan" | "us" | "other";

export interface FinanceRelatedLink {
  label: string;
  url: string;
}

export interface FinanceInstrument {
  $id: string;
  name: string;
  symbol: string;
  provider: FinanceCustomProvider;
  group: FinanceCustomGroup;
  imageUrl1?: string;
  imageUrl2?: string;
  imageUrl3?: string;
  youtubeUrl?: string;
  bilibiliUrl?: string;
  linkUrl1?: string;
  linkUrl2?: string;
  linkUrl3?: string;
  featured?: boolean;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface FinanceInstrumentFormData {
  name: string;
  symbol: string;
  provider: FinanceCustomProvider;
  group: FinanceCustomGroup;
  imageUrls?: string[];
  youtubeUrl?: string;
  bilibiliUrl?: string;
  relatedLinks?: FinanceRelatedLink[];
  featured?: boolean;
}

// 圖片相關類型
export interface ImageFile {
  name: string;
  path: string;
  size: number;
  extension: string;
  modified: string;
}

// 影片相關類型
export interface VideoItem {
  id: string;
  title: string;
  description: string;
  filename: string;
  url?: string;
  filetype?: string;
  duration?: string;
  thumbnail?: string;
  cover?: string;
}

export interface VideoCacheStatus {
  cached: boolean;
  downloading: boolean;
  progress: number;
  error?: string;
  size?: number;
  cachedAt?: string;
}

export interface CacheStats {
  totalSize: number;
  totalVideos: number;
  cachedVideos: number;
  downloadingVideos: number;
}

// 儀表板統計類型
export interface DashboardStats {
  totalFoods: number;
  totalSubscriptions: number;
  foodsExpiring7Days: number;
  foodsExpiring30Days: number;
  subscriptionsExpiring3Days: number;
  subscriptionsExpiring7Days: number;
  totalMonthlyFee: number;
  expiredFoods: number;
  overdueSubscriptions: number;
  foodsExpiring7DaysList: FoodDetail[];
  foodsExpiring30DaysList: FoodDetail[];
  expiredFoodsList: FoodDetail[];
  subscriptionsExpiring3DaysList: SubscriptionDetail[];
  subscriptionsExpiring7DaysList: SubscriptionDetail[];
  overdueSubscriptionsList: SubscriptionDetail[];
}

// 選單項目類型
export interface MenuItem {
  id: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
}

// 文章相關類型
export interface Article {
  $id: string;
  title: string;
  content: string;
  newDate: string;
  category?: string;
  url1?: string;
  url2?: string;
  url3?: string;
  file1?: string;
  file1name?: string;
  file1type?: string;
  file2?: string;
  file2name?: string;
  file2type?: string;
  file3?: string;
  file3name?: string;
  file3type?: string;
  $createdAt: string;
  $updatedAt: string;
}

export interface ArticleFormData {
  title: string;
  content: string;
  newDate: string;
  category?: string;
  url1?: string;
  url2?: string;
  url3?: string;
  file1?: string;
  file1name?: string;
  file1type?: string;
  file2?: string;
  file2name?: string;
  file2type?: string;
  file3?: string;
  file3name?: string;
  file3type?: string;
}

// API 回應類型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 銀行相關類型
export interface Bank {
  $id: string;
  name: string;
  deposit?: number;
  site?: string;
  address?: string;
  withdrawals?: number;
  transfer?: number;
  activity?: string;
  card?: string;
  account?: string;
  $createdAt: string;
  $updatedAt: string;
}

export interface BankFormData {
  name: string;
  deposit?: number;
  site?: string;
  address?: string;
  withdrawals?: number;
  transfer?: number;
  activity?: string;
  card?: string;
  account?: string;
}

// 常用帳號類型
export interface CommonAccount {
  $id: string;
  name: string;
  site01?: string;
  site02?: string;
  site03?: string;
  site04?: string;
  site05?: string;
  site06?: string;
  site07?: string;
  site08?: string;
  site09?: string;
  site10?: string;
  site11?: string;
  site12?: string;
  site13?: string;
  site14?: string;
  site15?: string;
  site16?: string;
  site17?: string;
  site18?: string;
  site19?: string;
  site20?: string;
  site21?: string;
  site22?: string;
  site23?: string;
  site24?: string;
  site25?: string;
  site26?: string;
  site27?: string;
  site28?: string;
  site29?: string;
  site30?: string;
  site31?: string;
  site32?: string;
  site33?: string;
  site34?: string;
  site35?: string;
  site36?: string;
  site37?: string;
  note01?: string;
  note02?: string;
  note03?: string;
  note04?: string;
  note05?: string;
  note06?: string;
  note07?: string;
  note08?: string;
  note09?: string;
  note10?: string;
  note11?: string;
  note12?: string;
  note13?: string;
  note14?: string;
  note15?: string;
  note16?: string;
  note17?: string;
  note18?: string;
  note19?: string;
  note20?: string;
  note21?: string;
  note22?: string;
  note23?: string;
  note24?: string;
  note25?: string;
  note26?: string;
  note27?: string;
  note28?: string;
  note29?: string;
  note30?: string;
  note31?: string;
  note32?: string;
  note33?: string;
  note34?: string;
  note35?: string;
  note36?: string;
  note37?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface CommonAccountFormData {
  name: string;
  site01?: string;
  site02?: string;
  site03?: string;
  site04?: string;
  site05?: string;
  site06?: string;
  site07?: string;
  site08?: string;
  site09?: string;
  site10?: string;
  site11?: string;
  site12?: string;
  site13?: string;
  site14?: string;
  site15?: string;
  site16?: string;
  site17?: string;
  site18?: string;
  site19?: string;
  site20?: string;
  site21?: string;
  site22?: string;
  site23?: string;
  site24?: string;
  site25?: string;
  site26?: string;
  site27?: string;
  site28?: string;
  site29?: string;
  site30?: string;
  site31?: string;
  site32?: string;
  site33?: string;
  site34?: string;
  site35?: string;
  site36?: string;
  site37?: string;
  note01?: string;
  note02?: string;
  note03?: string;
  note04?: string;
  note05?: string;
  note06?: string;
  note07?: string;
  note08?: string;
  note09?: string;
  note10?: string;
  note11?: string;
  note12?: string;
  note13?: string;
  note14?: string;
  note15?: string;
  note16?: string;
  note17?: string;
  note18?: string;
  note19?: string;
  note20?: string;
  note21?: string;
  note22?: string;
  note23?: string;
  note24?: string;
  note25?: string;
  note26?: string;
  note27?: string;
  note28?: string;
  note29?: string;
  note30?: string;
  note31?: string;
  note32?: string;
  note33?: string;
  note34?: string;
  note35?: string;
  note36?: string;
  note37?: string;
}

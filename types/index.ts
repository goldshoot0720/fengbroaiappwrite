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
  icon?: React.ReactNode;
  children?: MenuItem[];
}

// 文章相關類型
export interface Article {
  $id: string;
  title: string;
  content: string;
  newDate: string;
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

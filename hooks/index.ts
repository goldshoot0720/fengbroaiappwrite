// Hooks 統一導出

export { useFoods, getFoodExpiryInfo } from "./useFoods";
export { useSubscriptions, getSubscriptionExpiryInfo } from "./useSubscriptions";
export { useImages, type ImageData } from "./useImages";
export { useVideos, type VideoData } from "./useVideos";
export { useMusic, type MusicData } from "./useMusic";
export { useBanks } from "./useBanks";
export { useDashboardStats } from "./useDashboardStats";
export { useVideoCache } from "./useVideoCache";
export { useMusicCache } from "./useMusicCache";
export { useDocumentCache } from "./useDocumentCache";
export { usePodcastCache } from "./usePodcastCache";
export { useApi, useCrud, fetchApi } from "./useApi";
export { useCommonDocument, type CommonDocumentData } from "./useCommonDocument";
export {
  bumpRefreshKey,
  notifyDataRefresh,
  useRefreshKeyListener,
  DATA_REFRESH_EVENT,
} from "./useRefreshKey";
export {
  useSpeechRecognition,
  formatRecordingClock,
  playVoiceSuccessTone,
  type SpeechRecognitionMode,
  type UseSpeechRecognitionOptions,
  type UseSpeechRecognitionReturn,
} from "./useSpeechRecognition";
export { useVoicePreferences } from "./useVoicePreferences";
export { useNotificationPermission } from "./useNotificationPermission";
export {
  useExpiryNotifications,
  sendExpiryOsNotifications,
} from "./useExpiryNotifications";
export { useWebPush } from "./useWebPush";

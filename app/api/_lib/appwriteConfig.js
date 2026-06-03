export function isMissingAppwriteConfigError(error) {
  return (error?.message || "").includes("Appwrite configuration is missing");
}

export function getAppwriteErrorStatus(error) {
  return isMissingAppwriteConfigError(error) ? 400 : 500;
}

export function getAppwriteErrorMessage(error) {
  return isMissingAppwriteConfigError(error)
    ? "Appwrite configuration is missing. Please configure Appwrite in Settings."
    : error?.message || "Appwrite request failed";
}

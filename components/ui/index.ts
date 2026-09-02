// UI 元件統一導出

// 基礎元件
export { Button, buttonVariants } from "./button";
export { Input } from "./input";
export { Textarea } from "./textarea";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./card";

// 表格元件
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

// 自訂元件
export { EmptyState } from "./empty-state";
export { StatCard, SimpleStatCard } from "./stat-card";
export { LoadingSpinner, FullPageLoading, InlineLoading } from "./loading-spinner";
export { StatusBadge, StatusDot } from "./status-badge";
export { SectionHeader, SubSectionHeader, PageTitle } from "./section-header";
export { DataCard, DataCardItem, DataCardList } from "./data-card";
export { FormCard, FormGrid, FormActions } from "./form-card";

// 主題元件
export { ThemeToggle, ThemeToggleCompact } from "./theme-toggle";

// 語音
export { VoiceCommandBar, type VoiceBarPending, type VoiceBarRisk } from "./voice-command-bar";
export { GlobalVoiceCommandPanel } from "./global-voice-command-panel";

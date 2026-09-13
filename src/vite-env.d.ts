/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DESKTOP?: string;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
}

interface Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<{
    name: string;
    queryPermission?: (descriptor?: { mode?: string }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: { mode?: string }) => Promise<PermissionState>;
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

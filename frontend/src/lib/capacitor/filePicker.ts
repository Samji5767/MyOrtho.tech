import { isNative, isIOS } from "./platform";

export interface PickedFile {
  name: string;
  mimeType: string;
  /** Base64-encoded data URI when native; object URL when web */
  dataUri: string;
  /** Raw File object — only available on web */
  file?: File;
}

export interface FilePickerOptions {
  /** MIME types to accept, e.g. ["model/stl", "application/octet-stream"] */
  mimeTypes?: string[];
  /** File extensions to accept, e.g. [".stl", ".ply"] */
  extensions?: string[];
  multiple?: boolean;
}

/**
 * Opens a native document picker on iOS/Android, or a web <input> fallback.
 * Returns the selected file(s) or an empty array if cancelled.
 */
export async function pickFiles(opts: FilePickerOptions = {}): Promise<PickedFile[]> {
  if (typeof window === "undefined") return [];

  if (isNative()) {
    try {
      const { FilePicker } = (await import(/* webpackIgnore: true */ "@capawesome/capacitor-file-picker" as any)) as {
        FilePicker: {
          pickFiles: (opts: {
            types?: string[];
            multiple?: boolean;
            readData?: boolean;
          }) => Promise<{ files: Array<{ name: string; mimeType: string; data?: string }> }>;
        };
      };
      const result = await FilePicker.pickFiles({
        types: opts.mimeTypes,
        multiple: opts.multiple ?? false,
        readData: true,
      });
      return result.files.map(f => ({
        name: f.name,
        mimeType: f.mimeType,
        dataUri: f.data ? `data:${f.mimeType};base64,${f.data}` : "",
      }));
    } catch {
      // Plugin not installed or cancelled
      return [];
    }
  }

  // Web fallback: programmatic <input type="file">
  return new Promise<PickedFile[]>(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    if (opts.multiple) input.multiple = true;
    // Build accept string from extensions and MIME types
    const accept = [
      ...(opts.extensions ?? []),
      ...(opts.mimeTypes ?? []),
    ].join(",");
    if (accept) input.accept = accept;

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) { resolve([]); return; }
      Promise.all(
        files.map(
          file =>
            new Promise<PickedFile>(res => {
              const reader = new FileReader();
              reader.onload = () => res({
                name: file.name,
                mimeType: file.type || "application/octet-stream",
                dataUri: reader.result as string,
                file,
              });
              reader.readAsDataURL(file);
            }),
        ),
      ).then(resolve);
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/** Convenience: pick a single dental scan file (STL / OBJ / PLY / DICOM) */
export const pickScanFile = () =>
  pickFiles({
    extensions: [".stl", ".ply", ".obj", ".dcm", ".dicom"],
    mimeTypes: ["model/stl", "application/octet-stream"],
    multiple: false,
  });

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Scan } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function BarcodeScanInput({
  onScan,
  autoFocus = true,
}: {
  onScan: (code: string) => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    return () => controlsRef.current?.stop();
  }, []);

  const startCamera = async () => {
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      setCameraOn(true);
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result) => {
          if (result) {
            const code = result.getText();
            onScan(code);
            controls.stop();
            setCameraOn(false);
          }
        },
      );
      controlsRef.current = controls;
    } catch (e) {
      console.error(e);
      toast.error(t("scanner.cameraError"));
      setCameraOn(false);
    }
  };

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraOn(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onScan(v);
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("scanner.scanOrType")}
            className="pl-9 font-mono"
            inputMode="text"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={!value.trim()}>
          {t("common.submit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={cameraOn ? stopCamera : startCamera}
        >
          {cameraOn ? (
            <>
              <CameraOff className="h-4 w-4 mr-1.5" />
              {t("scanner.stopCamera")}
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 mr-1.5" />
              {t("scanner.useCamera")}
            </>
          )}
        </Button>
      </form>
      {cameraOn && (
        <div className="rounded-lg overflow-hidden border border-border bg-black aspect-video max-w-md">
          <video ref={videoRef} className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

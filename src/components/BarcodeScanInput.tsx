import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  CameraOff,
  Scan,
  AlertCircle,
  Loader2,
  Flashlight,
  FlashlightOff,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrowserMultiFormatReader } from "@zxing/browser";

type Props = {
  onScan: (code: string) => void;
  autoFocus?: boolean;
};

export function BarcodeScanInput({ onScan, autoFocus = true }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const startingRef = useRef(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch (e) {
      console.warn("[scanner] controls.stop failed", e);
    }
    controlsRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setStarting(false);
    setTorchOn(false);
    setTorchSupported(false);
    startingRef.current = false;
  }, []);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch (e) {
      console.warn("[scanner] torch toggle failed", e);
    }
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  const enumerate = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter((d) => d.kind === "videoinput");
      setDevices(cams);
      return cams;
    } catch (e) {
      console.error("[scanner] enumerateDevices failed", e);
      return [];
    }
  };

  const startCamera = async (preferredId?: string) => {
    if (startingRef.current || cameraOn) return;
    startingRef.current = true;
    setError(null);
    setStarting(true);

    if (!window.isSecureContext) {
      setError(t("scanner.httpsRequired"));
      setStarting(false);
      startingRef.current = false;
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("scanner.notSupported"));
      setStarting(false);
      startingRef.current = false;
      return;
    }

    // CRITICAL: call getUserMedia synchronously inside the user gesture
    // (no awaits before it) to preserve gesture provenance on iOS Safari.
    const constraints: MediaStreamConstraints = preferredId
      ? { video: { deviceId: { exact: preferredId } }, audio: false }
      : { video: { facingMode: { ideal: "environment" } }, audio: false };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err: any) {
      console.error("[scanner] getUserMedia error", err);
      const name = err?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(t("scanner.permissionDenied"));
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError(t("scanner.noCamera"));
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setError(t("scanner.cameraBusy"));
      } else {
        setError(t("scanner.cameraError"));
      }
      setStarting(false);
      startingRef.current = false;
      return;
    }

    streamRef.current = stream;
    setCameraOn(true);
    const video = videoRef.current;
    if (!video) {
      stopCamera();
      return;
    }
    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.srcObject = stream;
    try {
      await video.play();
    } catch (e) {
      console.warn("[scanner] video.play failed", e);
    }

    // Now safe to enumerate (labels available after permission)
    enumerate().then((cams) => {
      const active = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (active) setDeviceId(active);
      else if (cams[0]) setDeviceId(cams[0].deviceId);
    });

    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const controls = await reader.decodeFromVideoElement(video, (result) => {
        if (result) {
          const code = result.getText();
          onScan(code);
          stopCamera();
        }
      });
      controlsRef.current = controls;
    } catch (e) {
      console.error("[scanner] decode init failed", e);
      setError(t("scanner.cameraError"));
      stopCamera();
      return;
    }

    setStarting(false);
    startingRef.current = false;
  };

  const switchCamera = (id: string) => {
    setDeviceId(id);
    if (cameraOn) {
      stopCamera();
      // small delay so tracks fully release before re-acquiring
      setTimeout(() => startCamera(id), 150);
    }
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
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
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
          onClick={cameraOn ? stopCamera : () => startCamera(deviceId || undefined)}
          disabled={starting}
        >
          {starting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t("scanner.startingCamera")}
            </>
          ) : cameraOn ? (
            <>
              <CameraOff className="h-4 w-4 mr-1.5" />
              {t("scanner.stopCamera")}
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 mr-1.5" />
              {t("scanner.startCamera")}
            </>
          )}
        </Button>
      </form>

      {devices.length > 1 && cameraOn && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("scanner.cameraSource")}
          </span>
          <Select value={deviceId} onValueChange={switchCamera}>
            <SelectTrigger className="h-8 w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d, i) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `${t("scanner.camera")} ${i + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(cameraOn || starting) && (
        <div className="rounded-lg overflow-hidden border border-border bg-black aspect-video max-w-md relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {t("scanner.startingCamera")}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{error}</p>
            <p className="text-xs text-destructive/80 mt-1">
              {t("scanner.troubleshoot")}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("scanner.usbHint")}
      </p>
    </div>
  );
}

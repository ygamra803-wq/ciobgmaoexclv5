import { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, X, Camera, CheckCircle2 } from 'lucide-react';

/**
 * 📷 QRScannerModal: Interactive Camera-based QR / Barcode Scanner Modal
 */
export const QRScannerModal = ({ isOpen, onClose, onScan }) => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const videoRef = useRef(null);

  const handleSuccessScan = useCallback((code) => {
    setScannedResult(code);
    if (navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch {
        // vibration unsupported
      }
    }
    setTimeout(() => {
      onScan?.(code);
      onClose?.();
    }, 1000);
  }, [onScan, onClose]);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("الكاميرا غير مدعومة في هذا المتصفح.");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Try native BarcodeDetector API if available
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13']
        });

        const scanLoop = async () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                handleSuccessScan(rawValue);
                return;
              }
            } catch {
              // Frame detection scan step error ignore
            }
          }
          if (videoRef.current && videoRef.current.srcObject) {
            requestAnimationFrame(scanLoop);
          }
        };
        requestAnimationFrame(scanLoop);
      }
    } catch (err) {
      setError(err.message || 'عذراً، تعذر تشغيل الكاميرا المادية.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setScannedResult(null);
      setError(null);
    }
    return () => stopCamera();
  }, [isOpen]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleSuccessScan(manualCode.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">ماسح الكود والـ QR Code</h3>
              <p className="text-[11px] text-slate-400">امسح رمز الآلة أو قطعة الغيار الميدانية</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Camera Container */}
        <div className="relative bg-black h-64 flex items-center justify-center overflow-hidden">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <Camera className="w-10 h-10 mx-auto text-slate-600 animate-bounce" />
              <p className="text-xs">{error || 'جاري تهيئة واجهة الكاميرا...'}</p>
            </div>
          )}

          {/* Laser Scanner Frame Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-dashed border-emerald-500/60 rounded-2xl relative shadow-2xl">
              <div className="absolute inset-x-0 h-0.5 bg-emerald-400 animate-pulse top-1/2 shadow-[0_0_15px_#10b981]" />
            </div>
          </div>

          {/* Scanned Badge Popup */}
          {scannedResult && (
            <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-4 text-emerald-300 font-bold space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
              <span className="text-sm">تم مسح الكود بنجاح:</span>
              <span className="text-xs bg-emerald-900/80 px-3 py-1 rounded-lg font-mono border border-emerald-700">
                {scannedResult}
              </span>
            </div>
          )}
        </div>

        {/* Manual Fallback Form */}
        <form onSubmit={handleManualSubmit} className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            أو إدخال الكود المرجعي يدوياً
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="مثال: MAC-PRI-01 أو ROUL-6204"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow"
            >
              تأكيد
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QRScannerModal;

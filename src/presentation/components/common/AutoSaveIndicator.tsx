import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, RefreshCw } from 'lucide-react';

export default function AutoSaveIndicator() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    let hideTimeout;

    const handleSaving = () => {
      setStatus('saving');
    };

    const handleSaved = (e) => {
      setStatus('saved');
      setLastSaved(new Date(e.detail?.timestamp || Date.now()));

      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        setStatus('idle');
      }, 3500);
    };

    window.addEventListener('gmao:state_saving', handleSaving);
    window.addEventListener('gmao:state_saved', handleSaved);

    return () => {
      window.removeEventListener('gmao:state_saving', handleSaving);
      window.removeEventListener('gmao:state_saved', handleSaved);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, []);

  if (status === 'idle' && !lastSaved) {
    return null;
  }

  return (
    <AnimatePresence>
      {status !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 z-40 select-none pointer-events-none"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 text-white shadow-lg backdrop-blur-md border border-slate-700/60 text-xs font-mono">
            {status === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-amber-200">Sauvegarde locale...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">
                  Enregistré {lastSaved ? `(${lastSaved.toLocaleTimeString()})` : ''}
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

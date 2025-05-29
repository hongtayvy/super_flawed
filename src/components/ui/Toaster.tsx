import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

export const Toaster = () => {
  const { toasts, removeToast } = useToast();

  // Auto-dismiss toasts after timeout
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        removeToast(toasts[0].id);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [toasts, removeToast]);

  return (
    <div className="fixed bottom-0 right-0 p-4 w-full sm:max-w-xs z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden pointer-events-auto"
          >
            <div className="p-4 flex">
              <div className="flex-1">
                {toast.title && (
                  <h4 className="text-sm font-medium text-white mb-1">{toast.title}</h4>
                )}
                {toast.description && (
                  <p className="text-xs text-gray-300">{toast.description}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-4 text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
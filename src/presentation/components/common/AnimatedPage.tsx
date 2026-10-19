import { Children } from 'react';
import { motion } from 'motion/react';

// 1. Parent Container: orchestrates calm, rhythmic streaming cascade
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12, // 120ms between each cascading block for clear, enjoyable streaming
      delayChildren: 0.04,   // 40ms gentle initial onset
    },
  },
};

// 2. Streaming Block Variants (Smooth, graceful opacity and upward glide)
export const itemVariants = {
  hidden: { 
    opacity: 0, 
    y: 18,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.52, // Peaceful, steady streaming duration
      ease: [0.22, 1, 0.36, 1], // Silky smooth deceleration curve
    },
  },
};

// 3. Header Streaming Variant (Slightly more prominence with gentle settle)
export const headerSpringVariants = {
  hidden: { 
    opacity: 0, 
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.56,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function AnimatedPage({ children, className = 'space-y-5' }) {
  let nonModalIndex = 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {Children.map(children, (child) => {
        if (!child) return null;

        // Check if child is a modal/portal (fixed inset-0) to avoid breaking CSS fixed coordinates
        const isModal =
          child.props &&
          child.props.className &&
          typeof child.props.className === 'string' &&
          child.props.className.includes('fixed inset-0');

        if (isModal) {
          return child;
        }

        const isHeader = nonModalIndex === 0;
        nonModalIndex++;

        return (
          <motion.div
            variants={isHeader ? headerSpringVariants : itemVariants}
            className="w-full min-w-0"
          >
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}



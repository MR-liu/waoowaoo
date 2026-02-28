import type { Transition } from "framer-motion"

const springGentle: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 26,
  mass: 1,
}

const springSnappy: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 28,
  mass: 0.9,
}

const springModal: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 1,
}

export const MOTION_PRESETS = {
  spring: {
    gentle: springGentle,
    snappy: springSnappy,
    modal: springModal,
  },
  hover: { scale: 1.02 },
  press: { scale: 0.98 },
} as const

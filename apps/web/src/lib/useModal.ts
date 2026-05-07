import { useCallback, useState } from "react";

interface UseModalReturn {
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /** Toggle the modal open/closed */
  toggle: () => void;
}

/**
 * Simple state hook for driving a `Modal` component.
 *
 * @example
 * const confirmModal = useModal();
 *
 * <button onClick={confirmModal.open}>Delete</button>
 * <Modal isOpen={confirmModal.isOpen} onClose={confirmModal.close} title="Confirm">
 *   ...
 * </Modal>
 */
export function useModal(initialOpen = false): UseModalReturn {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle };
}

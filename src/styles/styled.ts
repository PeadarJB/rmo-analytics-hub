import { createStyles } from 'antd-style';

export const usePanelStyles = createStyles(({ token }) => ({
  filterPanel: {
    position: 'absolute' as const,
    top: 88,
    right: 16,
    width: 420,
    zIndex: 9
  },
  chartPanel: {
    position: 'absolute' as const,
    top: 88,
    right: 16,
    width: 520,
    zIndex: 9
  },
  statsPanel: {
    position: 'absolute' as const,
    bottom: 16,
    left: 16,
    width: 420,
    zIndex: 9
  },
  swipePanel: {
    position: 'absolute' as const,
    bottom: 16,
    right: 16,
    width: 380,
    zIndex: 9
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  }
}));

import { createStyles } from 'antd-style';
const PANEL_WIDTH = 500;

export const usePanelStyles = createStyles(({ token }) => ({
  filterPanel: {
    position: 'absolute' as const,
    bottom: 20,
    right: 16,
    width: PANEL_WIDTH,  // Use shared constant
    zIndex: 9
  },
  chartPanel: {
    position: 'absolute' as const,
    bottom: 20,
    right: 16,
    width: 575,  // Changed from 520 to shared constant
    zIndex: 9
  },
  statsPanel: {
    position: 'absolute' as const,
    bottom: 20,
    left: 16,
    width: 575,
    maxHeight: '65vh',   // prevent overflow if many stats
    overflowY: 'auto',   // scrollable if content too tall
    zIndex: 99,
  },
  swipePanel: {
    position: 'absolute' as const,
    bottom: 20,
    right: 16,
    width: 380,
    zIndex: 9
  },
  panelContainer: {  // ADD THIS NEW STYLE
    position: 'absolute' as const,
    top: 18,
    right: 16,
    width: PANEL_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    zIndex: 9
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  }
}));

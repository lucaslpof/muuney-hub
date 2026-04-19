/**
 * HubSectionsContext — Page-level section registry for the Hub layout.
 *
 * Each Hub page historically rendered its own vertical sidebar (MacroSidebar)
 * listing narrative sections ("Visão Geral", "Rankings", etc). The sidebar
 * was visually heavy and ate horizontal real estate. This context lets each
 * page register its sections centrally so the top bar in HubLayout can
 * render a single horizontal navigator instead.
 *
 * Usage (page side):
 *   MacroSidebar continues to be rendered with the same (items, activeId,
 *   onNavigate) props — internally it registers into this context and
 *   returns null instead of rendering a sidebar.
 *
 * Usage (layout side):
 *   const ctx = useHubSections(); // may be null outside provider
 *   ctx?.sections / ctx?.activeId / ctx?.navigate
 */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";

export interface HubSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface HubSectionsValue {
  sections: HubSection[];
  activeId: string;
  /** Called by top-bar nav to scroll to / activate a section on the page. */
  navigate: (id: string) => void;
  /** Page registers its nav state. Shallow-compares to avoid churn. */
  registerSections: (
    sections: HubSection[],
    activeId: string,
    onNavigate: (id: string) => void,
  ) => void;
  /** Page clears its nav state on unmount. */
  clearSections: () => void;
}

const HubSectionsContext = createContext<HubSectionsValue | null>(null);

function sectionsShallowEqual(a: HubSection[], b: HubSection[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].label !== b[i].label) return false;
  }
  return true;
}

export const HubSectionsProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<{ sections: HubSection[]; activeId: string }>({
    sections: [],
    activeId: "",
  });
  const navRef = useRef<(id: string) => void>(() => {});

  const registerSections = useCallback(
    (sections: HubSection[], activeId: string, onNavigate: (id: string) => void) => {
      // Always keep navigate handler fresh (closures change every render).
      navRef.current = onNavigate;
      setState((prev) => {
        if (prev.activeId === activeId && sectionsShallowEqual(prev.sections, sections)) {
          return prev;
        }
        return { sections, activeId };
      });
    },
    [],
  );

  const clearSections = useCallback(() => {
    navRef.current = () => {};
    setState({ sections: [], activeId: "" });
  }, []);

  const navigate = useCallback((id: string) => {
    navRef.current(id);
  }, []);

  return (
    <HubSectionsContext.Provider
      value={{
        sections: state.sections,
        activeId: state.activeId,
        navigate,
        registerSections,
        clearSections,
      }}
    >
      {children}
    </HubSectionsContext.Provider>
  );
};

/** Returns the Hub sections registry (or null when called outside provider). */
export const useHubSections = () => useContext(HubSectionsContext);

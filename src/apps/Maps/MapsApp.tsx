import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, animate, useDragControls, type PanInfo } from 'motion/react';
import { AppScreen, Material } from '@/system';
import { spring } from '@/platform/design-tokens/motion';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { useMapsStore } from './mapsStore';
import { MapView } from './MapView';
import { MapControls } from './MapControls';
import { SearchBar } from './SearchBar';
import { ExploreCategories } from './ExploreCategories';
import { SearchResults } from './SearchResults';
import { PlaceDetail } from './PlaceDetail';
import { searchPlaces } from './searchService';
import { SHEET_PEEK, SHEET_EXPANDED, SHEET_MINI } from './mapConfig';
import type { ExploreCategory } from './mapConfig';

export function MapsApp() {
  const reset = useMapsStore((s) => s.reset);

  useEffect(() => {
    if (wasAppKilled('maps')) {
      reset();
      clearAppKilled('maps');
    }
  }, [reset]);

  return (
    <AppScreen backgroundColor="transparent" style={{ background: '#f2f1ed' }}>
      <MapsContent />
    </AppScreen>
  );
}

// ---------------------------------------------------------------------------
// MapsContent
// ---------------------------------------------------------------------------

function MapsContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Store state (Zustand setters are stable across renders)
  const query = useMapsStore((s) => s.query);
  const setQuery = useMapsStore((s) => s.setQuery);
  const results = useMapsStore((s) => s.results);
  const setResults = useMapsStore((s) => s.setResults);
  const searching = useMapsStore((s) => s.searching);
  const setSearching = useMapsStore((s) => s.setSearching);
  const selectedPlace = useMapsStore((s) => s.selectedPlace);
  const selectPlace = useMapsStore((s) => s.selectPlace);
  const sheetMode = useMapsStore((s) => s.sheetMode);
  const setSheetMode = useMapsStore((s) => s.setSheetMode);

  // Local state
  const [searchFocused, setSearchFocused] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number; key: number } | null>(null);
  const flyKeyRef = useRef(0);

  // Ref to skip search effect when category search is in progress
  const skipSearchEffectRef = useRef(false);

  // Sheet snap points (px from top of container)
  const [containerHeight, setContainerHeight] = useState(700);
  const snapPeek = containerHeight * (1 - SHEET_PEEK);
  const snapExpanded = containerHeight * (1 - SHEET_EXPANDED);
  const snapMini = containerHeight * (1 - SHEET_MINI);

  // Keep snap values in ref for use in callbacks without stale closures
  const snapsRef = useRef({ snapPeek, snapExpanded, snapMini });
  snapsRef.current = { snapPeek, snapExpanded, snapMini };

  // Motion value for sheet Y (from top)
  const sheetY = useMotionValue(snapPeek);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Set initial sheet position once containerHeight is known
  useEffect(() => {
    sheetY.set(snapPeek);
  }, [containerHeight, snapPeek, sheetY]);

  // Snap sheet to position
  const snapTo = useCallback(
    (target: number) => {
      animate(sheetY, target, {
        type: 'spring',
        ...spring.interactive,
      });
    },
    [sheetY],
  );

  // -----------------------------------------------------------------------
  // Search effect — debounce managed here via setTimeout + cleanup.
  // Only depends on `query`. sheetMode is NOT a dependency to avoid
  // re-triggering searches when mode changes.
  // -----------------------------------------------------------------------
  useEffect(() => {
    // Category search sets this flag — skip the effect so it doesn't
    // override the category's direct API call with the display label.
    if (skipSearchEffectRef.current) {
      skipSearchEffectRef.current = false;
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      // Always reset searching when query is empty
      setSearching(false);
      return;
    }

    setSearching(true);
    setSheetMode('search');
    snapTo(snapsRef.current.snapExpanded);

    // Debounce: wait 350ms after last keystroke before hitting API
    const timer = setTimeout(() => {
      const center = useMapsStore.getState().mapCenter;
      searchPlaces(trimmed, center)
        .then((r) => {
          setResults(r);
        })
        .catch(() => {
          setResults([]);
          setSearching(false);
        });
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Handle search focus
  const handleSearchFocus = () => {
    setSearchFocused(true);
    // If there are existing results, show them again
    if (results.length > 0 && query.trim()) {
      setSheetMode('search');
      snapTo(snapExpanded);
    }
  };

  const handleSearchCancel = () => {
    setSearchFocused(false);
    setQuery('');
    setResults([]);
    setSearching(false);
    setSheetMode('explore');
    snapTo(snapPeek);
  };

  // Category tap — uses direct API call, skips the search effect.
  // Immediately switch to search mode so the loading spinner is visible.
  const handleCategorySelect = (cat: ExploreCategory) => {
    skipSearchEffectRef.current = true;
    setQuery(cat.label); // display only
    setSearchFocused(true);
    setSearching(true);
    setSheetMode('search');
    snapTo(snapExpanded);
    const center = useMapsStore.getState().mapCenter;
    searchPlaces(cat.query, center)
      .then((r) => {
        setResults(r);
      })
      .catch(() => {
        setResults([]);
        setSearching(false);
      });
  };

  // Select a place from search results
  const handleSelectPlace = (place: typeof selectedPlace) => {
    selectPlace(place);
    setSearchFocused(false);
    if (place) {
      flyKeyRef.current += 1;
      setFlyTarget({ center: [place.lat, place.lon], zoom: 16, key: flyKeyRef.current });
      snapTo(snapPeek);
    }
  };

  const handleCloseDetail = () => {
    selectPlace(null);
    setSheetMode('explore');
    setQuery('');
    setResults([]);
    snapTo(snapPeek);
  };

  // Locate user (shared logic)
  const locateUser = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        flyKeyRef.current += 1;
        setFlyTarget({ center: loc, zoom: 15, key: flyKeyRef.current });
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // Auto-locate on mount
  useEffect(() => {
    locateUser();
  }, [locateUser]);

  const handleLocate = locateUser;

  // Sheet drag — velocity-biased snap to nearest point
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const currentY = sheetY.get();
    const velocity = info.velocity.y;
    const { snapExpanded: exp, snapPeek: peek, snapMini: mini } = snapsRef.current;

    const snaps = [exp, peek, mini];
    let target = peek;

    if (velocity < -400) {
      target = exp;
    } else if (velocity > 400) {
      target = mini;
    } else {
      target = snaps.reduce((prev, snap) =>
        Math.abs(snap - currentY) < Math.abs(prev - currentY) ? snap : prev,
      );
    }

    snapTo(target);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden"
      style={{ minHeight: 0 }}
    >
      {/* Map layer */}
      <MapView
        selectedPlace={selectedPlace}
        searchResults={sheetMode === 'search' ? results : []}
        userLocation={userLocation}
        flyTarget={flyTarget}
      />

      {/* Map controls (right side) */}
      <MapControls onLocate={handleLocate} isLocating={isLocating} />

      {/* Bottom sheet */}
      <motion.div
        style={{
          y: sheetY,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
          zIndex: 30,
          pointerEvents: 'none',
          willChange: 'transform',
          overflow: 'hidden',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          borderTop: '0.5px solid rgba(255,255,255,0.3)',
        }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: snapExpanded, bottom: snapMini }}
        dragElastic={0.1}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
      >
        <Material
          variant="chrome"
          className="flex h-full flex-col"
          style={{
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit',
            backgroundColor: 'var(--color-systemBackground)',
            pointerEvents: 'auto',
          }}
        >
          {/* Drag handle — ONLY this area initiates sheet drag */}
          <div
            className="flex items-center justify-center"
            style={{
              height: 28,
              paddingTop: 8,
              cursor: 'grab',
              flexShrink: 0,
              touchAction: 'none',
            }}
            onPointerDown={(e) => dragControls.start(e)}
          >
            <div
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                backgroundColor: 'var(--color-tertiaryLabel)',
              }}
            />
          </div>

          {/* Search bar */}
          <div style={{ flexShrink: 0, paddingBottom: 8 }}>
            <SearchBar
              value={query}
              onChange={setQuery}
              onFocus={handleSearchFocus}
              onCancel={handleSearchCancel}
              isFocused={searchFocused}
            />
          </div>

          {/* Scrollable content area */}
          <div
            ref={sheetContentRef}
            className="flex-1 overflow-y-auto"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              overscrollBehavior: 'contain',
              paddingBottom: 'var(--app-safe-bottom, 20px)',
            }}
          >
            {sheetMode === 'detail' && selectedPlace ? (
              <PlaceDetail place={selectedPlace} onClose={handleCloseDetail} />
            ) : sheetMode === 'search' ? (
              <SearchResults
                results={results}
                searching={searching}
                query={query}
                onSelect={handleSelectPlace}
              />
            ) : (
              <ExploreCategories onSelect={handleCategorySelect} />
            )}
          </div>
        </Material>
      </motion.div>
    </div>
  );
}

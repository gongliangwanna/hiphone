import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'motion/react';
import { AppScreen, Material } from '@/system';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { useMapsStore } from './mapsStore';
import { MapView } from './MapView';
import { MapControls } from './MapControls';
import { SearchBar } from './SearchBar';
import { ExploreCategories, FavoritesList } from './ExploreCategories';
import { SearchResults } from './SearchResults';
import { PlaceDetail } from './PlaceDetail';
import { searchPlaces } from './searchService';
import type { ExploreCategory } from './mapConfig';

// ---------------------------------------------------------------------------
// Sheet snap heights (px from bottom of the screen).
// We compute real px values in the component based on container height.
// ---------------------------------------------------------------------------

const SHEET_HANDLE_HEIGHT = 20;

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

  // Store state
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
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);

  // Sheet snap points (px from top of container)
  const [containerHeight, setContainerHeight] = useState(700);
  const snapPeek = containerHeight * 0.62; // collapsed — bottom 38%
  const snapExpanded = containerHeight * 0.12; // expanded — near top
  const snapMini = containerHeight * 0.88; // mini — just handle

  // Motion value for sheet Y (from top)
  const sheetY = useMotionValue(snapPeek);
  const sheetRadius = useTransform(sheetY, [snapExpanded, snapPeek], [16, 16]);

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
        stiffness: 400,
        damping: 40,
        mass: 0.8,
      });
    },
    [sheetY],
  );

  // Search
  useEffect(() => {
    if (!query.trim()) {
      if (sheetMode === 'search') {
        setResults([]);
      }
      return;
    }
    setSearching(true);
    searchPlaces(query)
      .then((r) => {
        setResults(r);
        setSheetMode('search');
        snapTo(snapExpanded);
      })
      .catch(() => setResults([]));
  }, [query, setResults, setSearching, setSheetMode, snapTo, snapExpanded, sheetMode]);

  // Handle search focus
  const handleSearchFocus = () => {
    setSearchFocused(true);
    setSheetMode('search');
    snapTo(snapExpanded);
  };

  const handleSearchCancel = () => {
    setSearchFocused(false);
    setQuery('');
    setResults([]);
    setSheetMode('explore');
    snapTo(snapPeek);
  };

  // Category tap
  const handleCategorySelect = (cat: ExploreCategory) => {
    setQuery(cat.label);
    setSearchFocused(true);
    setSearching(true);
    searchPlaces(cat.query)
      .then((r) => {
        setResults(r);
        setSheetMode('search');
        snapTo(snapExpanded);
      })
      .catch(() => setResults([]));
  };

  // Select a place from search results
  const handleSelectPlace = (place: typeof selectedPlace) => {
    selectPlace(place);
    setSearchFocused(false);
    if (place) {
      setFlyTarget({ center: [place.lat, place.lon], zoom: 16 });
      snapTo(snapPeek);
    }
  };

  const handleCloseDetail = () => {
    selectPlace(null);
    setSheetMode('explore');
    snapTo(snapPeek);
  };

  // Locate user
  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        setFlyTarget({ center: loc, zoom: 15 });
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  // Sheet drag
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const currentY = sheetY.get();
    const velocity = info.velocity.y;

    // Determine nearest snap point, biased by velocity
    const snaps = [snapExpanded, snapPeek, snapMini];
    let target = snapPeek;

    if (velocity < -400) {
      // Fast upward fling → expand
      target = snapExpanded;
    } else if (velocity > 400) {
      // Fast downward fling → mini
      target = snapMini;
    } else {
      // Snap to closest
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
          borderTopLeftRadius: sheetRadius,
          borderTopRightRadius: sheetRadius,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
          zIndex: 30,
          pointerEvents: 'auto',
          willChange: 'transform',
          overflow: 'hidden',
          boxShadow: '0 -2px 20px rgba(0,0,0,0.08)',
        }}
        drag="y"
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
          }}
        >
          {/* Drag handle */}
          <div
            className="flex items-center justify-center"
            style={{
              height: SHEET_HANDLE_HEIGHT,
              paddingTop: 8,
              cursor: 'grab',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                backgroundColor: 'var(--color-separator)',
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
            onPointerDownCapture={(e) => {
              // Prevent sheet drag when scrolling content
              if (sheetContentRef.current && sheetContentRef.current.scrollTop > 0) {
                e.stopPropagation();
              }
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
              <>
                <ExploreCategories onSelect={handleCategorySelect} />
                <FavoritesList />
              </>
            )}
          </div>
        </Material>
      </motion.div>
    </div>
  );
}

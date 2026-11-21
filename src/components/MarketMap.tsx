"use client";

import {
  hierarchy,
  treemap,
  treemapSquarify,
  type HierarchyRectangularNode,
} from "d3-hierarchy";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { SIZE_SOURCES } from "@/data/market-sizes";
import {
  MAP_PERIODS,
  NO_CHANGES,
  type MapPeriod,
} from "@/lib/market-map/changes";
import {
  changeIntensity,
  formatChange,
  formatMapValue,
  formatShare,
  PERIOD_LABELS,
  PERIOD_SCALE,
} from "@/lib/market-map/format";
import type { MapTile, MapView, MapViewId } from "@/lib/market-map/views";

type Node = HierarchyRectangularNode<MapTile>;

type Hover = { node: Node; x: number; y: number };

function useElementWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry?.contentRect.width ?? 0));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function mapHeight(width: number): number {
  if (width < 640) return Math.round(width * 1.15);
  return Math.round(Math.min(720, Math.max(440, width * 0.56)));
}

function tileFill(change: number | null, period: MapPeriod): string {
  const intensity = changeIntensity(change, period);
  if (intensity == null) return "var(--map-none)";
  const tone = intensity >= 0 ? "var(--map-up)" : "var(--map-down)";
  const pct = Math.round(18 + Math.abs(intensity) * 82);
  return `color-mix(in oklab, ${tone} ${pct}%, var(--map-flat))`;
}

function tileInk(change: number | null, period: MapPeriod): string {
  const intensity = changeIntensity(change, period);
  if (intensity == null) return "var(--muted-strong)";
  return Math.abs(intensity) > 0.45 ? "#fff" : "var(--text)";
}

function headerHeight(node: Node): number {
  if (node.depth === 0 || !node.children?.length) return 0;
  const w = node.x1 - node.x0;
  const h = node.y1 - node.y0;
  if (w < 56 || h < 44) return 0;
  return node.depth === 1 ? 18 : 15;
}

/** Fits a label inside a tile, or hides it when the tile is too small. */
function labelSize(text: string, w: number, h: number): number | null {
  const size = Math.min(22, h / 2.6, (w - 6) / Math.max(1, text.length * 0.6));
  return size >= 9 ? Math.floor(size) : null;
}

function truncate(text: string, w: number, size: number): string {
  const max = Math.floor((w - 8) / (size * 0.58));
  if (text.length <= max) return text;
  return max > 3 ? `${text.slice(0, max - 1)}…` : "";
}

export function MarketMap({
  views,
  asOf,
}: {
  views: MapView[];
  asOf: string | null;
}) {
  const [viewId, setViewId] = useState<MapViewId>(
    views[0]?.id ?? "asset-classes",
  );
  const [period, setPeriod] = useState<MapPeriod>("1d");
  const [path, setPath] = useState<string[]>([]);
  const [hover, setHover] = useState<Hover | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(frameRef);
  const height = mapHeight(width);

  const view = views.find((item) => item.id === viewId) ?? views[0];

  const trail = useMemo(() => {
    const chain: MapTile[] = [];
    let level = view?.tiles ?? [];
    for (const id of path) {
      const next = level.find((tile) => tile.id === id);
      if (!next?.children) break;
      chain.push(next);
      level = next.children;
    }
    return chain;
  }, [view, path]);

  const focus = trail.at(-1);

  const layout = useMemo(() => {
    if (!view || width === 0) return null;
    const root = hierarchy<MapTile>(
      {
        id: "root",
        label: view.title,
        value: 0,
        changes: NO_CHANGES,
        children: focus?.children ?? view.tiles,
      },
      (tile) => tile.children,
    )
      .sum((tile) => (tile.children?.length ? 0 : Math.max(0, tile.value)))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return treemap<MapTile>()
      .tile(treemapSquarify.ratio(1.3))
      .size([width, height])
      .paddingOuter((node) => (node.depth === 0 ? 0 : 1))
      .paddingTop(headerHeight)
      .paddingInner(2)
      .round(true)(root);
  }, [view, focus, width, height]);

  if (!view) return null;

  const total = layout?.value ?? 0;
  const leaves = layout?.leaves() ?? [];
  const movers = [...leaves]
    .filter((node) => node.data.changes[period] != null)
    .sort((a, b) => b.data.changes[period]! - a.data.changes[period]!);
  const gainers = movers.filter((node) => node.data.changes[period]! > 0);
  const losers = movers
    .filter((node) => node.data.changes[period]! < 0)
    .reverse();

  function zoomTo(node: Node) {
    const chain = node
      .ancestors()
      .reverse()
      .slice(1)
      .map((item) => item.data.id);
    setPath([...path, ...chain]);
    setHover(null);
    frameRef.current?.focus();
  }

  function onGroupKey(event: KeyboardEvent, node: Node) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      zoomTo(node);
    }
  }

  function onPointer(event: PointerEvent, node: Node) {
    const box = frameRef.current?.getBoundingClientRect();
    if (!box) return;
    setHover({ node, x: event.clientX - box.left, y: event.clientY - box.top });
  }

  function selectView(id: MapViewId) {
    setViewId(id);
    setPath([]);
    setHover(null);
  }

  const hovered = hover?.node;
  const hoveredParent = hovered?.parent;
  const sources = view.sources.map((id) => SIZE_SOURCES[id]);

  return (
    <section
      aria-labelledby="market-map-title"
      data-testid="market-map"
      onKeyDown={(event) => {
        if (event.key === "Escape" && path.length > 0) {
          setPath(path.slice(0, -1));
          setHover(null);
        }
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2
            id="market-map-title"
            className="text-2xl font-semibold tracking-[-0.04em]"
          >
            {view.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
            {view.description} Size shows how big; colour shows the{" "}
            {PERIOD_LABELS[period]} move.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="map-view">
            Map view
          </label>
          <select
            id="map-view"
            className="select-control"
            value={view.id}
            onChange={(event) => selectView(event.target.value as MapViewId)}
            data-testid="map-view-select"
          >
            {views.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <div className="segmented-control" aria-label="Select move period">
            {MAP_PERIODS.map((item) => (
              <button
                key={item}
                type="button"
                className="segment"
                aria-pressed={period === item}
                onClick={() => setPeriod(item)}
                data-testid={`map-period-${item}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Map zoom"
          className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-[var(--muted)]"
          data-testid="map-breadcrumb"
        >
          <button
            type="button"
            className="rounded-md px-1.5 py-0.5 hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            onClick={() => setPath([])}
            aria-current={trail.length === 0 ? "page" : undefined}
          >
            All
          </button>
          {trail.map((tile, index) => (
            <span key={tile.id} className="flex items-center gap-1">
              <span aria-hidden>›</span>
              <button
                type="button"
                className="rounded-md px-1.5 py-0.5 hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                onClick={() => setPath(path.slice(0, index + 1))}
                aria-current={index === trail.length - 1 ? "page" : undefined}
              >
                {tile.label}
              </button>
            </span>
          ))}
          {trail.length === 0 ? (
            <span className="ml-2">Click a group heading to zoom in.</span>
          ) : null}
        </nav>
        <MapLegend period={period} />
      </div>

      <div
        ref={frameRef}
        tabIndex={-1}
        className="relative mt-3 overflow-hidden rounded-[14px] border border-[var(--line)] focus:outline-none"
        style={{ height: width ? height : 480, background: "var(--map-gap)" }}
        onPointerLeave={() => setHover(null)}
      >
        {view.tiles.length === 0 ? (
          <div
            className="flex h-full items-center justify-center bg-[var(--surface)] px-6 text-center text-sm text-[var(--muted-strong)]"
            data-testid="map-empty"
          >
            No data for this view yet. It fills in after the next ingest run.
          </div>
        ) : layout ? (
          <svg
            width={width}
            height={height}
            role="group"
            aria-label={`${focus?.label ?? view.title} treemap`}
            data-testid="market-map-svg"
          >
            {layout
              .descendants()
              .slice(1)
              .map((node) => {
                const w = node.x1 - node.x0;
                const h = node.y1 - node.y0;
                const tile = node.data;
                const change = tile.changes[period];

                if (node.children?.length) {
                  const header = headerHeight(node);
                  const size = header ? (node.depth === 1 ? 11 : 10) : 0;
                  const value = formatMapValue(tile.value, view.unit);
                  return (
                    <g
                      key={tile.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Zoom into ${tile.label}`}
                      className="cursor-zoom-in focus-visible:outline-none [&:focus-visible>rect]:stroke-[var(--accent)]"
                      onClick={() => zoomTo(node)}
                      onKeyDown={(event) => onGroupKey(event, node)}
                      onPointerMove={(event) => onPointer(event, node)}
                      data-testid={`map-group-${tile.id}`}
                    >
                      <rect
                        x={node.x0}
                        y={node.y0}
                        width={w}
                        height={h}
                        fill="var(--surface)"
                        strokeWidth={2}
                        stroke="transparent"
                      />
                      {header ? (
                        <text
                          x={node.x0 + 5}
                          y={node.y0 + header - 5}
                          fontSize={size}
                          fill="var(--muted-strong)"
                          className="pointer-events-none select-none font-mono uppercase tracking-[0.06em]"
                        >
                          {truncate(
                            value ? `${tile.label} · ${value}` : tile.label,
                            w,
                            size,
                          )}
                        </text>
                      ) : null}
                    </g>
                  );
                }

                const label = labelSize(tile.label, w, h);
                const showChange =
                  label != null && change != null && h >= 30 && w >= 34;
                const ink = tileInk(change, period);
                return (
                  <g
                    key={tile.id}
                    onPointerMove={(event) => onPointer(event, node)}
                    onClick={() =>
                      node.parent && node.parent.depth > 0
                        ? zoomTo(node.parent)
                        : undefined
                    }
                    data-testid={`map-tile-${tile.id}`}
                    data-change={change ?? ""}
                  >
                    <title>
                      {`${tile.name ?? tile.label}: ${formatChange(change)} over ${PERIOD_LABELS[period]}`}
                    </title>
                    <rect
                      x={node.x0}
                      y={node.y0}
                      width={w}
                      height={h}
                      fill={tileFill(change, period)}
                      className="transition-[fill] duration-300"
                    />
                    {label ? (
                      <text
                        x={node.x0 + w / 2}
                        y={
                          node.y0 +
                          h / 2 +
                          (showChange ? -label * 0.15 : label * 0.35)
                        }
                        textAnchor="middle"
                        fontSize={label}
                        fontWeight={600}
                        fill={ink}
                        className="pointer-events-none select-none"
                      >
                        {truncate(tile.label, w, label)}
                      </text>
                    ) : null}
                    {showChange ? (
                      <text
                        x={node.x0 + w / 2}
                        y={node.y0 + h / 2 + label! * 0.95}
                        textAnchor="middle"
                        fontSize={Math.max(9, Math.round(label! * 0.62))}
                        fill={ink}
                        className="pointer-events-none select-none font-mono"
                      >
                        {formatChange(change)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
          </svg>
        ) : null}

        {hover && hovered ? (
          <div
            className={`chart-tooltip ${hover.x > width * 0.6 ? "chart-tooltip-end" : "chart-tooltip-start"}`}
            style={{
              left: hover.x,
              top: Math.min(hover.y + 12, Math.max(0, height - 120)),
            }}
            data-testid="map-tooltip"
            role="status"
          >
            <span className="chart-tooltip-date">
              {hovered.data.name
                ? `${hovered.data.label} · ${hovered.data.name}`
                : hovered.data.label}
            </span>
            <span
              className="chart-tooltip-value"
              style={{
                color:
                  (hovered.data.changes[period] ?? 0) > 0
                    ? "var(--positive)"
                    : (hovered.data.changes[period] ?? 0) < 0
                      ? "var(--negative)"
                      : undefined,
              }}
            >
              {formatChange(hovered.data.changes[period])}{" "}
              <span className="text-[10px] text-[var(--muted)]">
                {PERIOD_LABELS[period]}
              </span>
            </span>
            {formatMapValue(hovered.data.value, view.unit) ? (
              <span>
                {formatMapValue(hovered.data.value, view.unit)}
                {hoveredParent && hoveredParent.depth > 0
                  ? ` · ${formatShare(hovered.data.value, hoveredParent.data.value)} of ${hoveredParent.data.label}`
                  : total > 0
                    ? ` · ${formatShare(hovered.value ?? 0, total)} of view`
                    : ""}
              </span>
            ) : null}
            {hovered.data.note ? (
              <span className="chart-tooltip-note">{hovered.data.note}</span>
            ) : null}
            {hovered.children?.length ? (
              <span className="chart-tooltip-note">Click to zoom in</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MoverList
          title={`Biggest gains · ${PERIOD_LABELS[period]}`}
          nodes={gainers.slice(0, 5)}
          period={period}
          testId="map-gainers"
        />
        <MoverList
          title={`Biggest falls · ${PERIOD_LABELS[period]}`}
          nodes={losers.slice(0, 5)}
          period={period}
          testId="map-losers"
        />
      </div>

      <p className="mt-6 text-[11px] leading-5 text-[var(--muted)]">
        {asOf ? `Prices as of ${asOf}. ` : ""}
        {sources.length ? "Sizes: " : ""}
        {sources.map((source, index) => (
          <span key={source.url}>
            <a
              className="underline underline-offset-2"
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.label}
            </a>{" "}
            ({source.asOf}){index < sources.length - 1 ? "; " : ". "}
          </span>
        ))}
        {view.id === "companies"
          ? "Market caps from Finnhub, converted to US dollars daily. "
          : ""}
        Grey tiles have no price to colour them. Research aid only, not
        financial advice.
      </p>
    </section>
  );
}

function MapLegend({ period }: { period: MapPeriod }) {
  const scale = PERIOD_SCALE[period];
  return (
    <div
      className="flex items-center gap-2 font-mono text-[10px] text-[var(--muted)]"
      aria-hidden
    >
      <span>{formatChange(-scale)}</span>
      <span
        className="h-2.5 w-36 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, var(--map-down), var(--map-flat), var(--map-up))",
        }}
      />
      <span>{formatChange(scale)}</span>
    </div>
  );
}

function MoverList({
  title,
  nodes,
  period,
  testId,
}: {
  title: string;
  nodes: Node[];
  period: MapPeriod;
  testId: string;
}) {
  return (
    <div
      className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4"
      data-testid={testId}
    >
      <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
        {title}
      </h3>
      {nodes.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          No priced tiles here.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {nodes.map((node) => {
            const change = node.data.changes[period];
            return (
              <li
                key={node.data.id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="min-w-0 truncate text-[var(--muted-strong)]">
                  <span className="font-medium text-[var(--text)]">
                    {node.data.label}
                  </span>
                  {node.data.name ? ` · ${node.data.name}` : ""}
                </span>
                <span
                  className="font-mono"
                  style={{
                    color:
                      (change ?? 0) >= 0
                        ? "var(--positive)"
                        : "var(--negative)",
                  }}
                >
                  {formatChange(change)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

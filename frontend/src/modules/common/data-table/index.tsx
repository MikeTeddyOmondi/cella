import { autoUpdate, computePosition, offset } from '@floating-ui/dom';
import { config } from 'config';
import { Search } from 'lucide-react';
import { type Key, type ReactNode, useEffect, useRef, useState } from 'react';
import { type CellClickArgs, type CellMouseEvent, DataGrid, type RenderRowProps, type RowsChangeData, type SortColumn } from 'react-data-grid';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { useOnlineManager } from '~/hooks/use-online-manager';
import ContentPlaceholder from '~/modules/common/content-placeholder';
import { DataTableSkeleton } from '~/modules/common/data-table/table-skeleton';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { Checkbox } from '~/modules/ui/checkbox';

import 'react-data-grid/lib/styles.css';
import '~/modules/common/data-table/style.css';

interface DataTableProps<TData> {
  columns: ColumnOrColumnGroup<TData>[];
  rows: TData[];
  totalCount?: number;
  rowKeyGetter: (row: TData) => string;
  error?: Error | null;
  isLoading?: boolean;
  isFetching?: boolean;
  limit?: number;
  isFiltered?: boolean;
  renderRow?: (key: Key, props: RenderRowProps<TData, unknown>) => ReactNode;
  NoRowsComponent?: React.ReactNode;
  overflowNoRows?: boolean;
  onCellClick?: (args: CellClickArgs<TData, unknown>, event: CellMouseEvent) => void;
  selectedRows?: Set<string>;
  onSelectedRowsChange?: (selectedRows: Set<string>) => void;
  sortColumns?: SortColumn[];
  onSortColumnsChange?: (sortColumns: SortColumn[]) => void;
  rowHeight?: number;
  enableVirtualization?: boolean;
  onRowsChange?: (rows: TData[], data: RowsChangeData<TData>) => void;
  fetchMore?: () => Promise<unknown>;
}

interface NoRowsProps {
  isFiltered?: boolean;
  isFetching?: boolean;
  customComponent?: React.ReactNode;
}
// When there are no rows, this component is displayed
const NoRows = ({ isFiltered, isFetching, customComponent }: NoRowsProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center w-full p-8">
      {isFiltered && !isFetching && (
        <ContentPlaceholder Icon={Search} title={t('common:no_resource_found', { resource: t('common:results').toLowerCase() })} />
      )}
      {!isFiltered && !isFetching && (customComponent ?? t('common:no_resource_yet', { resource: t('common:results').toLowerCase() }))}
    </div>
  );
};

// When there is an error, this component is displayed
const ErrorMessage = ({ error }: { error: Error }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-background text-muted-foreground">
      <div className="text-center my-8 text-sm text-red-500">{error.message}</div>
    </div>
  );
};

export const DataTable = <TData,>({
  columns,
  rows,
  totalCount,
  rowKeyGetter,
  error,
  isLoading,
  limit = config.requestLimits.default,
  isFetching,
  NoRowsComponent,
  isFiltered,
  selectedRows,
  onSelectedRowsChange,
  sortColumns,
  onSortColumnsChange,
  rowHeight = 50,
  enableVirtualization,
  onRowsChange,
  fetchMore,
  renderRow,
  onCellClick,
}: DataTableProps<TData>) => {
  const { t } = useTranslation();
  const { isOnline } = useOnlineManager();
  const [initialDone, setInitialDone] = useState(false);
  const { ref: measureRef, inView } = useInView({ triggerOnce: false, threshold: 0 });

  // TODO move tooltip to separate hook file
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const lastShownCellRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    if (!gridRef.current) return;

    // Create tooltip element outside React
    const tooltip = document.createElement('div');
    tooltip.className =
      'max-md:invisible bg-muted-foreground text-primary-foreground absolute pointer-events-none hidden font-light rounded-md text-xs px-3 py-1.5 z-200';
    document.body.appendChild(tooltip);
    tooltipRef.current = tooltip;

    // Function to show tooltip
    const showTooltip = (cell: HTMLElement) => {
      const tooltipContent = cell.getAttribute('data-tooltip-content') || '';
      if (!tooltipContent) return;

      tooltip.textContent = tooltipContent;
      tooltip.style.display = 'block';
      lastShownCellRef.current = cell;

      autoUpdate(cell, tooltip, () => {
        computePosition(cell, tooltip, {
          placement: 'right',
          middleware: [offset(4)],
        }).then(({ x, y }) => {
          Object.assign(tooltip.style, {
            left: `${x}px`,
            top: `${y}px`,
          });
        });
      });

      //  Observe changes in data-tooltip-content
      observerRef.current?.disconnect();
      observerRef.current = new MutationObserver(() => updateTooltipContent(cell));
      observerRef.current.observe(cell, { attributes: true, attributeFilter: ['data-tooltip-content'] });
    };

    const updateTooltipContent = (cell: HTMLElement) => {
      const tooltipContent = cell.getAttribute('data-tooltip-content') || '';
      tooltip.textContent = tooltipContent;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const cell: HTMLElement | null = (e.target as HTMLElement).closest("[data-tooltip='true']");
      if (!cell) return clearTooltip();

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (lastShownCellRef.current) {
        showTooltip(cell);
      } else {
        timeoutRef.current = window.setTimeout(() => showTooltip(cell), 400);
      }
    };

    const handleFocus = (e: FocusEvent) => {
      const cell: HTMLElement | null = (e.target as HTMLElement).closest("[data-tooltip='true']");
      if (cell) showTooltip(cell);
    };

    const handleMouseLeave = () => {
      clearTooltip();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const clearTooltip = () => {
      tooltip.style.display = 'none';
      lastShownCellRef.current = null;
      observerRef.current?.disconnect();
    };

    // Attach event listeners
    gridRef.current.addEventListener('mousemove', handleMouseMove);
    gridRef.current.addEventListener('mouseleave', handleMouseLeave);
    gridRef.current.addEventListener('focusin', handleFocus);
    gridRef.current.addEventListener('focusout', clearTooltip);

    // Cleanup on unmount
    return () => {
      gridRef.current?.removeEventListener('mousemove', handleMouseMove);
      gridRef.current?.removeEventListener('mouseleave', handleMouseLeave);
      gridRef.current?.removeEventListener('focusin', handleFocus);
      gridRef.current?.removeEventListener('focusout', clearTooltip);
      observerRef.current?.disconnect();
      tooltip.remove();
    };
  }, [initialDone]);

  useEffect(() => {
    if (!rows.length || error || !fetchMore || isFetching || !inView) return;

    if (typeof totalCount === 'number' && rows.length >= totalCount) return;

    // Throttle fetchMore to avoid duplicate calls
    const fetchMoreTimeout = setTimeout(() => {
      fetchMore();
    }, 100);

    return () => clearTimeout(fetchMoreTimeout); // Clear timeout on cleanup
  }, [inView, error, rows.length, isFetching]);

  useEffect(() => {
    if (initialDone) return;
    if (!isLoading) setInitialDone(true);
  }, [isLoading]);

  return (
    <div className="w-full h-full mb-4 md:mb-8">
      {initialDone ? ( // Render skeleton only on initial load
        <>
          {error && rows.length === 0 ? (
            <ErrorMessage error={error} />
          ) : !rows.length ? (
            <NoRows isFiltered={isFiltered} isFetching={isFetching} customComponent={NoRowsComponent} />
          ) : (
            <div className="grid rdg-wrapper relative pb-8" ref={gridRef}>
              <DataGrid
                rowHeight={rowHeight}
                enableVirtualization={enableVirtualization}
                rowKeyGetter={rowKeyGetter}
                columns={columns}
                onRowsChange={onRowsChange}
                rows={rows}
                onCellClick={onCellClick}
                // Hack to rerender html/css by changing width
                style={{ blockSize: '100%', marginRight: columns.length % 2 === 0 ? '0' : '.07rem' }}
                selectedRows={selectedRows}
                onSelectedRowsChange={onSelectedRowsChange}
                sortColumns={sortColumns as SortColumn[]}
                onSortColumnsChange={onSortColumnsChange}
                renderers={{
                  renderRow,
                  renderCheckbox: ({ onChange, ...props }) => {
                    const withShift = useRef(false);

                    // biome-ignore lint/performance/noDelete: necessary evil to prevent JS warnings
                    delete props.indeterminate;

                    const handleChange = (checked: boolean) => {
                      onChange(checked, withShift.current);
                    };

                    return (
                      <Checkbox
                        {...props}
                        onClick={(e) => {
                          withShift.current = e.nativeEvent.shiftKey;
                        }}
                        onCheckedChange={(checked) => {
                          handleChange(!!checked);
                        }}
                      />
                    );
                  },
                }}
              />
              {/* Infinite loading measure ref, which increases until 50 rows */}
              <div
                key={rows.length}
                ref={measureRef}
                className="h-4 w-0 bg-red-700 absolute bottom-0 z-200"
                style={{
                  height: `${Math.min(rows.length, 200) * 0.25 * rowHeight}px`,
                  maxHeight: `${rowHeight * limit}px`,
                }}
              />
              {/* Can load more, but offline */}
              {!isOnline && !!totalCount && totalCount > rows.length && (
                <div className="w-full mt-4 italic text-muted text-sm text-center">{t('common:offline.load_more')}</div>
              )}
              {/* Loading */}
              {isFetching && totalCount && totalCount > rows.length && !error && (
                <div className="flex space-x-1 justify-center items-center relative top-4 h-0 w-full animate-pulse">
                  <span className="sr-only">Loading...</span>
                  <div className="h-1 w-3 bg-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="h-1 w-3 bg-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="h-1 w-3 bg-foreground rounded-full animate-bounce" />
                </div>
              )}
              {/* All is loaded */}
              {!isFetching && !error && !!totalCount && totalCount <= rows.length && (
                <div className="opacity-50 w-full text-xl  mt-4 text-center">
                  <div>&#183;</div>
                  <div className="-mt-5">&#183;</div>
                  <div className="-mt-5">&#183;</div>
                  <div className="-mt-3">&#176;</div>
                </div>
              )}
              {/* Error */}
              {error && <div className="text-center my-8 text-sm text-red-500">{t('error:load_more_failed')}</div>}
            </div>
          )}
        </>
      ) : (
        <DataTableSkeleton cellsWidths={['3rem', '10rem', '4rem']} cellHeight={Number(rowHeight)} columnCount={columns.length} />
      )}
    </div>
  );
};

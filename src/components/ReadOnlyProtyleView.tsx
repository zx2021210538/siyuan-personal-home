import React, { useEffect, useRef, useState } from 'react';

export interface ProtyleInstanceLike {
  disable?: () => void;
  destroy?: () => void;
  resize?: () => void;
}

export type ProtyleMountFn = (
  container: HTMLElement,
  docId: string,
  onReady: () => void,
) => ProtyleInstanceLike | null | undefined;

export interface ReadOnlyProtyleViewProps {
  docId: string;
  mountProtyle?: ProtyleMountFn;
  fallbackSnippet?: string;
  refreshNonce?: number;
  heightClass?: string;
}

export const ReadOnlyProtyleView: React.FC<ReadOnlyProtyleViewProps> = ({
  docId,
  mountProtyle,
  fallbackSnippet,
  refreshNonce = 0,
  heightClass = 'h-[360px]',
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(!mountProtyle);
  const [mountError, setMountError] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!mountProtyle || !el || !docId) {
      setReady(true);
      setMountError(false);
      return;
    }

    let disposed = false;
    let instance: ProtyleInstanceLike | null | undefined;
    setReady(false);
    setMountError(false);
    el.innerHTML = '';

    const fallbackTimer = setTimeout(() => {
      if (!disposed) {
        setReady(true);
      }
    }, 4000);

    try {
      instance = mountProtyle(el, docId, () => {
        if (disposed) return;
        clearTimeout(fallbackTimer);
        try {
          instance?.disable?.();
        } catch {
          // ignore
        }
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            if (!disposed) {
              try {
                instance?.disable?.();
              } catch {
                // ignore
              }
            }
          });
        }
        setReady(true);
      });
      try {
        instance?.disable?.();
      } catch {
        // ignore
      }
    } catch {
      clearTimeout(fallbackTimer);
      if (!disposed) {
        setMountError(true);
        setReady(true);
      }
    }

    return () => {
      disposed = true;
      clearTimeout(fallbackTimer);
      try {
        instance?.destroy?.();
      } catch {
        // ignore destroy errors on rapid switch
      }
      el.innerHTML = '';
    };
  }, [docId, mountProtyle, refreshNonce]);

  if (!mountProtyle || mountError) {
    return (
      <div
        data-testid="readonly-protyle-fallback"
        className="rounded-xl px-4 py-3.5 text-[14px] leading-[1.85]"
        style={{
          backgroundColor: 'var(--sph-card)',
          border: '1px solid var(--sph-hairline)',
          color: 'var(--sph-muted)',
        }}
      >
        {fallbackSnippet || '日记已建好，点击「进入编辑」查看或记录内容…'}
      </div>
    );
  }

  return (
    <div
      data-testid="readonly-protyle-view"
      className={`sph-protyle-host ${heightClass}`}
      onBeforeInput={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <div ref={hostRef} className="sph-protyle-mount" />
      {!ready && (
        <div className="sph-protyle-loading" aria-live="polite">
          正在渲染日记原文…
        </div>
      )}
    </div>
  );
};

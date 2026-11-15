import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import raw from '../../public/marswalk/panorama.json';
import InfoMark from '../design/InfoMark';
import { Icon } from '../design/icons';

interface PanoramaFile { title: string; credit: string; page_url: string; url: string; widthPx: number; heightPx: number; note: string }
const PANORAMA = raw as { shows: string; credit: string; licenceNote: string; files: PanoramaFile[] };
const bySize = [...PANORAMA.files].sort((a, b) => a.widthPx - b.widthPx);
const small = bySize[0], large = bySize.at(-1)!;

export const PANORAMA_TITLE = 'Ground view of the ridges, real photo by the Curiosity rover';

/** The Curiosity Mastcam panorama, shown as it is (no tint). The large file loads only when opened full size. */
export default function GroundPanorama() {
  const [full, setFull] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null), opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!full) return;
    closeButton.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setFull(false); } };
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); opener.current?.focus(); };
  }, [full]);
  const credit = <>Credit: {PANORAMA.credit}. {small.title}. <a href={small.page_url} target="_blank" rel="noreferrer">NASA page ↗</a></>;
  return <div className="wall-label closer-panorama">
    <h2>{PANORAMA_TITLE} <InfoMark title="Curiosity ground panorama" does={PANORAMA.shows} source={<>{small.title}, {PANORAMA.credit}. {PANORAMA.licenceNote}</>} coverage="A photo taken from the ground. It is not placed on the map grid, so its directions are not matched to the map." /></h2>
    <figure>
      <img src={small.url} width={small.widthPx} height={small.heightPx} alt="Curiosity's 360-degree view of the boxwork ridges and hollows at Mount Sharp, Mars" loading="lazy" />
      <figcaption className="caption">{credit} Resized only, colours as published.</figcaption>
    </figure>
    <button ref={opener} type="button" className="secondary" onClick={() => setFull(true)}><Icon name="look" />Open full size ({large.widthPx} px)</button>
    {full && createPortal(<div className="panorama-full" role="dialog" aria-modal="true" aria-label={PANORAMA_TITLE}>
      <div className="panorama-full__bar"><strong>{PANORAMA_TITLE}</strong><button ref={closeButton} type="button" className="secondary" onClick={() => setFull(false)}>Close <kbd>Esc</kbd></button></div>
      <div className="panorama-full__scroll" tabIndex={0} aria-label="Scroll the panorama sideways">
        <img src={large.url} width={large.widthPx} height={large.heightPx} alt="Curiosity's 360-degree view of the boxwork ridges and hollows, full size" />
      </div>
      <p className="caption">{credit} Scroll sideways to turn around.</p>
    </div>, document.body)}
  </div>;
}

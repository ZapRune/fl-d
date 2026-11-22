import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { LandingGlobe } from './landingGlobe';
import { RegionInset } from '../earth/RegionInset';
import { HOUSTON } from '../earth/zones';
import { Icon } from '../../app/Icon';
import '@fontsource-variable/source-sans-3';
import '@fontsource/baskervville/400.css';
import './landing.css';
import HowItWorks from './HowItWorks';
import EvidenceDiagram from './EvidenceDiagram';

const Galaxy = lazy(() => import('./react-bits/Galaxy'));
const PixelTrail = lazy(() => import('./react-bits/PixelTrail'));

export default function Landing({ chooseArea = false, onCloseChooser }: { chooseArea?: boolean; onCloseChooser?: () => void }) {
  const [showHow, setShowHow] = useState(false);
  const [showPixels] = useState(() => window.matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches);
  const how = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (showHow && !how.current?.open) how.current?.showModal(); else if (!showHow && how.current?.open) how.current.close(); syncScene.current?.(); }, [showHow]);
  const [preview, setPreview] = useState(HOUSTON.zones[0]);
  const chooser = useRef<HTMLDialogElement>(null);
  const syncScene = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (chooseArea && !chooser.current?.open) chooser.current?.showModal();
    else if (!chooseArea && chooser.current?.open) chooser.current.close();
    syncScene.current?.();
  }, [chooseArea]);
  const scroller = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [spaceActive, setSpaceActive] = useState(false);
  useEffect(() => {
    const root = scroller.current!, visual = stage.current!, mount = canvas.current!;
    let globe: LandingGlobe | undefined;
    let importing = false;
    let disposed = false;
    let unavailable = false;
    let visible = false;
    let progress = 0;
    let globeReady = false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const space = root.querySelector<HTMLElement>('#landing-space-chapter')!;
    const orbit = root.querySelector<HTMLElement>('#landing-earth')!;
    const houston = root.querySelector<HTMLElement>('#landing-houston')!;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));

    const fail = () => {
      if (disposed) return;
      unavailable = true;
      globeReady = false;
      setFailed(true);
      update();
      // Cesium can report an error during a draw. Release its resources after that draw exits.
      queueMicrotask(() => {
        if (disposed) return;
        globe?.destroy();
        globe = undefined;
        mount.replaceChildren();
      });
    };
    const update = () => {
      const scroll = root.scrollTop;
      const spaceHeight = Math.max(1, orbit.offsetTop - space.offsetTop);
      const spaceProgress = (scroll - space.offsetTop) / spaceHeight;
      // Keep the entire planet in view as it fades in, then start the trip to Houston.
      const descentStart = orbit.offsetTop + root.clientHeight * 0.55;
      const descent = clamp((scroll - descentStart) / Math.max(1, houston.offsetTop - descentStart));
      progress = 0.36 + 0.55 * descent;

      // Keep the same starfield behind the transparent globe through the descent.
      const spaceOpacity = clamp((spaceProgress + 0.22) / 0.22);
      // Finish the fade by the time the orbit chapter reaches the top of the screen.
      const reveal = clamp((spaceProgress - 0.6) / 0.4);
      const earthOpacity = reveal * reveal * (3 - 2 * reveal);
      const fallbackOpacity = unavailable ? earthOpacity * descent : 0;
      visual.style.setProperty('--intro-map-opacity', String(.19 * (1 - clamp((spaceProgress + 0.44) / 0.22))));
      visual.style.setProperty('--earth-opacity', String(globeReady ? earthOpacity : 0));
      visual.style.setProperty('--earth-poster-opacity', String(globeReady ? 0 : earthOpacity - fallbackOpacity));
      visual.style.setProperty('--earth-fallback-opacity', String(fallbackOpacity));
      visual.style.setProperty('--space-opacity', String(spaceOpacity));

      const sceneOpen = !chooser.current?.open && !how.current?.open && !document.hidden;
      // Warm the renderer during the starfield-only stretch.
      visible = sceneOpen && spaceProgress >= 0.12;
      setSpaceActive(sceneOpen && !motion.matches && spaceOpacity > 0);
      if (unavailable) return;
      if (globe) {
        globe.update(progress, visible);
      } else if (visible && !importing) {
        importing = true;
        import('./landingGlobe').then(({ createLandingGlobe }) => {
          importing = false;
          if (disposed || !visible) return;
          globe = createLandingGlobe(mount, progress, fail, () => { globeReady = true; update(); });
        }).catch(fail);
      }
    };
    syncScene.current = update;
    root.addEventListener('scroll', update, { passive: true });
    document.addEventListener('visibilitychange', update);
    motion.addEventListener('change', update);
    const observer = new ResizeObserver(update); observer.observe(root);
    update();
    return () => {
      disposed = true;
      syncScene.current = null;
      root.removeEventListener('scroll', update);
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener('change', update);
      observer.disconnect();
      globe?.destroy();
    };
  }, []);
  useEffect(() => {
    if (typeof AudioContext === 'undefined') return;
    const journeySound = new AudioContext();
    const unlock = () => {
      if (journeySound.state === 'suspended') void journeySound.resume().catch(() => {});
    };
    const root = scroller.current!;
    let lastPosition = root.scrollTop;
    let lastMove = performance.now();
    let idle: ReturnType<typeof setTimeout>;
    const tone = journeySound.createOscillator();
    tone.type = 'sine';
    tone.frequency.value = 160;
    const gain = journeySound.createGain();
    gain.gain.value = 0;
    tone.connect(gain).connect(journeySound.destination);
    tone.start();
    const fade = () => gain.gain.setTargetAtTime(0, journeySound.currentTime, 0.055);
    const onScroll = () => {
      const position = root.scrollTop;
      const distance = Math.abs(position - lastPosition);
      lastPosition = position;
      if (!distance || document.hidden || chooser.current?.open) return;
      if (journeySound.state !== 'running') return;
      const now = performance.now();
      const speed = Math.min(1, distance / Math.max(8, now - lastMove));
      lastMove = now;
      const progress = Math.max(0, Math.min(1, position / Math.max(1, root.scrollHeight - root.clientHeight)));
      const time = journeySound.currentTime;
      // Absolute scroll depth makes reversals glide back along the same pitch curve.
      tone.frequency.setTargetAtTime(160 + 16 * progress, time, 0.085);
      gain.gain.setTargetAtTime(0.012 + speed * 0.008, time, 0.065);
      clearTimeout(idle);
      idle = setTimeout(fade, 135);
    };
    const gestures = ['pointerdown', 'pointerup', 'click', 'keydown'] as const;
    gestures.forEach(event => root.addEventListener(event, unlock, { capture: true, passive: true }));
    root.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', fade);
    return () => {
      clearTimeout(idle);
      gestures.forEach(event => root.removeEventListener(event, unlock, true));
      root.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', fade);
      tone.stop();
      gain.disconnect();
      void journeySound.close();
    };
  }, []);
  const beginJourney = () => {
    const root = scroller.current;
    if (!root) return;
    root.scrollTo({
      top: document.getElementById('landing-space-chapter')?.offsetTop ?? root.clientHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
  return <div className="landing" ref={scroller}>
    <a className="landing-skip" href="#/simulate">Skip introduction and open flŭd</a>
    <header className="landing-header">
      <a href="#/" className="landing-brand" aria-label="flŭd home"><img className="flud-mark" src={`${import.meta.env.BASE_URL}flud-logo.png`} width={32} height={32} alt="" />flŭd</a>
      <button type="button" className="landing-how" onClick={() => setShowHow(true)}>How it works</button>
      <a href="#/simulate" className="landing-open">Choose an area <Icon name="arrow" size={16} /></a>
    </header>
    <div className="landing-visual" ref={stage}>
      <div className="landing-stars" />
      {spaceActive && <div className="landing-space" aria-hidden="true"><Suspense fallback={null}>
        <Galaxy density={0.8} starSize={0.85} starSpeed={0.24} speed={0.45} glowIntensity={0.19}
          starColors={['#b7d3ed', '#e5edf6', '#95d1cf']} rotationSpeed={0.03}
          mouseInteraction={false} clickWarp={false} intro={false} dpr={1} />
      </Suspense></div>}
      {showPixels && <div className="landing-pixels"><Suspense fallback={null}><PixelTrail gridSize={90} trailSize={0.14} maxAge={150} color="#91b4d3" decay="dither" shine={0} glow={0} /></Suspense></div>}
      <div className="landing-earth-poster" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}map/earth-reveal.png`} alt="" fetchPriority="low" />
        <span>Natural Earth II · public-domain cartography</span>
      </div>
      <div className="landing-earth" ref={canvas} aria-hidden="true" />
      {failed && <div className="landing-fallback" />}
      <div className="landing-shade" />

    </div>
    <main className="landing-story">
      <section className="landing-chapter landing-intro">
        <div className="landing-copy">
          <p className="landing-location">Houston flood simulator</p>
          <h1>When Houston floods, what gets cut off?</h1>
          <p>Explore how a storm could disrupt streets, hospital access, and the places Houston depends on.</p>
          <div className="landing-actions">
            <a href="#/simulate" className="landing-primary">Start a simulation <Icon name="arrow" size={18} /></a>
            <button type="button" className="landing-text-link" onClick={beginJourney}>Explore Houston <Icon name="down" size={15} /></button>
          </div>
        </div>
        <EvidenceDiagram />
      </section>
      <div id="landing-space-chapter" className="landing-space-chapter" aria-hidden="true" />
      <section id="landing-earth" className="landing-chapter landing-orbit"><div className="landing-copy"><h2>One planet.<br />Our corner of it.</h2><p>Start with Earth. Follow the Gulf Coast to the bayous, neighborhoods and streets of Houston.</p><button className="landing-text-link" onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>Continue down to Houston <Icon name="down" size={15} /></button></div></section>
      <section id="landing-houston" className="landing-chapter landing-houston"><div className="landing-copy"><h2>Down to<br />street level.</h2><p>Change a storm. Compare its modeled impact. Trace a route through the scenario.</p><a className="landing-primary" href="#/simulate">Open flŭd <Icon name="arrow" size={18} /></a><small>Exploratory scenarios, not live emergency guidance.</small></div></section>
    </main>
    <dialog className="area-chooser" ref={chooser} aria-labelledby="area-title" onCancel={onCloseChooser}>
      <div className="area-heading"><div><h2 id="area-title">Choose a Houston study area</h2><p>Open a map to explore a storm, trace a trip, or compare relief priorities.</p></div><button type="button" onClick={onCloseChooser} aria-label="Close area selection">Close</button></div>
      <div className="area-spread">
        <div className="area-preview">
          <RegionInset region={HOUSTON} highlighted={preview.id} zoneHref={id => `#/zone/${id}`} onPreview={id => {
            const area = HOUSTON.zones.find(zone => zone.id === id);
            if (area) setPreview(area);
          }} />
          <div className="area-caption"><strong>{preview.name}</strong><p>{preview.summary}</p></div>
        </div>
        <nav aria-label="Houston simulation areas">
          {HOUSTON.zones.map((area, index) => <a key={area.id} href={`#/zone/${area.id}`}
            data-preview={preview.id === area.id} onFocus={() => setPreview(area)} onMouseEnter={() => setPreview(area)}>
            <span className="area-key" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
            <span><strong>{area.name}</strong><small>{area.area}</small><small className="area-row-summary">{area.summary}</small></span><Icon name="arrow" size={16} />
          </a>)}
        </nav>
      </div>
    </dialog>
    <dialog className="how-dialog" ref={how} aria-label="How flŭd works" onCancel={() => setShowHow(false)} onClose={() => setShowHow(false)}><HowItWorks onClose={() => setShowHow(false)} /></dialog>
    <footer className="landing-footer"><span>Houston, Texas · 29.76° N / 95.37° W</span><span>Satellite: Esri & contributors · Houston: USDA / USGS</span></footer>
  </div>;
}

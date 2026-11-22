import { useState } from 'react';

const topics = [
  ['Rainfall', 'Heavy rain can overwhelm drainage before a bayou overtops.', 'Vary rainfall intensity and duration to see which streets and buildings are exposed.'],
  ['Elevation', 'Low spots and underpasses can collect runoff even away from a channel.', 'USGS elevation helps flŭd estimate terrain depressions and the direction runoff can take.'],
  ['Roads', 'Flooding on a few links can disconnect streets that are themselves dry.', 'Compare the same trip in dry weather and under a modeled storm, and examine which road segments close.'],
  ['Hospitals', 'Flooded approaches can delay staff, patients and emergency vehicles even if a facility stays open.', 'Choose a hospital to see how the modeled road network changes its reach across the study area.'],
  ['Bayous', 'Rain can raise bayou levels and concentrate runoff in downstream neighborhoods.', 'Draw a storm footprint and inspect terrain-based runoff paths. Channel hydraulics are outside the model.'],
  ['Buildings', 'Water can enter low-lying homes, damage property and interrupt services.', 'Inspect modeled water at building footprints and compare exposure with census-tract vulnerability.'],
  ['Drainage', 'Blocked drains and high downstream water can reduce the system’s ability to remove runoff.', 'Change the assumed drain blockage or compare hypothetical drainage and pumping projects on selected roads.'],
  ['Storm presets', 'Houston storms vary in intensity, duration and coastal surge.', 'Use illustrative presets to compare storm conditions. Historical events provide context for the presets.'],
] as const;

function point(index: number, radius: number) {
  const angle = index * Math.PI / 4 - Math.PI / 2;
  return [300 + Math.cos(angle) * radius, 300 + Math.sin(angle) * radius];
}

export default function EvidenceDiagram() {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = hovered ?? focused ?? selected;
  const topic = active === null ? null : topics[active];

  return <section className="landing-diagram" aria-label="What shapes a Houston flood scenario">
    <div className="diagram-field">
      <div className="diagram-plot">
      <svg viewBox="0 0 600 600" aria-hidden="true">
        {[50, 95, 140, 185].map(radius => <polygon key={radius} points={topics.map((_, index) => point(index, radius).join(',')).join(' ')} />)}
        {topics.map(([label], index) => {
          const [x, y] = point(index, 185);
          const [nodeX, nodeY] = point(index, 140);
          return <g key={label} className={active === index ? 'diagram-active' : undefined}>
            <line x1="300" y1="300" x2={x} y2={y} />
            <circle className="diagram-node" style={{ animationDelay: `${index * 0.35}s` }} cx={nodeX} cy={nodeY} r="4" />
          </g>;
        })}
        <circle className="landing-diagram-core" cx="300" cy="300" r="8" />
      </svg>
      {topics.map(([label], index) => {
        const [x, y] = point(index, 235);
        return <button key={label} type="button" className="diagram-topic"
          style={{ left: `${x / 6}%`, top: `${y / 6}%` }} aria-pressed={selected === index}
          aria-controls="diagram-detail" aria-describedby={active === index ? 'diagram-detail' : undefined}
          onPointerEnter={event => {
            if (event.pointerType !== 'mouse') return;
            setSelected(null);
            setFocused(null);
            setHovered(index);
          }}
          onPointerLeave={() => setHovered(null)}
          onFocus={event => {
            if (event.currentTarget.matches(':focus-visible')) setFocused(index);
          }} onBlur={() => setFocused(null)}
          onClick={event => {
            if (event.nativeEvent instanceof PointerEvent && ['touch', 'pen'].includes(event.nativeEvent.pointerType)) {
              setSelected(current => current === index ? null : index);
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setSelected(null);
              setHovered(null);
              setFocused(null);
            }
          }}>{label}</button>;
      })}
      </div>
      <div className="diagram-detail" id="diagram-detail" hidden={!topic}>
        {topic && <>
          <h2>{topic[0]}</h2>
          <p><strong>Houston impact</strong> {topic[1]}</p>
          <p><strong>Explore with flŭd</strong> {topic[2]}</p>
        </>}
      </div>
    </div>
    <p className="diagram-caption">Explore the inputs and impacts <span>· Illustrative diagram</span></p>
  </section>;
}

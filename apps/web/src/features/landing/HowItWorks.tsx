import './how-it-works.css';

type ChartRow = { label: string; value: number; unit?: string };

function BarChart({ title, rows, scale, note }: {
  title: string;
  rows: ChartRow[];
  scale: number;
  note: string;
}) {
  return <figure className="how-chart">
    <figcaption>{title}</figcaption>
    {rows.map(({ label, value, unit }) => <div className="how-bar" key={label}>
      <span>{label}</span>
      <div className="how-bar-track" aria-hidden="true"><i style={{ width: `${value / scale * 100}%` }} /></div>
      <strong>{value}{unit && ` ${unit}`}</strong>
    </div>)}
    <small>{note}</small>
  </figure>;
}

export default function HowItWorks({ onClose }: { onClose: () => void }) {
  return <article className="how-paper">
    <header className="how-masthead"><span>flŭd / Houston</span><span>Research &amp; methods</span><button type="button" onClick={onClose}>Close ×</button></header>
    <div className="how-title"><p>THE HOUSTON RESILIENCE PROJECT</p><h1>How it works.</h1><p>From a storm on a screen to a clearer picture of the streets and services that connect us.</p></div>
    <nav className="how-ticker how-contents" aria-label="In this article">
      {[['mission', 'Our mission'], ['pipeline', 'Data and model'], ['decisions', 'Routing and relief'],
        ['harvey', 'Houston research'], ['evidence', 'Reading the evidence']].map(([id, label]) =>
        <button type="button" key={id} onClick={() => {
          const section = document.getElementById(`methods-${id}`);
          section?.focus({ preventScroll: true });
          section?.scrollIntoView({ block: 'start' });
        }}>{label}</button>)}
    </nav>
    <section className="how-section" id="methods-mission" tabIndex={-1}><h2>Why we built flŭd</h2><div className="how-columns">
      <div><p className="how-drop">Flooding changes the rhythm of Houston. When roads are underwater and infrastructure is disrupted, a trip to school, a hospital, or a neighbor can become uncertain.</p><p>We built flŭd to make those connections visible. A student, planner, or curious resident can explore a hypothetical storm and see how the effects reach beyond the water itself.</p></div>
      <div><p>Our mission is personal: Houston flooding affects the routes and places our communities depend on, including the ability to get to school. We want to make the problem easier to understand and discuss.</p><p><strong>Sparshdeep Singh</strong> is a freshman at Texas A&amp;M University. <strong>Aaron Qin</strong> is a junior at Westside High School.</p></div>
      <figure className="how-flow"><figcaption>FIGURE 01 / A connected city</figcaption><div><span>Rain &amp; surge</span><b>↓</b><span>Roads &amp; buildings</span><b>↓</b><span>Access &amp; community</span></div><small>An illustrative chain of effects, not a forecast.</small></figure>
    </div></section>
    <section className="how-section" id="methods-pipeline" tabIndex={-1}><h2>What powers the map?</h2><div className="how-columns">
      <div><h3>01 / The landscape</h3><p>USGS 3DEP elevation is processed into terrain and drainage features. Road and building geometry comes from Overture Maps. The globe uses CesiumJS; Cesium ion or Google photorealistic tiles are optional display layers, not sources for the flood model.</p></div>
      <div><h3>02 / The model</h3><p>A process-based simulator generates depths for synthetic storms. An XGBoost surrogate learns to reproduce those depths for a region’s roads, buildings and ground cells. The previous training protocol used about 838 training storms and 162 validation storms per region.</p><p>Performance measures agreement with the simulator, not independently validated accuracy against real floods.</p></div>
      <BarChart title="Previous training split per region" rows={[{ label: 'Training', value: 838 }, { label: 'Validation', value: 162 }]}
        scale={1000} note="Approximate counts from the project’s storm-level training split and validation run." />
    </div></section>
    <section className="how-section" id="methods-decisions" tabIndex={-1}><h2>From depth to decisions</h2><div className="how-columns"><div><h3>03 / The network</h3><p>Roads above a chosen vehicle’s depth threshold are treated as impassable. NetworkX and SciPy calculate hypothetical routes and access to a selected hospital on the mapped road network.</p><BarChart title="Assumed vehicle thresholds" rows={[
      { label: 'Car', value: 15, unit: 'cm' }, { label: 'Ambulance', value: 30, unit: 'cm' },
      { label: 'Rescue', value: 75, unit: 'cm' },
    ]} scale={75} note="These illustrative thresholds define modeled closures. Actual passability depends on conditions and equipment." /></div><div><h3>04 / The community</h3><p>Relief comparisons combine modeled building exposure with census population and CDC Social Vulnerability Index measures. Residents are distributed evenly across mapped buildings within each tract, so counts are proxies.</p></div><div className="how-note"><strong>Read this map carefully.</strong><p>These are exploratory scenarios, not live conditions, validated flood forecasts, safe routes, or a needs assessment. Verify decisions with local authorities and community organizations.</p></div></div></section>
    <section className="how-section" id="methods-harvey" tabIndex={-1}>
      <h2>What Houston learned from Harvey</h2>
      <div className="how-columns how-research">
        <div>
          <h3>School access and recovery</h3>
          <p>The City of Houston reported that Harvey damaged several Houston ISD schools. Some closed for the year, affecting 6,500 students. A separate NIST recovery study describes how schools were assessed and reopened. These records motivate the project’s focus on everyday trips and the infrastructure they depend on.</p>
          <a href="https://houstontx.gov/hcdrecovery/dr17/hud-reports/community/Outreach-and-Marketing-Plan-0519.pdf">City of Houston · Hurricane Harvey impacts</a>
          <a href="https://www.govinfo.gov/content/pkg/GOVPUB-C13-72f6522520195176e908cf200a084428/pdf/GOVPUB-C13-72f6522520195176e908cf200a084428.pdf">NIST · Critical Path Method Assessment of Community Recovery</a>
        </div>
        <div>
          <h3>Roads fail as a network</h3>
          <p>Researchers studying Harris County after Harvey distinguished direct inundation, storm-related slowdowns and isolation from the remaining network. That last mechanism matters for flŭd: the road in front of a building can be dry while every modeled route to a service is disrupted.</p>
          <a href="https://www.nature.com/articles/s43247-022-00366-0">Communications Earth &amp; Environment · Compound road-network failure</a>
        </div>
        <div>
          <h3>Hospital access can change first</h3>
          <p>A retrospective study of one Houston emergency department reported five days of limited access due to flooding, with effects on staffing, discharges and transfers. flŭd models the road-access part of that problem. Staffing and clinical capacity are outside its scope.</p>
          <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7234707/">Western Journal of Emergency Medicine · Emergency department operations during Harvey</a>
        </div>
      </div>
    </section>
    <section className="how-section" id="methods-evidence" tabIndex={-1}>
      <h2>How to read the evidence</h2>
      <div className="how-columns how-research">
        <div><h3>Terrain and storm assumptions</h3><p>Elevation features describe low points, terrain drainage and coastal connectivity. The process simulator combines those features with rainfall, duration, surge and assumed drain blockage. Moving the user’s storm track changes the rainfall footprint and the terrain runoff paths. CesiumJS handles the globe presentation.</p><a href="https://www.usgs.gov/3d-elevation-program">USGS · 3D Elevation Program</a></div>
        <div><h3>Training and evaluation</h3><p>XGBoost fits an ensemble of trees to synthetic depth labels. The training split groups rows by storm. New runs reserve distinct storm groups for fitting, early stopping, and final evaluation. They compare the surrogate’s mean absolute error against the training median. Older runs report validation scores from early stopping. Independent validation would require observed flood depths, closure records and separate events.</p><a href="https://arxiv.org/abs/1603.02754">Chen and Guestrin · XGBoost</a></div>
        <div><h3>Routing and intervention</h3><p>The engine snaps trip endpoints to road nodes and compares dry and flooded paths on the same vehicle-specific graph. The distance from each pin to its road node is shown separately. Hospital reach remains an independent network calculation. Relief uses tract indicators and building exposure to support a planning discussion.</p><a href="https://atsdr.cdc.gov/community-stress-resource-center/php/resources/social-vulnerability-index.html">CDC/ATSDR · Social Vulnerability Index</a></div>
      </div>
    </section>
    <footer className="how-footer"><span>flŭd / Flood impact &amp; community resilience</span><span>Data: USGS · Overture Maps · CDC/ATSDR · ACS</span></footer>
  </article>;
}

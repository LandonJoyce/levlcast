/**
 * A sample free report, drawn in the homepage's corner-marked frame. Used
 * on the VOD analyzer page so people can see what comes back before they
 * paste anything. Styled by the "Sample report" rules in home-ranked.css.
 */
export default function ExampleReport() {
  return (
    <aside className="v3-frame xr" aria-label="A free report">
      <div className="v3-result-top">
        <span>Free report</span>
        <span>First 12 min</span>
      </div>
      <div className="xr-score">
        <span className="xr-num">68</span>
        <span className="xr-k">Opening score</span>
      </div>
      <div className="xr-row">
        <p className="xr-k">Fix this first</p>
        <p className="xr-text">
          Say what today&apos;s stream is in the first minute. It took four minutes before chat could tell.
        </p>
      </div>
      <div className="xr-row">
        <p className="xr-k">Clip these</p>
        <ul className="xr-clips">
          <li>
            <span>4:12</span>The jump you missed three times
          </li>
          <li>
            <span>9:47</span>Chat roasting your aim
          </li>
        </ul>
      </div>
    </aside>
  );
}
